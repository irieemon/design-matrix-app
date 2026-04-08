/**
 * Tests for client-side video frame extraction.
 *
 * jsdom does not implement HTMLMediaElement decoding, so we drive the
 * lifecycle through a fake video element exposed via the `deps` seam.
 * These tests exercise the async-seek ordering (finding #5) and D-17
 * error conditions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractFrames,
  VIDEO_MAX_BYTES,
  VIDEO_FRAME_COUNT,
  VideoTooLargeError,
  VideoTooLongError,
  VideoDecodeError,
  VideoUnsupportedFormatError,
} from '../extractFrames'

// ---------------------------------------------------------------------------
// Fake video element — mimics the subset of HTMLMediaElement we rely on.
// ---------------------------------------------------------------------------

type Listener = () => void

interface FakeVideoControls {
  duration: number
  videoWidth: number
  videoHeight: number
  seekDelayMs: number
  failOnError: boolean
  metadataDelayMs: number
  // Tracks whether drawImage saw the video element AFTER seeked fired.
  drawOrder: string[]
}

function createFakeVideo(controls: FakeVideoControls) {
  const listeners = new Map<string, Listener[]>()
  let currentTimeInternal = 0

  const el: Partial<HTMLVideoElement> & {
    __controls: FakeVideoControls
    addEventListener: (type: string, cb: Listener, options?: unknown) => void
    removeEventListener: (type: string, cb: Listener) => void
  } = {
    __controls: controls,
    muted: false,
    // playsInline/preload assignments are exercised by the implementation
    // — having writable fields is enough for the test.
    // @ts-expect-error writable in our fake
    playsInline: false,
    preload: 'none',
    src: '',
    get currentTime() {
      return currentTimeInternal
    },
    set currentTime(value: number) {
      currentTimeInternal = value
      if (controls.failOnError) {
        setTimeout(() => emit('error'), 0)
        return
      }
      setTimeout(() => {
        controls.drawOrder.push('seeked')
        emit('seeked')
      }, controls.seekDelayMs)
    },
    get duration() {
      return controls.duration
    },
    get videoWidth() {
      return controls.videoWidth
    },
    get videoHeight() {
      return controls.videoHeight
    },
    addEventListener: (type: string, cb: Listener) => {
      const existing = listeners.get(type) ?? []
      existing.push(cb)
      listeners.set(type, existing)
    },
    removeEventListener: (type: string, cb: Listener) => {
      const existing = listeners.get(type) ?? []
      listeners.set(
        type,
        existing.filter((fn) => fn !== cb),
      )
    },
  }

  function emit(type: string) {
    const fns = listeners.get(type) ?? []
    // clone — `once` handlers mutate during iteration
    ;[...fns].forEach((fn) => fn())
  }

  // Schedule loadedmetadata or error after `.src =`
  Object.defineProperty(el, 'src', {
    get: () => '',
    set: () => {
      setTimeout(() => {
        if (controls.failOnError && controls.metadataDelayMs === 0) {
          emit('error')
        } else if (!controls.failOnError) {
          emit('loadedmetadata')
        }
      }, controls.metadataDelayMs)
    },
  })

  return el as unknown as HTMLVideoElement
}

// ---------------------------------------------------------------------------
// Fake canvas — records draw order and returns a small JPEG blob.
// ---------------------------------------------------------------------------

function createFakeCanvas(drawOrder: string[]) {
  const canvas: Partial<HTMLCanvasElement> = {
    width: 0,
    height: 0,
    getContext: ((_type: string) => ({
      drawImage: () => {
        drawOrder.push('draw')
      },
    })) as unknown as HTMLCanvasElement['getContext'],
    toBlob: ((cb: BlobCallback, _type?: string, _q?: number) => {
      // ~400KB placeholder well under the 500KB contract cap.
      const chunk = new Uint8Array(400 * 1024)
      cb(new Blob([chunk], { type: 'image/jpeg' }))
    }) as HTMLCanvasElement['toBlob'],
  }
  return canvas as HTMLCanvasElement
}

function mkFile(size: number, type: string): File {
  const buf = new Uint8Array(size)
  return new File([buf], 'test.mp4', { type })
}

function buildDeps(controls: FakeVideoControls) {
  return {
    createVideo: () => createFakeVideo(controls),
    createCanvas: () => createFakeCanvas(controls.drawOrder),
    createObjectURL: () => 'blob:fake',
    revokeObjectURL: vi.fn(),
  }
}

function baseControls(overrides: Partial<FakeVideoControls> = {}): FakeVideoControls {
  return {
    duration: 60,
    videoWidth: 1920,
    videoHeight: 1080,
    seekDelayMs: 0,
    failOnError: false,
    metadataDelayMs: 0,
    drawOrder: [],
    ...overrides,
  }
}

describe('extractFrames', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('returns 6 JPEG blobs for a valid video (D-13)', async () => {
    const controls = baseControls()
    const blobs = await extractFrames(mkFile(1024, 'video/mp4'), VIDEO_FRAME_COUNT, undefined, buildDeps(controls))

    expect(blobs).toHaveLength(VIDEO_FRAME_COUNT)
    blobs.forEach((b) => expect(b.type).toBe('image/jpeg'))
  })

  it('throws VideoTooLargeError when file exceeds 100MB (D-17)', async () => {
    const controls = baseControls()
    // Construct a fake File with inflated size so we do not allocate 101MB.
    const oversizedFile = new File([new Uint8Array(1024)], 'big.mp4', { type: 'video/mp4' })
    Object.defineProperty(oversizedFile, 'size', { value: VIDEO_MAX_BYTES + 1 })

    await expect(extractFrames(oversizedFile, 6, undefined, buildDeps(controls))).rejects.toBeInstanceOf(
      VideoTooLargeError,
    )
  })

  it('throws VideoTooLongError when duration > 300s (D-17)', async () => {
    const controls = baseControls({ duration: 301 })
    await expect(
      extractFrames(mkFile(1024, 'video/mp4'), 6, undefined, buildDeps(controls)),
    ).rejects.toBeInstanceOf(VideoTooLongError)
  })

  it('throws VideoDecodeError when the video element fires error', async () => {
    const controls = baseControls({ failOnError: true })
    await expect(
      extractFrames(mkFile(1024, 'video/mp4'), 6, undefined, buildDeps(controls)),
    ).rejects.toBeInstanceOf(VideoDecodeError)
  })

  it('rejects unsupported mime types with VideoUnsupportedFormatError (D-17)', async () => {
    const controls = baseControls()
    await expect(
      extractFrames(mkFile(1024, 'video/avi'), 6, undefined, buildDeps(controls)),
    ).rejects.toBeInstanceOf(VideoUnsupportedFormatError)
  })

  it('each returned blob is ≤ ~500KB (validates scaling + quality)', async () => {
    const controls = baseControls()
    const blobs = await extractFrames(mkFile(1024, 'video/mp4'), VIDEO_FRAME_COUNT, undefined, buildDeps(controls))
    blobs.forEach((b) => expect(b.size).toBeLessThanOrEqual(500 * 1024))
  })

  it('awaits the `seeked` event before drawing (finding #5)', async () => {
    // Seek resolves asynchronously; if the implementation draws before
    // awaiting `seeked`, the order will contain `draw` before `seeked`.
    const controls = baseControls({ seekDelayMs: 5 })
    await extractFrames(mkFile(1024, 'video/mp4'), 2, undefined, buildDeps(controls))

    // Expected order per frame: seeked → draw. Never draw before seeked.
    for (let i = 0; i < controls.drawOrder.length; i += 2) {
      expect(controls.drawOrder[i]).toBe('seeked')
      expect(controls.drawOrder[i + 1]).toBe('draw')
    }
  })

  it('reports extraction progress for each frame', async () => {
    const controls = baseControls()
    const events: Array<{ stage: string; current: number; total: number }> = []
    await extractFrames(mkFile(1024, 'video/mp4'), 3, (p) => events.push({ ...p }), buildDeps(controls))

    const extracting = events.filter((e) => e.stage === 'extracting')
    expect(extracting).toHaveLength(3)
    expect(extracting[0]).toMatchObject({ current: 1, total: 3 })
    expect(extracting[2]).toMatchObject({ current: 3, total: 3 })
  })
})
