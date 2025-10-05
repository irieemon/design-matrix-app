import { useEffect, useRef, useCallback, useState } from 'react'
import { useLogger } from '../lib/logging'

// Animation configurations
export interface AnimationConfig {
  duration?: number
  easing?: string
  delay?: number
  iterations?: number
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both'
}

export interface SpringConfig {
  tension?: number
  friction?: number
  mass?: number
  velocity?: number
}

export interface ParticleConfig {
  count?: number
  colors?: string[]
  shapes?: ('circle' | 'square' | 'triangle')[]
  duration?: number
  spread?: number
  origin?: { x: number; y: number }
}

// Predefined premium animations
const PREMIUM_ANIMATIONS = {
  // Entrance animations
  fadeInUp: {
    keyframes: [
      { opacity: 0, transform: 'translateY(20px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ],
    config: { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  },
  
  slideInRight: {
    keyframes: [
      { opacity: 0, transform: 'translateX(30px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ],
    config: { duration: 500, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }
  },
  
  scaleIn: {
    keyframes: [
      { opacity: 0, transform: 'scale(0.9)' },
      { opacity: 1, transform: 'scale(1)' }
    ],
    config: { duration: 400, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
  },
  
  // Interaction animations
  bounce: {
    keyframes: [
      { transform: 'scale(1)' },
      { transform: 'scale(1.05)' },
      { transform: 'scale(0.95)' },
      { transform: 'scale(1)' }
    ],
    config: { duration: 600, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' }
  },
  
  pulse: {
    keyframes: [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.1)', opacity: 0.8 },
      { transform: 'scale(1)', opacity: 1 }
    ],
    config: { duration: 1000, easing: 'ease-in-out', iterations: Infinity }
  },
  
  shake: {
    keyframes: [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-5px)' },
      { transform: 'translateX(5px)' },
      { transform: 'translateX(-5px)' },
      { transform: 'translateX(0)' }
    ],
    config: { duration: 500, easing: 'ease-in-out' }
  },
  
  // Success animations
  checkmark: {
    keyframes: [
      { opacity: 0, transform: 'scale(0) rotate(45deg)' },
      { opacity: 1, transform: 'scale(1.2) rotate(45deg)' },
      { opacity: 1, transform: 'scale(1) rotate(45deg)' }
    ],
    config: { duration: 600, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }
  },
  
  // Loading animations
  shimmer: {
    keyframes: [
      { transform: 'translateX(-100%)' },
      { transform: 'translateX(100%)' }
    ],
    config: { duration: 1500, easing: 'ease-in-out', iterations: Infinity }
  },
  
  // Hover effects
  liftUp: {
    keyframes: [
      { transform: 'translateY(0) scale(1)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
      { transform: 'translateY(-2px) scale(1.02)', boxShadow: '0 8px 25px rgba(0,0,0,0.15)' }
    ],
    config: { duration: 200, easing: 'ease-out', fillMode: 'forwards' }
  },
  
  // Attention seekers
  wiggle: {
    keyframes: [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(5deg)' },
      { transform: 'rotate(-5deg)' },
      { transform: 'rotate(0deg)' }
    ],
    config: { duration: 500, easing: 'ease-in-out' }
  }
}

export const usePremiumAnimations = () => {
  const logger = useLogger('usePremiumAnimations')
  const [isAnimationEnabled, setIsAnimationEnabled] = useState(true)
  const animationRefs = useRef<Map<string, Animation>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Check user's animation preferences
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setIsAnimationEnabled(!prefersReducedMotion)
  }, [])

  // Animate element with predefined animation
  const animate = useCallback((element: HTMLElement, animationName: keyof typeof PREMIUM_ANIMATIONS, customConfig?: AnimationConfig) => {
    if (!isAnimationEnabled || !element) return null

    const animation = PREMIUM_ANIMATIONS[animationName]
    if (!animation) {
      logger.warn('Animation not found', { animationName })
      return null
    }

    try {
      const config = { ...animation.config, ...customConfig }
      const webAnimation = element.animate(animation.keyframes, config)

      // Store animation reference
      const animationId = `${animationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      animationRefs.current.set(animationId, webAnimation)

      // Cleanup when animation finishes or is cancelled
      const cleanup = () => {
        animationRefs.current.delete(animationId)
      }

      webAnimation.addEventListener('finish', cleanup)
      webAnimation.addEventListener('cancel', cleanup)

      return webAnimation
    } catch (error) {
      logger.warn('Failed to create animation', { animationName, error })
      return null
    }
  }, [isAnimationEnabled])

  // Custom keyframe animation
  const animateCustom = useCallback((element: HTMLElement, keyframes: Keyframe[], config: AnimationConfig = {}) => {
    if (!isAnimationEnabled || !element) return null

    try {
      const defaultConfig = {
        duration: 300,
        easing: 'ease',
        fillMode: 'both' as const
      }

      const webAnimation = element.animate(keyframes, { ...defaultConfig, ...config })

      const animationId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      animationRefs.current.set(animationId, webAnimation)

      // Cleanup when animation finishes or is cancelled
      const cleanup = () => {
        animationRefs.current.delete(animationId)
      }

      webAnimation.addEventListener('finish', cleanup)
      webAnimation.addEventListener('cancel', cleanup)

      return webAnimation
    } catch (error) {
      logger.warn('Failed to create custom animation', { error })
      return null
    }
  }, [isAnimationEnabled, logger])

  // Spring-based animation (simplified)
  const animateSpring = useCallback((element: HTMLElement, targetState: Partial<CSSStyleDeclaration>, springConfig: SpringConfig = {}) => {
    if (!isAnimationEnabled || !element) return null

    const { tension = 170, friction = 26, mass = 1 } = springConfig
    
    // Convert spring config to CSS transition
    const dampingRatio = friction / (2 * Math.sqrt(mass * tension))
    const naturalFrequency = Math.sqrt(tension / mass)
    const duration = dampingRatio < 1 ? 
      (4 / (naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio))) * 1000 :
      (4 / naturalFrequency) * 1000

    const easing = dampingRatio >= 1 ? 'ease-out' : 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'

    // Apply styles with transition
    element.style.transition = `all ${duration}ms ${easing}`
    Object.assign(element.style, targetState)

    // Reset transition after animation
    setTimeout(() => {
      element.style.transition = ''
    }, duration)

    return { duration, easing }
  }, [isAnimationEnabled])

  // Stagger animation for multiple elements
  const staggerAnimation = useCallback((elements: HTMLElement[], animationName: keyof typeof PREMIUM_ANIMATIONS, staggerDelay = 100) => {
    if (!isAnimationEnabled) return []

    return elements.map((element, index) => {
      return animate(element, animationName, { delay: index * staggerDelay })
    }).filter(Boolean)
  }, [animate, isAnimationEnabled])

  // Parallax scroll effect
  const createParallaxEffect = useCallback((element: HTMLElement, speed = 0.5) => {
    if (!isAnimationEnabled) return () => {}

    const handleScroll = () => {
      const scrolled = window.pageYOffset
      const rate = scrolled * -speed
      element.style.transform = `translateY(${rate}px)`
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isAnimationEnabled])

  // Intersection observer animations
  const animateOnScroll = useCallback((element: HTMLElement, animationName: keyof typeof PREMIUM_ANIMATIONS, threshold = 0.1) => {
    if (!isAnimationEnabled) return () => {}

    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const animationName = entry.target.getAttribute('data-animation') as keyof typeof PREMIUM_ANIMATIONS
            if (animationName) {
              animate(entry.target as HTMLElement, animationName)
            }
          }
        })
      }, { threshold })
    }

    element.setAttribute('data-animation', animationName)
    observerRef.current.observe(element)

    return () => {
      if (observerRef.current) {
        observerRef.current.unobserve(element)
      }
    }
  }, [animate, isAnimationEnabled])

  // Particle burst effect
  const createParticleBurst = useCallback((element: HTMLElement, config: ParticleConfig = {}) => {
    if (!isAnimationEnabled) return

    const {
      count = 10,
      colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
      shapes = ['circle'],
      duration = 1000,
      spread = 100,
      origin = { x: 0.5, y: 0.5 }
    } = config

    const rect = element.getBoundingClientRect()
    const container = document.createElement('div')
    container.style.cssText = `
      position: fixed;
      top: ${rect.top + rect.height * origin.y}px;
      left: ${rect.left + rect.width * origin.x}px;
      pointer-events: none;
      z-index: 9999;
    `
    document.body.appendChild(container)

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div')
      const color = colors[Math.floor(Math.random() * colors.length)]
      const shape = shapes[Math.floor(Math.random() * shapes.length)]
      const size = Math.random() * 8 + 4
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
      const velocity = Math.random() * spread + 50
      const x = Math.cos(angle) * velocity
      const y = Math.sin(angle) * velocity

      particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: ${shape === 'circle' ? '50%' : '0'};
        transform: ${shape === 'triangle' ? 'rotate(45deg)' : 'none'};
      `

      container.appendChild(particle)

      // Animate particle
      particle.animate([
        { 
          transform: `translate(0, 0) scale(1)`,
          opacity: 1
        },
        { 
          transform: `translate(${x}px, ${y}px) scale(0)`,
          opacity: 0
        }
      ], {
        duration: duration + Math.random() * 500,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      })
    }

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(container)
    }, duration + 500)
  }, [isAnimationEnabled])

  // Cleanup all animations
  const cleanup = useCallback(() => {
    animationRefs.current.forEach(animation => {
      animation.cancel()
    })
    animationRefs.current.clear()

    if (observerRef.current) {
      observerRef.current.disconnect()
    }
  }, [])

  // Auto cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    animate,
    animateCustom,
    animateSpring,
    staggerAnimation,
    createParallaxEffect,
    animateOnScroll,
    createParticleBurst,
    cleanup,
    isAnimationEnabled,
    setIsAnimationEnabled
  }
}