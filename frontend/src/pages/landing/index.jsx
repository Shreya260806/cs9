import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/useAuthStore'
import {
  Award,
  BriefcaseBusiness,
  CalendarClock,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardCheck,
  FileText,
  Info,
  Laptop,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  Search,
  ShieldCheck,
  Tag,
  Terminal,
  Users,
} from 'lucide-react'
import Footer from '../../components/Footer/Footer'
import Button from '../../components/Button/Button'
import labSupportImage from '../../assets/lab-support.png'
import LoginModal from './LoginModal'
import FaqCard from './components/FaqCard'
import { getCurrentUser, getFaqSections } from './service'

const iconComponents = {
  award: Award,
  'briefcase-business': BriefcaseBusiness,
  'calendar-clock': CalendarClock,
  'clipboard-check': ClipboardCheck,
  'file-text': FileText,
  info: Info,
  laptop: Laptop,
  'message-circle': MessageCircle,
  'messages-square': MessagesSquare,
  newspaper: Newspaper,
  'shield-check': ShieldCheck,
  tag: Tag,
  terminal: Terminal,
  users: Users,
}

const emptySections = []

function TagIcon({ name, className }) {
  const IconComponent = iconComponents[name] || Tag

  return <IconComponent aria-hidden="true" className={className} strokeWidth={1.8} />
}

function Tooltip({ label, children }) {
  return (
    <div className="group/tip relative">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-[#191c1d] px-2 py-1 text-[11px] leading-none text-white opacity-0 transition-opacity group-hover/tip:opacity-100">
        {label}
      </span>
    </div>
  )
}

function Landing() {
  const [explicitOpenKeys, setExplicitOpenKeys] = useState(new Set())
  const [closedKeys, setClosedKeys] = useState(new Set())
  const [query, setQuery] = useState('')
  const [activeSectionId, setActiveSectionId] = useState('')
  const [pageProgress, setPageProgress] = useState(0)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const navigate = useNavigate()
  const { user: currentUser, setUser } = useAuthStore()

  function handleLogin(user) {
    setUser(user)
    navigate(user.role === 'ADMIN' ? '/admin' : '/dashboard')
  }

  function toggleFaq(accordionKey) {
    const isOpen = openKeys.has(accordionKey)

    setExplicitOpenKeys((prev) => {
      const next = new Set(prev)
      if (isOpen) next.delete(accordionKey)
      else next.add(accordionKey)
      return next
    })

    setClosedKeys((prev) => {
      const next = new Set(prev)
      if (isOpen) next.add(accordionKey)
      else next.delete(accordionKey)
      return next
    })
  }

  function toggleSection(section) {
    const keys = section.faqs.map((faq) => `${section.id}:${faq.id}`)
    const allOpen = keys.length > 0 && keys.every((k) => openKeys.has(k))

    setExplicitOpenKeys((prev) => {
      const next = new Set(prev)
      if (allOpen) keys.forEach((k) => next.delete(k))
      else keys.forEach((k) => next.add(k))
      return next
    })

    setClosedKeys((prev) => {
      const next = new Set(prev)
      if (allOpen) keys.forEach((k) => next.add(k))
      else keys.forEach((k) => next.delete(k))
      return next
    })
  }

  function handleHeaderButtonClick() {
    if (currentUser) {
      navigate(currentUser.role === 'ADMIN' ? '/admin' : '/dashboard')
    } else {
      if (isLoginModalOpen) {
        setIsLoginModalOpen(false)
      } else {
        setIsLoginModalOpen(true)
      }
    }
  }

  // TanStack Query — FAQs (cached, staleTime=Infinity)
  const { data: faqSections = emptySections, isLoading, isError, error } = useQuery({
    queryKey: ['landing-faqs'],
    queryFn: () => getFaqSections(),
    staleTime: Infinity,
  })

  const sections = isError ? emptySections : faqSections
  const firstSection = sections[0]
  const firstFaq = firstSection?.faqs[0]
  const firstFaqKey = firstSection && firstFaq ? `${firstSection.id}:${firstFaq.id}` : ''
  const openKeys = new Set(firstFaqKey ? [firstFaqKey] : [])
  closedKeys.forEach((key) => openKeys.delete(key))
  explicitOpenKeys.forEach((key) => openKeys.add(key))

  useEffect(() => {
    if (currentUser) {
      return undefined
    }

    const controller = new AbortController()

    async function hydrateCurrentUser() {
      try {
        const user = await getCurrentUser(controller.signal)
        setUser(user)
      } catch (error) {
        if (
          error.name === 'AbortError' ||
          error.name === 'CanceledError' ||
          error.code === 'ERR_CANCELED'
        ) {
          return
        }
      }
    }

    hydrateCurrentUser()

    return () => controller.abort()
  }, [currentUser, setUser])

  useEffect(() => {
    if (sections.length === 0) {
      return undefined
    }

    let animationFrame = 0

    const updateActiveSection = () => {
      const scrollPosition = window.scrollY + 150
      let nextActiveSection = sections[0].id

      for (const section of sections) {
        const sectionElement = document.getElementById(section.id)

        if (sectionElement && sectionElement.offsetTop <= scrollPosition) {
          nextActiveSection = section.id
        }
      }

      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight
      const nextProgress =
        scrollableHeight > 0 ? Math.min((window.scrollY / scrollableHeight) * 100, 100) : 0

      setActiveSectionId(nextActiveSection)
      setPageProgress(nextProgress)
    }

    const onScroll = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(updateActiveSection)
    }

    updateActiveSection()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [sections])

  const visibleSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return sections
    }

    return sections
      .map((section) => {
        const sectionMatches = section.label.toLowerCase().includes(normalizedQuery)
        const matchingFaqs = section.faqs.filter((faq) => {
          const searchableText = `${faq.question} ${faq.answer} ${faq.category} ${faq.tags.join(
            ' ',
          )}`.toLowerCase()
          return searchableText.includes(normalizedQuery)
        })

        return {
          ...section,
          faqs: sectionMatches ? section.faqs : matchingFaqs,
        }
      })
      .filter((section) => section.faqs.length > 0)
  }, [query, sections])

  const hasSections = sections.length > 0
  const currentActiveSectionId = activeSectionId || sections[0]?.id || ''
  const visiblePageProgress = hasSections ? pageProgress : 0

  return (
    <div className="min-h-svh bg-[#f8f9fa] text-[#191c1d]">
      <header className="sticky top-0 z-50 border-b border-[#c4c7c7] bg-[#f8f9fa]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-300 items-center justify-between px-2 py-3 sm:px-2 sm:py-4">
          <a
            href="#top"
            className="flex flex-col"
          >
            <span className="font-display text-[18px] font-bold leading-tight text-[#0f172a] sm:text-[22px]">
              Vicharanashala
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#444748]">
              Lab Internship Hub
            </span>
          </a>
          <Button variant="secondary" className="text-[10px] bg-[#8c6a40]/80 text-white" onClick={handleHeaderButtonClick}>
            {currentUser ? 'Dashboard' : 'Login'}
          </Button>
        </div>
      </header>

      <div id="top" className="mx-auto flex w-full max-w-300">
        <aside className="sticky top-16 hidden w-62 shrink-0 flex-col self-start border-r border-[#c4c7c7] pr-3 py-6 md:flex">
          <div className="mb-4">
            <h2 className="font-display text-[14px] font-semibold leading-snug text-black">
              FAQ Tags
            </h2>
            <p className="mt-1 text-[12px] leading-normal text-[#444748]">Internship Guide</p>
          </div>

          <nav aria-label="FAQ tags" className="relative flex flex-col gap-1 pl-2">
            <span className="absolute bottom-2 left-0 top-2 w-px bg-[#d9dadb]" aria-hidden="true" />
            <span
              className="absolute left-0 top-2 w-px bg-black transition-[height] duration-200"
              style={{ height: `calc((100% - 16px) * ${visiblePageProgress / 100})` }}
              aria-hidden="true"
            />
            {sections.map((section) => {
              const isActive = currentActiveSectionId === section.id

              return (
                <a
                  href={`#${section.id}`}
                  key={section.id}
                  className={`flex min-h-10 items-center gap-3 px-2 py-2 text-[14px] leading-normal transition ${
                    isActive ? 'border-r-2 border-[#8c6a40] font-bold text-[#8c6a40] bg-[#8c6a40]/10' : 'text-[#444748] hover:bg-[#8c6a40]/10 hover:text-[#8c6a40]'
                  }`}
                >
                  <TagIcon className="h-4 w-4 shrink-0" name={section.icon} />
                  <span>{section.label}</span>
                </a>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 pl-2 pr-4 py-6">
          <div className="mb-8 md:hidden">
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="font-display text-[14px] font-semibold leading-snug text-black">
                FAQ Tags
              </p>
              <p className="text-[12px] font-semibold text-[#444748]">
                {Math.round(visiblePageProgress)}%
              </p>
            </div>
            <div className="mb-4 h-px overflow-hidden bg-[#d9dadb]">
              <div
                className="h-full bg-black transition-[width] duration-200"
                style={{ width: `${visiblePageProgress}%` }}
              />
            </div>
            <nav
              aria-label="FAQ tags"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6"
            >
              {sections.map((section) => {
                const isActive = currentActiveSectionId === section.id

                return (
                  <a
                    href={`#${section.id}`}
                    key={section.id}
                    className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] ${
                      isActive
                        ? 'border-black bg-black text-white'
                        : 'border-[#c4c7c7] bg-white text-[#444748]'
                    }`}
                  >
                    <TagIcon className="h-4 w-4 shrink-0" name={section.icon} />
                    <span>{section.label}</span>
                  </a>
                )
              })}
            </nav>
          </div>

          <label className="relative mb-8 block w-full" htmlFor="faq-search">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#747878]"
              strokeWidth={1.8}
            />
            <input
              id="faq-search"
              className="h-10 w-full rounded-lg border border-[#c4c7c7] bg-white pl-9 pr-4 text-[12px] outline-none transition placeholder:text-[#9da1a1] focus:border-black focus:ring-1 focus:ring-black"
              placeholder="Search for questions (e.g., 'stipend', 'selection')..."
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          {isLoading && (
            <section className="rounded-lg border border-[#c4c7c7] bg-white p-6">
              <p className="text-[14px] leading-7 text-[#444748]">Loading FAQ data...</p>
            </section>
          )}

          {isError && (
            <section className="rounded-lg border border-[#c4c7c7] bg-white p-6">
              <h1 className="mb-2 font-display text-[18px] font-semibold leading-snug text-black">
                FAQ data is unavailable
              </h1>
              <p className="text-[14px] leading-7 text-[#444748]">
                {error?.message || 'Unable to load FAQs'}. Make sure the backend is running.
              </p>
            </section>
          )}

          {!isLoading && !isError && hasSections && (
            <div className="flex flex-col gap-8">
              {visibleSections.map((section) => (
                <section
                  id={section.id}
                  aria-labelledby={`${section.id}-heading`}
                  className="scroll-mt-28"
                  key={section.id}
                >
                  <div className="mb-4 flex items-end justify-between gap-4 border-b border-[#c4c7c7] pb-3">
                    <h1
                      id={`${section.id}-heading`}
                      className="font-display text-[18px] font-semibold leading-snug text-black"
                    >
                      {section.label}
                    </h1>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="text-[12px] font-bold leading-none text-[#747878]">
                        {section.faqs.length} QUESTIONS
                      </p>
                      <Tooltip
                        label={
                          section.faqs.length > 0 &&
                          section.faqs.every((faq) => openKeys.has(`${section.id}:${faq.id}`))
                            ? 'Collapse all'
                            : 'Expand all'
                        }
                      >
                        <button
                          type="button"
                          onClick={() => toggleSection(section)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-[#c4c7c7] bg-white text-[#747878] transition hover:border-black hover:text-black"
                        >
                          {section.faqs.length > 0 &&
                          section.faqs.every((faq) => openKeys.has(`${section.id}:${faq.id}`)) ? (
                            <ChevronsDownUp className="h-3 w-3" strokeWidth={2} />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3" strokeWidth={2} />
                          )}
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {section.faqs.map((faq) => {
                      const accordionKey = `${section.id}:${faq.id}`
                      const isOpen = openKeys.has(accordionKey)

                      return (
                        <FaqCard
                          key={accordionKey}
                          faq={faq}
                          sectionId={section.id}
                          isOpen={isOpen}
                          onToggle={() => toggleFaq(accordionKey)}
                        />
                      )
                    })}
                  </div>
                </section>
              ))}

              {visibleSections.length === 0 && (
                <section className="rounded-lg border border-[#c4c7c7] bg-white p-6">
                  <h1 className="mb-2 font-display text-[18px] font-semibold leading-snug text-black">
                    No questions found
                  </h1>
                  <p className="text-[14px] leading-7 text-[#444748]">
                    Try a different keyword or clear the search field to return to the full FAQ.
                  </p>
                </section>
              )}
            </div>
          )}

          {!isLoading && !isError && !hasSections && (
            <section className="rounded-lg border border-[#c4c7c7] bg-white p-6">
              <h1 className="mb-2 font-display text-[18px] font-semibold leading-snug text-black">
                No FAQs published
              </h1>
              <p className="text-[14px] leading-7 text-[#444748]">
                Published FAQ questions will appear here automatically once they have tags.
              </p>
            </section>
          )}

        </main>
      </div>

      <section className="border-t border-[#c4c7c7]/60 px-2 py-6 sm:px-2">
        <div className="relative mx-auto flex min-h-48 max-w-300 items-center overflow-hidden rounded-xl border border-[#c4c7c7] bg-white p-6">
          <img
            alt="Academic research environment"
            className="absolute inset-0 h-full w-full object-cover opacity-10 grayscale"
            src={labSupportImage}
          />
          <div className="relative z-10 max-w-lg">
            <h2 className="mb-2 font-display text-[15px] font-semibold leading-snug text-black">
              Need direct assistance?
            </h2>
            <p className="mb-4 text-[13px] leading-6 text-[#444748]">
              Our support team is available during lab hours to help with specific onboarding or
              platform issues.
            </p>
            <Button
              variant="secondary"
              className="text-[10px] border-transparent bg-[#8c6a40]/80 text-white hover:border-transparent hover:bg-[#7a5c35]"
              onClick={() => currentUser ? navigate('/raise-query') : setIsLoginModalOpen(true)}
            >
              Contact Crowd for Solution
            </Button>
          </div>
        </div>
      </section>

      <Footer />
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLogin}
      />
    </div>
  )
}

export default Landing
