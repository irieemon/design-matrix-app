/**
 * Multi-stage loader for the video analysis flow (Phase 07-03, D-20).
 *
 * Stages: idle → extracting → analyzing → done (or error at any point).
 * Rendered inline inside AIStarterModal while the user's selected video
 * is being decoded client-side and then analyzed server-side.
 */

import React from 'react'

export type VideoAnalysisStage =
  | 'idle'
  | 'extracting'
  | 'analyzing'
  | 'done'
  | 'error'

export interface VideoAnalysisProgressProps {
  stage: VideoAnalysisStage
  current?: number
  total?: number
  errorMessage?: string
}

const VideoAnalysisProgress: React.FC<VideoAnalysisProgressProps> = ({
  stage,
  current = 0,
  total = 0,
  errorMessage,
}) => {
  if (stage === 'idle') return null

  if (stage === 'error') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="mt-4 rounded-lg border p-4 text-sm"
        style={{
          backgroundColor: 'var(--garnet-50)',
          borderColor: 'var(--garnet-200)',
          color: 'var(--garnet-700)',
        }}
      >
        {errorMessage || 'Something went wrong analyzing the video.'}
      </div>
    )
  }

  const progressPct =
    stage === 'extracting' && total > 0
      ? Math.min(100, Math.round((current / total) * 100))
      : stage === 'analyzing'
        ? 100
        : stage === 'done'
          ? 100
          : 0

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 rounded-lg border p-4"
      style={{ borderColor: 'var(--graphite-200)' }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--graphite-800)' }}>
        {stage === 'extracting' && `Extracting frames (${current}/${total})…`}
        {stage === 'analyzing' && 'Analyzing video…'}
        {stage === 'done' && 'Done'}
      </p>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded"
        style={{ backgroundColor: 'var(--graphite-100)' }}
      >
        <div
          className="h-full transition-all"
          style={{
            width: `${progressPct}%`,
            backgroundColor:
              stage === 'done' ? 'var(--emerald-500)' : 'var(--sapphire-500)',
          }}
        />
      </div>
    </div>
  )
}

export default VideoAnalysisProgress
