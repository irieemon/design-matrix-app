/**
 * Client-side image resize utility (MM-08)
 *
 * Resizes an input image File so the longest edge is at most `maxEdgePx`
 * (default 2048), encoding the result as JPEG at the configured quality
 * (default 0.85). Files already within the limit are returned unchanged.
 *
 * Uses the browser Canvas API — no external dependencies.
 */

export interface ResizeOptions {
  /** Longest-edge cap in pixels. Default: 2048 */
  maxEdgePx?: number
  /** JPEG output quality (0..1). Default: 0.85 */
  quality?: number
}

export async function resizeImageToFile(
  file: File,
  options: ResizeOptions = {}
): Promise<File> {
  const maxEdgePx = options.maxEdgePx ?? 2048
  const quality = options.quality ?? 0.85

  return new Promise<File>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      const width = img.width
      const height = img.height
      const longestEdge = Math.max(width, height)

      // Below threshold — return original unchanged
      if (longestEdge <= maxEdgePx) {
        URL.revokeObjectURL(url)
        resolve(file)
        return
      }

      const scale = maxEdgePx / longestEdge
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas resize failed'))
        return
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (!blob) {
            reject(new Error('Canvas resize failed'))
            return
          }
          const newName = file.name.replace(/\.[^.]+$/, '.jpg')
          resolve(new File([blob], newName, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }

    img.src = url
  })
}
