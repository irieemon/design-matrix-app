import { describe, it, expect } from 'vitest'
import {
  validateAudioFile,
  normalizeTranscriptionResult,
  deriveTitleFromSummary,
  MAX_AUDIO_BYTES,
} from '../audioTranscription'

describe('validateAudioFile', () => {
  it('rejects files larger than 25MB', () => {
    const result = validateAudioFile({ size: 26 * 1024 * 1024, type: 'audio/wav' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('File too large (max 25MB)')
  })

  it('rejects unsupported MIME types', () => {
    const result = validateAudioFile({ size: 1024, type: 'video/mp4' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Unsupported audio format')
  })

  it('accepts a 1MB audio/webm file', () => {
    const result = validateAudioFile({ size: 1024 * 1024, type: 'audio/webm' })
    expect(result.ok).toBe(true)
  })

  it('accepts 24MB audio/mp4 (boundary)', () => {
    const result = validateAudioFile({ size: 24 * 1024 * 1024, type: 'audio/mp4' })
    expect(result.ok).toBe(true)
  })

  it('boundary check matches MAX_AUDIO_BYTES', () => {
    expect(MAX_AUDIO_BYTES).toBe(25 * 1024 * 1024)
  })
})

describe('normalizeTranscriptionResult', () => {
  it('maps Whisper response to IdeaCard-shaped object', () => {
    const result = normalizeTranscriptionResult({
      transcription: {
        text: 'hello world. second sentence.',
        summary: 'A greeting and a follow-up.',
        keyPoints: ['greet', 'follow'],
        language: 'en',
        duration: 5,
      },
    })
    expect(result.subject).toBe('A greeting and a follow-up')
    expect(result.description).toBe('A greeting and a follow-up.')
    expect(result.textContent).toBe('hello world. second sentence.')
    expect(result.insights).toEqual(['greet', 'follow'])
    expect(result.relevanceScore).toBeUndefined()
  })
})

describe('deriveTitleFromSummary', () => {
  it('truncates long summaries with ellipsis', () => {
    const long = 'a'.repeat(120)
    const title = deriveTitleFromSummary(long)
    expect(title.length).toBeLessThanOrEqual(80)
    expect(title.endsWith('…')).toBe(true)
  })

  it('returns first sentence only when multiple sentences', () => {
    const title = deriveTitleFromSummary('First sentence. Second sentence.')
    expect(title).toBe('First sentence')
  })
})
