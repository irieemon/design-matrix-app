import { useState } from 'react'
import { Target, Mail, Lock, User, Eye, EyeOff, ArrowRight, Sparkles, AlertCircle, CheckCircle } from 'lucide-react'
import PrioritasLogo from '../PrioritasLogo'
import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void
}

type AuthMode = 'login' | 'signup' | 'forgot-password'

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (mode === 'signup') {
        // Validation
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long')
        }
        if (!fullName.trim()) {
          throw new Error('Full name is required')
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            }
          }
        })

        if (error) throw error

        if (data.user && !data.user.email_confirmed_at) {
          setSuccess('Please check your email for a confirmation link before signing in.')
          setMode('login')
        } else if (data.user) {
          onAuthSuccess(data.user)
        }

      } else if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
        if (data.user) {
          onAuthSuccess(data.user)
        }

      } else if (mode === 'forgot-password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        })

        if (error) throw error
        setSuccess('Password reset email sent! Check your inbox.')
        setMode('login')
      }
    } catch (err: any) {
      logger.error('Auth error:', err)
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }


  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Create Your Account'
      case 'forgot-password': return 'Reset Password'
      default: return 'Welcome Back'
    }
  }

  const getSubtitle = () => {
    switch (mode) {
      case 'signup': return 'Join thousands of teams organizing their priorities'
      case 'forgot-password': return 'Enter your email to receive a password reset link'
      default: return 'Sign in to your priority matrix workspace'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-white to-slate-100 rounded-2xl mb-4 shadow-lg">
            <PrioritasLogo className="text-blue-600" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Prioritas</h1>
          <p className="text-slate-600">Smart Priority Matrix Platform</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{getTitle()}</h2>
            <p className="text-slate-600 text-sm">{getSubtitle()}</p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            </div>
          )}


          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name - Only for signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Password - Not for forgot password */}
            {mode !== 'forgot-password' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password - Only for signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium py-3 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>
                    {mode === 'signup' ? 'Create Account' : 
                     mode === 'forgot-password' ? 'Send Reset Link' : 'Sign In'}
                  </span>
                  {mode !== 'forgot-password' && <ArrowRight className="w-4 h-4" />}
                </>
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center text-sm">
            {mode === 'login' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Forgot your password?
                </button>
                <div>
                  <span className="text-slate-600">Don't have an account? </span>
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                  >
                    Sign up
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <span className="text-slate-600">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                  Sign in
                </button>
              </div>
            )}

            {mode === 'forgot-password' && (
              <div>
                <span className="text-slate-600">Remember your password? </span>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            )}
          </div>

          {/* Terms */}
          {mode === 'signup' && (
            <div className="mt-6 text-center text-xs text-slate-500">
              By creating an account, you agree to our{' '}
              <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and{' '}
              <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          {[
            { icon: Target, title: 'Smart Prioritization', desc: 'AI-powered priority matrix' },
            { icon: Sparkles, title: 'Team Collaboration', desc: 'Real-time project sharing' },
            { icon: ArrowRight, title: 'Strategic Planning', desc: 'Roadmap generation' }
          ].map((feature, index) => (
            <div key={index} className="bg-white/50 backdrop-blur-sm rounded-xl p-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <feature.icon className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-medium text-slate-900 text-sm">{feature.title}</h3>
              <p className="text-xs text-slate-600 mt-1">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AuthScreen