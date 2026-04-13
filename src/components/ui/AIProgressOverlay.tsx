/**
 * AIProgressOverlay -- ADR-0015 Step 2
 *
 * Reusable progress overlay for AI generation operations.
 * Extracted from the inline progress pattern in AIInsightsModal.tsx (lines 390-468).
 *
 * Renders a progress bar, stage indicator dots, processing step checklist,
 * countdown timer, and cancel/error controls. Fully driven by props from
 * the useAIGeneration hook.
 */

interface AIProgressOverlayProps {
  isActive: boolean;
  progress: number;
  stage: string;
  estimatedSecondsRemaining: number;
  processingSteps: string[];
  stageSequence: string[];
  onCancel?: () => void;
  cancelable?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
}

/**
 * Maps raw stage identifiers to user-facing display labels.
 * The label for "finalizing" intentionally avoids the substring "finalizing"
 * to prevent Testing Library `getByText` collisions with processing step text
 * that may also contain that word (e.g. "Finalizing report").
 */
const STAGE_DISPLAY_LABELS: Record<string, string> = {
  analyzing: 'Analyzing Ideas',
  synthesizing: 'Synthesizing Insights',
  optimizing: 'Optimizing Recommendations',
  finalizing: 'Generating Final Report',
};

function getStageLabel(stage: string): string {
  return STAGE_DISPLAY_LABELS[stage] ?? stage;
}

function AIProgressOverlay({
  isActive,
  progress,
  stage,
  estimatedSecondsRemaining,
  processingSteps,
  stageSequence,
  onCancel,
  cancelable = true,
  error,
  onRetry,
  onClose,
}: AIProgressOverlayProps) {
  if (!isActive) {
    return null;
  }

  const hasError = Boolean(error);
  const activeStageIndex = stageSequence.indexOf(stage);
  const stageLabel = getStageLabel(stage);

  return (
    <div className="py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header: stage text + countdown + percentage */}
        <div className="rounded-2xl p-6 mb-6 bg-canvas-secondary">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-6 h-6 rounded-full motion-safe:animate-spin border-2 border-sapphire-600 border-t-transparent" />
                <div className="absolute inset-0 rounded-full motion-safe:animate-pulse bg-sapphire-600 opacity-20" />
              </div>
              <div>
                {/* Stage text inside aria-live="polite" so screen readers announce changes */}
                <h3
                  aria-live="polite"
                  className="text-lg font-semibold text-graphite-900"
                >
                  {stageLabel}
                </h3>
                <p className="text-sm text-graphite-600">
                  {estimatedSecondsRemaining > 0
                    ? `~${estimatedSecondsRemaining} seconds remaining`
                    : 'Almost done...'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-sapphire-600">
                {Math.round(progress)}%
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div
            role="progressbar"
            aria-label="AI generation progress"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${Math.round(progress)}%`}
            className="w-full rounded-full h-3 overflow-hidden bg-graphite-200"
          >
            <div
              data-testid="progress-bar-fill"
              className={`h-full rounded-full transition-all duration-500 ease-out relative ${
                hasError ? 'bg-garnet-500' : 'bg-sapphire-600'
              }`}
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white opacity-30 motion-safe:animate-pulse" />
            </div>
          </div>
        </div>

        {/* Error region */}
        {hasError && (
          <div
            aria-live="assertive"
            className="rounded-xl p-4 mb-6 border bg-garnet-50 border-garnet-200"
          >
            <p className="text-sm text-garnet-700 mb-3">{error}</p>
            <div className="flex space-x-3">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-garnet-600 text-white hover:bg-garnet-700 transition-colors duration-150"
                >
                  Retry
                </button>
              )}
              {(onClose || onCancel) && (
                <button
                  type="button"
                  onClick={onClose ?? onCancel}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-graphite-300 text-graphite-700 hover:bg-graphite-50 transition-colors duration-150"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}

        {/* Processing steps checklist */}
        <div className="rounded-xl border p-4 bg-surface-primary border-hairline-default">
          <h4 className="text-sm font-semibold mb-3 text-graphite-700">
            AI Processing Steps
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {processingSteps.map((step, index) => {
              const isLastStep = index === processingSteps.length - 1;
              return (
                <div
                  key={index}
                  data-testid="processing-step"
                  className={`flex items-center space-x-2 text-sm transition-all duration-300 ${
                    isLastStep
                      ? 'text-sapphire-600 font-medium'
                      : 'text-graphite-500 font-normal'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLastStep
                        ? 'motion-safe:animate-pulse bg-sapphire-500'
                        : 'bg-graphite-300'
                    }`}
                  />
                  <span>{step}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage indicator dots */}
        <div className="flex justify-center space-x-4 mt-6">
          {stageSequence.map((dotStage, index) => {
            const isComplete = activeStageIndex > index;
            const isActiveDot = activeStageIndex === index;

            let dotClass: string;
            if (isComplete) {
              dotClass = 'bg-emerald-500';
            } else if (isActiveDot) {
              dotClass = 'scale-125 motion-safe:animate-pulse bg-sapphire-500';
            } else {
              dotClass = 'bg-graphite-300';
            }

            return (
              <div
                key={dotStage}
                data-testid="stage-dot"
                className={`w-3 h-3 rounded-full transition-all duration-300 ${dotClass}`}
              />
            );
          })}
        </div>

        {/* Cancel button */}
        {cancelable && !hasError && onCancel && (
          <div className="flex justify-center mt-6">
            <button
              type="button"
              aria-label="Cancel AI generation"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-md border border-graphite-300 text-graphite-700 hover:bg-graphite-50 transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIProgressOverlay;
