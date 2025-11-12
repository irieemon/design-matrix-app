/**
 * Image Lazy Loading Hook
 *
 * PERFORMANCE OPTIMIZATION: Delays loading images until they're visible in the viewport
 * using Intersection Observer API. Reduces initial page load and bandwidth usage.
 *
 * Key Benefits:
 * - Defers image loading until needed (viewport visibility)
 * - Supports placeholder images during loading
 * - Automatic cleanup on unmount
 * - Handles loading states and errors
 *
 * @example
 * ```typescript
 * function Avatar({ src }: { src: string }) {
 *   const { imgRef, loaded, error } = useLazyImage()
 *
 *   return (
 *     <img
 *       ref={imgRef}
 *       data-src={src} // Actual source loaded lazily
 *       src="placeholder.jpg" // Shown until lazy load
 *       alt="Avatar"
 *       className={loaded ? 'opacity-100' : 'opacity-50'}
 *     />
 *   )
 * }
 * ```
 */

import { useEffect, useRef, useState, RefObject } from 'react'

interface UseLazyImageOptions {
  /** Margin around viewport to trigger loading early (default: '50px') */
  rootMargin?: string
  /** IntersectionObserver threshold (default: 0.01) */
  threshold?: number
  /** Placeholder image to show while loading */
  placeholder?: string
}

interface UseLazyImageReturn {
  /** Ref to attach to the img element */
  imgRef: RefObject<HTMLImageElement>
  /** Whether the image has loaded successfully */
  loaded: boolean
  /** Any error that occurred during loading */
  error: Error | null
  /** Whether the image is currently loading */
  loading: boolean
}

/**
 * Hook for lazy loading images with Intersection Observer
 */
export function useLazyImage(options: UseLazyImageOptions = {}): UseLazyImageReturn {
  const {
    rootMargin = '50px',
    threshold = 0.01,
    placeholder
  } = options

  const imgRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const imgElement = imgRef.current
    if (!imgElement) return

    // Check if IntersectionObserver is supported
    if (!('IntersectionObserver' in window)) {
      // Fallback: load image immediately on older browsers
      loadImage(imgElement)
      return
    }

    // Callback when image enters viewport
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadImage(imgElement)
          observer.unobserve(imgElement)
        }
      })
    }

    // Create observer
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold
    })

    // Start observing
    observer.observe(imgElement)

    // Cleanup
    return () => {
      if (imgElement) {
        observer.unobserve(imgElement)
      }
    }
  }, [rootMargin, threshold])

  const loadImage = (imgElement: HTMLImageElement) => {
    const src = imgElement.dataset.src
    if (!src) return

    setLoading(true)
    setError(null)

    // Create temporary image to test loading
    const tempImg = new Image()

    tempImg.onload = () => {
      imgElement.src = src
      setLoaded(true)
      setLoading(false)
    }

    tempImg.onerror = () => {
      const error = new Error(`Failed to load image: ${src}`)
      setError(error)
      setLoading(false)

      // Show placeholder on error if provided
      if (placeholder && imgElement.src !== placeholder) {
        imgElement.src = placeholder
      }
    }

    tempImg.src = src
  }

  return {
    imgRef,
    loaded,
    error,
    loading
  }
}

/**
 * Component version of lazy image for easier use
 *
 * @example
 * ```typescript
 * <LazyImage
 *   src="/large-image.jpg"
 *   placeholder="/placeholder.jpg"
 *   alt="Description"
 *   className="w-full h-auto"
 * />
 * ```
 */
export interface LazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'> {
  /** Actual image source to lazy load */
  src: string
  /** Placeholder image to show during loading */
  placeholder?: string
  /** CSS class for loading state */
  loadingClassName?: string
  /** CSS class for loaded state */
  loadedClassName?: string
  /** CSS class for error state */
  errorClassName?: string
  /** Callback when image loads successfully */
  onLoad?: () => void
  /** Callback when image fails to load */
  onError?: (error: Error) => void
  /** Intersection Observer options */
  rootMargin?: string
  threshold?: number
}

export function LazyImage({
  src,
  placeholder = '',
  loadingClassName = 'opacity-50',
  loadedClassName = 'opacity-100 transition-opacity duration-300',
  errorClassName = 'opacity-30',
  onLoad,
  onError,
  rootMargin,
  threshold,
  className = '',
  alt = '',
  ...props
}: LazyImageProps) {
  const { imgRef, loaded, error, loading } = useLazyImage({
    rootMargin,
    threshold,
    placeholder
  })

  // Call user callbacks
  useEffect(() => {
    if (loaded && onLoad) {
      onLoad()
    }
  }, [loaded, onLoad])

  useEffect(() => {
    if (error && onError) {
      onError(error)
    }
  }, [error, onError])

  // Determine className based on state
  const stateClassName = error
    ? errorClassName
    : loaded
    ? loadedClassName
    : loading
    ? loadingClassName
    : ''

  return (
    <img
      ref={imgRef}
      data-src={src}
      src={placeholder}
      alt={alt}
      className={`${className} ${stateClassName}`.trim()}
      {...props}
    />
  )
}

/**
 * Hook for lazy loading background images on div elements
 *
 * @example
 * ```typescript
 * function Hero({ imageUrl }: { imageUrl: string }) {
 *   const { divRef, loaded } = useLazyBackgroundImage(imageUrl)
 *
 *   return (
 *     <div
 *       ref={divRef}
 *       className={`hero ${loaded ? 'bg-loaded' : 'bg-loading'}`}
 *     >
 *       Content
 *     </div>
 *   )
 * }
 * ```
 */
export function useLazyBackgroundImage(
  imageUrl: string,
  options: UseLazyImageOptions = {}
) {
  const {
    rootMargin = '50px',
    threshold = 0.01
  } = options

  const divRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const divElement = divRef.current
    if (!divElement) return

    // Check if IntersectionObserver is supported
    if (!('IntersectionObserver' in window)) {
      // Fallback: load image immediately
      loadBackgroundImage(divElement)
      return
    }

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadBackgroundImage(divElement)
          observer.unobserve(divElement)
        }
      })
    }

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold
    })

    observer.observe(divElement)

    return () => {
      if (divElement) {
        observer.unobserve(divElement)
      }
    }
  }, [imageUrl, rootMargin, threshold])

  const loadBackgroundImage = (divElement: HTMLDivElement) => {
    // Preload image
    const tempImg = new Image()

    tempImg.onload = () => {
      divElement.style.backgroundImage = `url(${imageUrl})`
      setLoaded(true)
    }

    tempImg.onerror = () => {
      const error = new Error(`Failed to load background image: ${imageUrl}`)
      setError(error)
    }

    tempImg.src = imageUrl
  }

  return {
    divRef,
    loaded,
    error
  }
}
