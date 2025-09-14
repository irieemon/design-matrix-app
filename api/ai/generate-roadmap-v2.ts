import { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticate, checkUserRateLimit } from '../auth/middleware.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  // Authenticate user (optional)
  const { user } = await authenticate(req)
  
  // Rate limiting
  const rateLimitKey = user?.id || (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown')
  const rateLimit = user ? 8 : 3 // Lower limit for roadmap generation
  
  if (!checkUserRateLimit(rateLimitKey, rateLimit)) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please try again later.',
      suggestion: user ? 'Try again in a minute.' : 'Sign in for higher rate limits.'
    })
  }
  
  try {
    console.log('📥 Roadmap request:', req.body)
    
    const { projectName, projectType, ideas } = req.body
    
    if (!projectName || !ideas || !Array.isArray(ideas)) {
      console.error('❌ Missing required fields')
      return res.status(400).json({ error: 'Project name and ideas array are required' })
    }
    
    const openaiKey = process.env.OPENAI_API_KEY
    console.log('🔑 OpenAI key available:', !!openaiKey)
    
    if (!openaiKey) {
      return res.status(500).json({ error: 'No AI service configured' })
    }
    
    let roadmap = {}
    
    if (openaiKey) {
      roadmap = await generateRoadmapWithOpenAI(openaiKey, projectName, projectType, ideas)
    }
    
    return res.status(200).json({ roadmap })
    
  } catch (error) {
    console.error('❌ Roadmap error:', error)
    return res.status(500).json({ error: 'Failed to generate roadmap' })
  }
}

async function generateRoadmapWithOpenAI(apiKey: string, projectName: string, projectType: string, ideas: any[]) {
  
  // Define contextual team structures based on project type
  const getProjectTypeContext = (projectType: string) => {
    const type = projectType.toLowerCase()
    
    if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
      return {
        teams: [
          'PLATFORM/INFRASTRUCTURE: Backend APIs, databases, authentication, security, DevOps, system architecture, data models, cloud infrastructure',
          'FRONTEND/WEB: Frontend applications, web interfaces, user dashboards, responsive design, web-based features',
          'MOBILE: Mobile applications, native features, app store deployment (if applicable)',
          'QA/TESTING: Testing frameworks, quality assurance, performance testing, automated testing'
        ],
        mandatoryEpics: [
          'Backend API architecture and development',
          'Database design and implementation',
          'Authentication and security systems',
          'DevOps and deployment pipeline'
        ]
      }
    } else if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
      return {
        teams: [
          'CREATIVE: Content creation, design assets, brand materials, visual identity',
          'DIGITAL MARKETING: Social media, online advertising, email campaigns, SEO/SEM',
          'ANALYTICS: Performance tracking, data analysis, reporting, ROI measurement',
          'OPERATIONS: Campaign management, vendor coordination, budget management, timeline execution'
        ],
        mandatoryEpics: [
          'Creative asset development and brand guidelines',
          'Digital marketing strategy and channel setup',
          'Analytics and measurement framework',
          'Campaign operations and workflow management'
        ]
      }
    } else if (type.includes('event') || type.includes('conference') || type.includes('meeting')) {
      return {
        teams: [
          'PLANNING: Event logistics, venue management, timeline coordination, vendor selection',
          'MARKETING: Promotion strategy, attendee acquisition, communications, brand presence',
          'OPERATIONS: Registration systems, on-site coordination, technical setup, staff management',
          'EXPERIENCE: Content curation, speaker management, attendee engagement, networking facilitation'
        ],
        mandatoryEpics: [
          'Event planning and logistics coordination',
          'Marketing and attendee acquisition strategy',
          'Registration and operational systems',
          'Content and experience design'
        ]
      }
    } else if (type.includes('research') || type.includes('study') || type.includes('analysis')) {
      return {
        teams: [
          'RESEARCH: Data collection, survey design, interview protocols, literature review',
          'ANALYSIS: Data processing, statistical analysis, pattern identification, insights generation',
          'DOCUMENTATION: Report writing, visualization, presentation development, publication',
          'STAKEHOLDER: Stakeholder communication, findings dissemination, recommendation implementation'
        ],
        mandatoryEpics: [
          'Research methodology and data collection framework',
          'Data analysis and insights generation',
          'Documentation and reporting systems',
          'Stakeholder engagement and communication plan'
        ]
      }
    } else if (type.includes('business') || type.includes('strategy') || type.includes('consulting')) {
      return {
        teams: [
          'STRATEGY: Business analysis, market research, competitive analysis, strategic planning',
          'OPERATIONS: Process optimization, workflow design, resource allocation, implementation',
          'STAKEHOLDER: Client management, communication, change management, training',
          'MEASUREMENT: KPI definition, performance tracking, ROI analysis, reporting'
        ],
        mandatoryEpics: [
          'Strategic analysis and planning framework',
          'Operational process design and optimization',
          'Stakeholder engagement and change management',
          'Performance measurement and tracking systems'
        ]
      }
    } else {
      // Generic project structure
      return {
        teams: [
          'PLANNING: Project planning, resource allocation, timeline management, risk assessment',
          'EXECUTION: Implementation, deliverable creation, quality control, milestone tracking',
          'COORDINATION: Team management, communication, stakeholder alignment, vendor management',
          'EVALUATION: Performance measurement, outcome assessment, feedback collection, reporting'
        ],
        mandatoryEpics: [
          'Project planning and framework establishment',
          'Implementation strategy and execution plan',
          'Coordination and communication systems',
          'Evaluation and measurement framework'
        ]
      }
    }
  }

  const projectContext = getProjectTypeContext(projectType)
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${getRoadmapPersona(projectType)}

CRITICAL REQUIREMENTS - YOU MUST FOLLOW THESE:
1. Generate epics for the contextual team structure based on project type: ${projectContext.teams.join(', ')}
2. Each team should have 2-4 epics appropriate to their domain and the project type
3. MANDATORY CORE EPICS for this project type (include variations of these): ${projectContext.mandatoryEpics.join(', ')}
4. Use terminology and keywords specific to the project type domain
5. Each epic must be specific, actionable, and relevant to the project type

CLARIFYING QUESTIONS TO CONSIDER:
${getRoadmapClarifyingQuestions(projectType).map(q => `- ${q}`).join('\n')}

INDUSTRY-SPECIFIC SUCCESS PATTERNS:
${getRoadmapIndustryInsights(projectType)}

Return a JSON object with this EXACT structure matching the RoadmapData interface:
{
  "roadmapAnalysis": {
    "totalDuration": "12-16 weeks",
    "phases": [
      {
        "phase": "Foundation & Planning",
        "duration": "3-4 weeks",
        "description": "Detailed phase description explaining goals, approach, and expected outcomes",
        "epics": [
          {
            "title": "Epic Title (specific and actionable)",
            "description": "Comprehensive epic description with technical details and business value",
            "userStories": ["As a [user type], I want [functionality] so that [benefit]", "Another user story"],
            "deliverables": ["Specific deliverable 1", "Specific deliverable 2", "Technical artifact"],
            "priority": "high|medium|low",
            "complexity": "high|medium|low",
            "relatedIdeas": ["idea title 1", "idea title 2"]
          }
        ],
        "risks": ["Specific risk with mitigation strategy", "Another risk"],
        "successCriteria": ["Measurable success criteria 1", "Measurable success criteria 2"]
      }
    ]
  },
  "executionStrategy": {
    "methodology": "Agile Development with 2-week sprints",
    "sprintLength": "2 weeks",
    "teamRecommendations": "Detailed team structure recommendation including roles, skills, and responsibilities needed for successful execution",
    "keyMilestones": [
      {
        "milestone": "Phase 1 Completion",
        "timeline": "Week 4",
        "description": "Detailed milestone description with deliverables and acceptance criteria"
      }
    ]
  }
}`
        },
        {
          role: 'user',
          content: `Generate a comprehensive roadmap for this ${projectType} project. YOU MUST create epics for all team areas relevant to this project type.

Project: ${projectName}
Type: ${projectType}
Ideas to incorporate: ${ideas.map(idea => `- ${idea.title}: ${idea.description}`).join('\n')}

MANDATORY TEAM DISTRIBUTION (create epics for these areas):
${projectContext.teams.map(team => `- ${team}`).join('\n')}

CORE REQUIRED EPICS for this project type (must include variations of these):
${projectContext.mandatoryEpics.map(epic => `- "${epic}"`).join('\n')}

IMPORTANT: 
- Use terminology and keywords specific to ${projectType} projects
- Each epic should be relevant to the project type and team domain
- Ensure deliverables are appropriate for ${projectType} projects
- Focus on outcomes and value specific to this project type

Requirements for comprehensive roadmap:
1. Generate 3-5 logical phases (Foundation, Development, Enhancement, Testing, Launch)
2. Each phase should have 2-4 epics with different priorities (high/medium/low)
3. Each epic should have 3-5 detailed user stories in "As a [user], I want [goal] so that [benefit]" format
4. Each epic should have 2-4 specific technical deliverables (APIs, databases, UI components, etc.)
5. Include 2-3 realistic risks per phase with specific mitigation strategies
6. Provide 2-3 measurable success criteria per phase (KPIs, metrics, benchmarks)
7. Create 4-6 key milestones with specific week timelines and detailed descriptions
8. Team recommendations should specify exact roles: Product Owner, Tech Lead, Frontend Dev, Backend Dev, QA, DevOps
9. Include complexity ratings (high/medium/low) for each epic
10. Relate epics back to original ideas by title
11. Ensure totalDuration covers all phases realistically
12. All content should be detailed enough for enterprise-level documentation

Generate a roadmap that will create a beautiful, comprehensive PDF report with professional depth.`
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  })
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.choices[0]?.message?.content || '{}'
  
  try {
    // Strip markdown code blocks if present
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    return JSON.parse(cleanContent)
  } catch {
    return {}
  }
}

function getRoadmapPersona(projectType: string): string {
  const type = projectType.toLowerCase()
  
  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return `You are a Senior Software Engineering Manager with 12+ years at companies like Microsoft, Atlassian, and Spotify. You have deep expertise in technical roadmap planning, agile development, architecture decisions, and scaling engineering teams from MVP to enterprise-scale products.

EXPERTISE AREAS: Technical Architecture, Agile/Scrum Methodology, DevOps & Infrastructure, API Strategy, User Experience, Data Analytics, Security & Compliance, Team Management

APPROACH: Think like a Silicon Valley engineering leader. Focus on technical feasibility, scalability, user value, and sustainable development practices. Consider the full software development lifecycle, technical debt, and platform evolution.`
  }
  
  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return `You are a VP of Marketing with 15+ years at high-growth companies like Shopify, Zoom, and Slack. You excel at campaign strategy, brand building, growth marketing, and performance optimization with proven track records of driving customer acquisition and revenue growth.

EXPERTISE AREAS: Campaign Strategy, Brand Management, Performance Marketing, Content Strategy, Customer Segmentation, Marketing Automation, Analytics & Attribution, Creative Development

APPROACH: Think like a data-driven marketing executive. Focus on audience insights, channel optimization, brand consistency, and measurable business outcomes. Consider the entire customer journey, lifecycle marketing, and long-term brand value.`
  }
  
  if (type.includes('event') || type.includes('conference') || type.includes('meeting')) {
    return `You are a Director of Events with 10+ years producing major conferences like CES, SXSW, and corporate summits for Fortune 500 companies. You excel at event strategy, experience design, logistics coordination, and delivering measurable ROI from events.

EXPERTISE AREAS: Event Strategy, Experience Design, Logistics Management, Vendor Coordination, Sponsorship Strategy, Technology Integration, Budget Management, Risk Management

APPROACH: Think like a strategic event producer. Focus on attendee experience, operational excellence, stakeholder satisfaction, and measurable outcomes. Consider every touchpoint from registration to post-event follow-up.`
  }
  
  if (type.includes('research') || type.includes('study') || type.includes('analysis')) {
    return `You are a Principal Research Manager with PhD-level expertise and 12+ years leading research initiatives at institutions like Stanford Research Institute, McKinsey Global Institute, and Google Research. You excel at research design, methodology, and translating insights into actionable strategies.

EXPERTISE AREAS: Research Methodology, Data Collection, Statistical Analysis, Literature Review, Study Design, Data Visualization, Report Writing, Knowledge Translation

APPROACH: Think like a senior research leader. Focus on methodological rigor, research quality, stakeholder communication, and practical applications. Consider both theoretical frameworks and real-world implementation.`
  }
  
  if (type.includes('business') || type.includes('strategy') || type.includes('consulting')) {
    return `You are a Partner at a top-tier strategy consulting firm with MBA and 15+ years at firms like McKinsey, BCG, and Bain. You excel at strategic planning, business transformation, market analysis, and implementation roadmaps with proven results for Fortune 500 clients.

EXPERTISE AREAS: Strategic Planning, Market Analysis, Business Model Design, Operations Optimization, Change Management, Financial Modeling, Stakeholder Alignment, Implementation Planning

APPROACH: Think like a senior strategy consultant. Focus on data-driven insights, strategic frameworks, stakeholder alignment, and measurable business outcomes. Consider both strategic vision and tactical execution.`
  }
  
  return `You are a Senior Program Manager with 10+ years leading complex, cross-functional initiatives across various industries. You excel at program planning, stakeholder management, resource optimization, and delivering results in dynamic environments.

EXPERTISE AREAS: Program Management, Strategic Planning, Stakeholder Management, Resource Optimization, Risk Management, Process Improvement, Change Management, Performance Measurement

APPROACH: Think like an experienced program leader. Focus on clear objectives, efficient execution, stakeholder satisfaction, and measurable outcomes. Consider both strategic goals and operational constraints.`
}

function getRoadmapClarifyingQuestions(projectType: string): string[] {
  const type = projectType.toLowerCase()
  
  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return [
      "What's the target user base and their technical proficiency?",
      "What are the key technical constraints and infrastructure requirements?",
      "How will we handle scalability and performance as we grow?",
      "What integrations and API requirements are critical?",
      "What security, privacy, and compliance standards must we meet?",
      "How will we approach testing, deployment, and monitoring?",
      "What's our technical debt management strategy?",
      "How will we measure user engagement and product success?"
    ]
  }
  
  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return [
      "Who is our target audience and what are their preferences?",
      "What's our unique value proposition and brand positioning?",
      "Which marketing channels will give us the best ROI?",
      "How will we measure campaign success and attribution?",
      "What's our budget and resource allocation strategy?",
      "How does this align with our overall brand strategy?",
      "What creative assets and content do we need to develop?",
      "How will we personalize messaging for different segments?"
    ]
  }
  
  if (type.includes('event') || type.includes('conference') || type.includes('meeting')) {
    return [
      "What are the primary goals and success metrics for this event?",
      "Who is our target attendee and what do they value most?",
      "What's our budget range and optimal resource allocation?",
      "What venue type and format will best serve our objectives?",
      "How will we attract and register the right audience?",
      "What content and speakers will provide maximum value?",
      "How will we facilitate networking and engagement?",
      "What technology do we need for seamless execution?"
    ]
  }
  
  if (type.includes('research') || type.includes('study') || type.includes('analysis')) {
    return [
      "What specific research questions are we trying to answer?",
      "What methodology will give us the most reliable results?",
      "Who are our target participants and how will we recruit them?",
      "What existing data sources and literature should we review?",
      "How will we ensure research quality and minimize bias?",
      "What timeline and resources do we need for proper execution?",
      "How will we analyze and present findings to stakeholders?",
      "What ethical considerations and approvals are required?"
    ]
  }
  
  if (type.includes('business') || type.includes('strategy') || type.includes('consulting')) {
    return [
      "What are the core strategic objectives and success metrics?",
      "What's the competitive landscape and market opportunity?",
      "What are the key stakeholders and their priorities?",
      "What resources and capabilities do we have available?",
      "What are the main risks and mitigation strategies?",
      "How will we measure progress and adapt our approach?",
      "What change management considerations are critical?",
      "What's the optimal implementation timeline and sequence?"
    ]
  }
  
  return [
    "What are the primary objectives and success criteria?",
    "Who are the key stakeholders and what do they need?",
    "What resources and constraints should we consider?",
    "What are the main risks and dependencies?",
    "How will we measure progress and success?",
    "What's the optimal timeline and milestone structure?",
    "What communication and coordination is required?",
    "How will we ensure quality and stakeholder satisfaction?"
  ]
}

function getRoadmapIndustryInsights(projectType: string): string {
  const type = projectType.toLowerCase()
  
  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return `Software roadmaps succeed through user-centric development, technical excellence, and iterative delivery. Focus on MVP validation, scalable architecture, continuous deployment, and data-driven product decisions. Prioritize platform stability, security, and user experience while maintaining development velocity.`
  }
  
  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return `Marketing roadmaps succeed through integrated campaign strategy, audience-first thinking, and performance optimization. Focus on brand consistency, multi-channel coordination, measurement frameworks, and agile campaign management. Prioritize customer journey optimization and sustainable growth.`
  }
  
  if (type.includes('event') || type.includes('conference') || type.includes('meeting')) {
    return `Event roadmaps succeed through experience design, operational excellence, and stakeholder alignment. Focus on attendee value, logistics coordination, technology integration, and measurable outcomes. Prioritize risk management, vendor relationships, and post-event optimization.`
  }
  
  if (type.includes('research') || type.includes('study') || type.includes('analysis')) {
    return `Research roadmaps succeed through methodological rigor, stakeholder engagement, and knowledge translation. Focus on research quality, data integrity, timeline management, and practical application. Prioritize ethical considerations, collaboration, and effective communication of findings.`
  }
  
  if (type.includes('business') || type.includes('strategy') || type.includes('consulting')) {
    return `Business roadmaps succeed through strategic clarity, stakeholder alignment, and disciplined execution. Focus on market insights, competitive positioning, operational excellence, and measurable value creation. Prioritize change management, capability building, and sustainable competitive advantages.`
  }
  
  return `Project roadmaps succeed through clear objectives, stakeholder alignment, efficient execution, and continuous adaptation. Focus on value delivery, risk management, resource optimization, and sustainable outcomes. Prioritize communication, quality, and stakeholder satisfaction.`
}