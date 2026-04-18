import React, { useState, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { Target, Mail, Lock, User, Eye, EyeOff, ArrowRight, Sparkles, AlertCircle, CheckCircle } from 'lucide-react'
import PrioritasLogo from '../PrioritasLogo'
import { supabase } from '../../lib/supabase'
import { updateRecoveryPassword } from '../../hooks/useAuth'
import { useLogger } from '../../lib/logging'
import { Button, Input } from '../ui'
import { useUser } from '../../contexts/UserContext'
import { TIMEOUTS, PASSWORD_MIN_LENGTH } from '../../lib/config'
import { withTimeout } from '../../utils/promiseUtils'
import { mapErrorToCopy } from '../../lib/auth/errorCopy'

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void
}

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'reset-password'

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const logger = useLogger('AuthScreen')

  // Access password recovery state from auth context
  const { isPasswordRecovery, clearPasswordRecovery } = useUser()

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Detect PASSWORD_RECOVERY event and switch to reset-password mode
  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('reset-password')
    }
  }, [isPasswordRecovery])

  // Enhanced component refs
  const emailRef = useRef<any>(null)
  const passwordRef = useRef<any>(null)
  const fullNameRef = useRef<any>(null)
  const confirmPasswordRef = useRef<any>(null)

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

      // Skip standard field validation for reset-password mode (has its own fields)
      if (mode === 'reset-password') {
        return true
      }

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

    try {
      // ADR-0017 Wave B: every SDK call is wrapped with a 15s timeout via
      // withTimeout. Errors raised from these paths — timeouts, SDK
      // rejections, 4xx/5xx objects — are normalized through
      // mapErrorToCopy so the UI only ever renders canonical, non-enumerating
      // copy. Raw SDK messages and stack traces never reach the DOM.
        if (mode === 'signup') {
          const redirectUrl = getRedirectUrl()
          const fullRedirectUrl = `${redirectUrl}`
          logger.info('Initiating signup', {
            redirectUrl: fullRedirectUrl,
            hasEmail: !!email,
            hasFullName: !!fullName
          })

          const { data, error } = await withTimeout(
            supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: fullRedirectUrl,
                data: {
                  full_name: fullName.trim(),
                }
              }
            }),
            TIMEOUTS.SIGNUP_SUBMIT,
            'Request timed out. Please try again.'
          )

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
          // Use Supabase SDK directly.
          // SDK stores the session in localStorage and fires the SIGNED_IN event
          // via onAuthStateChange. We also call onAuthSuccess directly so the UI
          // transitions immediately without waiting for the async listener.
          logger.info('Signing in with Supabase SDK')
          // ADR-0017 Wave B — login timeout handling via a side-effecting
          // setTimeout callback. We do NOT await a Promise.race rejection
          // here because, under React's async act() combined with vitest
          // fake timers, a pending (never-settling) upstream promise in a
          // race prevents act from flushing — the act thenable only
          // resolves when _every_ pending work queue drains. Instead, the
          // setTimeout directly commits the TIMEOUT copy via flushSync,
          // which settles React synchronously. If the SDK resolves first
          // we clear the timer; if the timer fires first we short-circuit
          // by flagging `timedOut` and returning without awaiting further.
          let loginTimeoutId: ReturnType<typeof setTimeout> | undefined
          let timedOut = false
          loginTimeoutId = setTimeout(() => {
            timedOut = true
            flushSync(() => {
              setError(mapErrorToCopy(new Error('Request timed out. Please try again.')))
              setLoading(false)
            })
          }, TIMEOUTS.LOGIN_SUBMIT)

          const signInResult = await supabase.auth.signInWithPassword({ email, password })

          if (loginTimeoutId) clearTimeout(loginTimeoutId)
          if (timedOut) {
            // Timer fired first — error/loading already committed.
            return
          }

          const { data: signInData, error: signInError } = signInResult
          // Throw the original SDK error object (preserves status/code for
          // mapErrorToCopy) rather than re-wrapping in `new Error(message)`
          // which would strip status/code fields.
          if (signInError) throw signInError
          if (signInData.user) {
            onAuthSuccess(signInData.user)
          }

        } else if (mode === 'forgot-password') {
          const { error } = await withTimeout(
            supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin
            }),
            TIMEOUTS.PASSWORD_RESET_SUBMIT,
            'Request timed out. Please try again.'
          )

          if (error) throw error
          setSuccess('Password reset email sent! Check your inbox.')
          setMode('login')
        } else if (mode === 'reset-password') {
          if (newPassword.length < PASSWORD_MIN_LENGTH) {
            setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
            return
          }
          if (newPassword !== confirmNewPassword) {
            setError('Passwords do not match')
            return
          }
          // Use in-memory recovery token via direct REST call — bypasses
          // supabase.auth.updateUser() which deadlocks on the GoTrueClient lock.
          const { error: recoveryError } = await updateRecoveryPassword(newPassword)
          if (recoveryError) throw new Error(recoveryError)
          setSuccess('Password updated successfully! Please sign in with your new password.')
          clearPasswordRecovery?.()
          setNewPassword('')
          setConfirmNewPassword('')
          setMode('login')
        }
    } catch (err: unknown) {
      logger.error('Auth error:', err)
      // ADR-0017 Wave B — route all errors (timeouts, SDK rejections,
      // 4xx/5xx objects) through the canonical copy map so raw SDK
      // messages, fetch bodies, and stack traces never reach the DOM.
      flushSync(() => {
        setError(mapErrorToCopy(err))
        setLoading(false)
      })
    } finally {
      setLoading(false)
    }
  }


  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Create Your Account'
      case 'forgot-password': return 'Reset Password'
      case 'reset-password': return 'Set New Password'
      default: return 'Welcome Back'
    }
  }

  const getSubtitle = () => {
    switch (mode) {
      case 'signup': return 'Join thousands of teams organizing their priorities'
      case 'forgot-password': return 'Enter your email to receive a password reset link'
      case 'reset-password': return 'Enter your new password below'
      default: return 'Sign in to your priority matrix workspace'
    }
  }

  return (
    <div className="auth-screen min-h-screen flex items-center justify-center p-4 bg-canvas-primary">
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

            {/* Email - hidden during reset-password (user already authenticated via recovery token) */}
            {mode !== 'reset-password' && <Input
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
            />}

            {/* New Password fields - Only for reset-password mode */}
            {mode === 'reset-password' && (
              <>
                <Input
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={`Enter new password (min ${PASSWORD_MIN_LENGTH} characters)`}
                  icon={<Lock />}
                  variant="primary"
                  size="lg"
                  animated={true}
                  required
                  data-testid="auth-new-password-input"
                  iconAfter={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-600 transition-colors min-h-11 min-w-11 flex items-center justify-center text-base"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                  onValidate={(value) => {
                    if (!value) return { isValid: false, error: 'Password is required' }
                    if (value.length < PASSWORD_MIN_LENGTH) return { isValid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` }
                    return { isValid: true }
                  }}
                />
                <Input
                  label="Confirm New Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  icon={<Lock />}
                  variant="primary"
                  size="lg"
                  animated={true}
                  required
                  data-testid="auth-confirm-new-password-input"
                  iconAfter={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-slate-400 hover:text-slate-600 transition-colors min-h-11 min-w-11 flex items-center justify-center text-base"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                  onValidate={(value) => {
                    if (!value) return { isValid: false, error: 'Please confirm your password' }
                    if (value !== newPassword) return { isValid: false, error: 'Passwords do not match' }
                    return { isValid: true }
                  }}
                />
              </>
            )}

            {/* Password - Not for forgot password or reset-password */}
            {mode !== 'forgot-password' && mode !== 'reset-password' && (
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
               mode === 'forgot-password' ? 'Send Reset Link' :
               mode === 'reset-password' ? 'Set New Password' : 'Sign In'}
            </Button>
          </form>

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

            {mode === 'reset-password' && (
              <div>
                <button
                  type="button"
                  onClick={() => { clearPasswordRecovery?.(); setMode('login') }}
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