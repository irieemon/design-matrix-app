/**
 * Shared MediaRecorder + getUserMedia mock fixtures for vitest.
 *
 * Usage:
 *   const mr = createMockMediaRecorder()
 *   const gum = createMockGetUserMedia()
 *   // ...run hook...
 *   mr.emitData(new Blob(['x']))
 *   mr.emitStop()
 *   mr.restore(); gum.restore()
 */
import { vi } from 'vitest'

export interface MockTrack {
  stop: ReturnType<typeof vi.fn>
  kind: string
}

export interface MockStream {
  getTracks: () => MockTrack[]
}

export class MockMediaRecorder {
  static isTypeSupported = vi.fn((m: string) => m === 'audio/webm')
  static instances: MockMediaRecorder[] = []

  public state: 'inactive' | 'recording' | 'paused' = 'inactive'
  public mimeType: string
  public ondataavailable: ((e: { data: Blob }) => void) | null = null
  public onstop: (() => void) | null = null
  public stream: MockStream

  constructor(stream: MockStream, options?: { mimeType?: string }) {
    this.stream = stream
    this.mimeType = options?.mimeType || 'audio/webm'
    MockMediaRecorder.instances.push(this)
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    // Call onstop async-ish to mimic browser
    if (this.onstop) this.onstop()
  }
}

export interface MockMediaRecorderControl {
  instances: MockMediaRecorder[]
  emitData: (blob: Blob, idx?: number) => void
  emitStop: (idx?: number) => void
  restore: () => void
  MockClass: typeof MockMediaRecorder
}

export function createMockMediaRecorder(options?: {
  isTypeSupported?: (m: string) => boolean
}): MockMediaRecorderControl {
  MockMediaRecorder.instances = []
  if (options?.isTypeSupported) {
    MockMediaRecorder.isTypeSupported = vi.fn(options.isTypeSupported)
  } else {
    MockMediaRecorder.isTypeSupported = vi.fn((m: string) => m === 'audio/webm')
  }
  vi.stubGlobal('MediaRecorder', MockMediaRecorder)

  return {
    instances: MockMediaRecorder.instances,
    MockClass: MockMediaRecorder,
    emitData(blob: Blob, idx = 0) {
      const inst = MockMediaRecorder.instances[idx]
      if (inst?.ondataavailable) inst.ondataavailable({ data: blob })
    },
    emitStop(idx = 0) {
      const inst = MockMediaRecorder.instances[idx]
      if (inst?.onstop) inst.onstop()
    },
    restore() {
      vi.unstubAllGlobals()
      MockMediaRecorder.instances = []
    },
  }
}

export interface MockGetUserMediaControl {
  fn: ReturnType<typeof vi.fn>
  tracks: MockTrack[]
  restore: () => void
}

export function createMockGetUserMedia(options?: {
  reject?: Error
}): MockGetUserMediaControl {
  const tracks: MockTrack[] = [
    { stop: vi.fn(), kind: 'audio' },
  ]
  const stream: MockStream = {
    getTracks: () => tracks,
  }

  const fn = vi.fn(() => {
    if (options?.reject) return Promise.reject(options.reject)
    return Promise.resolve(stream)
  })

  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: fn },
  })

  return {
    fn,
    tracks,
    restore() {
      vi.unstubAllGlobals()
    },
  }
}
