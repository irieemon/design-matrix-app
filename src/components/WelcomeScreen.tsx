import { useState } from 'react'
import { Target, User, ArrowRight } from 'lucide-react'
import PrioritasLogo from './PrioritasLogo'

interface WelcomeScreenProps {
  onUserCreated: (userName: string) => void
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onUserCreated }) => {
  const [userName, setUserName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userName.trim()) return

    setIsLoading(true)
    try {
      await onUserCreated(userName.trim())
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-white to-slate-100 rounded-2xl mb-6 shadow-lg">
            <PrioritasLogo className="text-blue-600" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Prioritas</h1>
          <p className="text-slate-600">Smart prioritization suite for teams</p>
        </div>

        {/* Welcome Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 p-8 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Welcome!</h2>
            <p className="text-slate-600 text-sm">
              Let's get you started. Enter your name to begin prioritizing your ideas and projects.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Your Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  placeholder="Enter your name"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!userName.trim() || isLoading}
              className="w-full flex items-center justify-center space-x-2 bg-slate-900 text-white py-3 px-4 rounded-xl hover:bg-slate-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <span>Start Collaborating</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/60">
            <div className="text-2xl mb-2">🎯</div>
            <p className="text-xs font-medium text-slate-600">Drag & Drop Ideas</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/60">
            <div className="text-2xl mb-2">👥</div>
            <p className="text-xs font-medium text-slate-600">Real-time Collaboration</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WelcomeScreen