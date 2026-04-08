/**
 * Client-side video frame extraction (Phase 07-03, D-12/D-13/D-14/D-17).
 *
 * Extracts a uniformly-distributed set of JPEG frames from a user-provided
 * video File entirely in-browser. The source blob never leaves the device —
 * only the resulting JPEG frames are uploaded for analysis.
 *
 * Async-seek correctness (07-RESEARCH finding #5): HTMLMediaElement seeking
 * is asynchronous. We MUST await the `seeked` event before drawing, otherwise
 * the canvas captures the old frame.
 */

export const VIDEO_MAX_BYTES = 100 * 1024 * 1024 // 100MB (D-17)
export const VIDEO_MAX_DURATION_SEC = 300 // 5min (D-17)
export const VIDEO_FRAME_COUNT = 6 // D-13
export const VIDEO_FRAME_MAX_EDGE = 1024 // D-14
export const VIDEO_FRAME_QUALITY = 0.85 // D-14
export const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const // D-17

export class VideoTooLargeError extends Error {
  constructor(message = 'Video is larger than the 100MB limit') {
    super(message)
    this.name = 'VideoTooLargeError'
  }
}

export class VideoTooLongError extends Error {
  constructor(message = 'Video is longer than the 5 minute limit') {
    super(message)
    this.name = 'VideoTooLongError'
  }
}

export class VideoDecodeError extends Error {
  constructor(message = 'Browser could not decode this video') {
    super(message)
    this.name = 'VideoDecodeError'
  }
}

export class VideoUnsupportedFormatError extends Error {
  constructor(message = 'Unsupported video format') {
    super(message)
    this.name = 'VideoUnsupportedFormatError'
  }
}

export interface ExtractProgress {
  stage: 'loading' | 'extracting'
  current: number
  total: number
}

/**
 * Test seam: constructs the working HTMLVideoElement. Overridden in tests so
 * we can drive the async `loadedmetadata`/`seeked`/`error` lifecycle without
 * relying on jsdom's (absent) media implementation.
 */
export interface ExtractFramesDeps {
  createVideo?: () => HTMLVideoElement
  createCanvas?: () => HTMLCanvasElement
  createObjectURL?: (file: Blob) => string
  revokeObjectURL?: (url: string) => void
}

const defaultDeps: Required<ExtractFramesDeps> = {
  createVideo: () => document.createElement('video'),
  createCanvas: () => document.createElement('canvas'),
  createObjectURL: (file) => URL.createObjectURL(file),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
}

export async function extractFrames(
  file: File,
  count: number = VIDEO_FRAME_COUNT,
  onProgress?: (p: ExtractProgress) => void,
  deps: ExtractFramesDeps = {},
): Promise<Blob[]> {
  const { createVideo, createCanvas, createObjectURL, revokeObjectURL } = {
    ...defaultDeps,
    ...deps,
  }

  if (file.size > VIDEO_MAX_BYTES) {
    throw new VideoTooLargeError()
  }

  if (!ACCEPTED_VIDEO_TYPES.includes(file.type as (typeof ACCEPTED_VIDEO_TYPES)[number])) {
    throw new VideoUnsupportedFormatError(
      `Unsupported format: ${file.type || 'unknown'}. Use MP4, WebM, or MOV.`,
    )
  }

  const video = createVideo()
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  const objectUrl = createObjectURL(file)
  video.src = objectUrl

  try {
    onProgress?.({ stage: 'loading', current: 0, total: count })

    await waitForMetadata(video)

    if (video.duration > VIDEO_MAX_DURATION_SEC) {
      throw new VideoTooLongError()
    }

    const canvas = createCanvas()
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new VideoDecodeError('Canvas 2D context unavailable')
    }

    const frames: Blob[] = []
    for (let i = 1; i <= count; i++) {
      // Uniform distribution: i * duration / (count + 1). Avoids 0s and EOF.
      const t = (i * video.duration) / (count + 1)

      await seekTo(video, t)

      const width = video.videoWidth || 1280
      const height = video.videoHeight || 720
      const scale = Math.min(1, VIDEO_FRAME_MAX_EDGE / Math.max(width, height))
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const blob = await canvasToJpeg(canvas)
      frames.push(blob)
      onProgress?.({ stage: 'extracting', current: i, total: count })
    }

    return frames
  } finally {
    try {
      revokeObjectURL(objectUrl)
      video.src = ''
    } catch {
      // ignore cleanup failures
    }
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const onLoaded = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new VideoDecodeError('Failed to load video metadata'))
    }
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('loadedmetadata', onLoaded, { once: true })
    video.addEventListener('error', onError, { once: true })
  })
}

function seekTo(video: HTMLVideoElement, timestamp: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new VideoDecodeError(`Seek failed at ${timestamp}s`))
    }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    // Setting currentTime kicks off the async seek. The `seeked` listener
    // above is the only signal that the new frame is ready to draw.
    video.currentTime = timestamp
  })
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new VideoDecodeError('canvas.toBlob() returned null'))
      },
      'image/jpeg',
      VIDEO_FRAME_QUALITY,
    )
  })
}
