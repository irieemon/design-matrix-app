/**
 * MM-08 unit tests for resizeImageToFile
 *
 * JSDOM does not implement Canvas. We stub:
 * - HTMLCanvasElement.prototype.getContext (returns a fake ctx with no-op drawImage)
 * - HTMLCanvasElement.prototype.toBlob (synchronously emits a fake JPEG blob)
 * - global.Image (dispatches onload on a microtask with configurable width/height)
 * - URL.createObjectURL / revokeObjectURL (no-op string)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resizeImageToFile } from '../imageResize'

interface MockImageDims {
  width: number
  height: number
  shouldError?: boolean
}

let nextImageDims: MockImageDims = { width: 100, height: 100 }

class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 0
  height = 0
  set src(_v: string) {
    queueMicrotask(() => {
      if (nextImageDims.shouldError) {
        this.onerror?.()
        return
      }
      this.width = nextImageDims.width
      this.height = nextImageDims.height
      this.onload?.()
    })
  }
}

beforeEach(() => {
  // @ts-expect-error override global Image
  global.Image = MockImage

  // URL stubs
  if (!('createObjectURL' in URL)) {
    // @ts-expect-error
    URL.createObjectURL = vi.fn(() => 'blob:mock')
  } else {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
  }
  if (!('revokeObjectURL' in URL)) {
    // @ts-expect-error
    URL.revokeObjectURL = vi.fn()
  } else {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  }

  // Canvas stubs — JSDOM clamps canvas width/height, so override the
  // width/height accessors to store any value the SUT writes.
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
    configurable: true,
    get() { return this._w ?? 0 },
    set(v: number) { this._w = v },
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
    configurable: true,
    get() { return this._h ?? 0 },
    set(v: number) { this._h = v },
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    // @ts-expect-error partial mock
    () => ({ drawImage: () => {} })
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback
  ) {
    cb(new Blob(['resized'], { type: 'image/jpeg' }))
  })

  nextImageDims = { width: 100, height: 100 }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resizeImageToFile (MM-08)', () => {
  it('resizes a 3000x1500 image so the longest edge is exactly 2048px and outputs image/jpeg', async () => {
    nextImageDims = { width: 3000, height: 1500 }
    const input = new File(['source'], 'photo.png', { type: 'image/png' })

    const drawSpy = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      // @ts-expect-error partial
      () => ({ drawImage: drawSpy })
    )

    const result = await resizeImageToFile(input)

    expect(result).toBeInstanceOf(File)
    expect(result.type).toBe('image/jpeg')
    expect(drawSpy).toHaveBeenCalledTimes(1)
    // drawImage(img, 0, 0, w, h) — width is arg index 3, height is arg index 4
    const [, , , width, height] = drawSpy.mock.calls[0]
    expect(width).toBe(2048)
    expect(height).toBe(Math.round(1500 * (2048 / 3000)))
  })

  it('returns the original file unchanged when longest edge is below 2048', async () => {
    nextImageDims = { width: 1000, height: 1000 }
    const input = new File(['source'], 'small.png', { type: 'image/png' })

    const result = await resizeImageToFile(input)

    expect(result).toBe(input)
    expect(result.type).toBe('image/png')
    expect(result.name).toBe('small.png')
  })

  it('rejects with "Image load failed" when the image cannot be decoded', async () => {
    nextImageDims = { width: 0, height: 0, shouldError: true }
    const input = new File([], 'broken.jpg', { type: 'image/jpeg' })

    await expect(resizeImageToFile(input)).rejects.toThrow('Image load failed')
  })

  it('outputs a filename with .jpg extension regardless of input extension', async () => {
    nextImageDims = { width: 4000, height: 2000 }
    const input = new File(['source'], 'photo.png', { type: 'image/png' })

    const result = await resizeImageToFile(input)

    expect(result.name).toBe('photo.jpg')
  })

  it('preserves aspect ratio within 1px tolerance', async () => {
    nextImageDims = { width: 4000, height: 3000 }
    const input = new File(['source'], 'photo.webp', { type: 'image/webp' })

    const drawSpy = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      // @ts-expect-error partial
      () => ({ drawImage: drawSpy })
    )

    await resizeImageToFile(input, { maxEdgePx: 2048 })

    const [, , , w, h] = drawSpy.mock.calls[0]
    const inputRatio = 4000 / 3000
    const outputRatio = w / h
    expect(Math.abs(inputRatio - outputRatio)).toBeLessThan(0.01)
    expect(w).toBe(2048)
  })
})
