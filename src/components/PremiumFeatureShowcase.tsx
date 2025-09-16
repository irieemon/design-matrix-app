import React, { useRef, useEffect } from 'react'
import { Sparkles, Zap, TrendingUp, Shield, Cpu, Layers, Wand2 } from 'lucide-react'
import { usePremiumAnimations } from '../hooks/usePremiumAnimations'

interface PremiumFeature {
  icon: React.ReactNode
  title: string
  description: string
  color: string
  benefits: string[]
}

const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    icon: <Zap className="w-6 h-6" />,
    title: "React 19 Concurrent Features",
    description: "Smooth, non-blocking AI processing with useTransition",
    color: "from-blue-500 to-cyan-500",
    benefits: [
      "Seamless user interactions during AI processing",
      "Advanced progress tracking with real-time updates",
      "Intelligent loading states and stage indicators"
    ]
  },
  {
    icon: <Cpu className="w-6 h-6" />,
    title: "Web Workers Integration",
    description: "Background AI analysis without blocking the main thread",
    color: "from-purple-500 to-pink-500",
    benefits: [
      "Non-blocking heavy computations",
      "Responsive UI during complex operations",
      "Automatic fallback to main thread"
    ]
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: "Optimistic Updates",
    description: "Instant UI feedback with smart error recovery",
    color: "from-green-500 to-emerald-500",
    benefits: [
      "Immediate visual feedback",
      "Automatic rollback on errors",
      "Intelligent retry mechanisms"
    ]
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Smart Error Recovery",
    description: "Advanced error handling with automatic classification",
    color: "from-orange-500 to-red-500",
    benefits: [
      "Automatic error type detection",
      "Contextual recovery strategies",
      "User-friendly error messages"
    ]
  },
  {
    icon: <Wand2 className="w-6 h-6" />,
    title: "AI-Powered Suggestions",
    description: "Real-time intelligent suggestions and auto-completion",
    color: "from-indigo-500 to-purple-500",
    benefits: [
      "Context-aware auto-completion",
      "Smart pattern recognition",
      "Business domain expertise"
    ]
  },
  {
    icon: <Layers className="w-6 h-6" />,
    title: "Premium Animations",
    description: "Sophisticated micro-interactions and visual feedback",
    color: "from-pink-500 to-rose-500",
    benefits: [
      "Smooth entrance and exit animations",
      "Interactive hover effects",
      "Accessibility-aware motion"
    ]
  }
]

interface PremiumFeatureShowcaseProps {
  className?: string
}

const PremiumFeatureShowcase: React.FC<PremiumFeatureShowcaseProps> = ({ className = '' }) => {
  const { animate, staggerAnimation, animateOnScroll, createParticleBurst } = usePremiumAnimations()
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    // Animate header on mount
    if (headerRef.current) {
      animate(headerRef.current, 'fadeInUp', { delay: 200 })
    }

    // Stagger feature cards
    if (featuresRef.current.length > 0) {
      staggerAnimation(featuresRef.current, 'slideInRight', 150)
    }

    // Set up scroll animations
    featuresRef.current.forEach((ref, index) => {
      if (ref) {
        animateOnScroll(ref, 'scaleIn', 0.2)
      }
    })
  }, [])

  const handleFeatureClick = (index: number) => {
    const element = featuresRef.current[index]
    if (element) {
      // Create particle burst effect
      createParticleBurst(element, {
        count: 15,
        colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
        duration: 800
      })
      
      // Bounce animation
      animate(element, 'bounce')
    }
  }

  return (
    <div ref={containerRef} className={`bg-gradient-to-br from-slate-50 to-blue-50 rounded-3xl p-8 ${className}`}>
      {/* Header */}
      <div ref={headerRef} className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl mb-6 shadow-lg">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Premium AI Experience
        </h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Experience the cutting-edge of AI-powered productivity with advanced concurrent processing, 
          intelligent suggestions, and premium interactions designed for the modern user.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {PREMIUM_FEATURES.map((feature, index) => (
          <div
            key={feature.title}
            ref={(el) => el && (featuresRef.current[index] = el)}
            className="group cursor-pointer"
            onClick={() => handleFeatureClick(index)}
          >
            <div className="h-full bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-gray-200 transform hover:-translate-y-1">
              {/* Feature Icon */}
              <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r ${feature.color} rounded-xl mb-4 text-white shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                {feature.icon}
              </div>
              
              {/* Feature Content */}
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                {feature.title}
              </h3>
              
              <p className="text-gray-600 mb-4 leading-relaxed">
                {feature.description}
              </p>
              
              {/* Benefits List */}
              <ul className="space-y-2">
                {feature.benefits.map((benefit, benefitIndex) => (
                  <li key={benefitIndex} className="flex items-start space-x-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              
              {/* Hover Indicator */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Click to see effect</span>
                  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Sparkles className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="text-center mt-12">
        <div className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 cursor-pointer group">
          <Sparkles className="w-5 h-5 mr-2 group-hover:animate-spin" />
          <span>Experience Premium AI Now</span>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          All features are active and ready to enhance your productivity
        </p>
      </div>
    </div>
  )
}

export default PremiumFeatureShowcase