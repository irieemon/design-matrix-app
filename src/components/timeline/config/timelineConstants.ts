// Timeline layout constants
export const TIMELINE_CONSTANTS = {
  // Lane dimensions
  TEAM_COLUMN_WIDTH: 192, // w-48 = 12rem = 192px
  FEATURE_ROW_HEIGHT: 36, // 36px per row
  FEATURE_HEIGHT: 32, // h-8 = 2rem = 32px
  FEATURE_TOP_OFFSET: 16, // 16px offset from top
  MIN_LANE_HEIGHT: 140, // Minimum height for team lanes
  LANE_PADDING: 40, // Additional padding for team lanes

  // Resize handle dimensions
  RESIZE_HANDLE_WIDTH: 8, // w-2 = 0.5rem = 8px

  // Default timeline settings
  DEFAULT_TIMELINE_MONTHS: 6,
  MAX_TIMELINE_MONTHS: 12,
  TIMELINE_BUFFER_MONTHS: 2,

  // Feature constraints
  MIN_FEATURE_DURATION: 1, // Minimum 1 month duration
  MIN_START_MONTH: 0 // Cannot start before month 0
} as const

// Styling classes for consistent use across components
export const TIMELINE_CLASSES = {
  // Container classes
  MAIN_CONTAINER: 'bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden w-full',
  HEADER_GRADIENT: 'bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-5',
  GRID_HEADER: 'bg-slate-50 border-b border-slate-200',
  LEGEND_CONTAINER: 'bg-slate-50 px-6 py-4 border-t border-slate-200',

  // Team lane classes
  TEAM_LABEL_BASE: 'flex items-center px-4 flex-shrink-0',
  TIMELINE_AREA: 'flex-1 relative py-4 timeline-container overflow-hidden',
  TEAM_DIVIDER: 'divide-y divide-slate-200 min-h-0',

  // Feature classes
  FEATURE_BASE: 'group absolute h-8 rounded-lg border-2 flex items-center shadow-sm hover:shadow-md transition-all cursor-move hover:scale-105 hover:z-10',
  FEATURE_CONTENT: 'flex-1 px-3 py-1 truncate',
  FEATURE_TITLE: 'text-xs font-semibold',

  // Resize handle classes
  RESIZE_HANDLE_BASE: 'absolute top-0 w-2 h-full bg-transparent hover:bg-blue-400 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity',
  RESIZE_HANDLE_LEFT: 'left-0',
  RESIZE_HANDLE_RIGHT: 'right-0',

  // Grid and layout classes
  MONTH_GRID_LINES: 'absolute inset-0 flex',
  MONTH_GRID_LINE: 'flex-1 border-r border-slate-100',
  TEAMS_HEADER: 'w-48 flex items-center justify-center py-4 bg-slate-100 border-r border-slate-200',
  MONTH_HEADER_BASE: 'flex-1 py-4 text-center border-r border-slate-200 font-semibold text-sm',
  MONTH_HEADER_CURRENT: 'bg-blue-600 text-white',
  MONTH_HEADER_NORMAL: 'bg-slate-50 text-slate-700',

  // Button classes
  BUTTON_PRIMARY: 'flex items-center space-x-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 rounded-xl text-white transition-all shadow-sm hover:shadow-md text-sm font-medium',
  BUTTON_SECONDARY: 'flex items-center space-x-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-xl text-white transition-all shadow-sm hover:shadow-md text-sm font-medium',
  BUTTON_VIEW_MODE: 'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
  BUTTON_VIEW_MODE_ACTIVE: 'bg-slate-600 text-white shadow-sm',
  BUTTON_VIEW_MODE_INACTIVE: 'text-slate-300 hover:text-white',

  // State classes
  DRAGGED_OPACITY: 'opacity-50',
  RESIZING_RING: 'ring-2 ring-blue-400 scale-105'
} as const

// Export utility function to calculate feature position
export const calculateFeatureTop = (rowIndex: number): number => {
  return rowIndex * TIMELINE_CONSTANTS.FEATURE_ROW_HEIGHT + TIMELINE_CONSTANTS.FEATURE_TOP_OFFSET
}

// Export utility function to calculate lane height
export const calculateLaneHeight = (maxRows: number): number => {
  return Math.max(
    TIMELINE_CONSTANTS.MIN_LANE_HEIGHT,
    maxRows * TIMELINE_CONSTANTS.FEATURE_ROW_HEIGHT + TIMELINE_CONSTANTS.LANE_PADDING
  )
}