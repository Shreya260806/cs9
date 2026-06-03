import { useEffect, useState } from 'react'

const tourSteps = [
  {
    title: 'Vicharanashala FAQ ADMIN PORTAL 🛠️',
    subtitle: 'Administrator Control Center',
    body: "Welcome to the administrator control room! Let's take a detailed walkthrough of the dashboard KPIs, unresolved queries, moderations, charts, user statistics, notifications, settings, and navigation.",
    icon: (
      <svg className="w-10 h-10 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-kpis"]',
    title: 'Real-Time Metrics 📊',
    subtitle: 'System Health & Performance',
    body: 'Monitor total community queries, curated FAQ articles, answer activity, and open urgent flags at a glance.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-unresolved"]',
    title: 'Unresolved Queries ⏳',
    subtitle: 'Actionable Inquiries',
    body: 'View open questions that need attention or assignment to resolvers. Click "View all queries" to see the full list.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-charts"]',
    title: 'Visual Analytics & Traffic 📈',
    subtitle: 'Category Volume & Daily Traffic',
    body: 'Analyze question categories and hourly traffic trends over the last 24 hours to scale system resources or assign specific moderators.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-moderation"]',
    title: 'Moderation & Escalations 🚨',
    subtitle: 'Escalated Flag Queue',
    body: 'Keep the community safe! Review questions, answers, and comments flagged by automated moderation systems or reported by students.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-stats-summary"]',
    title: 'Users & Sparks Ledger ⚡',
    subtitle: 'User Growth & Spark Economy',
    body: 'Track total registered users, new user signups this week, and the aggregate Spark points circulating across the entire ecosystem.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-settings-shortcut"]',
    title: 'Scoring & Configuration ⚙️',
    subtitle: 'System Threshold Parameters',
    body: 'Quickly update points allocation criteria, flags thresholds, and administrative settings using this settings shortcut card.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-sidebar"]',
    title: 'Main Navigation 🗂️',
    subtitle: 'Sidebar Control Menu',
    body: 'Navigate seamlessly between the Dashboard, Queries list, moderation Flags, User management, Spark point settings, FAQ articles, and global configurations.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-search"]',
    title: 'Global Search 🔍',
    subtitle: 'Fast Data Filtering',
    body: 'Quickly find any queries, FAQs, or moderation records by title, category tags, or status.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-notifications"]',
    title: 'System Alerts & Notifications 🔔',
    subtitle: 'Real-time Activity Stream',
    body: 'Receive instant notifications for newly submitted flags, user escalations, and resolved system tasks.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-theme"]',
    title: 'Visual Theme Toggle 🌗',
    subtitle: 'Interface Customization',
    body: 'Switch seamlessly between light and dark visual themes to configure the display for your preference.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-faq-view"]',
    title: 'Switch to User View 🔄',
    subtitle: 'Student Platform Sandbox',
    body: 'Click "FAQ View" to jump directly to the student-facing FAQ platform to see how it looks to regular students.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    )
  },
  {
    selector: '[data-tour="admin-user-menu"]',
    title: 'Profile Settings & Re-tour ⚙️',
    subtitle: 'Account Management',
    body: 'Click your profile to edit your name, change passwords, restart this Product Tour at any time, or safely log out.',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  },
]

const styleContent = `
  @keyframes tourFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes spotlightPulse {
    0%, 100% {
      border-color: rgba(140, 106, 64, 0.5);
      box-shadow: 0 0 0 9999px rgba(10, 11, 14, 0.75), 0 0 15px rgba(140, 106, 64, 0.4);
    }
    50% {
      border-color: rgba(140, 106, 64, 0.95);
      box-shadow: 0 0 0 9999px rgba(10, 11, 14, 0.75), 0 0 25px rgba(140, 106, 64, 0.8);
    }
  }

  @keyframes floatIcon {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-6px) rotate(3deg); }
  }

  .tour-pulse-glow {
    animation: spotlightPulse 2s infinite ease-in-out;
  }

  .tour-animate-card {
    animation: tourFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .tour-float-icon {
    animation: floatIcon 3s infinite ease-in-out;
  }
`

function AdminOnboardingTour({ userId, isActive, onClose }) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)
  const [tooltipStyle, setTooltipStyle] = useState({
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  })

  // Reset to first step when tour becomes active
  useEffect(() => {
    if (isActive) {
      setStep(0)
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) return

    const currentStep = tourSteps[step]
    if (!currentStep.selector) {
      setRect(null)
      setTooltipStyle({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      })
      return
    }

    const updatePosition = () => {
      const element = document.querySelector(currentStep.selector)
      if (element) {
        // Scroll the element into the center of the viewport instantly to guarantee stable layout and plenty of space above/below
        element.scrollIntoView({ block: 'center', behavior: 'auto' })

        const r = element.getBoundingClientRect()
        setRect(r)

        const spaceBelow = window.innerHeight - r.bottom
        const spaceAbove = r.top
        let tooltipTop = 0
        let tooltipLeft = r.left + r.width / 2 - 175 // Center 350px tooltip horizontally

        // Clamp left position to viewport boundaries
        tooltipLeft = Math.max(16, Math.min(window.innerWidth - 366, tooltipLeft))

        let tooltipTransform = 'none'
        if (spaceBelow > 260 || spaceBelow > spaceAbove) {
          // Position below target
          tooltipTop = r.bottom + 12
          tooltipTransform = 'none'
        } else {
          // Position above target
          tooltipTop = r.top - 12
          tooltipTransform = 'translateY(-100%)'
        }

        setTooltipStyle({
          top: `${tooltipTop}px`,
          left: `${tooltipLeft}px`,
          transform: tooltipTransform,
        })
      } else {
        // Fallback to center if element is not in DOM
        setRect(null)
        setTooltipStyle({
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        })
      }
    }

    // Delay slightly to ensure DOM is ready
    const timer = setTimeout(updatePosition, 100)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [step, isActive])

  if (!isActive) return null

  const currentStep = tourSteps[step]
  const isFirst = step === 0
  const isLast = step === tourSteps.length - 1
  const progressPercent = ((step + 1) / tourSteps.length) * 100

  const handleNext = () => {
    if (isLast) {
      handleFinish()
    } else {
      setStep(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    if (!isFirst) {
      setStep(prev => prev - 1)
    }
  }

  const handleFinish = () => {
    localStorage.setItem(`rogare-admin-tour-completed-${userId}`, 'true')
    onClose?.()
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styleContent }} />

      {/* Background Overlay */}
      <div className="fixed inset-0 z-[9997] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300" />

      {/* Spotlight cutout */}
      {rect && (
        <div
          className="tour-pulse-glow"
          style={{
            position: 'fixed',
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: '12px',
            border: '2.5px solid var(--color-brand)',
            zIndex: 9998,
            pointerEvents: 'none',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      )}

      {/* Tooltip Card wrapper to handle outer coordinates/translations */}
      <div
        style={{
          position: 'fixed',
          top: tooltipStyle.top,
          left: tooltipStyle.left,
          transform: tooltipStyle.transform,
          zIndex: 10000,
          width: '350px',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Inner card with CSS animation (no transform collisions) */}
        <div className="tour-animate-card rounded-2xl border border-border-light bg-bg-card/95 p-6 shadow-2xl backdrop-blur-lg dark:border-border/40 dark:bg-bg-card/90">
          {/* Top Progress Line */}
          <div className="absolute left-0 top-0 h-1.5 w-full overflow-hidden rounded-t-2xl bg-bg-tertiary">
            <div
              className="h-full bg-gradient-to-r from-brand to-brand-hover transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Step Header */}
          <div className="mt-1 flex items-start gap-4">
            {/* Animated Icon Container */}
            <div className="tour-float-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              {currentStep.icon}
            </div>

            <div className="flex-1">
              <h4 className="font-sans text-[16px] font-extrabold leading-tight text-text-primary">
                {currentStep.title}
              </h4>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                {currentStep.subtitle}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 h-px bg-border-light dark:bg-border/30" />

          {/* Body Text */}
          <p className="text-[13px] leading-5 text-text-secondary">
            {currentStep.body}
          </p>

          {/* Progress Bar & Buttons */}
          <div className="mt-6 flex items-center justify-between">
            {/* Skip Link */}
            <button
              type="button"
              onClick={handleFinish}
              className="text-[12px] font-bold text-text-muted hover:text-brand transition duration-200"
            >
              Skip Tour
            </button>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Step Count */}
              <span className="rounded-md bg-bg-tertiary px-2 py-1 text-[11px] font-bold text-text-secondary">
                {step + 1} / {tourSteps.length}
              </span>

              {/* Back Button */}
              {!isFirst && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-lg border border-border-light bg-bg-secondary px-3 py-1.5 text-[12px] font-bold text-text-secondary hover:bg-bg-tertiary transition duration-200 dark:border-border/40"
                >
                  Back
                </button>
              )}

              {/* Next/Finish Button */}
              <button
                type="button"
                onClick={handleNext}
                className="rounded-lg bg-gradient-to-r from-brand to-brand-hover px-4 py-1.5 text-[12px] font-extrabold text-white shadow-sm hover:brightness-110 active:scale-95 transition duration-200"
              >
                {isLast ? 'Finish 🏁' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default AdminOnboardingTour
