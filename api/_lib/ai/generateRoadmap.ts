/**
 * Generate Roadmap handler -- migrated from api/ai.ts to use AI SDK.
 *
 * Replaces raw fetch() to OpenAI API with generateText() via the AI Gateway.
 * Preserves identical response shape and project-type-specific prompt adaptation.
 * Handles both 'generate-roadmap' and 'generate-roadmap-v2' actions.
 */

import { generateText } from 'ai';
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../middleware/index.js';
import { checkLimit, trackAIUsage } from '../services/subscriptionService.js';
import { selectModel, getProviderOptions } from './modelRouter.js';
import { getModel } from './providers.js';
import { getActiveProfile } from './modelProfiles.js';
import { parseJsonResponse } from './utils/parsing.js';

// ============================================================================
// Project-type-specific prompt builders (moved from api/ai.ts per D-06)
// ============================================================================

/**
 * Returns project context configuration based on project type.
 */
function getProjectTypeContext(projectType: string) {
  const type = projectType.toLowerCase();

  if (type.includes('operations') || type.includes('improvement') || type.includes('optimization') || type.includes('process')) {
    return {
      approach: 'strategic_themes',
      focusAreas: [
        'Current State Assessment: Understanding existing processes, identifying pain points, and establishing baseline metrics',
        'Strategic Planning: Defining improvement objectives, prioritizing initiatives, and creating implementation roadmap',
        'Implementation: Executing process changes, training teams, and managing organizational transition',
        'Measurement & Optimization: Tracking improvements, gathering feedback, and continuous refinement',
      ],
      coreThemes: [
        'Process assessment and mapping',
        'Stakeholder alignment and change management',
        'Implementation planning and execution',
        'Performance measurement and continuous improvement',
      ],
    };
  }

  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return {
      approach: 'technical_implementation',
      focusAreas: [
        'PLATFORM/INFRASTRUCTURE: Backend APIs, databases, authentication, security, DevOps, system architecture',
        'FRONTEND/WEB: Frontend applications, web interfaces, user dashboards, responsive design',
        'MOBILE: Mobile applications, native features, app store deployment (if applicable)',
        'QA/TESTING: Testing frameworks, quality assurance, performance testing, automated testing',
      ],
      coreThemes: [
        'Backend API architecture and development',
        'Database design and implementation',
        'Authentication and security systems',
        'DevOps and deployment pipeline',
      ],
    };
  }

  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return {
      approach: 'marketing_strategy',
      focusAreas: [
        'CREATIVE: Content creation, design assets, brand materials, visual identity',
        'DIGITAL MARKETING: Social media, online advertising, email campaigns, SEO/SEM',
        'ANALYTICS: Performance tracking, data analysis, reporting, ROI measurement',
        'OPERATIONS: Campaign management, vendor coordination, budget management',
      ],
      coreThemes: [
        'Creative asset development and brand guidelines',
        'Digital marketing strategy and channel setup',
        'Analytics and measurement framework',
        'Campaign operations and workflow management',
      ],
    };
  }

  // Generic strategic approach
  return {
    approach: 'strategic_themes',
    focusAreas: [
      'PLANNING: Strategic planning, resource allocation, timeline management, risk assessment',
      'EXECUTION: Implementation, deliverable creation, quality control, milestone tracking',
      'COORDINATION: Stakeholder management, communication, change management, team alignment',
      'EVALUATION: Performance measurement, outcome assessment, feedback collection, reporting',
    ],
    coreThemes: [
      'Strategic planning and framework establishment',
      'Implementation strategy and execution plan',
      'Stakeholder coordination and communication systems',
      'Evaluation and measurement framework',
    ],
  };
}

/**
 * Returns a project-type-specific persona for roadmap generation.
 */
function getRoadmapPersona(projectType: string): string {
  const type = projectType.toLowerCase();

  if (type.includes('operations') || type.includes('improvement') || type.includes('optimization') || type.includes('process')) {
    return `You are a Senior Operations Strategy Consultant with 15+ years at leading consulting firms like McKinsey, Deloitte, and Accenture. You specialize in operational excellence, process improvement, and organizational transformation with proven success across multiple industries.

EXPERTISE AREAS: Process Optimization, Change Management, Stakeholder Alignment, Performance Measurement, Operational Strategy, Lean/Six Sigma, Digital Transformation, Organizational Design

APPROACH: Think strategically about operations improvement. Focus on current state assessment, stakeholder buy-in, sustainable change, and measurable business impact. Avoid overly technical solutions - emphasize people, process, and performance. Consider change management, training needs, and cultural factors.`;
  }

  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return `You are a Senior Software Engineering Manager with 12+ years at companies like Microsoft, Atlassian, and Spotify. You have deep expertise in technical roadmap planning, agile development, architecture decisions, and scaling engineering teams from MVP to enterprise-scale products.

EXPERTISE AREAS: Technical Architecture, Agile/Scrum Methodology, DevOps & Infrastructure, API Strategy, User Experience, Data Analytics, Security & Compliance, Team Management

APPROACH: Think like a Silicon Valley engineering leader. Focus on technical feasibility, scalability, user value, and sustainable development practices. Consider the full software development lifecycle, technical debt, and platform evolution.`;
  }

  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return `You are a VP of Marketing with 15+ years at high-growth companies like Shopify, Zoom, and Slack. You excel at campaign strategy, brand building, growth marketing, and performance optimization with proven track records of driving customer acquisition and revenue growth.

EXPERTISE AREAS: Campaign Strategy, Brand Management, Performance Marketing, Content Strategy, Customer Segmentation, Marketing Automation, Analytics & Attribution, Creative Development

APPROACH: Think like a data-driven marketing executive. Focus on audience insights, channel optimization, brand consistency, and measurable business outcomes. Consider the entire customer journey, lifecycle marketing, and long-term brand value.`;
  }

  if (type.includes('business') || type.includes('strategy') || type.includes('consulting')) {
    return `You are a Partner at a top-tier strategy consulting firm with MBA and 15+ years at firms like McKinsey, BCG, and Bain. You excel at strategic planning, business transformation, market analysis, and implementation roadmaps with proven results for Fortune 500 clients.

EXPERTISE AREAS: Strategic Planning, Market Analysis, Business Model Design, Operations Optimization, Change Management, Financial Modeling, Stakeholder Alignment, Implementation Planning

APPROACH: Think like a senior strategy consultant. Focus on data-driven insights, strategic frameworks, stakeholder alignment, and measurable business outcomes. Consider both strategic vision and tactical execution.`;
  }

  return `You are a Senior Program Manager with 10+ years leading complex, cross-functional initiatives across various industries. You excel at program planning, stakeholder management, resource optimization, and delivering results in dynamic environments.

EXPERTISE AREAS: Program Management, Strategic Planning, Stakeholder Management, Resource Optimization, Risk Management, Process Improvement, Change Management, Performance Measurement

APPROACH: Think like an experienced program leader. Focus on clear objectives, efficient execution, stakeholder satisfaction, and measurable outcomes. Consider both strategic goals and operational constraints.`;
}

/**
 * Returns clarifying questions specific to the project type.
 */
function getRoadmapClarifyingQuestions(projectType: string): string[] {
  const type = projectType.toLowerCase();

  if (type.includes('operations') || type.includes('improvement') || type.includes('optimization') || type.includes('process')) {
    return [
      'What are the specific operational pain points and inefficiencies?',
      'Who are the key stakeholders and what are their priorities?',
      'What current processes need to be assessed and potentially redesigned?',
      'How will we measure success and track improvements?',
      'What resistance to change should we anticipate and how will we address it?',
      'What resources and budget are available for implementation?',
      'What training and change management support will teams need?',
      'How will we ensure sustainability of improvements over time?',
    ];
  }

  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return [
      "What's the target user base and their technical proficiency?",
      'What are the key technical constraints and infrastructure requirements?',
      'How will we handle scalability and performance as we grow?',
      'What integrations and API requirements are critical?',
      'What security, privacy, and compliance standards must we meet?',
      'How will we approach testing, deployment, and monitoring?',
      "What's our technical debt management strategy?",
      'How will we measure user engagement and product success?',
    ];
  }

  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return [
      'Who is our target audience and what are their preferences?',
      "What's our unique value proposition and brand positioning?",
      'Which marketing channels will give us the best ROI?',
      'How will we measure campaign success and attribution?',
      "What's our budget and resource allocation strategy?",
      'How does this align with our overall brand strategy?',
      'What creative assets and content do we need to develop?',
      'How will we personalize messaging for different segments?',
    ];
  }

  // Default questions
  return [
    'What are the primary objectives and success criteria?',
    'Who are the key stakeholders and what do they need?',
    'What resources and constraints should we consider?',
    'What are the main risks and dependencies?',
    'How will we measure progress and success?',
    "What's the optimal timeline and milestone structure?",
    'What communication and coordination is required?',
    'How will we ensure quality and stakeholder satisfaction?',
  ];
}

/**
 * Returns industry-specific insights for roadmap generation.
 */
function getRoadmapIndustryInsights(projectType: string): string {
  const type = projectType.toLowerCase();

  if (type.includes('operations') || type.includes('improvement') || type.includes('optimization') || type.includes('process')) {
    return 'Operations improvement roadmaps succeed through stakeholder engagement, data-driven assessment, and sustainable change management. Focus on current state analysis, process redesign, pilot implementations, and phased rollouts. Prioritize quick wins, change management, training programs, and measurement systems. Avoid over-engineering solutions - emphasize practical improvements with clear business value.';
  }

  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return 'Software roadmaps succeed through user-centric development, technical excellence, and iterative delivery. Focus on MVP validation, scalable architecture, continuous deployment, and data-driven product decisions. Prioritize platform stability, security, and user experience while maintaining development velocity.';
  }

  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return 'Marketing roadmaps succeed through integrated campaign strategy, audience-first thinking, and performance optimization. Focus on brand consistency, multi-channel coordination, measurement frameworks, and agile campaign management. Prioritize customer journey optimization and sustainable growth.';
  }

  return 'Project roadmaps succeed through clear objectives, stakeholder alignment, efficient execution, and continuous adaptation. Focus on value delivery, risk management, resource optimization, and sustainable outcomes. Prioritize communication, quality, and stakeholder satisfaction.';
}

/**
 * Handles the generate-roadmap and generate-roadmap-v2 actions.
 *
 * Validates input, generates roadmap via AI SDK, and returns { roadmap: {...} }.
 */
export async function handleGenerateRoadmap(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const { projectName, projectType, ideas } = req.body;

    if (!projectName || !ideas || !Array.isArray(ideas)) {
      return res.status(400).json({ error: 'Project name and ideas array are required' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return res.status(500).json({ error: 'No AI service configured' });
    }

    // ADR-0015 Step 6: Quota enforcement before AI processing
    const userId = req.user!.id;
    const limitCheck = await checkLimit(userId, 'ai_roadmap');

    if (!limitCheck.canUse) {
      return res.status(402).json({
        error: {
          code: 'quota_exceeded',
          resource: 'ai_roadmap',
          limit: limitCheck.limit,
          used: limitCheck.current,
          upgradeUrl: '/pricing',
        },
      });
    }

    const roadmap = await generateRoadmapWithAI(projectName, projectType, ideas);

    // ADR-0015 Step 6: Track usage after successful generation
    await trackAIUsage(userId, 'ai_roadmap');

    return res.status(200).json({ roadmap });
  } catch (error) {
    console.error('Roadmap error:', error);
    return res.status(500).json({ error: 'Failed to generate roadmap' });
  }
}

/**
 * Generates a roadmap via AI SDK using the model router.
 */
async function generateRoadmapWithAI(
  projectName: string,
  projectType: string,
  ideas: any[],
): Promise<Record<string, unknown>> {
  // Profile-aware model routing (ADR-0013 Step 3)
  const profile = await getActiveProfile();
  const selection = selectModel({
    task: 'generate-roadmap',
    hasVision: false,
    hasAudio: false,
    userTier: 'free', // NOTE: userTier hardcoded to 'free' — per-tier routing deferred (ADR-0013 anti-goal)
  }, profile);

  const model = getModel(selection.gatewayModelId);
  const providerOptions = getProviderOptions(selection.fallbackModels);
  const projectContext = getProjectTypeContext(projectType);

  const systemPrompt = `${getRoadmapPersona(projectType)}

CRITICAL REQUIREMENTS - ADAPT YOUR APPROACH:
1. Project Approach: ${projectContext.approach}
2. Generate themes/epics aligned with these focus areas: ${projectContext.focusAreas.join(' | ')}
3. Core themes to incorporate (adapt to project context): ${projectContext.coreThemes.join(', ')}
4. Use terminology and language appropriate for ${projectType} projects
5. Balance strategic planning with practical implementation steps
6. For operations/improvement projects: Focus on assessments, process design, change management, and measurement rather than technical implementation
7. For technical projects: Include appropriate technical detail and development workflows

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
}`;

  const userPrompt = `Generate a comprehensive roadmap for this ${projectType} project. Adapt your approach based on the project type and context.

Project: ${projectName}
Type: ${projectType}
Ideas to incorporate: ${ideas.map(idea => `- ${idea.title}: ${idea.description}`).join('\n')}

PROJECT FOCUS AREAS (align epics with these themes):
${projectContext.focusAreas.map(area => `- ${area}`).join('\n')}

CORE THEMES to incorporate (adapt to project context):
${projectContext.coreThemes.map(theme => `- ${theme}`).join('\n')}

APPROACH GUIDANCE:
- For Operations/Improvement projects: Focus on strategic initiatives, process improvements, stakeholder engagement, and measurable outcomes rather than technical implementation details
- For Technical projects: Include appropriate technical depth and development workflows
- For Other projects: Balance strategic planning with practical execution steps

ROADMAP REQUIREMENTS:
1. Generate 3-5 logical phases appropriate for the project type (e.g., Assessment -> Planning -> Implementation -> Optimization)
2. Each phase should have 2-4 themes/epics with different priorities (high/medium/low)
3. Each epic should have 3-5 outcomes or objectives (use "As a [stakeholder], I want [outcome] so that [benefit]" format when appropriate, but adapt language to project type)
4. Each epic should have 2-4 key deliverables appropriate for the project type (processes, assessments, systems, etc.)
5. Include 2-3 realistic risks per phase with specific mitigation strategies
6. Provide 2-3 measurable success criteria per phase (KPIs, metrics, benchmarks)
7. Create 4-6 key milestones with specific timelines and detailed descriptions
8. Team recommendations should specify roles appropriate for the project type
9. Include complexity ratings (high/medium/low) for each epic
10. Relate epics back to original ideas by title when relevant
11. Ensure totalDuration covers all phases realistically
12. Content should be professional and actionable for the specific project domain

Generate a roadmap that creates a comprehensive, domain-appropriate plan.`;

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: selection.temperature,
    maxOutputTokens: selection.maxOutputTokens,
    ...(providerOptions ? { providerOptions } : {}),
  });

  // Parse response, fallback to empty object on failure (preserving original behavior)
  try {
    const parsed = parseJsonResponse(text);
    return parsed as Record<string, unknown>;
  } catch (_parseError) {
    return {};
  }
}
