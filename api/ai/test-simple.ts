import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    if (!openaiKey && !anthropicKey) {
      return res.status(500).json({ 
        error: 'No AI service configured', 
        details: 'Neither OPENAI_API_KEY nor ANTHROPIC_API_KEY environment variables are set' 
      })
    }
    
    // Simple test with minimal data
    const testIdeas = [
      { title: 'Test Idea 1', description: 'A simple test idea', quadrant: 'quick-wins' }
    ]
    
    let result = null
    let service = ''
    
    if (openaiKey) {
      service = 'OpenAI'
      console.log('Testing OpenAI with key:', openaiKey.substring(0, 7) + '...')
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: 'Return a simple JSON object with just: {"test": "success", "message": "AI is working"}'
            }
          ],
          temperature: 0.1,
          max_tokens: 100,
        }),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
      }
      
      const data = await response.json()
      result = {
        service,
        success: true,
        response: data.choices[0]?.message?.content,
        usage: data.usage
      }
      
    } else if (anthropicKey) {
      service = 'Anthropic'
      console.log('Testing Anthropic with key:', anthropicKey.substring(0, 7) + '...')
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'Return a simple JSON object with just: {"test": "success", "message": "AI is working"}'
            }
          ]
        }),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Anthropic API error ${response.status}: ${errorText}`)
      }
      
      const data = await response.json()
      result = {
        service,
        success: true,
        response: data.content[0]?.text,
        usage: data.usage
      }
    }
    
    return res.status(200).json(result)
    
  } catch (error) {
    console.error('Test error:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Simple AI API test failed'
    })
  }
}