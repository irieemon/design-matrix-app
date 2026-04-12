import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertTriangle, RefreshCw, Save, Zap } from 'lucide-react'
import { getAuthHeadersSync } from '../../lib/authHeaders'
import { logger } from '../../utils/logger'

// ============================================================================
// TYPES
// ============================================================================

type TaskType =
  | 'generate-ideas'
  | 'generate-insights'
  | 'generate-roadmap'
  | 'analyze-image'
  | 'analyze-video'
  | 'analyze-file'
  | 'transcribe-summary'

interface TaskConfig {
  gatewayModelId: string
  fallbackModels: string[]
  temperature: number
  maxOutputTokens: number
}

interface ModelProfile {
  id: string
  name: string
  display_name: string
  description?: string
  is_active: boolean
  task_configs: Record<TaskType, TaskConfig>
  created_at: string
  updated_at: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TASK_TYPES: TaskType[] = [
  'generate-ideas',
  'generate-insights',
  'generate-roadmap',
  'analyze-image',
  'analyze-video',
  'analyze-file',
  'transcribe-summary',
]

const TASK_LABELS: Record<TaskType, string> = {
  'generate-ideas': 'Idea Generation',
  'generate-insights': 'Insights Analysis',
  'generate-roadmap': 'Roadmap Planning',
  'analyze-image': 'Image Analysis',
  'analyze-video': 'Video Analysis',
  'analyze-file': 'File Analysis',
  'transcribe-summary': 'Transcription Summary',
}

// Colour accents per profile name (budget/balanced/premium)
const PROFILE_ACCENT: Record<string, { border: string; badge: string; dot: string }> = {
  budget: {
    border: 'border-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  balanced: {
    border: 'border-blue-500',
    badge: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
  },
  premium: {
    border: 'border-purple-500',
    badge: 'bg-purple-100 text-purple-800',
    dot: 'bg-purple-500',
  },
}

const DEFAULT_ACCENT = {
  border: 'border-slate-400',
  badge: 'bg-slate-100 text-slate-700',
  dot: 'bg-slate-400',
}

function accentFor(name: string) {
  return PROFILE_ACCENT[name.toLowerCase()] ?? DEFAULT_ACCENT
}

// ============================================================================
// EDIT STATE HELPERS
// ============================================================================

// Mutable per-task state kept in a flat object so inputs stay simple
type EditedTaskConfig = {
  gatewayModelId: string
  fallbackModelsRaw: string // comma-separated string for editing
  temperature: string
  maxOutputTokens: string
}

function toEditState(taskConfigs: Record<TaskType, TaskConfig>): Record<TaskType, EditedTaskConfig> {
  const result = {} as Record<TaskType, EditedTaskConfig>
  for (const taskType of TASK_TYPES) {
    const cfg = taskConfigs[taskType]
    result[taskType] = {
      gatewayModelId: cfg.gatewayModelId,
      fallbackModelsRaw: cfg.fallbackModels.join(', '),
      temperature: String(cfg.temperature),
      maxOutputTokens: String(cfg.maxOutputTokens),
    }
  }
  return result
}

function fromEditState(edited: Record<TaskType, EditedTaskConfig>): Record<TaskType, TaskConfig> {
  const result = {} as Record<TaskType, TaskConfig>
  for (const taskType of TASK_TYPES) {
    const e = edited[taskType]
    result[taskType] = {
      gatewayModelId: e.gatewayModelId.trim(),
      fallbackModels: e.fallbackModelsRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      temperature: parseFloat(e.temperature) || 0,
      maxOutputTokens: parseInt(e.maxOutputTokens, 10) || 0,
    }
  }
  return result
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface TaskRowProps {
  taskType: TaskType
  edited: EditedTaskConfig
  onChange: (taskType: TaskType, field: keyof EditedTaskConfig, value: string) => void
}

function TaskRow({ taskType, edited, onChange }: TaskRowProps) {
  return (
    <tr className="border-t border-slate-100">
      <td className="py-3 pr-4 text-sm font-medium text-slate-700 whitespace-nowrap w-44">
        {TASK_LABELS[taskType]}
      </td>
      <td className="py-3 pr-3">
        <input
          type="text"
          value={edited.gatewayModelId}
          onChange={e => onChange(taskType, 'gatewayModelId', e.target.value)}
          placeholder="provider/model-id"
          aria-label={`${TASK_LABELS[taskType]} primary model`}
          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
        />
      </td>
      <td className="py-3 pr-3">
        <input
          type="text"
          value={edited.fallbackModelsRaw}
          onChange={e => onChange(taskType, 'fallbackModelsRaw', e.target.value)}
          placeholder="provider/model-a, provider/model-b"
          aria-label={`${TASK_LABELS[taskType]} fallback models`}
          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
        />
      </td>
      <td className="py-3 pr-3 w-24">
        <input
          type="number"
          step="0.1"
          min="0"
          max="2"
          value={edited.temperature}
          onChange={e => onChange(taskType, 'temperature', e.target.value)}
          aria-label={`${TASK_LABELS[taskType]} temperature`}
          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </td>
      <td className="py-3 w-28">
        <input
          type="number"
          step="256"
          min="256"
          value={edited.maxOutputTokens}
          onChange={e => onChange(taskType, 'maxOutputTokens', e.target.value)}
          aria-label={`${TASK_LABELS[taskType]} max output tokens`}
          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </td>
    </tr>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ModelProfileSettings() {
  const [profiles, setProfiles] = useState<ModelProfile[]>([])
  const [activeProfileName, setActiveProfileName] = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [editedConfigs, setEditedConfigs] = useState<Record<TaskType, EditedTaskConfig> | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [confirmActivateId, setConfirmActivateId] = useState<string | null>(null)

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const loadProfiles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/model-profiles', {
        headers: getAuthHeadersSync(),
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error(`Failed to load profiles (${response.status})`)
      }
      const result = await response.json()
      const fetchedProfiles: ModelProfile[] = result.profiles ?? []
      setProfiles(fetchedProfiles)
      setActiveProfileName(result.activeProfileName ?? null)

      // Auto-select the active profile on first load
      if (selectedProfileId === null && fetchedProfiles.length > 0) {
        const active = fetchedProfiles.find(p => p.is_active) ?? fetchedProfiles[0]
        setSelectedProfileId(active.id)
        setEditedConfigs(toEditState(active.task_configs))
      }
    } catch (err) {
      logger.error('Failed to load model profiles:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profiles')
    } finally {
      setIsLoading(false)
    }
  }, [selectedProfileId])

  useEffect(() => {
    loadProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ============================================================================
  // PROFILE SELECTION
  // ============================================================================

  function handleSelectProfile(profile: ModelProfile) {
    setSelectedProfileId(profile.id)
    setEditedConfigs(toEditState(profile.task_configs))
    setSaveStatus('idle')
  }

  // ============================================================================
  // TASK CONFIG EDITING
  // ============================================================================

  function handleFieldChange(taskType: TaskType, field: keyof EditedTaskConfig, value: string) {
    setEditedConfigs(prev => {
      if (!prev) return prev
      return {
        ...prev,
        [taskType]: { ...prev[taskType], [field]: value },
      }
    })
    setSaveStatus('idle')
  }

  // ============================================================================
  // SAVE
  // ============================================================================

  async function handleSave() {
    if (!selectedProfileId || !editedConfigs) return
    setIsSaving(true)
    setSaveStatus('idle')
    try {
      const taskConfigs = fromEditState(editedConfigs)
      const response = await fetch(`/api/admin/model-profiles?id=${selectedProfileId}`, {
        method: 'PUT',
        headers: getAuthHeadersSync(),
        credentials: 'include',
        body: JSON.stringify({ task_configs: taskConfigs }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? `Save failed (${response.status})`)
      }
      const result = await response.json()
      // Sync local state with returned profile
      setProfiles(prev =>
        prev.map(p => (p.id === selectedProfileId ? (result.profile as ModelProfile) : p))
      )
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      logger.error('Failed to save model profile:', err)
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  // ============================================================================
  // ACTIVATE
  // ============================================================================

  async function handleConfirmActivate() {
    if (!confirmActivateId) return
    setIsActivating(true)
    try {
      const response = await fetch(
        `/api/admin/model-profiles?action=activate&id=${confirmActivateId}`,
        {
          method: 'POST',
          headers: getAuthHeadersSync(),
          credentials: 'include',
        }
      )
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? `Activate failed (${response.status})`)
      }
      const result = await response.json()
      const activated = result.activeProfile as ModelProfile
      setProfiles(prev =>
        prev.map(p => ({ ...p, is_active: p.id === activated.id }))
      )
      setActiveProfileName(activated.name)
    } catch (err) {
      logger.error('Failed to activate model profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to activate profile')
    } finally {
      setIsActivating(false)
      setConfirmActivateId(null)
    }
  }

  // ============================================================================
  // DERIVED
  // ============================================================================

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) ?? null

  // ============================================================================
  // RENDER — LOADING
  // ============================================================================

  if (isLoading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">AI Model Profiles</h1>
          <p className="text-slate-600 mt-1">Loading profiles...</p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="flex gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 w-56 bg-slate-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-slate-200 rounded-xl" />
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER — ERROR
  // ============================================================================

  if (error && profiles.length === 0) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">AI Model Profiles</h1>
        </div>
        <div className="max-w-md mx-auto mt-12 text-center">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8">
            <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-900 mb-2">Failed to Load Profiles</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => loadProfiles()}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER — MAIN VIEW
  // ============================================================================

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Model Profiles</h1>
          <p className="text-slate-600 mt-1">
            Manage which AI models power each task type. One profile is active at a time.
          </p>
        </div>
        <button
          onClick={() => loadProfiles()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">Refresh</span>
        </button>
      </div>

      {/* Non-blocking error banner */}
      {error && profiles.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Profile cards */}
      <div className="flex flex-wrap gap-4 mb-8">
        {profiles.map(profile => {
          const accent = accentFor(profile.name)
          const isActive = profile.is_active
          const isSelected = profile.id === selectedProfileId

          return (
            <div
              key={profile.id}
              onClick={() => handleSelectProfile(profile)}
              className={[
                'relative cursor-pointer rounded-xl border-2 bg-white p-5 w-56 transition-all',
                isSelected ? accent.border + ' shadow-md' : 'border-slate-200 hover:border-slate-300',
              ].join(' ')}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Select ${profile.display_name} profile`}
              onKeyDown={e => e.key === 'Enter' && handleSelectProfile(profile)}
            >
              {/* Active badge */}
              {isActive && (
                <span
                  className={`absolute top-3 right-3 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${accent.badge}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                  Active
                </span>
              )}

              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-slate-500" />
                <h2 className="text-base font-semibold text-slate-900">{profile.display_name}</h2>
              </div>

              {profile.description && (
                <p className="text-xs text-slate-500 leading-relaxed">{profile.description}</p>
              )}

              {/* Activate button (only when not already active) */}
              {!isActive && isSelected && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    setConfirmActivateId(profile.id)
                  }}
                  disabled={isActivating}
                  className="mt-4 w-full py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Set as Active
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Confirm activate dialog */}
      {confirmActivateId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm profile activation"
        >
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Activate profile?</h3>
            <p className="text-sm text-slate-600 mb-6">
              This will switch all AI tasks to use{' '}
              <strong>
                {profiles.find(p => p.id === confirmActivateId)?.display_name ?? confirmActivateId}
              </strong>
              . The change takes effect within 60 seconds.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmActivateId(null)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmActivate}
                disabled={isActivating}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isActivating ? 'Activating…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task config editor */}
      {selectedProfile && editedConfigs && (
        <div className="bg-white rounded-xl shadow-sm">
          {/* Editor header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Task Models —{' '}
                <span className="font-normal text-slate-500">{selectedProfile.display_name}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Last updated:{' '}
                {new Date(selectedProfile.updated_at).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {saveStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-sm text-red-700 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  Save failed
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>

          {/* Task table */}
          <div className="overflow-x-auto px-6 py-4">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-44">
                    Task
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pr-3">
                    Primary Model
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pr-3">
                    Fallbacks (comma-separated)
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pr-3 w-24">
                    Temp
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">
                    Max Tokens
                  </th>
                </tr>
              </thead>
              <tbody>
                {TASK_TYPES.map(taskType => (
                  <TaskRow
                    key={taskType}
                    taskType={taskType}
                    edited={editedConfigs[taskType]}
                    onChange={handleFieldChange}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 pb-4">
            <p className="text-xs text-slate-400">
              Model IDs must follow the <code className="font-mono">provider/model-id</code> format
              (e.g. <code className="font-mono">openai/gpt-4o</code>).
              Unsaved changes are discarded when switching profiles.
            </p>
          </div>
        </div>
      )}

      {profiles.length === 0 && !isLoading && (
        <div className="text-center py-16 text-slate-400">
          <p>No model profiles found. Seed the database to get started.</p>
        </div>
      )}

      {/* Active profile footer note */}
      {activeProfileName && (
        <p className="mt-4 text-xs text-slate-400 text-right">
          Currently active profile:{' '}
          <span className="font-medium text-slate-600">{activeProfileName}</span>
        </p>
      )}
    </div>
  )
}
