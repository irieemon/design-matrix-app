import React, { useState } from 'react'
import { Home, User, Mail, Settings, ChevronRight, ChevronDown, ChevronLeft, Search, AlertCircle, CheckCircle, AlertTriangle, Info, FolderOpen, BarChart } from 'lucide-react'

/**
 * Monochrome-Lux Light Workspace Demo with Micro-Animations
 *
 * Motion philosophy: calm, confident, purposeful
 * - Durations: 120-260ms
 * - Easing: cubic-bezier(0.2, 0.6, 0, 0.98) "confident glide"
 * - Distances: ≤6px translate, subtle tints ≤4%
 * - Shadows: width-dominant, never darker
 * - Reduced motion: respects prefers-reduced-motion
 */

const MonochromeLuxAnimated: React.FC = () => {
  const [activeNav, setActiveNav] = useState('settings')
  const [emailFocused, setEmailFocused] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [messageFocused, setMessageFocused] = useState(false)
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [railTop, setRailTop] = useState(0)
  const [showRail, setShowRail] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Update rail position when nav item is clicked
  const handleNavClick = (itemId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget
    const container = button.closest('nav')

    if (container) {
      const containerRect = container.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()
      const offset = buttonRect.top - containerRect.top + button.offsetHeight / 2
      setRailTop(offset)
      setShowRail(true)
    }

    setActiveNav(itemId)
  }

  return (
    <div className="min-h-screen bg-[#FAFBFC] font-sans antialiased">
      {/* Global Motion Styles */}
      <style>{`
        /* Motion System - Monochrome-Lux */
        :root {
          --duration-instant: 120ms;
          --duration-fast: 140ms;
          --duration-base: 190ms;
          --duration-moderate: 220ms;
          --duration-slow: 260ms;
          --easing-glide: cubic-bezier(0.2, 0.6, 0, 0.98);
          --easing-standard: ease;
          --easing-in: ease-in;
          --easing-out: ease-out;
        }

        /* Reduced Motion Support */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
          .shimmer-animation {
            animation: none !important;
          }
        }

        /* Shimmer Animation for Skeletons */
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .shimmer-animation {
          animation: shimmer 2s linear infinite;
        }

        /* Focus Ring Animation */
        @keyframes focusRingIn {
          from {
            opacity: 0;
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
          to {
            opacity: 1;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
          }
        }

        .focus-ring-animated {
          animation: focusRingIn var(--duration-base) var(--easing-out);
        }

        /* Button Hover Lift */
        .btn-hover-lift {
          transition: transform var(--duration-fast) var(--easing-out),
                      box-shadow var(--duration-fast) var(--easing-out),
                      background-color var(--duration-fast) var(--easing-out);
        }

        .btn-hover-lift:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .btn-hover-lift:active:not(:disabled) {
          transform: translateY(0);
          transition-duration: var(--duration-instant);
          transition-timing-function: var(--easing-in);
        }

        /* Card Hover */
        .card-hover {
          transition: box-shadow var(--duration-fast) var(--easing-out),
                      background-color var(--duration-fast) var(--easing-out);
        }

        /* Nav Item Transitions with Left Rail Indicator */
        .nav-item {
          position: relative;
          transition: background-color var(--duration-fast) var(--easing-standard),
                      color var(--duration-fast) var(--easing-standard);
        }

        .nav-item svg {
          transition: opacity var(--duration-fast) var(--easing-standard);
        }

        .nav-item:hover svg {
          opacity: 1;
        }

        /* Shared Left Rail Indicator - slides smoothly between items */
        .nav-rail-indicator {
          position: absolute;
          left: 0;
          width: 3px;
          height: 20px;
          background-color: #374151;
          border-radius: 0 2px 2px 0;
          transition: top 180ms var(--easing-glide),
                      opacity 180ms var(--easing-glide);
          pointer-events: none;
        }

        .nav-rail-indicator.hidden {
          opacity: 0;
        }

        /* Section Collapse/Expand Animation */
        .collapsible-section {
          overflow: hidden;
          transition: max-height 200ms var(--easing-out),
                      opacity 200ms var(--easing-out);
        }

        .collapsible-section.collapsed {
          max-height: 0 !important;
          opacity: 0;
        }

        /* Chevron Rotation */
        .chevron-rotate {
          transition: transform 200ms var(--easing-out),
                      opacity 180ms var(--easing-in);
        }

        .chevron-rotate.expanded {
          transform: rotate(0deg);
        }

        .chevron-rotate.collapsed {
          transform: rotate(-90deg);
        }

        /* Hide chevrons when sidebar collapsed */
        .sidebar-collapsed .chevron-rotate {
          opacity: 0;
          width: 0;
          overflow: hidden;
        }

        /* Sidebar Horizontal Collapse */
        .sidebar-container {
          transition: width 280ms var(--easing-glide);
          overflow: visible;
        }

        /* Labels handled by conditional rendering - no CSS needed */

        /* Sidebar icons - smooth transitions */
        .sidebar-icon {
          transition: transform 200ms var(--easing-out),
                      opacity 200ms var(--easing-out);
          flex-shrink: 0; /* Prevent icon from shrinking */
        }

        /* Enhanced hover state for collapsed icons */
        .nav-item:hover .sidebar-icon {
          transform: scale(1.05); /* Subtle lift on hover */
        }

        /* Section headers fade out quickly */
        .section-header {
          opacity: 1;
          transition: opacity 120ms var(--easing-in);
          overflow: hidden;
        }

        .sidebar-collapsed .section-header {
          opacity: 0;
          max-height: 0;
          margin: 0;
          padding: 0;
          pointer-events: none;
        }

        /* CRITICAL FIX: Keep collapsible sections visible when sidebar collapsed */
        /* Only hide the section, NOT the navigation items inside */
        .sidebar-collapsed .collapsible-section {
          max-height: none !important;  /* Keep section open */
          opacity: 1 !important;         /* Keep icons visible */
          margin-top: 0.5rem !important; /* Adjust spacing */
        }

        /* Collapsed nav items - handled via Tailwind classes now */
        /* Removed CSS rules to prevent conflicts with inline styles */

        /* Badges handled by conditional rendering */

        /* Tooltip on hover for collapsed items */
        .nav-item-collapsed {
          position: relative;
        }

        .nav-item-collapsed:hover::after {
          content: attr(data-tooltip);
          position: absolute;
          left: calc(100% + 12px);
          top: 50%;
          transform: translateY(-50%);
          background-color: #1F2937;
          color: white;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          animation: tooltipFadeIn 160ms var(--easing-out) forwards;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 100;
        }

        .nav-item-collapsed:hover::before {
          content: '';
          position: absolute;
          left: calc(100% + 6px);
          top: 50%;
          transform: translateY(-50%);
          width: 0;
          height: 0;
          border-top: 5px solid transparent;
          border-bottom: 5px solid transparent;
          border-right: 6px solid #1F2937;
          opacity: 0;
          animation: tooltipFadeIn 160ms var(--easing-out) forwards;
          z-index: 100;
        }

        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateY(-50%) translateX(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
          }
        }

        /* Input Focus Transition - Smooth on both focus and blur */
        .input-focus {
          transition: border-color var(--duration-base) var(--easing-out),
                      box-shadow var(--duration-base) var(--easing-out),
                      outline var(--duration-base) var(--easing-out);
        }

        /* When input gets focus, ring expands smoothly */
        .input-focus:focus {
          transition-timing-function: var(--easing-glide);
        }

        /* When input loses focus, ring fades out with ease-in */
        .input-focus:not(:focus) {
          transition-timing-function: var(--easing-in);
        }

        /* Link Underline Slide */
        .link-underline {
          position: relative;
        }

        .link-underline::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 1px;
          background-color: currentColor;
          transition: width var(--duration-fast) var(--easing-out);
        }

        .link-underline:hover::after {
          width: 100%;
        }
      `}</style>

      {/* Top Bar */}
      <header className="h-14 bg-white border-b border-[#E8EBED] flex items-center justify-between px-6 transition-colors duration-200">
        <h1 className="text-base font-semibold text-[#1F2937] tracking-tight">Prioritas Workspace</h1>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg">
          Active
        </span>
      </header>

      <div className="flex">
        {/* Sidebar with Horizontal Collapse */}
        <aside className={`sidebar-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''} bg-[#FAFBFC] border-r border-[#E8EBED] min-h-[calc(100vh-3.5rem)] py-6 relative overflow-x-hidden`}
          style={{ width: sidebarCollapsed ? '80px' : '224px' }}
        >
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`absolute top-6 w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-all duration-140 z-10 ${
              sidebarCollapsed ? 'left-1/2 -translate-x-1/2' : 'right-3'
            }`}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            ) : (
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            )}
          </button>

          <nav className={`space-y-6 relative mt-12 overflow-x-hidden ${sidebarCollapsed ? 'px-0' : 'px-3'}`}>
            {/* Shared Rail Indicator - slides between active items */}
            <div
              className={`nav-rail-indicator ${!showRail ? 'hidden' : ''}`}
              style={{
                top: `${railTop}px`,
                transform: 'translateY(-50%)',
              }}
            />

            {/* Workspace Section - Collapsible */}
            <div>
              <button
                onClick={() => setWorkspaceExpanded(!workspaceExpanded)}
                className="section-header w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#374151] uppercase tracking-wider transition-colors duration-140"
              >
                <span className="sidebar-label">Workspace</span>
                <ChevronDown
                  className={`sidebar-label w-3 h-3 chevron-rotate ${workspaceExpanded ? 'expanded' : 'collapsed'}`}
                  strokeWidth={2}
                />
              </button>

              <div
                className={`collapsible-section ${workspaceExpanded ? '' : 'collapsed'} space-y-1 mt-1`}
                style={{
                  maxHeight: sidebarCollapsed
                    ? 'none'  // Always show icons when sidebar collapsed
                    : (workspaceExpanded ? '300px' : '0')  // Respect section state when sidebar expanded
                }}
              >
                {[
                  { id: 'dashboard', icon: Home, label: 'Dashboard' },
                  { id: 'profile', icon: User, label: 'Profile' },
                  { id: 'messages', icon: Mail, label: 'Messages', badge: '3' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={(e) => handleNavClick(item.id, e)}
                    className={`nav-item ${sidebarCollapsed ? 'nav-item-collapsed' : ''} ${activeNav === item.id ? 'active' : ''} w-full rounded-lg text-sm font-medium ${
                      sidebarCollapsed
                        ? 'flex items-center justify-center p-0 h-12'
                        : 'flex items-center gap-3 px-3 py-2'
                    } ${
                      activeNav === item.id
                        ? 'bg-[#F3F4F6] text-[#1F2937]'
                        : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]'
                    }`}
                    data-tooltip={item.label}
                  >
                    <item.icon
                      className="sidebar-icon w-4 h-4 flex-shrink-0"
                      strokeWidth={2}
                      style={{ opacity: activeNav === item.id ? 1 : 0.7 }}
                    />
                    {!sidebarCollapsed && (
                      <>
                        <span className="sidebar-label">{item.label}</span>
                        {item.badge && (
                          <span className="nav-badge ml-auto px-2 py-0.5 bg-sapphire-50 text-sapphire-700 text-xs font-medium rounded transition-colors duration-140">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Projects Section - Collapsible */}
            <div>
              <button
                onClick={() => setProjectsExpanded(!projectsExpanded)}
                className="section-header w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#374151] uppercase tracking-wider transition-colors duration-140"
              >
                <span className="sidebar-label">Projects</span>
                <ChevronDown
                  className={`sidebar-label w-3 h-3 chevron-rotate ${projectsExpanded ? 'expanded' : 'collapsed'}`}
                  strokeWidth={2}
                />
              </button>

              <div
                className={`collapsible-section ${projectsExpanded ? '' : 'collapsed'} space-y-1 mt-1`}
                style={{
                  maxHeight: sidebarCollapsed
                    ? 'none'  // Always show icons when sidebar collapsed
                    : (projectsExpanded ? '300px' : '0')  // Respect section state when sidebar expanded
                }}
              >
                {[
                  { id: 'project-files', icon: FolderOpen, label: 'Project Files' },
                  { id: 'analytics', icon: BarChart, label: 'Analytics' },
                  { id: 'settings', icon: Settings, label: 'Settings' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={(e) => handleNavClick(item.id, e)}
                    className={`nav-item ${sidebarCollapsed ? 'nav-item-collapsed' : ''} ${activeNav === item.id ? 'active' : ''} w-full rounded-lg text-sm font-medium ${
                      sidebarCollapsed
                        ? 'flex items-center justify-center p-0 h-12'
                        : 'flex items-center gap-3 px-3 py-2'
                    } ${
                      activeNav === item.id
                        ? 'bg-[#F3F4F6] text-[#1F2937]'
                        : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]'
                    }`}
                    data-tooltip={item.label}
                  >
                    <item.icon
                      className="sidebar-icon w-4 h-4 flex-shrink-0"
                      strokeWidth={2}
                      style={{ opacity: activeNav === item.id ? 1 : 0.7 }}
                    />
                    {!sidebarCollapsed && <span className="sidebar-label">{item.label}</span>}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 max-w-7xl">
          {/* Section 1: Buttons with Micro-Animations */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-6 tracking-tight">Buttons with Micro-Animations</h2>
            <div className="flex flex-wrap gap-3">
              {/* Primary Button with Lift */}
              <button className="btn-hover-lift px-4 py-2 bg-[#374151] text-white text-sm font-medium rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                Primary Action
              </button>

              {/* Secondary Button */}
              <button className="btn-hover-lift px-4 py-2 bg-white border border-[#E8EBED] text-[#374151] text-sm font-medium rounded-lg hover:bg-[#F9FAFB] hover:border-[#D1D5DB]">
                Secondary
              </button>

              {/* Text/Tertiary Button with Underline */}
              <button className="link-underline px-4 py-2 text-[#374151] text-sm font-medium rounded-lg transition-colors duration-140 hover:text-[#1F2937]">
                Text Only
              </button>

              {/* Destructive Button */}
              <button className="btn-hover-lift px-4 py-2 bg-[#DC2626] text-white text-sm font-medium rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_2px_8px_rgba(220,38,38,0.12)] hover:bg-[#B91C1C]">
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
            <p className="mt-4 text-xs text-[#6B7280]">
              Hover: -1px lift, shadow widens · Pressed: returns to baseline · Duration: 140ms confident glide
            </p>
          </section>

          {/* Section 2: Cards with Hover Animations */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-6 tracking-tight">Cards with Hover Elevation</h2>
            <div className="grid grid-cols-3 gap-6">
              {[
                { icon: Home, title: 'Dashboard', desc: 'View your overview and key metrics' },
                { icon: Mail, title: 'Messages', desc: 'Check your communications', badge: 'new' },
                { icon: Settings, title: 'Settings', desc: 'Manage your preferences', chevron: true },
              ].map((card, idx) => (
                <div
                  key={idx}
                  className="card-hover bg-white border border-[#E8EBED] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_8px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_1px_3px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.05)] hover:bg-[#FEFEFE] cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-[#F3F4F6] rounded-xl flex items-center justify-center transition-colors duration-140 group-hover:bg-[#E5E7EB]">
                      <card.icon className="w-5 h-5 text-[#6B7280]" strokeWidth={2} />
                    </div>
                    {card.badge && (
                      <span className="px-2 py-0.5 bg-sapphire-50 text-sapphire-700 text-xs font-medium rounded">
                        {card.badge}
                      </span>
                    )}
                    {card.chevron && (
                      <ChevronRight className="w-4 h-4 text-[#9CA3AF] transition-transform duration-140 hover:translate-x-0.5" strokeWidth={2} />
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-[#1F2937] mb-1">{card.title}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{card.desc}</p>
                  <div className="mt-4 pt-4 border-t border-[#E8EBED]">
                    <button className="link-underline text-sm text-[#374151] font-medium hover:text-[#1F2937]">
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-[#6B7280]">
              Hover: +2% tint, shadow widens · Duration: 160ms ease-out · No movement, only elevation
            </p>
          </section>

          {/* Section 3: Forms with Focus Animations */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-6 tracking-tight">Forms with Focus Animations</h2>
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
                  className={`input-focus w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] ${
                    emailFocused
                      ? 'border-[#3B82F6]'
                      : 'border-[#E8EBED] hover:border-[#D1D5DB]'
                  }`}
                  style={{
                    boxShadow: emailFocused
                      ? 'inset 0 1px 2px rgba(0,0,0,0.02), 0 0 0 4px rgba(59, 130, 246, 0.1)'
                      : 'inset 0 1px 2px rgba(0,0,0,0.02), 0 0 0 0px rgba(59, 130, 246, 0)'
                  }}
                />
                <p className={`mt-1.5 text-xs text-[#6B7280] transition-opacity duration-160 ${emailFocused ? 'opacity-100' : 'opacity-70'}`}>
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
                  className={`input-focus w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] resize-none ${
                    messageFocused
                      ? 'border-[#3B82F6]'
                      : 'border-[#E8EBED] hover:border-[#D1D5DB]'
                  }`}
                  style={{
                    boxShadow: messageFocused
                      ? 'inset 0 1px 2px rgba(0,0,0,0.02), 0 0 0 4px rgba(59, 130, 246, 0.1)'
                      : 'inset 0 1px 2px rgba(0,0,0,0.02), 0 0 0 0px rgba(59, 130, 246, 0)'
                  }}
                />
              </div>

              {/* Search Input */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-140 ${
                      searchFocused ? 'text-[#3B82F6]' : 'text-[#9CA3AF]'
                    }`}
                    strokeWidth={2}
                  />
                  <input
                    type="search"
                    placeholder="Search items..."
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    className={`input-focus w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] ${
                      searchFocused
                        ? 'border-[#3B82F6]'
                        : 'border-[#E8EBED] hover:border-[#D1D5DB]'
                    }`}
                    style={{
                      boxShadow: searchFocused
                        ? 'inset 0 1px 2px rgba(0,0,0,0.02), 0 0 0 4px rgba(59, 130, 246, 0.1)'
                        : 'inset 0 1px 2px rgba(0,0,0,0.02), 0 0 0 0px rgba(59, 130, 246, 0)'
                    }}
                  />
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-[#6B7280]">
              Focus: hairline → sapphire ring softly expands · Duration: 190-210ms ease-out · Ring fades in, never snaps
            </p>
          </section>

          {/* Section 4: Status Indicators */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-6 tracking-tight">Status Indicators</h2>
            <div className="flex flex-wrap gap-3">
              {[
                { icon: CheckCircle, label: 'Success', bg: 'bg-emerald-50', text: 'text-emerald-700' },
                { icon: Info, label: 'Information', bg: 'bg-blue-50', text: 'text-blue-700' },
                { icon: AlertTriangle, label: 'Warning', bg: 'bg-amber-50', text: 'text-amber-700' },
                { icon: AlertCircle, label: 'Error', bg: 'bg-red-50', text: 'text-red-700' },
              ].map((badge, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 ${badge.bg} ${badge.text} text-sm font-medium rounded-lg transition-all duration-120 hover:shadow-sm`}
                >
                  <badge.icon className="w-4 h-4" strokeWidth={2} />
                  {badge.label}
                </span>
              ))}
            </div>
          </section>

          {/* Section 5: Loading States with Shimmer */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold text-[#1F2937] mb-6 tracking-tight">Loading States</h2>
            <div className="bg-white border border-[#E8EBED] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_8px_24px_rgba(0,0,0,0.03)]">
              <div className="space-y-4">
                {[75, 50, 85].map((width, idx) => (
                  <div
                    key={idx}
                    className="h-4 rounded shimmer-animation"
                    style={{
                      width: `${width}%`,
                      background: 'linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)',
                      backgroundSize: '200% 100%',
                    }}
                  />
                ))}
              </div>
            </div>
            <p className="mt-4 text-xs text-[#6B7280]">
              Shimmer: 2s linear loop · Reduced motion: static blocks · Low contrast, never intrusive
            </p>
          </section>

          {/* Footer Note */}
          <div className="mt-16 pt-8 border-t border-[#E8EBED]">
            <p className="text-sm text-[#9CA3AF] text-center">
              Monochrome-Lux Design System · Calm, Confident Motion · 120-260ms Transitions
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

export default MonochromeLuxAnimated
