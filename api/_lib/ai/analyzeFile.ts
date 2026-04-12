/**
 * Analyze File handler -- migrated from api/ai.ts to use AI SDK.
 *
 * Replaces raw fetch() to OpenAI APIs with generateText() and
 * experimental_transcribe() via the AI Gateway (and @ai-sdk/openai
 * for transcription). Preserves identical response shape for all
 * three file type paths: image, audio, and text.
 *
 * Contains 4 migrated fetch calls:
 * 1. Image vision analysis (was fetch to chat/completions with gpt-4o)
 * 2. Audio Whisper transcription (was fetch to audio/transcriptions)
 * 3. Audio transcript summary (was fetch to chat/completions with gpt-4o-mini)
 * 4. Text file analysis (was fetch to chat/completions with gpt-4o-mini)
 */

import { generateText, experimental_transcribe } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../middleware/index.js';
import { createClient } from '@supabase/supabase-js';
import { selectModel, getProviderOptions } from './modelRouter.js';
import { getModel } from './providers.js';
import { getActiveProfile } from './modelProfiles.js';
import type { ModelProfile } from './modelProfiles.js';
import { parseJsonResponse } from './utils/parsing.js';
import { mapUsageToTracking } from './utils/tokenTracking.js';

/**
 * Handles the analyze-file action.
 *
 * Fetches file metadata from Supabase, determines file type,
 * and dispatches to the appropriate analysis sub-handler:
 * - Image files: vision analysis via generateText with image content parts
 * - Audio/video files: Whisper transcription + GPT summary (two-step)
 * - Text files: text analysis via generateText with gpt-4o-mini
 */
export async function handleAnalyzeFile(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    console.log('File analysis request:', req.body);

    const { fileId, projectId } = req.body;

    if (!fileId || !projectId) {
      console.error('Missing required fields: fileId or projectId');
      return res.status(400).json({ error: 'File ID and Project ID are required' });
    }

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    // Use service role key if available (bypasses RLS), otherwise use anon key
    const supabaseKey = supabaseServiceKey || supabaseAnonKey;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase configuration missing' });
    }

    console.log('Using Supabase key type:', supabaseServiceKey ? 'service_role (admin)' : 'anon (user)');

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Get the file record with retry logic (handle race conditions)
    let fileRecord = null;
    let fileError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('id', fileId)
        .eq('project_id', projectId)
        .single();

      if (!error && data) {
        fileRecord = data;
        break;
      }

      fileError = error;

      if (attempt < 3) {
        console.log(`File not found on attempt ${attempt}, retrying in ${attempt * 500}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }

    if (fileError || !fileRecord) {
      console.error('File not found after 3 attempts:', fileError);
      return res.status(404).json({ error: 'File not found' });
    }

    console.log('Analyzing file:', fileRecord.name, 'Type:', fileRecord.mime_type);

    // Check if already analyzed
    if (fileRecord.analysis_status === 'completed' && fileRecord.ai_analysis) {
      console.log('File already analyzed, returning cached results');
      return res.status(200).json({
        analysis: fileRecord.ai_analysis,
        cached: true,
      });
    }

    // Update status to analyzing
    await supabase
      .from('project_files')
      .update({ analysis_status: 'analyzing' })
      .eq('id', fileId);

    const openaiKey = process.env.OPENAI_API_KEY;
    console.log('OpenAI key available:', !!openaiKey);

    if (!openaiKey) {
      await supabase
        .from('project_files')
        .update({ analysis_status: 'skipped' })
        .eq('id', fileId);
      return res.status(500).json({ error: 'No AI service configured' });
    }

    // Profile-aware model routing (ADR-0013 Step 3)
    const profile = await getActiveProfile();

    try {
      // Analyze the file based on its type
      const analysis = await analyzeFileContent(
        supabase,
        fileRecord,
        projectId,
        profile,
      );

      // Save analysis results
      console.log('Updating database with analysis results for file:', fileId);
      const { data: updateData, error: updateError } = await supabase
        .from('project_files')
        .update({
          ai_analysis: analysis,
          analysis_status: 'completed',
        })
        .eq('id', fileId)
        .select();

      if (updateError) {
        console.error('Failed to save analysis:', updateError);
        await supabase
          .from('project_files')
          .update({ analysis_status: 'failed' })
          .eq('id', fileId);
        return res.status(500).json({ error: 'Failed to save analysis results' });
      }

      console.log('File analysis completed and saved. Updated record:', updateData);
      return res.status(200).json({ analysis, cached: false });

    } catch (analysisError) {
      console.error('Analysis failed:', analysisError);
      await supabase
        .from('project_files')
        .update({ analysis_status: 'failed' })
        .eq('id', fileId);
      return res.status(500).json({ error: 'Analysis failed' });
    }

  } catch (error) {
    console.error('File analysis error:', error);

    // Update status to failed
    try {
      const { fileId } = req.body;
      if (fileId) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase
            .from('project_files')
            .update({ analysis_status: 'failed' })
            .eq('id', fileId);
        }
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return res.status(500).json({ error: 'Failed to analyze file' });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function analyzeFileContent(
  supabase: any,
  fileRecord: any,
  _projectId: string,
  profile?: ModelProfile | null,
) {
  const mimeType = fileRecord.mime_type;
  const fileName = fileRecord.name;

  console.log('Analyzing file type:', mimeType, 'for file:', fileName);

  let analysis = {
    summary: '',
    key_insights: [] as string[],
    extracted_text: '',
    visual_description: '',
    audio_transcript: '',
    relevance_score: 0.5,
    content_type: 'text' as 'text' | 'image' | 'audio' | 'video' | 'mixed',
    analysis_model: 'gpt-4o',
    analysis_version: '1.0',
    analyzed_at: new Date().toISOString(),
  };

  // Determine content type and analysis approach
  if (mimeType.startsWith('image/')) {
    analysis.content_type = 'image';
    analysis = await analyzeImageFile(supabase, fileRecord, analysis, profile);
  } else if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    analysis.content_type = mimeType.startsWith('audio/') ? 'audio' : 'video';
    analysis = await analyzeAudioVideoFile(supabase, fileRecord, analysis, profile);
  } else if (mimeType === 'application/pdf' || mimeType.includes('text') || mimeType.includes('document')) {
    analysis.content_type = 'text';
    analysis = await analyzeTextFile(fileRecord, analysis, profile);
  } else {
    // Unknown file type - try to extract any available content
    analysis.summary = `File of type ${mimeType} uploaded but no specific analysis available.`;
    analysis.key_insights = ['File format not directly analyzable', 'May contain valuable project information'];
    analysis.relevance_score = 0.3;
  }

  return analysis;
}

/**
 * Analyzes image files using AI SDK generateText with vision content parts.
 * Migrated fetch call #1: was raw fetch to OpenAI chat/completions with gpt-4o vision.
 * Uses selectModel with hasVision=true to ensure vision-capable model (never MiniMax per AI-04).
 */
async function analyzeImageFile(supabase: any, fileRecord: any, analysis: any, profile?: ModelProfile | null) {
  try {
    console.log('Analyzing image:', fileRecord.name);

    // Get signed URL for the image
    const { data: urlData, error: urlError } = await supabase.storage
      .from('project-files')
      .createSignedUrl(fileRecord.storage_path, 3600);

    if (urlError || !urlData?.signedUrl) {
      console.error('Failed to get signed URL for image:', urlError);
      analysis.summary = 'Image uploaded but could not be accessed for analysis';
      analysis.key_insights = ['Image file uploaded', 'Analysis unavailable due to storage access issue'];
      analysis.relevance_score = 0.3;
      return analysis;
    }

    // Profile-aware routing: selectModel ensures vision-capable model (never MiniMax)
    const selection = selectModel({ task: 'analyze-file', hasVision: true, hasAudio: false, userTier: 'free' }, profile);
    const model = getModel(selection.gatewayModelId);
    const providerOptions = getProviderOptions(selection.fallbackModels);

    const analysisPrompt = `Analyze this image and provide:
1. A brief summary of what you see
2. Key insights or notable elements
3. A detailed visual description
4. Any text that appears in the image
5. Relevance to business/project context (score 0-1)

Return as JSON with fields: summary, key_insights (array), visual_description, extracted_text, relevance_score`;

    const { text, usage: _usage } = await generateText({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: analysisPrompt },
          { type: 'image', image: urlData.signedUrl },
        ],
      }],
      maxOutputTokens: selection.maxOutputTokens,
      temperature: selection.temperature,
      ...(providerOptions ? { providerOptions } : {}),
    });

    try {
      const parsed = parseJsonResponse(text) as any;
      analysis.summary = parsed.summary || 'Image analyzed';
      analysis.key_insights = parsed.key_insights || ['Visual content analyzed'];
      analysis.visual_description = parsed.visual_description || 'Image content described';
      analysis.extracted_text = parsed.extracted_text || '';
      analysis.relevance_score = parsed.relevance_score || 0.5;
    } catch (_parseError) {
      console.log('Using raw response for image analysis');
      analysis.summary = text.substring(0, 200);
      analysis.visual_description = text;
      analysis.key_insights = ['Image content analyzed', 'Visual elements identified'];
    }

  } catch (error) {
    console.error('Image analysis error:', error);
    analysis.summary = 'Image uploaded but analysis encountered an error';
    analysis.key_insights = ['Image file uploaded', 'Analysis error occurred'];
  }

  return analysis;
}

/**
 * Analyzes audio/video files using two-step AI SDK pipeline.
 * Migrated fetch call #2: Whisper transcription via experimental_transcribe (was raw fetch to audio/transcriptions).
 * Migrated fetch call #3: Transcript summary via generateText with gpt-4o-mini (was raw fetch to chat/completions).
 *
 * Uses @ai-sdk/openai for transcription model (targeted exception -- gateway does not support transcription models).
 */
async function analyzeAudioVideoFile(supabase: any, fileRecord: any, analysis: any, profile?: ModelProfile | null) {
  try {
    console.log('Analyzing audio/video:', fileRecord.name);

    // Get signed URL for the file
    const { data: urlData, error: urlError } = await supabase.storage
      .from('project-files')
      .createSignedUrl(fileRecord.storage_path, 3600);

    if (urlError || !urlData?.signedUrl) {
      console.error('Failed to get signed URL for audio/video:', urlError);
      analysis.summary = 'Audio/video uploaded but could not be accessed for analysis';
      analysis.key_insights = ['Media file uploaded', 'Analysis unavailable due to storage access issue'];
      return analysis;
    }

    // Download file for transcription
    const audioResponse = await fetch(urlData.signedUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();

    // Step 1: Whisper transcription via AI SDK experimental_transcribe
    // Targeted exception: @ai-sdk/openai used because gateway does not support transcription models
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcriptionModel = openai.transcription('whisper-1');

    const transcriptionResult = await experimental_transcribe({
      model: transcriptionModel,
      audio: new Uint8Array(audioBuffer),
    });

    const transcript = transcriptionResult.text || '';

    analysis.audio_transcript = transcript;
    analysis.extracted_text = transcript;

    if (transcript.length > 50) {
      // Step 2: Summarize transcript via profile-aware routing (ADR-0013 Step 3)
      const summarySelection = selectModel({
        task: 'transcribe-summary',
        hasVision: false,
        hasAudio: false,
        userTier: 'free',
      }, profile);
      const summaryModel = getModel(summarySelection.gatewayModelId);
      const summaryProviderOptions = getProviderOptions(summarySelection.fallbackModels);

      const summaryPrompt = `Analyze this audio transcript and provide:
1. A brief summary of the content
2. Key insights or important points mentioned
3. Relevance to business/project context (score 0-1)

Transcript: "${transcript}"

Return as JSON with fields: summary, key_insights (array), relevance_score`;

      const { text: summaryText } = await generateText({
        model: summaryModel,
        prompt: summaryPrompt,
        maxOutputTokens: summarySelection.maxOutputTokens,
        temperature: summarySelection.temperature,
        ...(summaryProviderOptions ? { providerOptions: summaryProviderOptions } : {}),
      });

      try {
        const parsed = parseJsonResponse(summaryText) as any;
        analysis.summary = parsed.summary || 'Audio content transcribed and analyzed';
        analysis.key_insights = parsed.key_insights || ['Audio content transcribed'];
        analysis.relevance_score = parsed.relevance_score || 0.5;
      } catch (_parseError) {
        analysis.summary = `Audio transcribed: ${transcript.substring(0, 100)}...`;
        analysis.key_insights = ['Audio content transcribed', 'Spoken content captured'];
      }
    } else {
      analysis.summary = 'Audio file transcribed but content is very brief';
      analysis.key_insights = ['Short audio content', 'Limited transcription available'];
    }

  } catch (error) {
    console.error('Audio/video analysis error:', error);
    analysis.summary = 'Audio/video uploaded but analysis encountered an error';
    analysis.key_insights = ['Media file uploaded', 'Analysis error occurred'];
  }

  return analysis;
}

/**
 * Analyzes text files using AI SDK generateText with gpt-4o-mini.
 * Migrated fetch call #4: was raw fetch to chat/completions with gpt-4o-mini.
 * Uses getModel directly (not selectModel) since text analysis always uses gpt-4o-mini for cost efficiency.
 */
async function analyzeTextFile(fileRecord: any, analysis: any, profile?: ModelProfile | null) {
  try {
    console.log('Analyzing text file:', fileRecord.name);

    // Use existing content_preview if available
    const textContent = fileRecord.content_preview || '';

    if (textContent.length < 50) {
      analysis.summary = 'Text file uploaded but content is too brief for analysis';
      analysis.key_insights = ['Text file uploaded', 'Content too short for meaningful analysis'];
      return analysis;
    }

    // Profile-aware routing replaces hardcoded gpt-4o-mini (ADR-0013 Step 3)
    const textSelection = selectModel({
      task: 'analyze-file',
      hasVision: false,
      hasAudio: false,
      userTier: 'free',
    }, profile);
    const textModel = getModel(textSelection.gatewayModelId);
    const textProviderOptions = getProviderOptions(textSelection.fallbackModels);

    const { text: analysisText, usage: _usage } = await generateText({
      model: textModel,
      prompt: `Analyze this document content and provide:
1. A brief summary of the main topics and content
2. Key insights, findings, or important points
3. Relevance to business/project context (score 0-1)

Document content: "${textContent.substring(0, 3000)}"

Return as JSON with fields: summary, key_insights (array), relevance_score`,
      maxOutputTokens: textSelection.maxOutputTokens,
      temperature: textSelection.temperature,
      ...(textProviderOptions ? { providerOptions: textProviderOptions } : {}),
    });

    try {
      const parsed = parseJsonResponse(analysisText) as any;
      analysis.summary = parsed.summary || 'Document analyzed';
      analysis.key_insights = parsed.key_insights || ['Document content analyzed'];
      analysis.relevance_score = parsed.relevance_score || 0.5;
      analysis.extracted_text = textContent.substring(0, 1000); // Store excerpt
    } catch (_parseError) {
      analysis.summary = analysisText.substring(0, 200);
      analysis.key_insights = ['Document content analyzed', 'Text content extracted'];
      analysis.extracted_text = textContent.substring(0, 1000);
    }

  } catch (error) {
    console.error('Text analysis error:', error);
    analysis.summary = 'Text document uploaded but analysis encountered an error';
    analysis.key_insights = ['Text file uploaded', 'Analysis error occurred'];
  }

  return analysis;
}
