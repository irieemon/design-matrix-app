/**
 * Thin client-side wrappers around the /api/ai routes (Phase 07-03).
 *
 * This module intentionally keeps the transport layer minimal — each
 * function converts its inputs to the shape expected by a specific
 * `?action=` handler and returns the decoded analysis. Components that
 * need auth headers or CSRF tokens pass them through via `init`.
 */

import { SUPABASE_STORAGE_KEY } from '../config'

export interface AiRequestInit {
  /** Extra headers to merge (e.g. CSRF token). */
  headers?: Record<string, string>
}

export interface SuggestedIdea {
  content: string
  details?: string
  x?: number
  y?: number
  priority?: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
}

export interface VideoAnalysisResult {
  summary: string
  suggestedIdeas: SuggestedIdea[]
}

export interface VideoAnalysisProjectContext {
  projectName?: string
  projectType?: string
  description?: string
}

/**
 * Uploads N extracted JPEG frames to the server's analyze-video action and
 * returns the holistic `{summary, suggestedIdeas}` result. The raw video
 * blob is never sent — only base64 JPEG data URLs of the extracted frames.
 */
export async function analyzeVideo(
  frames: Blob[],
  projectContext: VideoAnalysisProjectContext,
  init: AiRequestInit = {},
): Promise<VideoAnalysisResult> {
  const frameDataUrls = await Promise.all(frames.map(blobToDataUrl))

  const res = await fetch('/api/ai?action=analyze-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessTokenFromLocalStorage()}`,
      ...(init.headers ?? {}),
    },
    credentials: 'include',
    body: JSON.stringify({
      frames: frameDataUrls,
      projectContext,
    }),
  })

  if (!res.ok) {
    throw new Error(`Video analysis failed: ${res.status}`)
  }

  const json = (await res.json()) as { analysis: VideoAnalysisResult }
  return json.analysis
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read frame blob'))
    reader.readAsDataURL(blob)
  })
}

function getAccessTokenFromLocalStorage(): string {
  try {
    const raw = localStorage.getItem(SUPABASE_STORAGE_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    return parsed?.access_token || ''
  } catch {
    return ''
  }
}
