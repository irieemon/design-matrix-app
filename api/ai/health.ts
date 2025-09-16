import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    const healthData = {
      timestamp: new Date().toISOString(),
      environment: 'production',
      apiKeys: {
        openai: !!openaiKey,
        anthropic: !!anthropicKey,
        openaiLength: openaiKey?.length || 0
      },
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      status: 'healthy'
    }
    
    console.log('🏥 Health check:', healthData)
    
    return res.status(200).json(healthData)
  } catch (error) {
    console.error('❌ Health check failed:', error)
    return res.status(500).json({ 
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}