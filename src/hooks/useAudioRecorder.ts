import { useCallback, useEffect, useRef, useState } from 'react'
import { logger } from '../utils/logger'

/**
 * useAudioRecorder
 *
 * Wraps the browser MediaRecorder API with React lifecycle, mic cleanup,
 * and iOS Safari MIME-type fallback (audio/webm → audio/mp4).
 *
 * IMPORTANT: `start()` must be invoked synchronously inside a user gesture
 * (e.g. a button onClick handler) for browser permission prompts to work.
 */
export interface UseAudioRecorderReturn {
  isRecording: boolean
  elapsedMs: number
  error: string | null
  start: () => Promise<void>
  stop: () => Promise<Blob>
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return undefined
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [isRecording, setIsRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      try {
        stream.getTracks().forEach((t) => t.stop())
      } catch (e) {
        logger.debug('useAudioRecorder: error stopping tracks', e)
      }
    }
    streamRef.current = null
    recorderRef.current = null
    setIsRecording(false)
    setElapsedMs(0)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    chunksRef.current = []
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      logger.error('useAudioRecorder: getUserMedia failed', err)
      setError('Microphone permission denied or unavailable')
      return
    }

    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    )

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorderRef.current = recorder
    streamRef.current = stream
    startedAtRef.current = Date.now()

    recorder.start()
    setIsRecording(true)
    logger.debug('useAudioRecorder: started', { mimeType })

    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current)
    }, 100)
  }, [])

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current
      if (!recorder) {
        reject(new Error('Not recording'))
        return
      }
      const finalize = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        logger.debug('useAudioRecorder: stopped', {
          size: blob.size,
          type: blob.type,
        })
        cleanup()
        resolve(blob)
      }
      recorder.onstop = finalize
      try {
        recorder.stop()
      } catch (err) {
        logger.error('useAudioRecorder: stop failed', err)
        cleanup()
        reject(err instanceof Error ? err : new Error('stop failed'))
      }
    })
  }, [cleanup])

  // Unmount cleanup — guard against mic leak
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current
      if (recorder && recorder.state === 'recording') {
        try {
          recorder.stop()
        } catch (e) {
          logger.debug('useAudioRecorder: unmount stop failed', e)
        }
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      const stream = streamRef.current
      if (stream) {
        try {
          stream.getTracks().forEach((t) => t.stop())
        } catch (e) {
          logger.debug('useAudioRecorder: unmount track stop failed', e)
        }
      }
      streamRef.current = null
      recorderRef.current = null
    }
  }, [])

  return { isRecording, elapsedMs, error, start, stop }
}
