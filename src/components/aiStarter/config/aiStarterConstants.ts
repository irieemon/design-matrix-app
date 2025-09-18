// AI Starter Configuration Constants

import type { ProjectType } from '../../../types'

// Form validation constants
export const AI_STARTER_VALIDATION = {
  MIN_PROJECT_NAME_LENGTH: 1,
  MIN_PROJECT_DESCRIPTION_LENGTH: 1,
  MIN_DESCRIPTION_FOR_CLARIFICATION: 50,
  MIN_IDEA_COUNT: 3,
  MAX_IDEA_COUNT: 12,
  DEFAULT_IDEA_COUNT: 8,
  MIN_IDEA_TOLERANCE: 0,
  MAX_IDEA_TOLERANCE: 100,
  DEFAULT_IDEA_TOLERANCE: 50
} as const

// Project type options with display labels
export const PROJECT_TYPE_OPTIONS = [
  { value: 'auto', label: '🤖 Let AI recommend' },
  { value: 'software', label: '💻 Software Development' },
  { value: 'product_development', label: '🛠️ Product Development' },
  { value: 'business_plan', label: '📊 Business Plan' },
  { value: 'marketing', label: '📢 Marketing Campaign' },
  { value: 'operations', label: '⚙️ Operations Improvement' },
  { value: 'research', label: '🔬 Research & Development' },
  { value: 'other', label: '❓ Other' }
] as const

// Industry options with display labels
export const INDUSTRY_OPTIONS = [
  { value: 'auto', label: '🤖 Let AI recommend' },
  { value: 'Healthcare', label: '🏥 Healthcare' },
  { value: 'Technology', label: '💻 Technology' },
  { value: 'Finance', label: '💰 Finance' },
  { value: 'Education', label: '🎓 Education' },
  { value: 'Retail', label: '🛍️ Retail & E-commerce' },
  { value: 'Real Estate', label: '🏠 Real Estate' },
  { value: 'Food & Hospitality', label: '🍽️ Food & Hospitality' },
  { value: 'Non-profit', label: '❤️ Non-profit' },
  { value: 'Manufacturing', label: '🏭 Manufacturing' },
  { value: 'Construction', label: '🔨 Construction' },
  { value: 'Transportation', label: '🚚 Transportation' },
  { value: 'Media & Entertainment', label: '🎬 Media & Entertainment' },
  { value: 'Professional Services', label: '💼 Professional Services' },
  { value: 'General', label: '📋 General' }
] as const

// Priority styling classes
export const PRIORITY_STYLES = {
  high: 'bg-red-100 text-red-800',
  strategic: 'bg-blue-100 text-blue-800',
  moderate: 'bg-amber-100 text-amber-800',
  innovation: 'bg-purple-100 text-purple-800',
  low: 'bg-slate-100 text-slate-800'
} as const

// Step configuration
export const AI_STARTER_STEPS = {
  INITIAL: 'initial',
  QUESTIONS: 'questions',
  GENERATING: 'generating',
  REVIEW: 'review'
} as const

// UI Messages and labels
export const AI_STARTER_MESSAGES = {
  FORM_TITLE: 'AI Project Starter',
  FORM_SUBTITLE: 'Let AI help you set up your project and generate prioritized ideas',
  QUESTIONS_TITLE: 'A few questions to help me understand better',
  QUESTIONS_SUBTITLE: 'This will help generate more relevant and strategic ideas for your project',
  REVIEW_TITLE: 'Project Analysis Complete',
  REVIEW_SUBTITLE: 'Review the generated ideas and create your project',
  INDUSTRY_HELP_TEXT: 'This helps generate more relevant roadmaps, user stories, and industry-specific recommendations',
  TOLERANCE_HELP_TEXT: 'Higher tolerance includes more experimental or challenging ideas',
  HOW_IT_WORKS_TITLE: 'How it works',
  LOADING_ANALYZING: 'Analyzing...',
  LOADING_GENERATING: 'Generating Ideas...',
  LOADING_CREATING: 'Creating...',
  BUTTON_START_ANALYSIS: 'Start AI Analysis',
  BUTTON_GENERATE_IDEAS: 'Generate Ideas',
  BUTTON_BACK: 'Back',
  BUTTON_CANCEL: 'Cancel',
  ERROR_ANALYSIS_FAILED: 'Failed to analyze project. Please try again.',
  ERROR_GENERATION_FAILED: 'Failed to generate ideas. Please try again.',
  ERROR_CREATION_FAILED: 'Failed to create project and ideas. Please try again.'
} as const

// Form field configurations
export const FORM_FIELDS = {
  PROJECT_NAME: {
    label: 'Project Name',
    placeholder: 'e.g., Mobile App Launch, Marketing Campaign, Process Improvement'
  },
  PROJECT_DESCRIPTION: {
    label: 'Project Description',
    placeholder: 'Describe your project goals, target audience, scope, timeline, or any other relevant details...',
    rows: 4
  },
  PROJECT_TYPE: {
    label: 'Project Type'
  },
  INDUSTRY: {
    label: 'Industry'
  },
  IDEA_COUNT: {
    label: 'Number of Ideas'
  },
  IDEA_TOLERANCE: {
    label: 'Idea Tolerance',
    minLabel: 'Conservative',
    maxLabel: 'Experimental'
  },
  QUESTION_ANSWER: {
    placeholder: 'Your answer...',
    rows: 2
  }
} as const

// Pattern matching configurations for project analysis
export const ANALYSIS_PATTERNS = {
  GOALS: {
    PRODUCT_LAUNCH: /(launch|release)/,
    PROCESS_IMPROVEMENT: /(improve|optimize)/,
    MARKET_EXPANSION: /(market|campaign)/,
    DEVELOPMENT: /(develop|build)/,
    RESEARCH: /research/
  },
  TIMELINE: {
    SHORT_TERM: /(quarter|3 month|short)/,
    LONG_TERM: /(year|annual|long)/
  },
  INDUSTRY: {
    HEALTHCARE: /(healthcare|health|medical|care|senior|elder|aging|caregiver|patient|clinical|wellness|therapy|nursing)/,
    FINANCE: /(finance|financial|bank|investment|insurance|loan|credit|payment|trading|fintech)/,
    EDUCATION: /(education|school|university|learning|training|course|curriculum|student|academic)/,
    RETAIL: /(retail|ecommerce|e-commerce|store|shop|product|inventory|sales|customer|commerce)/,
    REAL_ESTATE: /(real estate|property|housing|rental|lease|commercial|residential)/,
    FOOD_HOSPITALITY: /(restaurant|food|hospitality|hotel|catering|dining|cuisine|chef)/,
    NONPROFIT: /(nonprofit|non-profit|charity|community|volunteer|social impact|foundation|donation)/,
    TECHNOLOGY: /(software development|app development|programming|coding|api|database|saas|tech startup)/,
    TECHNOLOGY_GENERAL: /(technology|software|app|platform|system|digital)/,
    MARKETING_EXCLUSIONS: /(marketing|campaign|care|health|service|community|social)/
  },
  PROJECT_TYPE: {
    MARKETING: /(marketing|campaign|brand|customer|audience|social|content|seo|ads|advertising|promotion)/,
    SOFTWARE: /(software development|app development|coding|programming|api|database|backend|frontend)/,
    SOFTWARE_GENERAL: /(app|software|platform|system|website|mobile|web)/,
    MARKETING_EXCLUSIONS: /(marketing|campaign|brand|customer|audience|social|content|seo|ads)/,
    PRODUCT_DEVELOPMENT: /(product|prototype|design|feature|mvp|launch|release)/,
    BUSINESS_PLAN: /(business|strategy|plan|revenue|model|growth|expansion|partnership)/,
    OPERATIONS: /(process|workflow|operation|efficiency|automat|improve|optimize)/,
    RESEARCH: /(research|study|analysis|investigate|explore|experiment)/
  },
  CLARIFICATION: {
    TARGET_AUDIENCE: /(target|audience|user|customer|demographic)/,
    BUDGET_TIMELINE: /(budget|spend|cost|timeline|duration)/,
    COMPLIANCE: /(regulation|compliance|hipaa|privacy)/,
    PLATFORM: /(platform|mobile|web|desktop|api)/
  }
} as const