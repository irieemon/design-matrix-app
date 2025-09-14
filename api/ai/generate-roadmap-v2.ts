export default async function handler(req, res) {
  console.log('🚀 Roadmap function started')
  
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  console.log('✅ POST method confirmed')
  
  try {
    console.log('📥 Basic validation started')
    
    const { projectName } = req.body || {}
    
    console.log('🔍 Project name:', projectName)
    
    if (!projectName) {
      console.log('❌ Missing project name')
      return res.status(400).json({ error: 'Project name required' })
    }
    
    console.log('✅ Creating simple response')
    
    const simpleResponse = { 
      message: 'Roadmap function working',
      projectName: projectName,
      timestamp: new Date().toISOString()
    }
    
    console.log('✅ Returning simple response')
    return res.status(200).json(simpleResponse)
    
  } catch (error) {
    console.error('❌ Error:', error)
    return res.status(500).json({ error: 'Function failed' })
  }
}