// Simple JavaScript version of the projects endpoint for development
export default async function handler(req, res) {
  const startTime = performance.now()

  // Add CORS headers for development
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'http://localhost:3003'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization, Accept, Origin')

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    console.log(`[API /projects] Processing ${req.method} request`)

    if (req.method === 'GET') {
      // Mock projects response
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project 1',
          description: 'A test project for validation',
          created_at: new Date().toISOString()
        },
        {
          id: 'project-2',
          name: 'Test Project 2',
          description: 'Another test project',
          created_at: new Date().toISOString()
        }
      ]

      const endTime = performance.now()
      console.log(`[API /projects] ✅ GET request completed in ${(endTime - startTime).toFixed(2)}ms`)

      return res.status(200).json({
        projects: mockProjects,
        count: mockProjects.length,
        timestamp: new Date().toISOString()
      })
    }

    if (req.method === 'POST') {
      // Mock create project response
      const newProject = {
        id: `project-${Date.now()}`,
        name: req.body?.name || 'New Project',
        description: req.body?.description || '',
        created_at: new Date().toISOString()
      }

      const endTime = performance.now()
      console.log(`[API /projects] ✅ POST request completed in ${(endTime - startTime).toFixed(2)}ms`)

      return res.status(201).json({
        project: newProject,
        message: 'Project created successfully',
        timestamp: new Date().toISOString()
      })
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    const endTime = performance.now()
    console.error(`[API /projects] ❌ Error after ${(endTime - startTime).toFixed(2)}ms:`, error.message)

    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      timestamp: new Date().toISOString()
    })
  }
}