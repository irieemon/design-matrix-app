import { useState, useRef } from 'react'
import { Target, Mail, Lock, User, Eye, EyeOff, ArrowRight, Sparkles, AlertCircle, CheckCircle } from 'lucide-react'
import PrioritasLogo from '../PrioritasLogo'
import { supabase } from '../../lib/supabase'
import { useLogger } from '../../lib/logging'
import { Button, Input } from '../ui'
import { useSecureAuthContext } from '../../contexts/SecureAuthContext'
// EMERGENCY FIX: Removed useComponentState to eliminate state conflicts

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void
}

type AuthMode = 'login' | 'signup' | 'forgot-password'

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const logger = useLogger('AuthScreen')

  // Feature flag: use new httpOnly cookie auth or old localStorage auth
  const useNewAuth = import.meta.env.VITE_FEATURE_HTTPONLY_AUTH === 'true'

  // Try to get new auth context (only available if feature flag is enabled)
  let secureAuth: ReturnType<typeof useSecureAuthContext> | null = null
  try {
    if (useNewAuth) {
      secureAuth = useSecureAuthContext()
    }
  } catch (e) {
    // SecureAuthContext not available, fall back to old auth
    logger.debug('SecureAuthContext not available, using old auth')
  }

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

  // Enhanced component refs
  const emailRef = useRef<any>(null)
  const passwordRef = useRef<any>(null)
  const fullNameRef = useRef<any>(null)
  const confirmPasswordRef = useRef<any>(null)
  const submitButtonRef = useRef<any>(null)

  // EMERGENCY FIX: Simplified form state - no useComponentState conflicts

  // Determine the correct redirect URL based on the environment
  const getRedirectUrl = () => {
    // Check for environment variable override first
    const envRedirectUrl = import.meta.env.VITE_REDIRECT_URL
    if (envRedirectUrl) {
      logger.debug('Using environment redirect URL', { url: envRedirectUrl })
      return envRedirectUrl
    }

    const currentOrigin = window.location.origin
    const isProduction = !currentOrigin.includes('localhost')

    logger.debug('Determining redirect URL', {
      currentOrigin,
      isProduction
    })
    
    let redirectUrl
    if (isProduction) {
      // Always use prioritas.ai for production deployments
      redirectUrl = 'https://prioritas.ai'
      logger.debug('Production environment detected', { redirectUrl })
    } else {
      // Use localhost for development
      redirectUrl = currentOrigin
      logger.debug('Development environment detected', { redirectUrl })
    }

    logger.info('Redirect URL configured', { redirectUrl })
    return redirectUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Enhanced form validation using component refs
    const validateForm = () => {
      let isValid = true

      // Validate email
      if (!emailRef.current?.validate()) {
        isValid = false
      }

      if (mode !== 'forgot-password') {
        // Validate password
        if (!passwordRef.current?.validate()) {
          isValid = false
        }
      }

      if (mode === 'signup') {
        // Validate full name
        if (!fullNameRef.current?.validate()) {
          isValid = false
        }

        // Validate confirm password
        if (!confirmPasswordRef.current?.validate()) {
          isValid = false
        }

        // Check password match
        if (password !== confirmPassword) {
          confirmPasswordRef.current?.setError('Passwords do not match')
          isValid = false
        }
      }

      return isValid
    }

    // Clear previous states
    setError(null)
    setSuccess(null)

    // Validate form
    if (!validateForm()) {
      setError('Please fix the validation errors above')
      return
    }

    // EMERGENCY FIX: Simple duplicate prevention - single loading check
    if (loading) {
      return
    }

    // Start loading state
    setLoading(true)
    submitButtonRef.current?.setState('loading')

    try {
      // EMERGENCY FIX: Direct Supabase calls without executeAction wrapper
        if (mode === 'signup') {
          const redirectUrl = getRedirectUrl()
          const fullRedirectUrl = `${redirectUrl}`
          logger.info('Initiating signup', {
            redirectUrl: fullRedirectUrl,
            hasEmail: !!email,
            hasFullName: !!fullName
          })

          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: fullRedirectUrl,
              data: {
                full_name: fullName.trim(),
              }
            }
          })

          logger.info('Signup response received', {
            userId: data?.user?.id,
            hasError: !!error,
            errorMessage: error?.message
          })

          if (error) throw error

          if (data.user && !data.user.email_confirmed_at) {
            setSuccess('Please check your email for a confirmation link before signing in.')
            setMode('login')
          } else if (data.user) {
            onAuthSuccess(data.user)
          }

        } else if (mode === 'login') {
          // Check which auth system to use based on feature flag
          if (useNewAuth && secureAuth) {
            // NEW AUTH SYSTEM: httpOnly cookies via API endpoint
            logger.info('Using new httpOnly cookie authentication')
            await secureAuth.login(email, password)
            // Success! secureAuth automatically updates user state via cookies
            // No need to call onAuthSuccess - the SecureAuthProvider handles it
            logger.info('Login successful with httpOnly cookies')
          } else {
            // OLD AUTH SYSTEM: localStorage via Supabase direct
            logger.info('Using old localStorage authentication')
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            })

            if (error) throw error
            if (data.user) {
              onAuthSuccess(data.user)
            }
          }

        } else if (mode === 'forgot-password') {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${getRedirectUrl()}/reset-password`
          })

          if (error) throw error
          setSuccess('Password reset email sent! Check your inbox.')
          setMode('login')
        }
    } catch (err: any) {
      logger.error('Auth error:', err)
      setError(err.message || 'An unexpected error occurred')
      submitButtonRef.current?.setState('error')

      // Set error states on relevant fields
      if (err.message?.includes('Invalid login credentials')) {
        emailRef.current?.setError('Invalid email or password')
        passwordRef.current?.setError('Invalid email or password')
      } else if (err.message?.includes('email')) {
        emailRef.current?.setError(err.message)
      } else if (err.message?.includes('password')) {
        passwordRef.current?.setError(err.message)
      }
    } finally {
      setLoading(false)

      // Reset button state after a delay for better UX
      setTimeout(() => {
        if (submitButtonRef.current?.state !== 'success') {
          submitButtonRef.current?.setState('idle')
        }
      }, 500)
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
    <div className="auth-screen min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--canvas-primary)' }}>
      <main className="max-w-md w-full" role="main">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 card-clean-hover p-4 mb-4">
            <PrioritasLogo className="text-info-500" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">Prioritas</h1>
          <p className="text-secondary">Smart Priority Matrix Platform</p>
        </header>

        {/* Auth Card */}
        <div className="card-clean p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-primary mb-2">{getTitle()}</h2>
            <p className="text-secondary text-sm">{getSubtitle()}</p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-error-50 border border-error-200 rounded-lg p-4 mb-4" data-testid="auth-error-message">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-error-600 mt-0.5 flex-shrink-0" />
                <p className="text-error-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4 mb-4" data-testid="auth-success-message">
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-5 h-5 text-success-600 mt-0.5 flex-shrink-0" />
                <p className="text-success-700 text-sm">{success}</p>
              </div>
            </div>
          )}


          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name - Only for signup */}
            {mode === 'signup' && (
              <Input
                ref={fullNameRef}
                label="Full Name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                icon={<User />}
                variant="primary"
                size="lg"
                animated={true}
                required
                data-testid="auth-fullname-input"
                onValidate={(value) => {
                  if (!value.trim()) {
                    return { isValid: false, error: 'Full name is required' }
                  }
                  if (value.trim().length < 2) {
                    return { isValid: false, error: 'Full name must be at least 2 characters' }
                  }
                  return { isValid: true }
                }}
              />
            )}

            {/* Email */}
            <Input
              ref={emailRef}
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              icon={<Mail />}
              variant="primary"
              size="lg"
              animated={true}
              required
              data-testid="auth-email-input"
              onValidate={(value) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                if (!value.trim()) {
                  return { isValid: false, error: 'Email address is required' }
                }
                if (!emailRegex.test(value)) {
                  return { isValid: false, error: 'Please enter a valid email address' }
                }
                return { isValid: true }
              }}
            />

            {/* Password - Not for forgot password */}
            {mode !== 'forgot-password' && (
              <Input
                ref={passwordRef}
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                icon={<Lock />}
                variant="primary"
                size="lg"
                animated={true}
                required
                data-testid="auth-password-input"
                iconAfter={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                onValidate={(value) => {
                  if (!value) {
                    return { isValid: false, error: 'Password is required' }
                  }
                  if (mode === 'signup' && value.length < 6) {
                    return { isValid: false, error: 'Password must be at least 6 characters' }
                  }
                  return { isValid: true }
                }}
              />
            )}

            {/* Confirm Password - Only for signup */}
            {mode === 'signup' && (
              <Input
                ref={confirmPasswordRef}
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                icon={<Lock />}
                variant="primary"
                size="lg"
                animated={true}
                required
                data-testid="auth-confirm-password-input"
                iconAfter={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                onValidate={(value) => {
                  if (!value) {
                    return { isValid: false, error: 'Please confirm your password' }
                  }
                  if (value !== password) {
                    return { isValid: false, error: 'Passwords do not match' }
                  }
                  return { isValid: true }
                }}
              />
            )}

            {/* Submit Button */}
            <Button
              ref={submitButtonRef}
              type="submit"
              variant="primary"
              size="lg"
              state={loading ? 'loading' : 'idle'}
              animated={true}
              fullWidth={true}
              data-testid="auth-submit-button"
              iconAfter={mode !== 'forgot-password' ? <ArrowRight /> : undefined}
            >
              {mode === 'signup' ? 'Create Account' :
               mode === 'forgot-password' ? 'Send Reset Link' : 'Sign In'}
            </Button>
          </form>

          {/* Demo Mode - For Testing */}
          {mode === 'login' && (
            <div className="mt-4 text-center">
              <Button
                type="button"
                onClick={async () => {
                  try {
                    setLoading(true)
                    setError(null)
                    logger.info('🎭 Signing in as anonymous demo user...')

                    // Use Supabase anonymous authentication
                    const { data, error: anonError } = await supabase.auth.signInAnonymously()

                    if (anonError) {
                      logger.error('❌ Anonymous sign-in failed:', anonError)
                      setError(`Demo user sign-in failed: ${anonError.message}`)
                      setLoading(false)
                      return
                    }

                    if (!data.user) {
                      logger.error('❌ No user returned from anonymous sign-in')
                      setError('Demo user sign-in failed: No user returned')
                      setLoading(false)
                      return
                    }

                    logger.info('✅ Anonymous user signed in:', {
                      id: data.user.id,
                      isAnonymous: data.user.is_anonymous,
                      createdAt: data.user.created_at
                    })

                    // Create user object with Supabase anonymous user data
                    const demoUser = {
                      id: data.user.id, // Real Supabase user ID
                      email: 'demo@example.com',
                      full_name: 'Demo User',
                      is_anonymous: true,
                      created_at: data.user.created_at,
                      updated_at: new Date().toISOString()
                    }

                    logger.info('✅ Demo user authenticated successfully with Supabase session')
                    onAuthSuccess(demoUser)
                    // Note: Don't set loading=false here - let the auth flow handle UI transition
                  } catch (err) {
                    logger.error('❌ Demo user error:', err)
                    setError(`Demo user failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
                    setLoading(false)
                  }
                }}
                data-testid="auth-demo-button"
                disabled={loading}
                variant="warning"
                size="lg"
                fullWidth={true}
                animated={true}
              >
                {loading ? '🔄 Signing in...' : '🚀 Continue as Demo User (No Registration Required)'}
              </Button>
              <p className="text-xs text-slate-500 mt-2">
                Skip registration and test with anonymous authentication
              </p>
            </div>
          )}

          {/* Footer Links */}
          <div className="mt-6 text-center text-sm">
            {mode === 'login' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-info-600 hover:text-info-700 hover:underline"
                >
                  Forgot your password?
                </button>
                <div>
                  <span className="text-secondary">Don't have an account? </span>
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    data-testid="auth-mode-switcher"
                    className="text-info-600 hover:text-info-700 font-medium hover:underline"
                  >
                    Sign up
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <span className="text-secondary">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-info-600 hover:text-info-700 font-medium hover:underline"
                >
                  Sign in
                </button>
              </div>
            )}

            {mode === 'forgot-password' && (
              <div>
                <span className="text-secondary">Remember your password? </span>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-info-600 hover:text-info-700 font-medium hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            )}
          </div>

          {/* Terms */}
          {mode === 'signup' && (
            <div className="mt-6 text-center text-xs text-muted">
              By creating an account, you agree to our{' '}
              <a href="#" className="text-info-600 hover:underline">Terms of Service</a> and{' '}
              <a href="#" className="text-info-600 hover:underline">Privacy Policy</a>
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
            <div key={index} className="card-clean-hover p-4">
              <div className="w-10 h-10 bg-gradient-to-br from-info-100 to-accent-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <feature.icon className="w-5 h-5 text-info-600" />
              </div>
              <h3 className="font-medium text-primary text-sm">{feature.title}</h3>
              <p className="text-xs text-secondary mt-1">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default AuthScreen