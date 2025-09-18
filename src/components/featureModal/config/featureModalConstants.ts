// Feature Modal Constants - Configuration and styling

export const FEATURE_MODAL_CONSTANTS = {
  // Validation limits
  MAX_TITLE_LENGTH: 100,
  MIN_DURATION: 1,
  MAX_DURATION: 12,
  MIN_START_MONTH: 0,
  MAX_START_MONTH: 23,

  // Default values
  DEFAULT_TEAM: 'PLATFORM',
  DEFAULT_PRIORITY: 'medium',
  DEFAULT_STATUS: 'planned',
  DEFAULT_COMPLEXITY: 'medium',
  DEFAULT_DURATION: 1,
  DEFAULT_START_MONTH: 0,

  // Array field limits
  MAX_USER_STORIES: 20,
  MAX_DELIVERABLES: 20,
  MAX_SUCCESS_CRITERIA: 10,
  MAX_RISKS: 10,
  MAX_RELATED_IDEAS: 10
} as const

export const FEATURE_MODAL_CLASSES = {
  // Modal container classes
  MODAL_OVERLAY: 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4',
  MODAL_CONTAINER: 'bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-200',
  MODAL_CONTENT: 'p-6 overflow-y-auto max-h-[calc(90vh-160px)]',

  // Header classes
  HEADER_CONTAINER: 'bg-gray-200 border-b border-slate-200 p-6',
  HEADER_TITLE_EDIT: 'text-2xl font-bold bg-transparent border-0 border-b-2 border-slate-300 focus:border-blue-500 focus:outline-none text-slate-900 placeholder-slate-400 flex-1 pb-1 min-w-0',
  HEADER_TITLE_VIEW: 'text-2xl font-bold text-slate-900 leading-tight truncate',
  HEADER_ICON: 'w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-sm',

  // Button classes
  BUTTON_PRIMARY: 'flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium text-sm shadow-sm',
  BUTTON_SECONDARY: 'px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm',
  BUTTON_DANGER: 'flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-sm shadow-sm',
  BUTTON_EDIT: 'flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm shadow-sm',
  BUTTON_CLOSE: 'p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 hover:text-slate-700',

  // Form input classes
  SELECT_INPUT: 'appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:bg-white cursor-pointer',
  TEXT_INPUT: 'w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 focus:outline-none bg-white text-sm',
  TEXTAREA_INPUT: 'w-full h-24 px-3 py-2 border border-slate-200 rounded-lg text-slate-700 resize-none focus:border-blue-500 focus:outline-none bg-white text-sm',

  // Badge classes
  BADGE_BASE: 'px-3 py-1.5 rounded-lg text-xs font-medium border',

  // Section classes
  SECTION_CONTAINER: 'space-y-6',
  CARD_CONTAINER: 'rounded-xl p-4 border',

  // Footer classes
  FOOTER_CONTAINER: 'bg-slate-50 px-6 py-4 border-t border-slate-200',
  FOOTER_BUTTON: 'px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium text-sm'
} as const

export const FEATURE_FIELD_PLACEHOLDERS = {
  TITLE: 'Feature title',
  DESCRIPTION: 'Enter feature description...',
  USER_STORY: 'Add a new user story...',
  DELIVERABLE: 'Add a new deliverable...',
  SUCCESS_CRITERIA: 'Add success criteria...',
  RISK: 'Add risk factor...',
  RELATED_IDEA: 'Add related idea...'
} as const

export const FEATURE_VALIDATION_MESSAGES = {
  TITLE_REQUIRED: 'Title is required',
  TITLE_TOO_LONG: 'Title must be 100 characters or less',
  DURATION_MIN: 'Duration must be at least 1 month',
  DURATION_MAX: 'Duration cannot exceed 12 months',
  DURATION_INTEGER: 'Duration must be a whole number',
  START_MONTH_MIN: 'Start month cannot be negative',
  START_MONTH_MAX: 'Start month cannot be more than 24 months in the future',
  START_MONTH_INTEGER: 'Start month must be a whole number',
  TEAM_REQUIRED: 'Team is required',
  PRIORITY_INVALID: 'Priority must be high, medium, or low',
  STATUS_INVALID: 'Status must be planned, in-progress, or completed'
} as const

export type FeaturePriority = 'high' | 'medium' | 'low'
export type FeatureStatus = 'planned' | 'in-progress' | 'completed'
export type FeatureComplexity = 'low' | 'medium' | 'high'