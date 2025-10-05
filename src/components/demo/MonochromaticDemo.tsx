import React, { useState } from 'react'
import { Home, User, Settings, Mail, Bell, Search, Plus, Check, X, ChevronRight } from 'lucide-react'

/**
 * Monochromatic Design System Demo
 *
 * This component showcases the new design system:
 * - Grayscale palette (no gradients)
 * - Subtle shadows for depth
 * - Micro-animations (150-250ms)
 * - Functional color accents only
 * - Premium, sophisticated feel
 */

const MonochromaticDemo: React.FC = () => {
  const [activeNav, setActiveNav] = useState('home')
  const [showModal, setShowModal] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setShowModal(false)
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-bold text-gray-900">Monochromatic Design System</h1>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-md">
              Active
            </span>
            <span className="text-sm text-gray-500">Demo Mode</span>
          </div>
        </div>
        <p className="text-gray-600">
          Premium, sophisticated UI with grayscale palette and subtle micro-interactions
        </p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8">
        {/* Sidebar Demo */}
        <div className="col-span-3">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 sticky top-8">
            {/* Logo Area */}
            <div className="mb-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 w-fit">
                <Home className="w-6 h-6 text-gray-900" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mt-3">Demo App</h2>
              <p className="text-sm text-gray-500 mt-1">Monochromatic Theme</p>
            </div>

            {/* Navigation Items */}
            <nav className="space-y-1">
              {[
                { id: 'home', icon: Home, label: 'Dashboard' },
                { id: 'profile', icon: User, label: 'Profile' },
                { id: 'messages', icon: Mail, label: 'Messages' },
                { id: 'notifications', icon: Bell, label: 'Notifications' },
                { id: 'settings', icon: Settings, label: 'Settings' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-200 border-l-2
                    ${activeNav === item.id
                      ? 'bg-gray-100 text-black border-black'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-200'
                    }
                  `}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.id === 'messages' && (
                    <span className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">
                      3
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Footer Action */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-150">
                <Plus className="w-4 h-4" />
                <span>Add Workspace</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Demo */}
        <div className="col-span-9 space-y-8">
          {/* Buttons Section */}
          <section>
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Buttons</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-6">

              {/* Primary Buttons */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Primary Actions</h4>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="px-4 py-2 bg-black text-white rounded-lg font-medium shadow-sm hover:bg-gray-900 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all duration-200"
                    onClick={() => setShowModal(true)}
                  >
                    Open Modal
                  </button>
                  <button className="px-4 py-2 bg-black text-white rounded-lg font-medium shadow-sm hover:bg-gray-900 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all duration-200 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create New
                  </button>
                  <button
                    className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed"
                    disabled
                  >
                    Disabled
                  </button>
                </div>
              </div>

              {/* Secondary Buttons */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Secondary Actions</h4>
                <div className="flex flex-wrap gap-3">
                  <button className="px-4 py-2 bg-transparent border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-300 active:scale-98 transition-all duration-200">
                    Cancel
                  </button>
                  <button className="px-4 py-2 bg-transparent border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-300 active:scale-98 transition-all duration-200 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                </div>
              </div>

              {/* Ghost Buttons */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Ghost Actions</h4>
                <div className="flex flex-wrap gap-3">
                  <button className="px-3 py-1.5 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 active:scale-98 transition-all duration-150">
                    Learn More
                  </button>
                  <button className="px-3 py-1.5 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 active:scale-98 transition-all duration-150 flex items-center gap-1">
                    View Details
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Icon Buttons */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Icon Buttons</h4>
                <div className="flex gap-2">
                  <button className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:scale-105 active:scale-95 transition-all duration-150">
                    <Search className="w-4 h-4" />
                  </button>
                  <button className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:scale-105 active:scale-95 transition-all duration-150">
                    <Bell className="w-4 h-4" />
                  </button>
                  <button className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:scale-105 active:scale-95 transition-all duration-150">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Destructive Button */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Destructive Actions</h4>
                <button className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium shadow-sm hover:bg-red-600 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all duration-200">
                  Delete Item
                </button>
              </div>
            </div>
          </section>

          {/* Cards Section */}
          <section>
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Cards & Panels</h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Card 1 */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-gray-300 transition-all duration-250 cursor-pointer group">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-gray-200 transition-colors duration-200">
                  <Home className="w-5 h-5 text-gray-700" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Dashboard</h4>
                <p className="text-sm text-gray-600">View your overview and metrics</p>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">24 items</span>
                    <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all duration-200" />
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-gray-300 transition-all duration-250 cursor-pointer group">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-gray-200 transition-colors duration-200">
                  <Mail className="w-5 h-5 text-gray-700" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Messages</h4>
                <p className="text-sm text-gray-600">Check your communications</p>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-medium">3 new</span>
                    <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all duration-200" />
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-gray-300 transition-all duration-250 cursor-pointer group">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-gray-200 transition-colors duration-200">
                  <Settings className="w-5 h-5 text-gray-700" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Settings</h4>
                <p className="text-sm text-gray-600">Manage your preferences</p>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Configure</span>
                    <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all duration-200" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Forms Section */}
          <section>
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Forms & Inputs</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email..."
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-3 focus:ring-gray-900/10 hover:border-gray-300 transition-all duration-150"
                />
                <p className="text-xs text-gray-500 mt-1.5">We'll never share your email with anyone else.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  rows={4}
                  placeholder="Type your message..."
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-3 focus:ring-gray-900/10 hover:border-gray-300 transition-all duration-150 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="search"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Search items..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-3 focus:ring-gray-900/10 hover:border-gray-300 transition-all duration-150"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Status Badges */}
          <section>
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Status Indicators</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Functional Color Accents</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-md border border-green-100">
                  Success
                </span>
                <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-md border border-blue-100">
                  Info
                </span>
                <span className="px-3 py-1.5 bg-amber-50 text-amber-700 text-sm font-medium rounded-md border border-amber-100">
                  Warning
                </span>
                <span className="px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-md border border-red-100">
                  Error
                </span>
                <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-md border border-gray-200">
                  Neutral
                </span>
              </div>
            </div>
          </section>

          {/* Loading States */}
          <section>
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Loading States</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
              {/* Skeleton Loader */}
              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2"></div>
                <div className="h-4 bg-gray-100 rounded animate-pulse w-5/6"></div>
              </div>

              {/* Spinner */}
              <div className="flex items-center gap-3 pt-4">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
                <span className="text-sm text-gray-600">Loading content...</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modal Demo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => !isLoading && setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Modal Example</h3>
              <button
                onClick={() => !isLoading && setShowModal(false)}
                disabled={isLoading}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all duration-150 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                This modal demonstrates the monochromatic design system with clean backgrounds,
                subtle shadows, and smooth animations.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your name
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-3 focus:ring-gray-900/10 transition-all duration-150 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-100 active:scale-98 transition-all duration-150 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-4 py-2 bg-black text-white rounded-lg font-medium shadow-sm hover:bg-gray-900 active:scale-98 transition-all duration-200 disabled:opacity-50 flex items-center gap-2 min-w-[100px] justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MonochromaticDemo
