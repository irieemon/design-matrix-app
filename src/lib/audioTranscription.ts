/**
 * audioTranscription — client-side helpers for audio uploads + Whisper response normalization.
 * Pure functions, no React, no network. Consumed by Phase 4 Plan 02 (AudioTab UI).
 */

export const ACCEPTED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
] as const

export type AcceptedAudioMimeType = (typeof ACCEPTED_AUDIO_MIME_TYPES)[number]

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024

export type ValidationResult = { ok: true } | { ok: false; error: string }

export function validateAudioFile(
  file: File | { size: number; type: string }
): ValidationResult {
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: 'File too large (max 25MB)' }
  }
  const baseType = file.type.split(';')[0].trim()
  if (!ACCEPTED_AUDIO_MIME_TYPES.includes(baseType as AcceptedAudioMimeType)) {
    return { ok: false, error: 'Unsupported audio format' }
  }
  return { ok: true }
}

export interface TranscribeAudioResponse {
  transcription: {
    text: string
    summary: string
    keyPoints: string[]
    language: string
    duration: number
  }
}

export interface NormalizedTranscription {
  subject: string
  description: string
  textContent: string
  insights: string[]
  relevanceScore?: number
}

export function deriveTitleFromSummary(summary: string, maxLen = 80): string {
  const trimmed = (summary || '').trim()
  if (!trimmed) return ''
  // First sentence: split on '.', '!', '?' followed by space, OR trailing punctuation at end.
  const match = trimmed.split(/(?<=[.!?])\s+/)[0] || trimmed
  // Strip a single trailing terminal punctuation from the first segment.
  const firstSentence = match.replace(/[.!?]+$/, '').trim()
  if (firstSentence.length > maxLen) {
    return firstSentence.slice(0, maxLen - 1).trimEnd() + '…'
  }
  return firstSentence
}

export function normalizeTranscriptionResult(
  raw: TranscribeAudioResponse
): NormalizedTranscription {
  const t = raw.transcription
  return {
    subject: deriveTitleFromSummary(t.summary),
    description: t.summary,
    textContent: t.text,
    insights: Array.isArray(t.keyPoints) ? t.keyPoints : [],
    relevanceScore: undefined,
  }
}
