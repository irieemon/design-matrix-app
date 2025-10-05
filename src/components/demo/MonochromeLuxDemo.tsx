import React, { useState } from 'react'
import { Home, User, Mail, Settings, ChevronRight, Search, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react'

/**
 * Monochrome-Lux Light Workspace Demo
 *
 * A calm, precise, modern information workspace optimized for dense text
 * and long-form thinking. Inspired by Notion, Linear, and Stripe.
 *
 * Design tokens use semantic naming reflecting the brief:
 * - Canvas/surfaces (off-white cool grays)
 * - Hairlines (1px neutral borders)
 * - Graphite text hierarchy
 * - Gem-tone accents (sapphire, emerald, amber, garnet)
 */

const MonochromeLuxDemo: React.FC = () => {
  const [activeNav, setActiveNav] = useState('settings')
  const [emailFocused, setEmailFocused] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [messageFocused, setMessageFocused] = useState(false)

  return (
    <div className="min-h-screen bg-[#FAFBFC] font-sans antialiased">
      {/* Top Bar */}
      <header className="h-14 bg-white border-b border-[#E8EBED] flex items-center justify-between px-6">
        <h1 className="text-base font-semibold text-[#1F2937] tracking-tight">Prioritas Workspace</h1>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg">
          Active
        </span>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 bg-[#FAFBFC] border-r border-[#E8EBED] min-h-[calc(100vh-3.5rem)] py-6">
          <nav className="space-y-1 px-3">
            <button
              onClick={() => setActiveNav('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                activeNav === 'dashboard'
                  ? 'bg-[#F3F4F6] text-[#1F2937]'
                  : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]'
              }`}
            >
              <Home className="w-4 h-4" strokeWidth={2} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveNav('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                activeNav === 'profile'
                  ? 'bg-[#F3F4F6] text-[#1F2937]'
                  : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]'
              }`}
            >
              <User className="w-4 h-4" strokeWidth={2} />
              <span>Profile</span>
            </button>

            <button
              onClick={() => setActiveNav('messages')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                activeNav === 'messages'
                  ? 'bg-[#F3F4F6] text-[#1F2937]'
                  : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]'
              }`}
            >
              <Mail className="w-4 h-4" strokeWidth={2} />
              <span>Messages</span>
              <span className="ml-auto px-2 py-0.5 bg-sapphire-50 text-sapphire-700 text-xs font-medium rounded">
                3
              </span>
            </button>

            <button
              onClick={() => setActiveNav('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                activeNav === 'settings'
                  ? 'bg-[#F3F4F6] text-[#1F2937]'
                  : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]'
              }`}
            >
              <Settings className="w-4 h-4" strokeWidth={2} />
              <span>Settings</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 max-w-7xl">
          {/* Section 1: Buttons */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-6 tracking-tight">Buttons</h2>
            <div className="flex flex-wrap gap-3">
              {/* Primary Button */}
              <button className="px-4 py-2 bg-[#374151] text-white text-sm font-medium rounded-lg transition-all duration-200 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] active:translate-y-0">
                Primary Action
              </button>

              {/* Secondary Button */}
              <button className="px-4 py-2 bg-white border border-[#E8EBED] text-[#374151] text-sm font-medium rounded-lg transition-all duration-200 hover:bg-[#F9FAFB]">
                Secondary
              </button>

              {/* Text/Tertiary Button */}
              <button className="px-4 py-2 text-[#374151] text-sm font-medium rounded-lg transition-all duration-200 hover:underline hover:underline-offset-2">
                Text Only
              </button>

              {/* Destructive Button */}
              <button className="px-4 py-2 bg-[#DC2626] text-white text-sm font-medium rounded-lg transition-all duration-200 hover:bg-[#B91C1C]">
                Delete
              </button>

              {/* Disabled Button */}
              <button
                disabled
                className="px-4 py-2 bg-[#F3F4F6] text-[#9CA3AF] text-sm font-medium rounded-lg cursor-not-allowed"
              >
                Disabled
              </button>
            </div>
          </section>

          {/* Section 2: Cards & Panels */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-6 tracking-tight">Cards & Panels</h2>
            <div className="grid grid-cols-3 gap-6">
              {/* Dashboard Card */}
              <div className="bg-white border border-[#E8EBED] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_8px_24px_rgba(0,0,0,0.03)] transition-all duration-240 hover:shadow-[0_1px_3px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-[#F3F4F6] rounded-xl flex items-center justify-center">
                    <Home className="w-5 h-5 text-[#6B7280]" strokeWidth={2} />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-[#1F2937] mb-1">Dashboard</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">View your overview and key metrics</p>
                <div className="mt-4 pt-4 border-t border-[#E8EBED]">
                  <button className="text-sm text-[#374151] font-medium hover:text-[#1F2937] transition-colors duration-200">
                    View Details →
                  </button>
                </div>
              </div>

              {/* Messages Card */}
              <div className="bg-white border border-[#E8EBED] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_8px_24px_rgba(0,0,0,0.03)] transition-all duration-240 hover:shadow-[0_1px_3px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-[#F3F4F6] rounded-xl flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[#6B7280]" strokeWidth={2} />
                  </div>
                  <span className="px-2 py-0.5 bg-sapphire-50 text-sapphire-700 text-xs font-medium rounded">
                    new
                  </span>
                </div>
                <h3 className="text-base font-semibold text-[#1F2937] mb-1">Messages</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">Check your communications</p>
                <div className="mt-4 pt-4 border-t border-[#E8EBED]">
                  <button className="text-sm text-[#374151] font-medium hover:text-[#1F2937] transition-colors duration-200">
                    View Details →
                  </button>
                </div>
              </div>

              {/* Settings Card */}
              <div className="bg-white border border-[#E8EBED] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_8px_24px_rgba(0,0,0,0.03)] transition-all duration-240 hover:shadow-[0_1px_3px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-[#F3F4F6] rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-[#6B7280]" strokeWidth={2} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#9CA3AF]" strokeWidth={2} />
                </div>
                <h3 className="text-base font-semibold text-[#1F2937] mb-1">Settings</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">Manage your preferences</p>
                <div className="mt-4 pt-4 border-t border-[#E8EBED]">
                  <button className="text-sm text-[#374151] font-medium hover:text-[#1F2937] transition-colors duration-200">
                    View Details →
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Forms & Inputs */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-6 tracking-tight">Forms & Inputs</h2>
            <div className="max-w-2xl space-y-6">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email..."
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] transition-all duration-200 ${
                    emailFocused
                      ? 'border-[#3B82F6] ring-4 ring-blue-50'
                      : 'border-[#E8EBED] hover:border-[#D1D5DB]'
                  }`}
                  style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                />
                <p className="mt-1.5 text-xs text-[#6B7280]">
                  We'll never share your email with anyone else
                </p>
              </div>

              {/* Message Textarea */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Message
                </label>
                <textarea
                  rows={4}
                  placeholder="Type your message..."
                  onFocus={() => setMessageFocused(true)}
                  onBlur={() => setMessageFocused(false)}
                  className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] resize-none transition-all duration-200 ${
                    messageFocused
                      ? 'border-[#3B82F6] ring-4 ring-blue-50'
                      : 'border-[#E8EBED] hover:border-[#D1D5DB]'
                  }`}
                  style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                />
                <p className="mt-1.5 text-xs text-[#6B7280]">
                  Provide as much detail as possible
                </p>
              </div>

              {/* Search Input */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" strokeWidth={2} />
                  <input
                    type="search"
                    placeholder="Search items..."
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] transition-all duration-200 ${
                      searchFocused
                        ? 'border-[#3B82F6] ring-4 ring-blue-50'
                        : 'border-[#E8EBED] hover:border-[#D1D5DB]'
                    }`}
                    style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Status Indicators */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-6 tracking-tight">Status Indicators</h2>
            <div className="flex flex-wrap gap-3">
              {/* Success Badge */}
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg">
                <CheckCircle className="w-4 h-4" strokeWidth={2} />
                Success
              </span>

              {/* Info Badge */}
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg">
                <Info className="w-4 h-4" strokeWidth={2} />
                Information
              </span>

              {/* Warning Badge */}
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg">
                <AlertTriangle className="w-4 h-4" strokeWidth={2} />
                Warning
              </span>

              {/* Error Badge */}
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg">
                <AlertCircle className="w-4 h-4" strokeWidth={2} />
                Error
              </span>
            </div>
          </section>

          {/* Section 5: Loading States */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-6 tracking-tight">Loading States</h2>
            <div className="bg-white border border-[#E8EBED] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_8px_24px_rgba(0,0,0,0.03)]">
              <div className="space-y-4">
                {/* Skeleton bars with shimmer */}
                <div className="h-4 bg-gradient-to-r from-[#F3F4F6] via-[#E5E7EB] to-[#F3F4F6] rounded animate-shimmer bg-[length:200%_100%] w-3/4"></div>
                <div className="h-4 bg-gradient-to-r from-[#F3F4F6] via-[#E5E7EB] to-[#F3F4F6] rounded animate-shimmer bg-[length:200%_100%] w-1/2"></div>
                <div className="h-4 bg-gradient-to-r from-[#F3F4F6] via-[#E5E7EB] to-[#F3F4F6] rounded animate-shimmer bg-[length:200%_100%] w-5/6"></div>
              </div>
            </div>
          </section>

          {/* Footer Note */}
          <div className="mt-16 pt-8 border-t border-[#E8EBED]">
            <p className="text-sm text-[#9CA3AF] text-center">
              Monochrome-Lux Design System · Calm, Precise, Modern
            </p>
          </div>
        </main>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default MonochromeLuxDemo
