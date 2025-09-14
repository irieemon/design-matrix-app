import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    const config = {
      openaiConfigured: !!openaiKey,
      anthropicConfigured: !!anthropicKey,
      openaiKeyPrefix: openaiKey ? openaiKey.substring(0, 7) + '...' : 'Not set',
      anthropicKeyPrefix: anthropicKey ? anthropicKey.substring(0, 7) + '...' : 'Not set',
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString()
    }
    
    return res.status(200).json(config)
    
  } catch (error) {
    console.error('Error checking config:', error)
    return res.status(500).json({ error: 'Failed to check configuration' })
  }
}