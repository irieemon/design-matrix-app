import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  createMockMediaRecorder,
  createMockGetUserMedia,
  MockMediaRecorderControl,
  MockGetUserMediaControl,
} from '../../test/mocks/mediaRecorder'
import { useAudioRecorder } from '../useAudioRecorder'

describe('useAudioRecorder', () => {
  let mr: MockMediaRecorderControl
  let gum: MockGetUserMediaControl

  beforeEach(() => {
    mr = createMockMediaRecorder()
    gum = createMockGetUserMedia()
  })

  afterEach(() => {
    mr.restore()
    gum.restore()
    vi.useRealTimers()
  })

  it('returns idle initial state', () => {
    const { result } = renderHook(() => useAudioRecorder())
    expect(result.current.isRecording).toBe(false)
    expect(result.current.elapsedMs).toBe(0)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.start).toBe('function')
    expect(typeof result.current.stop).toBe('function')
  })

  it('start() invokes getUserMedia and sets isRecording', async () => {
    const { result } = renderHook(() => useAudioRecorder())
    await act(async () => {
      await result.current.start()
    })
    expect(gum.fn).toHaveBeenCalledWith({ audio: true })
    expect(result.current.isRecording).toBe(true)
    expect(mr.instances.length).toBe(1)
  })

  it('prefers audio/webm when supported', async () => {
    mr.restore()
    mr = createMockMediaRecorder({ isTypeSupported: (m) => m === 'audio/webm' })
    const { result } = renderHook(() => useAudioRecorder())
    await act(async () => {
      await result.current.start()
    })
    expect(mr.instances[0].mimeType).toBe('audio/webm')
  })

  it('falls back to audio/mp4 on iOS Safari (webm unsupported)', async () => {
    mr.restore()
    mr = createMockMediaRecorder({ isTypeSupported: (m) => m === 'audio/mp4' })
    const { result } = renderHook(() => useAudioRecorder())
    await act(async () => {
      await result.current.start()
    })
    expect(mr.instances[0].mimeType).toBe('audio/mp4')
  })

  it('stop() resolves with assembled Blob', async () => {
    const { result } = renderHook(() => useAudioRecorder())
    await act(async () => {
      await result.current.start()
    })
    // Push some data
    mr.emitData(new Blob(['hello'], { type: 'audio/webm' }))
    mr.emitData(new Blob(['world'], { type: 'audio/webm' }))

    let blob: Blob | undefined
    await act(async () => {
      blob = await result.current.stop()
    })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob!.type).toBe('audio/webm')
    expect(blob!.size).toBeGreaterThan(0)
  })

  it('stop() releases all MediaStream tracks (no mic leak)', async () => {
    const { result } = renderHook(() => useAudioRecorder())
    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      await result.current.stop()
    })
    for (const t of gum.tracks) {
      expect(t.stop).toHaveBeenCalled()
    }
  })

  it('unmount while recording stops recorder and tracks', async () => {
    const { result, unmount } = renderHook(() => useAudioRecorder())
    await act(async () => {
      await result.current.start()
    })
    const recorder = mr.instances[0]
    const stopSpy = vi.spyOn(recorder, 'stop')
    unmount()
    expect(stopSpy).toHaveBeenCalled()
    for (const t of gum.tracks) {
      expect(t.stop).toHaveBeenCalled()
    }
  })

  it('getUserMedia rejection sets clear error and isRecording stays false', async () => {
    gum.restore()
    gum = createMockGetUserMedia({ reject: new Error('NotAllowedError') })
    const { result } = renderHook(() => useAudioRecorder())
    await act(async () => {
      await result.current.start()
    })
    expect(result.current.isRecording).toBe(false)
    expect(result.current.error).toMatch(/[Mm]icrophone/)
  })

  it('elapsedMs increments while recording', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useAudioRecorder())
    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(3000)
  })
})
