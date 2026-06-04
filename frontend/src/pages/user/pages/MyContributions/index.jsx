import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, CheckCircle2, Clock, HelpCircle, ChevronUp, Award, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchMyContributions } from '../../service'
import { notifyError } from '../../../../lib/notify'
import useAuthStore from '../../../../store/useAuthStore'

// Per-type visual identity (semantic accent colors, readable on both themes).
const TYPE_META = {
  question: { icon: HelpCircle,    label: 'Question', color: '#8c6a40' },
  answer:   { icon: CheckCircle2,  label: 'Answer',   color: '#16a34a' },
  comment:  { icon: MessageSquare, label: 'Comment',  color: '#2563eb' },
}

const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'questions', label: 'Questions' },
  { key: 'answers',   label: 'Answers' },
  { key: 'comments',  label: 'Comments' },
]

const PAGE_SIZE = 10

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function displayStatus(status = '') {
  const normalized = status.toLowerCase()
  if (normalized === 'unanswered') return 'Active'
  if (normalized === 'answered') return 'In Progress'
  if (normalized === 'closed') return 'Resolved'
  if (normalized === 'removed') return 'Removed'
  if (normalized) return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  return 'Unknown'
}

function statusClassName(status = '') {
  const normalized = status.toLowerCase()
  if (normalized === 'closed') return 'bg-success/10 text-success'
  if (normalized === 'unanswered') return 'bg-brand/10 text-brand'
  if (normalized === 'answered') return 'bg-info/10 text-info'
  return 'bg-bg-tertiary text-text-muted'
}

function MyContributionsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [contributions, setContributions] = useState([])
  const [summaryStats, setSummaryStats]   = useState(null)
  const [activeTab, setActiveTab]         = useState('all')
  const [currentPage, setCurrentPage]     = useState(1)
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    if (!user?.userId) {
      setContributions([])
      setSummaryStats(null)
      setLoading(false)
      return
    }

    setLoading(true)
    fetchMyContributions()
      .then(data => {
        setContributions(Array.isArray(data.contributions) ? data.contributions : [])
        setSummaryStats(data.stats || null)
      })
      .catch(() => {
        setContributions([])
        setSummaryStats(null)
        notifyError('Could not load your contributions.')
      })
      .finally(() => setLoading(false))
  }, [user?.userId])

  // ── Derived stats + filtered list ────────────────────────────────────────
  const stats = useMemo(() => {
    const derived = {
      question: contributions.filter(c => c.type === 'question').length,
      answer:   contributions.filter(c => c.type === 'answer').length,
      comment:  contributions.filter(c => c.type === 'comment').length,
      accepted: contributions.filter(c => c.type === 'answer' && c.isAccepted).length,
    }

    return {
      question: Number(summaryStats?.question ?? derived.question),
      answer:   Number(summaryStats?.answer ?? derived.answer),
      comment:  Number(summaryStats?.comment ?? derived.comment),
      accepted: Number(summaryStats?.accepted ?? derived.accepted),
      total:    Number(summaryStats?.total ?? contributions.length),
    }
  }, [contributions, summaryStats])

  const STAT_CARDS = [
    { label: 'Questions', value: stats.question, Icon: HelpCircle,    color: '#8c6a40' },
    { label: 'Answers',   value: stats.answer,   Icon: CheckCircle2,  color: '#16a34a' },
    { label: 'Comments',  value: stats.comment,  Icon: MessageSquare, color: '#2563eb' },
    { label: 'Accepted',  value: stats.accepted, Icon: Award,         color: '#b45309' },
  ]

  const filtered = contributions.filter(c => {
    if (activeTab === 'all')       return true
    if (activeTab === 'questions') return c.type === 'question'
    if (activeTab === 'answers')   return c.type === 'answer'
    if (activeTab === 'comments')  return c.type === 'comment'
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages))
  }, [totalPages])

  // Always open the canonical query detail page.
  function openContribution(item) {
    const qid = item.type === 'question' ? item.id : item.questionId
    if (qid) navigate(`/query/${qid}`)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-brand" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-display text-[22px] font-bold text-text-primary">My Contributions</h2>
        <p className="mt-1 text-[13px] text-text-muted">
          Everything you’ve asked, answered, and commented on across the hub.
        </p>
      </div>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_CARDS.map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-xl border border-border-light bg-bg-card p-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${color}1f`, color }}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-[20px] font-bold leading-none text-text-primary">{value}</p>
                <p className="mt-1 text-[11px] font-medium text-text-muted">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {contributions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-bg-tertiary">
            <MessageSquare className="h-7 w-7 text-text-muted" strokeWidth={1.5} />
          </div>
          <h3 className="mb-2 font-display text-[18px] font-bold text-text-primary">No contributions yet</h3>
          <p className="mb-6 max-w-xs text-[13px] text-text-muted">
            Raise a query or answer a question to start building your activity history.
          </p>
          <button
            type="button"
            onClick={() => navigate('/raise-query')}
            className="inline-flex items-center justify-center rounded-lg bg-brand px-6 py-2.5 font-semibold text-white transition hover:bg-brand-hover"
          >
            <span className="!text-[10px] leading-none">Raise a Query</span>
          </button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-xl bg-bg-tertiary p-1">
            {TABS.map(tab => {
              const count =
                tab.key === 'all' ? stats.total
                : tab.key === 'questions' ? stats.question
                : tab.key === 'answers' ? stats.answer
                : stats.comment
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold transition ${
                    isActive
                      ? 'bg-bg-card text-text-primary shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? 'bg-brand/15 text-brand' : 'bg-bg-primary text-text-muted'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* List */}
          <div className="flex flex-col gap-3">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-text-muted">
                No {activeTab} to show.
              </p>
            ) : (
              paginated.map(item => {
                const { icon: Icon, label, color: baseColor } = TYPE_META[item.type] ?? TYPE_META.question
                const color = item.isUpheld ? '#dc2626' : baseColor
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openContribution(item)}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openContribution(item)}
                    className="flex cursor-pointer items-start gap-4 rounded-xl border border-border-light bg-bg-card p-5 transition hover:border-brand hover:shadow-sm"
                  >
                    {/* Type badge */}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${color}1f`, color }}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </div>

                    {/* Body */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: `${color}1f`, color }}
                        >
                          {label}
                        </span>
                        {item.type === 'answer' && item.isAccepted && (
                          <span className="flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                            <CheckCircle2 className="h-3 w-3" strokeWidth={2} /> Accepted
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-text-muted">
                          <Clock className="h-3 w-3" strokeWidth={1.8} />
                          {new Date(item.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      {item.type === 'question' && item.title && (
                        <h4 className="mb-1 text-[15px] font-semibold text-text-primary">{item.title}</h4>
                      )}

                      <p
                        className="line-clamp-2 text-[13px] leading-5 text-text-muted"
                        dangerouslySetInnerHTML={{ __html: item.body || '' }}
                      />

                      {/* Footer meta */}
                      <div className="mt-2 flex items-center gap-4 text-[11px] text-text-muted">
                        {item.type === 'question' && (
                          <>
                            <span className="flex items-center gap-1 font-medium">
                              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.8} />
                              {countLabel(item.answerCount || 0, 'answer')}
                            </span>
                            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${statusClassName(item.status)}`}>
                              {displayStatus(item.status)}
                            </span>
                          </>
                        )}
                        {item.type === 'answer' && (
                          <>
                            <span className="flex items-center gap-1 font-medium">
                              <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
                              {countLabel(item.score || 0, 'upvote')}
                            </span>
                            <span className="flex items-center gap-1 font-medium">
                              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.8} />
                              {countLabel(item.commentCount || 0, 'reply', 'replies')}
                            </span>
                          </>
                        )}
                        {item.type === 'comment' && (
                          <span className="flex items-center gap-1 font-medium">
                            <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.8} />
                            {countLabel(item.replyCount || 0, 'reply', 'replies')}
                          </span>
                        )}
                        {item.type !== 'question' && (
                          <span className="text-brand">View thread →</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                aria-label="Previous contributions page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-light text-text-muted transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-light disabled:hover:text-text-muted"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <span className="text-[11px] font-medium text-text-muted">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next contributions page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-light text-text-muted transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-light disabled:hover:text-text-muted"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default MyContributionsPage
