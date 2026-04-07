/**
 * Transcribe Audio handler -- migrated from api/ai.ts to use AI SDK.
 *
 * Two-step pipeline:
 * 1. experimental_transcribe via @ai-sdk/openai (targeted exception: Vercel AI Gateway
 *    does not support transcription models, so @ai-sdk/openai is used specifically for
 *    this call only; all other calls continue through the gateway).
 * 2. generateText via gateway (openai/gpt-4o-mini) to summarize the transcript.
 *
 * Preserves identical response shape: { transcription: { text, summary, keyPoints } }
 */

import { generateText, experimental_transcribe } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../middleware/index.js';
import { mapUsageToTracking } from './utils/tokenTracking.js';

/**
 * Resolves an audioUrl input into an absolute URL that fetch() can consume.
 *
 * The client (AIIdeaModal) may pass either:
 *   - an absolute http(s) URL (publicUrl/public_url), or
 *   - a Supabase Storage object path (storage_path, e.g. `projects/<id>/files/<name>.webm`)
 *     when the bucket is private and no public URL exists.
 *
 * For storage paths, we mint a short-lived signed URL via the service-role client.
 * The bucket is `project-files` to match analyzeFile.ts conventions.
 */
async function resolveAudioUrl(audioUrl: string): Promise<string> {
  if (/^https?:\/\//i.test(audioUrl)) {
    return audioUrl;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured for storage path resolution');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.storage
    .from('project-files')
    .createSignedUrl(audioUrl, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL for storage path: ${error?.message || 'unknown error'}`);
  }

  return data.signedUrl;
}

/**
 * Handles the transcribe-audio action.
 *
 * Downloads the audio from the provided URL, transcribes it via Whisper
 * (experimental_transcribe with @ai-sdk/openai targeted exception), then
 * summarizes the transcript via generateText with gpt-4o-mini through the
 * AI Gateway.
 */
export async function handleTranscribeAudio(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const { audioUrl, projectContext, language = 'en' } = req.body;

    if (!audioUrl) {
      return res.status(400).json({ error: 'Audio URL is required' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(500).json({ error: 'No AI service configured' });
    }

    console.log('Transcribing audio:', audioUrl.substring(0, 100) + '...');

    // Resolve storage paths to signed URLs; pass absolute URLs through unchanged.
    const resolvedAudioUrl = await resolveAudioUrl(audioUrl);

    // Download audio file
    const audioResponse = await fetch(resolvedAudioUrl);
    if (!audioResponse.ok) {
      return res.status(400).json({ error: `Failed to download audio: ${audioResponse.status}` });
    }

    const audioBuffer = await audioResponse.arrayBuffer();

    // Step 1: Whisper transcription via AI SDK experimental_transcribe
    // Targeted exception: @ai-sdk/openai used directly because Vercel AI Gateway
    // does not support transcription models. All other AI calls go through gateway.
    const openai = createOpenAI({ apiKey: openaiKey });
    const transcriptionModel = openai.transcription('whisper-1');

    const transcriptionResult = await experimental_transcribe({
      model: transcriptionModel,
      audio: new Uint8Array(audioBuffer),
    });

    const transcriptText = transcriptionResult.text || '';
    console.log('Transcription complete, length:', transcriptText.length);

    // For short transcriptions, skip the summary step
    if (transcriptText.length < 50) {
      return res.status(200).json({
        transcription: {
          text: transcriptText,
          summary: transcriptText,
          keyPoints: [],
          language,
          duration: null,
        },
      });
    }

    // Step 2: Summarize transcript via generateText (gpt-4o-mini for cost efficiency).
    // Bypasses the Vercel AI Gateway and reuses the @ai-sdk/openai provider created
    // above for Whisper, calling OpenAI directly with OPENAI_API_KEY. Avoids the
    // AI_GATEWAY_API_KEY requirement for this endpoint.
    const summaryModel = openai('gpt-4o-mini');

    const projectInfo = projectContext
      ? `\n\nProject: ${projectContext.projectName || 'Unknown'}\nType: ${projectContext.projectType || 'General'}`
      : '';

    const summaryPrompt = `You are analyzing a transcribed audio recording for a project team.${projectInfo}

Transcription:
"${transcriptText}"

Provide a concise analysis with:
1. Summary: A 2-3 sentence summary of what was discussed
2. Key points: The 3-5 most important points mentioned

Return as JSON: { "summary": "...", "keyPoints": ["point1", "point2", ...] }`;

    const { text: summaryText, usage } = await generateText({
      model: summaryModel,
      prompt: summaryPrompt,
      maxOutputTokens: 500,
    });

    const tracking = mapUsageToTracking(usage as any);
    console.log('Summary generated, tokens used:', tracking.total_tokens);

    // Parse summary response
    let summary = summaryText;
    let keyPoints: string[] = [];

    try {
      const parsed = JSON.parse(summaryText.trim()) as { summary?: string; keyPoints?: string[] };
      summary = parsed.summary || summaryText;
      keyPoints = parsed.keyPoints || [];
    } catch (_parseError) {
      // If not valid JSON, extract key points from plain text
      summary = summaryText.substring(0, 300);
      keyPoints = extractKeyPoints(summaryText);
    }

    return res.status(200).json({
      transcription: {
        text: transcriptText,
        summary,
        keyPoints,
        language,
        duration: null,
      },
    });

  } catch (error) {
    console.error('Audio transcription error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    // TEMP: surface debug in prod for diagnosis — strip after fix verified.
    return res.status(500).json({
      error: 'Failed to transcribe audio',
      debug: { message, stack, name: (error as any)?.name },
    });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts key points from plain-text summary when JSON parsing fails.
 */
function extractKeyPoints(text: string): string[] {
  const lines = text.split('\n').filter(line => line.trim().length > 10);
  const bulletLines = lines.filter(line =>
    line.trim().startsWith('•') ||
    line.trim().startsWith('-') ||
    line.trim().match(/^\d+\./)
  );

  if (bulletLines.length > 0) {
    return bulletLines.slice(0, 5).map(line =>
      line.replace(/^[\s•\-\d.]+/, '').trim()
    );
  }

  // Fall back to first few sentences
  return lines.slice(0, 3).map(line => line.trim());
}
