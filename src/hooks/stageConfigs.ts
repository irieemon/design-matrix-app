/**
 * Stage configurations for AI generation progress display.
 *
 * Each operation type defines:
 * - stages: UI labels shown during each phase
 * - steps: Processing step descriptions for the checklist
 * - estimatedTotalSeconds: Conservative time estimate for the progress bar
 * - stageThresholds: Percentage breakpoints at which stage transitions occur
 */

export type AIOperationType =
  | 'roadmap'
  | 'insights'
  | 'ideas'
  | 'single-idea'
  | 'text-idea'
  | 'image-idea'
  | 'audio-idea'
  | 'video-idea'

export interface StageConfig {
  operationType: AIOperationType
  stages: string[]
  steps: string[]
  estimatedTotalSeconds: number
  stageThresholds: number[]
}

export const STAGE_CONFIGS: Record<AIOperationType, StageConfig> = {
  roadmap: {
    operationType: 'roadmap',
    stages: ['Analyzing ideas...', 'Building roadmap...', 'Finalizing phases...'],
    steps: ['Analyze idea patterns', 'Generate project phases', 'Create timeline'],
    estimatedTotalSeconds: 15,
    stageThresholds: [0, 33, 66],
  },
  insights: {
    operationType: 'insights',
    stages: ['Analyzing ideas...', 'Synthesizing insights...', 'Optimizing recommendations...', 'Finalizing report...'],
    steps: ['Analyze patterns', 'Synthesize insights', 'Optimize priorities', 'Finalize report'],
    estimatedTotalSeconds: 12,
    stageThresholds: [0, 25, 50, 75],
  },
  ideas: {
    operationType: 'ideas',
    stages: ['Preparing generation...', 'Creating ideas...', 'Refining results...'],
    steps: ['Analyze project context', 'Generate candidate ideas', 'Refine and rank'],
    estimatedTotalSeconds: 10,
    stageThresholds: [0, 33, 66],
  },
  'single-idea': {
    operationType: 'single-idea',
    stages: ['Analyzing context...', 'Generating idea...'],
    steps: ['Read project context', 'Generate idea details'],
    estimatedTotalSeconds: 6,
    stageThresholds: [0, 50],
  },
  'text-idea': {
    operationType: 'text-idea',
    stages: ['Reading input...', 'Generating idea...'],
    steps: ['Parse text input', 'Generate idea from text'],
    estimatedTotalSeconds: 6,
    stageThresholds: [0, 50],
  },
  'image-idea': {
    operationType: 'image-idea',
    stages: ['Processing image...', 'Analyzing content...', 'Generating idea...'],
    steps: ['Upload image', 'Analyze visual content', 'Generate idea from image'],
    estimatedTotalSeconds: 10,
    stageThresholds: [0, 33, 66],
  },
  'audio-idea': {
    operationType: 'audio-idea',
    stages: ['Processing audio...', 'Transcribing...', 'Generating idea...'],
    steps: ['Process audio file', 'Transcribe speech', 'Generate idea from transcript'],
    estimatedTotalSeconds: 12,
    stageThresholds: [0, 33, 66],
  },
  'video-idea': {
    operationType: 'video-idea',
    stages: ['Processing video...', 'Analyzing frames...', 'Extracting audio...', 'Generating idea...'],
    steps: ['Process video file', 'Analyze key frames', 'Extract and transcribe audio', 'Generate idea from content'],
    estimatedTotalSeconds: 15,
    stageThresholds: [0, 25, 50, 75],
  },
}
