import { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticate, checkUserRateLimit } from '../auth/middleware'

interface WhisperSegment {
  avg_logprob?: number;
  start: number;
  end: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  // Authenticate user (optional)
  const { user } = await authenticate(req)
  
  // Rate limiting for audio transcription (expensive operation)
  const rateLimitKey = user?.id || (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown')
  const rateLimit = user ? 5 : 2 // Lower limit for transcription
  
  if (!checkUserRateLimit(rateLimitKey, rateLimit)) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please try again later.',
      suggestion: user ? 'Try again in a minute.' : 'Sign in for higher rate limits.'
    })
  }
  
  try {
    console.log('🎵 Audio transcription request:', req.body)
    
    const { audioUrl, projectContext, language = 'en' } = req.body
    
    if (!audioUrl) {
      console.error('❌ Missing required field: audioUrl')
      return res.status(400).json({ error: 'Audio URL is required' })
    }
    
    const openaiKey = process.env.OPENAI_API_KEY
    console.log('🔑 OpenAI key available:', !!openaiKey)
    
    if (!openaiKey) {
      return res.status(500).json({ error: 'No AI service configured' })
    }
    
    const transcription = await transcribeAudioWithWhisper(
      openaiKey, 
      audioUrl, 
      projectContext,
      language
    )
    
    return res.status(200).json({ transcription })
    
  } catch (error) {
    console.error('❌ Audio transcription error:', error)
    return res.status(500).json({ error: 'Failed to transcribe audio' })
  }
}

async function transcribeAudioWithWhisper(
  apiKey: string, 
  audioUrl: string, 
  projectContext: any = {}, 
  language: string = 'en'
) {
  console.log('🚀 Transcribing audio with Whisper API:', { audioUrl: audioUrl.substring(0, 100) + '...', language })
  
  try {
    // First, fetch the audio file
    console.log('📥 Downloading audio file...')
    const audioResponse = await fetch(audioUrl)
    
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio file: ${audioResponse.status}`)
    }
    
    const audioBuffer = await audioResponse.arrayBuffer()
    console.log('📁 Audio file downloaded:', audioBuffer.byteLength, 'bytes')
    
    // Create FormData for Whisper API
    const formData = new FormData()
    
    // Convert ArrayBuffer to Blob
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
    formData.append('file', audioBlob, 'audio.mp3')
    formData.append('model', 'whisper-1')
    formData.append('language', language)
    formData.append('response_format', 'verbose_json') // Get detailed response with timestamps
    
    // Add optional prompt for better context
    if (projectContext?.projectName || projectContext?.projectType) {
      const prompt = `This is audio from a ${projectContext.projectType || 'business'} project called "${projectContext.projectName || 'project'}".`
      formData.append('prompt', prompt)
    }
    
    // Call Whisper API
    console.log('🎯 Calling Whisper API...')
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })
    
    if (!response.ok) {
      const errorData = await response.text()
      console.error('❌ Whisper API error:', response.status, errorData)
      throw new Error(`Whisper API error: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('📄 Whisper transcription completed:', data.text?.length || 0, 'characters')
    
    // Process the transcription result
    const result = {
      text: data.text || '',
      language: data.language || language,
      duration: data.duration || 0,
      segments: data.segments || [],
      confidence: calculateAverageConfidence(data.segments || []),
      summary: await generateTranscriptionSummary(apiKey, data.text, projectContext),
      speakers: detectSpeakers(data.segments || []),
      keyPoints: extractKeyPoints(data.text, projectContext),
      projectRelevance: assessProjectRelevance(data.text, projectContext)
    }
    
    console.log('✅ Transcription analysis complete:', {
      textLength: result.text.length,
      confidence: result.confidence,
      speakers: result.speakers.length,
      keyPoints: result.keyPoints.length
    })
    
    return result
    
  } catch (error) {
    console.error('❌ Whisper transcription failed:', error)
    throw error
  }
}

function calculateAverageConfidence(segments: WhisperSegment[]): number {
  if (!segments || segments.length === 0) return 0
  
  const totalConfidence = segments.reduce((sum, segment) => {
    return sum + (segment.avg_logprob || 0)
  }, 0)
  
  // Convert log probability to confidence percentage (approximate)
  const avgLogProb = totalConfidence / segments.length
  return Math.max(0, Math.min(100, (avgLogProb + 1) * 100))
}

function detectSpeakers(segments: WhisperSegment[]): string[] {
  // Simple speaker detection based on pause patterns and voice characteristics
  // This is a placeholder - real speaker diarization would require additional processing
  
  const speakers = ['Speaker 1'] // Default single speaker
  
  // Look for long pauses that might indicate speaker changes
  let speakerCount = 1
  for (let i = 1; i < segments.length; i++) {
    const prevEnd = segments[i - 1].end
    const currentStart = segments[i].start
    const pause = currentStart - prevEnd
    
    // If pause > 2 seconds, might be a speaker change
    if (pause > 2.0 && speakerCount < 4) { // Max 4 speakers
      speakerCount++
      speakers.push(`Speaker ${speakerCount}`)
    }
  }
  
  return speakers
}

function extractKeyPoints(text: string, projectContext: any): string[] {
  if (!text || text.length < 50) return []
  
  const keyPoints: string[] = []
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
  
  // Look for important keywords related to project context
  const importantKeywords = [
    'important', 'key', 'critical', 'essential', 'priority', 'focus',
    'goal', 'objective', 'target', 'deadline', 'budget', 'cost',
    'decision', 'action', 'next steps', 'follow up', 'review',
    'problem', 'issue', 'challenge', 'solution', 'opportunity'
  ]
  
  // Add project-specific keywords if available
  if (projectContext?.projectName) {
    importantKeywords.push(projectContext.projectName.toLowerCase())
  }
  if (projectContext?.projectType) {
    importantKeywords.push(projectContext.projectType.toLowerCase())
  }
  
  sentences.forEach(sentence => {
    const lowerSentence = sentence.toLowerCase()
    const keywordMatches = importantKeywords.filter(keyword => 
      lowerSentence.includes(keyword)
    ).length
    
    // If sentence contains multiple keywords or is at beginning/end, consider it important
    if (keywordMatches >= 2 || 
        sentences.indexOf(sentence) < 3 || 
        sentences.indexOf(sentence) >= sentences.length - 3) {
      keyPoints.push(sentence.trim())
    }
  })
  
  return keyPoints.slice(0, 5) // Top 5 key points
}

async function generateTranscriptionSummary(
  apiKey: string, 
  transcriptionText: string, 
  projectContext: any
): Promise<string> {
  if (!transcriptionText || transcriptionText.length < 100) {
    return 'Audio content too short for meaningful summary.'
  }
  
  try {
    const projectInfo = projectContext ? `

This transcription is from a ${projectContext.projectType || 'business'} project called "${projectContext.projectName || 'project'}".` : ''

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use faster model for summarization
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Please provide a concise summary (2-3 sentences) of this audio transcription:${projectInfo}

TRANSCRIPTION:
${transcriptionText}

Focus on the main topics, decisions, and action items discussed.`
          }
        ],
        temperature: 0.3,
      }),
    })
    
    if (response.ok) {
      const data = await response.json()
      return data.choices[0]?.message?.content || 'Unable to generate summary.'
    } else {
      console.warn('Failed to generate summary:', response.status)
      return 'Summary generation unavailable.'
    }
  } catch (error) {
    console.warn('Summary generation error:', error)
    return 'Summary generation failed.'
  }
}

function assessProjectRelevance(text: string, projectContext: any): 'high' | 'medium' | 'low' {
  if (!projectContext?.projectName && !projectContext?.projectType) {
    return 'medium'
  }
  
  const content = text.toLowerCase()
  const projectName = (projectContext.projectName || '').toLowerCase()
  const projectType = (projectContext.projectType || '').toLowerCase()
  
  let relevanceScore = 0
  
  // Check for direct mentions
  if (content.includes(projectName)) relevanceScore += 3
  if (content.includes(projectType)) relevanceScore += 2
  
  // Check for project-related keywords
  const projectKeywords = [
    'project', 'initiative', 'plan', 'strategy', 'goal', 'objective',
    'requirement', 'feature', 'development', 'implementation', 'launch'
  ]
  
  projectKeywords.forEach(keyword => {
    if (content.includes(keyword)) relevanceScore += 1
  })
  
  if (relevanceScore >= 5) return 'high'
  if (relevanceScore >= 2) return 'medium'
  return 'low'
}