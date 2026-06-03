import { useEffect, useState } from 'react'

const tourSteps = [
  {
    title: 'Welcome to Rogāre! 🎓',
    body: "Let's take a quick 1-minute tour to help you navigate your new query resolution portal and learn how to ask, vote, and track contributions.",
  },
  {
    selector: '[data-tour="search-bar"]',
    title: 'Search FAQs & Categories 🔍',
    body: 'Use the search bar and categories filter to quickly look up existing questions. Try searching before asking a new question!',
  },
  {
    selector: '[data-tour="tabs-filter"]',
    title: 'Filter by Status & Trends 📊',
    body: 'Switch between tabs like Trending, Unanswered, and Resolved to explore community queries in different stages.',
  },
  {
    selector: '[data-tour="upvote-btn"]',
    title: 'Upvote to Prioritize 👍',
    body: 'If you have the same question as another student, upvote their query. High-upvote queries get resolved faster!',
  },
  {
    selector: '[data-tour="raise-query-btn"]',
    title: 'Raise a New Query ✍️',
    body: "Can't find what you need? Ask a new question here and set a Spark bounty to reward resolvers who answer it.",
  },
  {
    selector: '[data-tour="contributions-widget"]',
    title: 'Contributions & Sparks ⚡',
    body: 'Track your questions, answers, and comments here. Your active Spark points will also show up in this panel.',
  },
]

function OnboardingTour({ userId, isActive, onClose }) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)
  const [tooltipStyle, setTooltipStyle] = useState({})

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
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000,
        transition: 'all 0.3s ease',
      })
      return
    }

    const updatePosition = () => {
      const element = document.querySelector(currentStep.selector)
      if (element) {
        // Scroll the element into view smoothly if it's not visible
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        
        // Wait slightly for scroll to complete before getting client rect
        setTimeout(() => {
          const r = element.getBoundingClientRect()
          setRect(r)

          const spaceBelow = window.innerHeight - r.bottom
          const spaceAbove = r.top
          let tooltipTop = 0
          let tooltipLeft = r.left + r.width / 2 - 160 // Center 320px tooltip horizontally

          // Clamp left position to viewport boundaries
          tooltipLeft = Math.max(16, Math.min(window.innerWidth - 336, tooltipLeft))

          if (spaceBelow > 220 || spaceBelow > spaceAbove) {
            // Position below target
            tooltipTop = r.bottom + 16
          } else {
            // Position above target
            tooltipTop = r.top - 210 // Assumed tooltip height is ~190px
          }

          setTooltipStyle({
            position: 'fixed',
            top: `${tooltipTop}px`,
            left: `${tooltipLeft}px`,
            zIndex: 10000,
            transition: 'all 0.3s ease',
          })
        }, 100)
      } else {
        // Fallback to center if element is not in DOM
        setRect(null)
        setTooltipStyle({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
          transition: 'all 0.3s ease',
        })
      }
    }

    // Delay slightly to ensure DOM is ready and tabs are rendered
    const timer = setTimeout(updatePosition, 150)
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
    localStorage.setItem(`rogare-tour-completed-${userId}`, 'true')
    onClose?.()
  }

  return (
    <>
      {/* Background Overlay */}
      <div className="fixed inset-0 z-[9997] bg-black/60 transition-opacity duration-300" />

      {/* Spotlight cutout */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            borderRadius: '12px',
            border: '2px solid #8c6a40',
            zIndex: 9998,
            pointerEvents: 'none',
            transition: 'all 0.3s ease',
          }}
        />
      )}

      {/* Tooltip Card */}
      <div
        className="w-[320px] rounded-2xl border border-border-light bg-bg-card/95 p-6 shadow-2xl backdrop-blur-md dark:border-border/50"
        style={tooltipStyle}
      >
        {/* Title */}
        <h4 className="font-display mb-2 text-[16px] font-bold text-text-primary">
          {currentStep.title}
        </h4>

        {/* Body */}
        <p className="mb-6 text-[13px] leading-5 text-text-secondary">
          {currentStep.body}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {/* Skip Button */}
          <button
            type="button"
            onClick={handleFinish}
            className="text-[12px] font-semibold text-text-muted hover:text-text-primary transition"
          >
            Skip
          </button>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Step Indicators */}
            <span className="text-[11px] font-semibold text-text-muted">
              {step + 1} / {tourSteps.length}
            </span>

            {/* Back Button */}
            {!isFirst && (
              <button
                type="button"
                onClick={handlePrev}
                className="rounded-lg border border-border-light bg-bg-tertiary px-2.5 py-1.5 text-[12px] font-bold text-text-secondary hover:bg-border transition dark:border-border/50"
              >
                Back
              </button>
            )}

            {/* Next/Finish Button */}
            <button
              type="button"
              onClick={handleNext}
              className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-bold text-white hover:bg-brand-hover transition"
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default OnboardingTour
