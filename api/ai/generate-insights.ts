import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Simple rate limiting: 8 requests per minute per IP  
const RATE_LIMIT = 8
const RATE_WINDOW = 60 * 1000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitStore.get(ip)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false
  }
  
  userLimit.count++
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🚀 AI Insights API called at:', new Date().toISOString())
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    
    const clientIP = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown'
    
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' })
    }
    
    console.log('📥 Request body keys:', Object.keys(req.body))
    const { ideas, projectName, projectType, roadmapContext, documentContext, projectContext } = req.body
    
    console.log('🔍 Parsed request:', {
      ideasCount: ideas?.length || 0,
      projectName,
      projectType,
      hasRoadmapContext: !!roadmapContext,
      documentCount: documentContext?.length || 0,
      hasProjectContext: !!projectContext
    })
    
    if (!ideas || !Array.isArray(ideas)) {
      console.error('❌ Ideas validation failed:', { ideas: typeof ideas, isArray: Array.isArray(ideas) })
      return res.status(400).json({ error: 'Ideas array is required' })
    }
    
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    console.log('🔑 API Keys check:', { 
      hasOpenAI: !!openaiKey, 
      hasAnthropic: !!anthropicKey,
      openaiLength: openaiKey?.length || 0
    })
    
    if (!openaiKey && !anthropicKey) {
      return res.status(500).json({ error: 'No AI service configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.' })
    }
    
    let insights = {}
    
    if (openaiKey) {
      console.log('Using OpenAI for insights generation')
      insights = await generateInsightsWithOpenAI(openaiKey, ideas, projectName, projectType, roadmapContext, documentContext, projectContext)
    } else if (anthropicKey) {
      console.log('Using Anthropic for insights generation')
      insights = await generateInsightsWithAnthropic(anthropicKey, ideas, projectName, projectType, roadmapContext, documentContext, projectContext)
    }
    
    console.log('Generated insights:', Object.keys(insights))
    
    // Validate that we got proper insights structure
    if (!insights || typeof insights !== 'object' || Object.keys(insights).length === 0) {
      throw new Error('AI service returned empty or invalid response')
    }
    
    return res.status(200).json({ insights })
    
  } catch (error) {
    console.error('❌ FUNCTION ERROR:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error,
      timestamp: new Date().toISOString()
    })
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return res.status(500).json({ 
      error: `Failed to generate insights: ${errorMessage}`,
      timestamp: new Date().toISOString(),
      functionId: 'generate-insights'
    })
  }
}

async function generateInsightsWithOpenAI(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = [], projectContext: any = null) {
  
  console.log('🚀 OPENAI FUNCTION: Starting generateInsightsWithOpenAI')
  console.log('🎯 OPENAI: API Key available:', !!apiKey, 'Length:', apiKey?.length || 0)
  console.log('📋 OPENAI: Ideas count:', ideas?.length || 0)
  console.log('📁 OPENAI: Document context files:', documentContext?.length || 0)
  
  if (documentContext && documentContext.length > 0) {
    console.log('📄 OPENAI: Document files details:')
    documentContext.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.name} (${doc.mimeType || doc.type || 'unknown'}) - ${doc.content?.length || 0} chars`)
      if (doc.content) {
        console.log(`     Content preview: "${doc.content.substring(0, 100)}..."`)
      }
    })
  }
  
  // Process multi-modal file content for enhanced AI analysis
  console.log('🔄 OPENAI: Starting multi-modal file processing...')
  const multiModalContent = await processMultiModalFiles(apiKey, documentContext, projectName, projectType)
  console.log('✅ OPENAI: Multi-modal processing complete:', {
    hasVisualContent: multiModalContent.hasVisualContent,
    hasAudioContent: multiModalContent.hasAudioContent,
    textContentLength: multiModalContent.textContent?.length || 0,
    audioTranscriptsLength: multiModalContent.audioTranscripts?.length || 0,
    imageDescriptionsLength: multiModalContent.imageDescriptions?.length || 0,
    imageUrlsCount: multiModalContent.imageUrls?.length || 0
  })
  
  // Prepare messages array with potential image content
  const messages = [
    {
      role: 'system',
      content: `You are an experienced strategic consultant analyzing this specific project. Think like a seasoned advisor who asks the right questions and provides insights based on what you actually see.

Analyze the actual ideas provided - what do they tell you about this project's real focus, challenges, and opportunities? Look for patterns, gaps, and strategic priorities that emerge from the specific context.

${multiModalContent.hasVisualContent ? 'IMPORTANT: This project includes visual content (images, videos) that you can analyze directly. Pay attention to visual insights and design elements.' : ''}
${multiModalContent.hasAudioContent ? 'IMPORTANT: This project includes audio content that has been transcribed. Consider the spoken insights and meeting content in your analysis.' : ''}

Avoid generic business templates. Instead, provide thoughtful analysis that someone familiar with this exact project would find valuable and actionable.

Write conversationally and insightfully, like you're advising a founder or product team who knows their domain well.

IMPORTANT: Respond ONLY with valid JSON. Do not include any explanatory text before or after the JSON.

Provide your analysis as a JSON object with these sections:
{
  "executiveSummary": "Your strategic overview of what you see in this project",
  "keyInsights": [
    {
      "insight": "What stands out to you",
      "impact": "Why this matters for the project"
    }
  ],
  "priorityRecommendations": {
    "immediate": ["What should they do first"],
    "shortTerm": ["Next steps"],
    "longTerm": ["Bigger picture moves"]
  },
  "riskAssessment": {
    "highRisk": ["What concerns you"],
    "opportunities": ["What excites you about this"]
  },
  "suggestedRoadmap": [
    {
      "phase": "Logical next phase",
      "duration": "Realistic timeframe",
      "focus": "What this phase accomplishes",
      "ideas": ["Specific ideas from their list that fit here"]
    }
  ],
  "resourceAllocation": {
    "quickWins": "Where to focus energy first",
    "strategic": "Longer-term investments"
  },
  "futureEnhancements": [
    {
      "title": "Enhancement Title",
      "description": "Detailed description of the enhancement opportunity that builds on existing ideas",
      "relatedIdea": "Name of related idea from the portfolio",
      "impact": "high|medium|low",
      "timeframe": "Time estimate for implementation"
    }
  ],
  "nextSteps": ["Board-level next step 1", "Board-level next step 2"]
}`
    }
  ]
  
  // Build the user message with multi-modal content
  let userContent = []
  
  // Start with text content
  userContent.push({
    type: 'text',
    text: `I'm looking for strategic insights on this project. Take a look at what we're working on and give me your honest assessment - what do you see? What patterns emerge? What should we be thinking about?

Here's what we're building:

PROJECT: ${projectName} (${projectType})

IDEAS WE'RE CONSIDERING:
${ideas.map(idea => `• ${idea.title} - ${idea.description}`).join('\n')}

${roadmapContext ? `We already have some roadmap planning in place.` : ''}

${multiModalContent.textContent ? `
DOCUMENT CONTEXT:
${multiModalContent.textContent}
` : ''}

${multiModalContent.audioTranscripts ? `
AUDIO TRANSCRIPTS FROM PROJECT FILES:
${multiModalContent.audioTranscripts}
` : ''}

${multiModalContent.imageDescriptions ? `
VISUAL CONTENT ANALYSIS:
${multiModalContent.imageDescriptions}
` : ''}

What insights jump out at you? What should we be prioritizing or watching out for?`
  })
  
  // Add image content for GPT-4V analysis
  if (multiModalContent.imageUrls && multiModalContent.imageUrls.length > 0) {
    multiModalContent.imageUrls.forEach(imageUrl => {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
          detail: 'high'
        }
      })
    })
  }
  
  messages.push({
    role: 'user',
    content: userContent
  })
  
  console.log('📤 OPENAI: Preparing API request...')
  console.log('🎯 OPENAI: Using model: gpt-4o')
  console.log('📋 OPENAI: Message count:', messages.length)
  console.log('📁 OPENAI: User content items:', userContent.length)
  userContent.forEach((item, index) => {
    console.log(`  ${index + 1}. Type: ${item.type}, ${item.type === 'text' ? `Text length: ${item.text?.length}` : 'Image URL provided'}`)
  })
  
  console.log('🌐 OPENAI: Making API call to OpenAI...')
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o', // GPT-4V capable model
      seed: Math.floor(Math.random() * 1000000),
      messages: messages,
      temperature: getRandomTemperature(),
      max_tokens: 4000,
    }),
  })
  
  console.log('📡 OPENAI: API Response status:', response.status, response.statusText)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ OPENAI: API Error details:', errorText)
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }
  
  console.log('✅ OPENAI: API call successful!')
  const data = await response.json()
  console.log('📊 OPENAI: Response data structure:', {
    choices: data.choices?.length || 0,
    usage: data.usage,
    model: data.model
  })
  
  const content = data.choices[0]?.message?.content
  
  if (!content) {
    console.error('❌ OPENAI: Empty content in response:', data)
    throw new Error('OpenAI returned empty response')
  }
  
  console.log('📝 OPENAI: Raw response length:', content.length)
  console.log('📝 OPENAI: Raw response preview:', content.substring(0, 300) + '...')
  
  // Check if response mentions specific file content
  const mentionsImages = content.toLowerCase().includes('image') || content.toLowerCase().includes('visual') || content.toLowerCase().includes('dog') || content.toLowerCase().includes('spaniel')
  const mentionsHygiene = content.toLowerCase().includes('hygiene') || content.toLowerCase().includes('soap') || content.toLowerCase().includes('clean')
  console.log('🔍 OPENAI: Content analysis flags:', {
    mentionsImages,
    mentionsHygiene,
    hasSpecificContent: mentionsImages || mentionsHygiene
  })
  
  try {
    // Remove markdown code blocks if present (```json ... ```)
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    console.log('Attempting to parse cleaned content:', cleanContent.substring(0, 300) + '...')
    const parsed = JSON.parse(cleanContent)
    console.log('OpenAI parsed response keys:', Object.keys(parsed))
    return parsed
  } catch (parseError) {
    console.error('Failed to parse OpenAI response:', parseError)
    console.error('Content that failed to parse:', content.substring(0, 500))
    throw new Error(`OpenAI returned invalid JSON: ${parseError}`)
  }
}

async function generateInsightsWithAnthropic(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = [], projectContext: any = null) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      seed: Math.floor(Math.random() * 1000000),
      messages: [
        {
          role: 'user',
          content: `You are an experienced strategic consultant analyzing this specific project. Think like a seasoned advisor who asks the right questions and provides insights based on what you actually see.

Analyze the actual ideas provided - what do they tell you about this project's real focus, challenges, and opportunities? Look for patterns, gaps, and strategic priorities that emerge from the specific context.

Avoid generic business templates. Instead, provide thoughtful analysis that someone familiar with this exact project would find valuable and actionable.

Write conversationally and insightfully, like you're advising a founder or product team who knows their domain well.

IMPORTANT: Respond ONLY with valid JSON. Do not include any explanatory text before or after the JSON.

I'm looking for strategic insights on this project: ${projectName} (${projectType})

IDEAS WE'RE CONSIDERING:
${ideas.map(idea => `• ${idea.title} - ${idea.description}`).join('\n')}

${roadmapContext ? `We already have some roadmap planning in place.` : ''}

${documentContext && documentContext.length > 0 ? `
ADDITIONAL CONTEXT:
${documentContext.map(doc => `• ${doc.name}: ${doc.content.substring(0, 200)}...`).join('\n')}
` : ''}

Provide your analysis as a JSON object with these sections:
{
  "executiveSummary": "Your strategic overview of what you see in this project",
  "keyInsights": [
    {
      "insight": "What stands out to you",
      "impact": "Why this matters for the project"
    }
  ],
  "priorityRecommendations": {
    "immediate": ["What should they do first"],
    "shortTerm": ["Next steps"],
    "longTerm": ["Bigger picture moves"]
  },
  "riskAssessment": {
    "highRisk": ["What concerns you"],
    "opportunities": ["What excites you about this"]
  },
  "suggestedRoadmap": [
    {
      "phase": "Logical next phase",
      "duration": "Realistic timeframe",
      "focus": "What this phase accomplishes",
      "ideas": ["Specific ideas from their list that fit here"]
    }
  ],
  "resourceAllocation": {
    "quickWins": "Where to focus energy first",
    "strategic": "Longer-term investments"
  },
  "futureEnhancements": [],
  "nextSteps": ["Practical next steps"]
}`
        }
      ],
      temperature: getRandomTemperature(),
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.content[0]?.text
  
  if (!content) {
    throw new Error('Anthropic returned empty response')
  }
  
  console.log('Anthropic raw response:', content.substring(0, 200) + '...')
  
  try {
    // Remove markdown code blocks if present (```json ... ```)
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    console.log('Attempting to parse cleaned Anthropic content:', cleanContent.substring(0, 300) + '...')
    const parsed = JSON.parse(cleanContent)
    console.log('Anthropic parsed response keys:', Object.keys(parsed))
    return parsed
  } catch (parseError) {
    console.error('Failed to parse Anthropic response:', parseError)
    console.error('Content that failed to parse:', content.substring(0, 500))
    throw new Error(`Anthropic returned invalid JSON: ${parseError}`)
  }
}

// Multi-modal file processing for enhanced AI analysis
async function processMultiModalFiles(apiKey: string, documentContext: any[] = [], projectName: string, projectType: string) {
  console.log('🎬 MULTIMODAL: Starting processMultiModalFiles')
  console.log('📁 MULTIMODAL: Input files count:', documentContext?.length || 0)
  
  if (!documentContext || documentContext.length === 0) {
    console.log('⚠️ MULTIMODAL: No documents provided, returning empty result')
    return {
      hasVisualContent: false,
      hasAudioContent: false,
      textContent: '',
      audioTranscripts: '',
      imageDescriptions: '',
      imageUrls: []
    }
  }

  console.log('🔄 MULTIMODAL: Processing files for AI analysis:', documentContext.length, 'files')
  documentContext.forEach((doc, index) => {
    console.log(`📄 MULTIMODAL: File ${index + 1}: ${doc.name} (${doc.type || doc.mimeType || 'unknown type'})`)
    console.log(`    Content length: ${doc.content?.length || 0} chars`)
    console.log(`    Storage URL: ${doc.storageUrl ? 'available' : 'missing'}`)
    console.log(`    Storage path: ${doc.storagePath || doc.storage_path || 'missing'}`)
    console.log(`    File path: ${doc.file_path || 'missing'}`)
    console.log(`    All keys:`, Object.keys(doc))
  })
  
  let textContent = ''
  let audioTranscripts = ''
  let imageDescriptions = ''
  let imageUrls = []
  let hasVisualContent = false
  let hasAudioContent = false

  for (const doc of documentContext) {
    try {
      // Process based on file type
      console.log(`🔍 MULTIMODAL: Processing file ${doc.name} - Type: ${doc.type}`)
      
      if ((doc.type && doc.type.startsWith('image/')) || 
          (doc.type && ['webp', 'jpeg', 'jpg', 'png', 'gif', 'bmp', 'svg'].includes(doc.type.toLowerCase()))) {
        hasVisualContent = true
        console.log('🖼️ MULTIMODAL: Processing image:', doc.name)
        console.log('📝 MULTIMODAL: Image content available:', !!doc.content, 'Length:', doc.content?.length || 0)
        
        // For images, we could get the signed URL for direct GPT-4V analysis
        // For now, we'll use the content preview and add a placeholder URL
        if (doc.content) {
          imageDescriptions += `Image "${doc.name}": ${doc.content}\n\n`
          console.log('✅ MULTIMODAL: Added image description for', doc.name)
        } else {
          console.log('⚠️ MULTIMODAL: No content available for image', doc.name)
        }
        
        // Get actual signed URL for GPT-4V analysis
        const filePath = doc.storagePath || doc.storage_path || doc.file_path
        if (filePath) {
          try {
            console.log('🔗 MULTIMODAL: Attempting to get signed URL for path:', filePath)
            const signedUrl = await getSignedImageUrl(filePath)
            if (signedUrl) {
              imageUrls.push(signedUrl)
              console.log('✅ MULTIMODAL: Generated signed URL for', doc.name, '- URL length:', signedUrl.length)
            } else {
              console.log('⚠️ MULTIMODAL: Failed to generate signed URL for', doc.name)
            }
          } catch (error) {
            console.warn('⚠️ MULTIMODAL: Error getting signed URL for', doc.name, ':', error)
          }
        } else {
          console.log('⚠️ MULTIMODAL: No storage path available for', doc.name, '- Available keys:', Object.keys(doc))
        }
        
      } else if ((doc.type && (doc.type.startsWith('video/') || doc.type.startsWith('audio/'))) ||
                 (doc.type && ['mp4', 'avi', 'mov', 'wmv', 'mp3', 'wav', 'ogg', 'm4a'].includes(doc.type.toLowerCase()))) {
        hasAudioContent = true
        console.log('🎵 MULTIMODAL: Processing audio/video:', doc.name)
        console.log('📝 MULTIMODAL: Audio/video content available:', !!doc.content, 'Length:', doc.content?.length || 0)
        
        // For audio/video, we use the transcribed content
        if (doc.content) {
          audioTranscripts += `${doc.type.startsWith('video/') ? 'Video' : 'Audio'} "${doc.name}":\n${doc.content}\n\n`
          console.log('✅ MULTIMODAL: Added audio transcript for', doc.name)
        } else {
          console.log('⚠️ MULTIMODAL: No content available for audio/video', doc.name)
        }
        
        // TODO: Get transcription using the transcribe-audio API
        // const transcription = await transcribeFile(apiKey, doc.storageUrl, projectName, projectType)
        // audioTranscripts += transcription
        
      } else {
        // Text documents
        if (doc.content) {
          textContent += `Document "${doc.name}":\n${doc.content}\n\n`
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to process file:', doc.name, error)
    }
  }

  console.log('✅ Multi-modal processing complete:', {
    hasVisualContent,
    hasAudioContent,
    textLength: textContent.length,
    audioLength: audioTranscripts.length,
    imageDescLength: imageDescriptions.length,
    imageUrls: imageUrls.length
  })

  return {
    hasVisualContent,
    hasAudioContent,
    textContent: textContent.trim(),
    audioTranscripts: audioTranscripts.trim(),
    imageDescriptions: imageDescriptions.trim(),
    imageUrls
  }
}

// Supabase client for file operations
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ SUPABASE: Missing environment variables')
    return null
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

// Get signed URL for image file
async function getSignedImageUrl(filePath: string): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    console.warn('⚠️ SUPABASE: Client not available')
    return null
  }
  
  try {
    console.log('🔗 SUPABASE: Getting signed URL for:', filePath)
    
    // Try to get signed URL from project-files bucket
    const { data, error } = await supabase.storage
      .from('project-files')
      .createSignedUrl(filePath, 3600) // 1 hour expiry
    
    if (error) {
      console.error('❌ SUPABASE: Error creating signed URL:', error)
      return null
    }
    
    if (data?.signedUrl) {
      console.log('✅ SUPABASE: Generated signed URL successfully')
      return data.signedUrl
    }
    
    console.warn('⚠️ SUPABASE: No signed URL returned')
    return null
  } catch (error) {
    console.error('❌ SUPABASE: Exception getting signed URL:', error)
    return null
  }
}

// Dynamic prompt variation helpers to reduce repetitive AI responses
function getRandomTemperature(): number {
  const temperatures = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
  return temperatures[Math.floor(Math.random() * temperatures.length)]
}