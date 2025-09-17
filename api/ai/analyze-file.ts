import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { authenticate, checkUserRateLimit } from '../auth/middleware.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  // Authenticate user (optional)
  const { user } = await authenticate(req)
  
  // Rate limiting for file analysis
  const rateLimitKey = user?.id || (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown')
  const rateLimit = user ? 20 : 5
  
  if (!checkUserRateLimit(rateLimitKey, rateLimit)) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please try again later.',
      suggestion: user ? 'Try again in a minute.' : 'Sign in for higher rate limits.'
    })
  }
  
  try {
    console.log('🔍 File analysis request:', req.body)
    
    const { fileId, projectId } = req.body
    
    if (!fileId || !projectId) {
      console.error('❌ Missing required fields: fileId or projectId')
      return res.status(400).json({ error: 'File ID and Project ID are required' })
    }
    
    // Initialize Supabase client
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase configuration missing' })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Get the file record
    const { data: fileRecord, error: fileError } = await supabase
      .from('project_files')
      .select('*')
      .eq('id', fileId)
      .eq('project_id', projectId)
      .single()
    
    if (fileError || !fileRecord) {
      console.error('❌ File not found:', fileError)
      return res.status(404).json({ error: 'File not found' })
    }
    
    console.log('📁 Analyzing file:', fileRecord.name, 'Type:', fileRecord.mime_type)
    
    // Check if already analyzed
    if (fileRecord.analysis_status === 'completed' && fileRecord.ai_analysis) {
      console.log('✅ File already analyzed, returning cached results')
      return res.status(200).json({ 
        analysis: fileRecord.ai_analysis,
        cached: true 
      })
    }
    
    // Update status to analyzing
    await supabase
      .from('project_files')
      .update({ analysis_status: 'analyzing' })
      .eq('id', fileId)
    
    const openaiKey = process.env.OPENAI_API_KEY
    console.log('🔑 OpenAI key available:', !!openaiKey)
    
    if (!openaiKey) {
      await supabase
        .from('project_files')
        .update({ analysis_status: 'skipped' })
        .eq('id', fileId)
      return res.status(500).json({ error: 'No AI service configured' })
    }
    
    try {
      // Analyze the file based on its type
      const analysis = await analyzeFileContent(
        openaiKey,
        supabase,
        fileRecord,
        projectId
      )
      
      // Save analysis results
      const { error: updateError } = await supabase
        .from('project_files')
        .update({ 
          ai_analysis: analysis,
          analysis_status: 'completed'
        })
        .eq('id', fileId)
      
      if (updateError) {
        console.error('❌ Failed to save analysis:', updateError)
        await supabase
          .from('project_files')
          .update({ analysis_status: 'failed' })
          .eq('id', fileId)
        return res.status(500).json({ error: 'Failed to save analysis results' })
      }
      
      console.log('✅ File analysis completed and saved')
      return res.status(200).json({ analysis, cached: false })
      
    } catch (analysisError) {
      console.error('❌ Analysis failed:', analysisError)
      await supabase
        .from('project_files')
        .update({ analysis_status: 'failed' })
        .eq('id', fileId)
      return res.status(500).json({ error: 'Analysis failed' })
    }
    
  } catch (error) {
    console.error('❌ File analysis error:', error)
    
    // Update status to failed
    try {
      const { fileId } = req.body
      if (fileId) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey)
          await supabase
            .from('project_files')
            .update({ analysis_status: 'failed' })
            .eq('id', fileId)
        }
      }
    } catch (updateError) {
      console.error('❌ Failed to update error status:', updateError)
    }
    
    return res.status(500).json({ error: 'Failed to analyze file' })
  }
}

async function analyzeFileContent(
  apiKey: string,
  supabase: any,
  fileRecord: any,
  _projectId: string
) {
  const mimeType = fileRecord.mime_type
  const fileName = fileRecord.name
  // const _storagePath = fileRecord.storage_path
  
  console.log('🎯 Analyzing file type:', mimeType, 'for file:', fileName)
  
  let analysis = {
    summary: '',
    key_insights: [],
    extracted_text: '',
    visual_description: '',
    audio_transcript: '',
    relevance_score: 0.5,
    content_type: 'text' as 'text' | 'image' | 'audio' | 'video' | 'mixed',
    analysis_model: 'gpt-4o',
    analysis_version: '1.0',
    analyzed_at: new Date().toISOString()
  }
  
  // Determine content type and analysis approach
  if (mimeType.startsWith('image/')) {
    analysis.content_type = 'image'
    analysis = await analyzeImageFile(apiKey, supabase, fileRecord, analysis)
  } else if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    analysis.content_type = mimeType.startsWith('audio/') ? 'audio' : 'video'
    analysis = await analyzeAudioVideoFile(apiKey, supabase, fileRecord, analysis)
  } else if (mimeType === 'application/pdf' || mimeType.includes('text') || mimeType.includes('document')) {
    analysis.content_type = 'text'
    analysis = await analyzeTextFile(apiKey, fileRecord, analysis)
  } else {
    // Unknown file type - try to extract any available content
    analysis.summary = `File of type ${mimeType} uploaded but no specific analysis available.`
    analysis.key_insights = ['File format not directly analyzable', 'May contain valuable project information']
    analysis.relevance_score = 0.3
  }
  
  return analysis
}

async function analyzeImageFile(apiKey: string, supabase: any, fileRecord: any, analysis: any) {
  try {
    console.log('🖼️ Analyzing image:', fileRecord.name)
    
    // Get signed URL for the image
    const { data: urlData, error: urlError } = await supabase.storage
      .from('project-files')
      .createSignedUrl(fileRecord.storage_path, 3600)
    
    if (urlError || !urlData?.signedUrl) {
      console.error('❌ Failed to get signed URL for image:', urlError)
      analysis.summary = 'Image uploaded but could not be accessed for analysis'
      analysis.key_insights = ['Image file uploaded', 'Analysis unavailable due to storage access issue']
      analysis.relevance_score = 0.3
      return analysis
    }
    
    // Call GPT-4V for image analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and provide:
1. A brief summary of what you see
2. Key insights or notable elements
3. A detailed visual description
4. Any text that appears in the image
5. Relevance to business/project context (score 0-1)

Return as JSON with fields: summary, key_insights (array), visual_description, extracted_text, relevance_score`
              },
              {
                type: 'image_url',
                image_url: {
                  url: urlData.signedUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.3,
      }),
    })
    
    if (response.ok) {
      const data = await response.json()
      const content = data.choices[0]?.message?.content || '{}'
      
      try {
        const parsed = JSON.parse(content)
        analysis.summary = parsed.summary || 'Image analyzed'
        analysis.key_insights = parsed.key_insights || ['Visual content analyzed']
        analysis.visual_description = parsed.visual_description || 'Image content described'
        analysis.extracted_text = parsed.extracted_text || ''
        analysis.relevance_score = parsed.relevance_score || 0.5
      } catch (parseError) {
        console.log('📝 Using raw response for image analysis')
        analysis.summary = content.substring(0, 200)
        analysis.visual_description = content
        analysis.key_insights = ['Image content analyzed', 'Visual elements identified']
      }
    } else {
      console.error('❌ OpenAI API error for image:', response.status)
      analysis.summary = 'Image uploaded but analysis failed'
      analysis.key_insights = ['Image file uploaded', 'Analysis failed due to API error']
    }
    
  } catch (error) {
    console.error('❌ Image analysis error:', error)
    analysis.summary = 'Image uploaded but analysis encountered an error'
    analysis.key_insights = ['Image file uploaded', 'Analysis error occurred']
  }
  
  return analysis
}

async function analyzeAudioVideoFile(apiKey: string, supabase: any, fileRecord: any, analysis: any) {
  try {
    console.log('🎵 Analyzing audio/video:', fileRecord.name)
    
    // Get signed URL for the file
    const { data: urlData, error: urlError } = await supabase.storage
      .from('project-files')
      .createSignedUrl(fileRecord.storage_path, 3600)
    
    if (urlError || !urlData?.signedUrl) {
      console.error('❌ Failed to get signed URL for audio/video:', urlError)
      analysis.summary = 'Audio/video uploaded but could not be accessed for analysis'
      analysis.key_insights = ['Media file uploaded', 'Analysis unavailable due to storage access issue']
      return analysis
    }
    
    // Download file for Whisper API
    const audioResponse = await fetch(urlData.signedUrl)
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }
    
    const audioBuffer = await audioResponse.arrayBuffer()
    
    // Create FormData for Whisper API
    const formData = new FormData()
    const audioBlob = new Blob([audioBuffer], { type: fileRecord.mime_type })
    formData.append('file', audioBlob, fileRecord.name)
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'verbose_json')
    
    // Call Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })
    
    if (whisperResponse.ok) {
      const transcriptionData = await whisperResponse.json()
      const transcript = transcriptionData.text || ''
      
      analysis.audio_transcript = transcript
      analysis.extracted_text = transcript
      
      if (transcript.length > 50) {
        // Analyze the transcript with GPT-4
        const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 500,
            messages: [
              {
                role: 'user',
                content: `Analyze this audio transcript and provide:
1. A brief summary of the content
2. Key insights or important points mentioned
3. Relevance to business/project context (score 0-1)

Transcript: "${transcript}"

Return as JSON with fields: summary, key_insights (array), relevance_score`
              }
            ],
            temperature: 0.3,
          }),
        })
        
        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json()
          const content = analysisData.choices[0]?.message?.content || '{}'
          
          try {
            const parsed = JSON.parse(content)
            analysis.summary = parsed.summary || 'Audio content transcribed and analyzed'
            analysis.key_insights = parsed.key_insights || ['Audio content transcribed']
            analysis.relevance_score = parsed.relevance_score || 0.5
          } catch (parseError) {
            analysis.summary = `Audio transcribed: ${transcript.substring(0, 100)}...`
            analysis.key_insights = ['Audio content transcribed', 'Spoken content captured']
          }
        } else {
          analysis.summary = `Audio transcribed: ${transcript.substring(0, 100)}...`
          analysis.key_insights = ['Audio content transcribed', 'Manual review recommended']
        }
      } else {
        analysis.summary = 'Audio file transcribed but content is very brief'
        analysis.key_insights = ['Short audio content', 'Limited transcription available']
      }
    } else {
      console.error('❌ Whisper API error:', whisperResponse.status)
      analysis.summary = 'Audio/video uploaded but transcription failed'
      analysis.key_insights = ['Media file uploaded', 'Transcription failed due to API error']
    }
    
  } catch (error) {
    console.error('❌ Audio/video analysis error:', error)
    analysis.summary = 'Audio/video uploaded but analysis encountered an error'
    analysis.key_insights = ['Media file uploaded', 'Analysis error occurred']
  }
  
  return analysis
}

async function analyzeTextFile(apiKey: string, fileRecord: any, analysis: any) {
  try {
    console.log('📄 Analyzing text file:', fileRecord.name)
    
    // Use existing content_preview if available
    let textContent = fileRecord.content_preview || ''
    
    if (textContent.length < 50) {
      analysis.summary = 'Text file uploaded but content is too brief for analysis'
      analysis.key_insights = ['Text file uploaded', 'Content too short for meaningful analysis']
      return analysis
    }
    
    // Analyze text content with GPT-4
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: `Analyze this document content and provide:
1. A brief summary of the main topics and content
2. Key insights, findings, or important points
3. Relevance to business/project context (score 0-1)

Document content: "${textContent.substring(0, 3000)}"

Return as JSON with fields: summary, key_insights (array), relevance_score`
          }
        ],
        temperature: 0.3,
      }),
    })
    
    if (response.ok) {
      const data = await response.json()
      const content = data.choices[0]?.message?.content || '{}'
      
      try {
        const parsed = JSON.parse(content)
        analysis.summary = parsed.summary || 'Document analyzed'
        analysis.key_insights = parsed.key_insights || ['Document content analyzed']
        analysis.relevance_score = parsed.relevance_score || 0.5
        analysis.extracted_text = textContent.substring(0, 1000) // Store excerpt
      } catch (parseError) {
        analysis.summary = content.substring(0, 200)
        analysis.key_insights = ['Document content analyzed', 'Text content extracted']
        analysis.extracted_text = textContent.substring(0, 1000)
      }
    } else {
      console.error('❌ OpenAI API error for text:', response.status)
      analysis.summary = 'Text document uploaded but analysis failed'
      analysis.key_insights = ['Text file uploaded', 'Analysis failed due to API error']
    }
    
  } catch (error) {
    console.error('❌ Text analysis error:', error)
    analysis.summary = 'Text document uploaded but analysis encountered an error'
    analysis.key_insights = ['Text file uploaded', 'Analysis error occurred']
  }
  
  return analysis
}