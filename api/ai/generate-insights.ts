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
    const { ideas, projectName, projectType, roadmapContext, documentContext, projectContext, modelSelection, taskContext, focusArea } = req.body

    console.log('🔍 Parsed request:', {
      ideasCount: ideas?.length || 0,
      projectName,
      projectType,
      hasRoadmapContext: !!roadmapContext,
      documentCount: documentContext?.length || 0,
      hasProjectContext: !!projectContext,
      hasModelSelection: !!modelSelection,
      selectedModel: modelSelection?.model || 'default',
      complexity: taskContext?.complexity || 'unknown',
      focusArea: focusArea || 'standard'
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
      console.log('🤖 Using OpenAI for insights generation')
      console.log('📊 Model Selection:', {
        model: modelSelection?.model || 'gpt-4o (default)',
        temperature: modelSelection?.temperature || 'dynamic',
        reasoning: modelSelection?.reasoning || 'No routing provided'
      })
      insights = await generateInsightsWithOpenAI(openaiKey, ideas, projectName, projectType, roadmapContext, documentContext, projectContext, modelSelection, focusArea)
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

async function generateInsightsWithOpenAI(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = [], _projectContext: any = null, modelSelection: any = null, focusArea: string = 'standard') {
  
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
  
  // Use cached AI analysis from pre-analyzed files
  console.log('🔄 OPENAI: Using cached AI analysis from files...')
  const multiModalContent = await processCachedFileAnalysis(documentContext)
  console.log('✅ OPENAI: Cached analysis processing complete:', {
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
      content: `You are an experienced strategic consultant who specializes in analyzing SPECIFIC project contexts. Your job is to provide insights that are deeply relevant to THIS PARTICULAR PROJECT.

CRITICAL INSTRUCTIONS:
1. ANALYZE WHAT'S ACTUALLY HERE: Look at the specific ideas, project name, and context provided. What do they tell you about the real business model, target market, and challenges?
2. BE SPECIFIC, NOT GENERIC: Instead of saying "focus on user experience," say "optimize the subscription onboarding flow" if that's what the ideas suggest.
3. REFERENCE ACTUAL IDEAS: Quote or reference the specific ideas provided. Don't invent generic scenarios.
4. THINK LIKE AN INSIDER: Write as if you understand this exact business and industry.

${multiModalContent.hasVisualContent ? 'VISUAL CONTEXT: This project includes images/videos. Analyze what they reveal about the product, market, or business model.' : ''}
${multiModalContent.hasAudioContent ? 'AUDIO CONTEXT: This project includes transcribed audio. Consider the spoken insights and strategic discussions.' : ''}

FORBIDDEN PATTERNS - Do NOT use these generic phrases:
- "focus on user experience" (be specific about WHAT user experience)
- "leverage digital marketing" (specify WHICH channels for WHAT purpose)
- "enhance community engagement" (explain HOW based on the actual business)
- "diverse marketing channels" (specify channels relevant to THIS project)
- "brand awareness initiatives" (detail what makes sense for THIS brand)

${focusArea === 'comprehensive-risk-analysis' ? `
ENHANCED RISK ANALYSIS MODE ACTIVATED:
Since this is a comprehensive risk assessment request, provide EXTRA THOROUGH risk analysis:
- Analyze each quadrant for specific risks (Quick Wins: execution risks, Major Projects: scope/complexity risks, etc.)
- Consider technical risks, market risks, operational risks, financial risks, and strategic risks
- Provide specific, actionable mitigations for each identified risk
- Include risk interdependencies and cascading effects
- Suggest risk monitoring and early warning indicators
- Prioritize risks by impact and likelihood
- Provide 5-8 specific risks and matching detailed mitigations
` : ''}

Instead, provide tactical, actionable insights that reference the actual ideas and project context.

RESPOND WITH VALID JSON ONLY - no explanatory text before or after.

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
    "risks": ["Specific risks and challenges for this project"],
    "mitigations": ["Practical strategies to address these risks"]
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
  // Build a detailed context analysis
  const ideaAnalysis = ideas.map((idea, index) => {
    const position = idea.quadrant || 'unknown'
    return `${index + 1}. "${idea.title}" (${position} quadrant)${idea.description ? ` - ${idea.description}` : ''}`
  }).join('\n')

  const projectContext = `
PROJECT ANALYSIS REQUIRED FOR: ${projectName} (${projectType})

SPECIFIC IDEAS TO ANALYZE:
${ideaAnalysis}

QUADRANT DISTRIBUTION:
- Quick Wins: ${ideas.filter(i => i.quadrant === 'quick-wins').length} ideas
- Major Projects: ${ideas.filter(i => i.quadrant === 'major-projects').length} ideas
- Fill-ins: ${ideas.filter(i => i.quadrant === 'fill-ins').length} ideas
- Thankless Tasks: ${ideas.filter(i => i.quadrant === 'thankless-tasks').length} ideas`

  userContent.push({
    type: 'text',
    text: `STRATEGIC ANALYSIS REQUEST:

${projectContext}

${roadmapContext ? `EXISTING ROADMAP CONTEXT: Previous planning exists - build on this foundation.` : ''}

${multiModalContent.textContent ? `
DOCUMENT INTELLIGENCE:
${multiModalContent.textContent}
` : ''}

${multiModalContent.audioTranscripts ? `
MEETING TRANSCRIPTS:
${multiModalContent.audioTranscripts}
` : ''}

${multiModalContent.imageDescriptions ? `
VISUAL ASSETS ANALYSIS:
${multiModalContent.imageDescriptions}
` : ''}

REQUIRED OUTPUT:
Analyze these SPECIFIC ideas and provide strategic insights that reference the actual project context. Look for:
1. What business model emerges from these ideas?
2. What market/customer segment do these ideas target?
3. Which ideas have synergies or conflicts?
4. What's missing from this portfolio?
5. What sequence makes strategic sense?

Be specific about THIS project - not generic business advice.`
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
    content: userContent as any // Mixed content array for GPT-4V (text + images)
  })
  
  // Map frontend model names to actual OpenAI API models
  function mapModelToOpenAI(modelName: string): string {
    const modelMapping: Record<string, string> = {
      // GPT-5 Series -> Use real GPT-5 models (now available!)
      'gpt-5': 'gpt-5',
      'gpt-5-mini': 'gpt-5-mini',
      'gpt-5-nano': 'gpt-5-nano',
      'gpt-5-chat-latest': 'gpt-5-chat-latest',

      // Research models -> Map to reasoning models
      'o3-deep-research': 'o1-preview',
      'o4-mini-deep-research': 'o1-mini',

      // Specialized models -> Use real GPT-5 or closest equivalent
      'gpt-realtime': 'gpt-realtime',

      // O-Series models - pass through unchanged
      'o1-preview': 'o1-preview',
      'o1-mini': 'o1-mini'
    }

    return modelMapping[modelName] || 'gpt-5'
  }

  // Use smart model selection or fallback to defaults
  const requestedModel = modelSelection?.model || 'gpt-5'
  const selectedModel = mapModelToOpenAI(requestedModel)
  const selectedTemperature = modelSelection?.temperature || getRandomTemperature(selectedModel)
  const selectedMaxTokens = modelSelection?.maxTokens || 4000

  console.log('🔄 OPENAI: Model mapping:', {
    requested: requestedModel,
    mapped: selectedModel,
    reasoning: requestedModel !== selectedModel ? 'Mapped to available OpenAI model' : 'Using original model'
  })

  console.log('📤 OPENAI: Preparing API request...')
  console.log('🎯 OPENAI: Smart Model Selection:', {
    model: selectedModel,
    temperature: selectedTemperature,
    maxTokens: selectedMaxTokens,
    reasoning: modelSelection?.reasoning || 'Default selection'
  })
  console.log('📋 OPENAI: Message count:', messages.length)
  console.log('📁 OPENAI: User content items:', userContent.length)
  userContent.forEach((item, index) => {
    console.log(`  ${index + 1}. Type: ${item.type}, ${item.type === 'text' ? `Text length: ${item.text?.length}` : 'Image URL provided'}`)
  })

  console.log('🌐 OPENAI: Making API call to OpenAI...')

  // GPT-5 models have stricter parameter requirements
  const isGPT5Model = selectedModel.startsWith('gpt-5') || selectedModel.startsWith('o1') || selectedModel.startsWith('o3') || selectedModel.startsWith('o4')

  // Handle token parameters: GPT-5 uses max_completion_tokens, older models use max_tokens
  const tokenParams = isGPT5Model
    ? { max_completion_tokens: selectedMaxTokens }
    : { max_tokens: selectedMaxTokens }

  // Handle temperature parameters: GPT-5 only supports default temperature (1)
  const temperatureParams = isGPT5Model
    ? {} // Omit temperature to use default (1) for GPT-5
    : { temperature: selectedTemperature }

  console.log('🔧 OPENAI: Parameter adjustments for model:', selectedModel)
  console.log('🔧 OPENAI: Token parameter:', isGPT5Model ? 'max_completion_tokens' : 'max_tokens')
  console.log('🔧 OPENAI: Temperature handling:', isGPT5Model ? 'default (1)' : `custom (${selectedTemperature})`)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModel,
      seed: Math.floor(Math.random() * 1000000),
      messages: messages,
      ...temperatureParams,
      ...tokenParams,
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

async function generateInsightsWithAnthropic(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = [], _projectContext: any = null) {
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
    "risks": ["Specific risks and challenges for this project"],
    "mitigations": ["Practical strategies to address these risks"]
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
// Unused function - keeping for potential future use
/*
async function _processMultiModalFiles(_apiKey: string, documentContext: any[] = [], _projectName: string, _projectType: string) {
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
              
              console.log('❌ MULTIMODAL: Skipping image - no signed URL available for:', doc.name)
            }
          } catch (error) {
            console.warn('⚠️ MULTIMODAL: Error getting signed URL for', doc.name, ':', error)
            
            console.log('❌ MULTIMODAL: Skipping image due to error getting signed URL:', doc.name)
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
*/

// Supabase client for file operations
function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
  
  console.log('🔑 SUPABASE: Environment check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    urlLength: supabaseUrl?.length || 0,
    keyLength: supabaseKey?.length || 0
  })
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ SUPABASE: Missing environment variables')
    console.warn('Available env vars:', Object.keys(process.env).filter(key => key.toLowerCase().includes('supabase')))
    return null
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

// Get signed URL for image file
async function _getSignedImageUrl(filePath: string): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    console.warn('⚠️ SUPABASE: Client not available')
    return null
  }
  
  try {
    console.log('🔗 SUPABASE: Getting signed URL for:', filePath)
    
    // Clean and normalize the storage path
    let cleanPath = filePath
    
    // Remove any leading slashes that might cause issues
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1)
      console.log('🧹 SUPABASE: Removed leading slash from path:', cleanPath)
    }
    
    console.log('🎯 SUPABASE: Attempting to access file at path:', cleanPath)
    
    // Try to get signed URL from project-files bucket
    const { data, error } = await supabase.storage
      .from('project-files')
      .createSignedUrl(cleanPath, 3600) // 1 hour expiry
    
    if (error) {
      console.error('❌ SUPABASE: Error creating signed URL:', error)
      console.error('❌ SUPABASE: Failed path:', cleanPath)
      
      // Try to list files in the project directory to debug
      try {
        const pathParts = cleanPath.split('/')
        if (pathParts.length >= 2) {
          const projectPath = `${pathParts[0]}/${pathParts[1]}`
          console.log('🔍 SUPABASE: Listing files in project directory:', projectPath)
          
          const { data: fileList, error: listError } = await supabase.storage
            .from('project-files')
            .list(projectPath)
          
          if (listError) {
            console.error('❌ SUPABASE: Could not list project files:', listError)
          } else {
            console.log('📁 SUPABASE: Files in project directory:', fileList?.map(f => f.name))
            
            // Check if there are files in the 'files' subdirectory
            if (pathParts.length >= 3) {
              const filesPath = `${pathParts[0]}/${pathParts[1]}/files`
              const { data: filesInDir, error: filesDirError } = await supabase.storage
                .from('project-files')
                .list(filesPath)
              
              if (!filesDirError && filesInDir) {
                console.log('📁 SUPABASE: Files in files subdirectory:', filesInDir.map(f => f.name))
                
                // Look for similar filenames
                const targetFileName = pathParts[pathParts.length - 1]
                const similarFiles = filesInDir.filter(f => 
                  f.name.includes(targetFileName.substring(0, 10)) || 
                  targetFileName.includes(f.name.substring(0, 10))
                )
                if (similarFiles.length > 0) {
                  console.log('🔍 SUPABASE: Found similar files:', similarFiles.map(f => f.name))
                }
              }
            }
          }
        }
      } catch (debugError) {
        console.warn('⚠️ SUPABASE: Debug file listing failed:', debugError)
      }
      
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

// Cached file analysis processor - uses pre-analyzed file results
async function processCachedFileAnalysis(documentContext: any[] = []) {
  console.log('📋 CACHED: Starting cached file analysis processing')
  console.log('📁 CACHED: Input files count:', documentContext?.length || 0)
  
  if (!documentContext || documentContext.length === 0) {
    console.log('⚠️ CACHED: No documents provided, returning empty result')
    return {
      hasVisualContent: false,
      hasAudioContent: false,
      textContent: '',
      audioTranscripts: '',
      imageDescriptions: '',
      imageUrls: []
    }
  }

  let textContent = ''
  let audioTranscripts = ''
  let imageDescriptions = ''
  let imageUrls: string[] = []
  let hasVisualContent = false
  let hasAudioContent = false

  for (const doc of documentContext) {
    try {
      console.log(`🔍 CACHED: Processing file ${doc.name}`)
      
      // Check if file has cached AI analysis
      if (doc.ai_analysis && doc.analysis_status === 'completed') {
        console.log('✅ CACHED: Using pre-analyzed results for', doc.name)
        const analysis = doc.ai_analysis
        
        // Add summary and insights to text content
        if (analysis.summary) {
          textContent += `File Analysis - ${doc.name}:\n${analysis.summary}\n\n`
        }
        
        if (analysis.key_insights && analysis.key_insights.length > 0) {
          textContent += `Key Insights from ${doc.name}:\n${analysis.key_insights.map((insight: string) => `- ${insight}`).join('\n')}\n\n`
        }
        
        // Add extracted content based on type
        if (analysis.content_type === 'image' && analysis.visual_description) {
          hasVisualContent = true
          imageDescriptions += `Image "${doc.name}": ${analysis.visual_description}\n\n`
          
          // If we have extracted text from the image, add it
          if (analysis.extracted_text) {
            textContent += `Text extracted from image ${doc.name}: ${analysis.extracted_text}\n\n`
          }
        }
        
        if ((analysis.content_type === 'audio' || analysis.content_type === 'video') && analysis.audio_transcript) {
          hasAudioContent = true
          audioTranscripts += `Audio from ${doc.name}: ${analysis.audio_transcript}\n\n`
        }
        
        if (analysis.content_type === 'text' && analysis.extracted_text) {
          textContent += `Content from ${doc.name}: ${analysis.extracted_text}\n\n`
        }
        
        console.log(`✅ CACHED: Processed analysis for ${doc.name} (${analysis.content_type})`)
      } else {
        // Fallback to existing content if no analysis available
        console.log('⚠️ CACHED: No analysis available for', doc.name, 'using fallback content')
        
        if (doc.content) {
          if (doc.type && doc.type.startsWith('image/')) {
            hasVisualContent = true
            imageDescriptions += `Image "${doc.name}": ${doc.content}\n\n`
          } else {
            textContent += `Content from ${doc.name}: ${doc.content}\n\n`
          }
        }
      }
      
    } catch (error) {
      console.warn('⚠️ CACHED: Error processing file', doc.name, ':', error)
      // Continue with other files
    }
  }

  const result = {
    hasVisualContent,
    hasAudioContent,
    textContent,
    audioTranscripts,
    imageDescriptions,
    imageUrls
  }
  
  console.log('📊 CACHED: Processing complete:', {
    hasVisualContent: result.hasVisualContent,
    hasAudioContent: result.hasAudioContent,
    textLength: result.textContent.length,
    audioLength: result.audioTranscripts.length,
    imageDescLength: result.imageDescriptions.length,
    imageUrls: result.imageUrls.length
  })
  
  return result
}

// Dynamic prompt variation helpers to reduce repetitive AI responses
function getRandomTemperature(model?: string): number {
  // GPT-5 models only support default temperature (1)
  if (model && (model.startsWith('gpt-5') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4'))) {
    return 1
  }

  // For older models, use varied temperatures
  const temperatures = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
  return temperatures[Math.floor(Math.random() * temperatures.length)]
}