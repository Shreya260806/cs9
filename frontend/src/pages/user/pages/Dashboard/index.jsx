import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Link as LinkIcon } from 'lucide-react'
import QuestionCard from '../../components/QuestionCard/QuestionCard'
import FAQCategories from '../../components/FAQCategories/FAQCategories'
import Button from '../../../../components/Button/Button'
import { fetchQuestions, fetchQuestionCounts, fetchUserContributions, voteQuestion, normalizeQuestion } from '../../service'
import { queryClient } from '../../../../lib/queryClient'
import { notifyError } from '../../../../lib/notify'

function DashboardPage() {
  const navigate = useNavigate()
  // searchQuery and selectedTags live in UserLayout, passed via context
  const { user, sidebarNav, searchQuery, selectedTags, setSelectedTags, tags } = useOutletContext()

  const [queries, setQueries]                 = useState([])
  const [loadingQueries, setLoadingQueries]   = useState(true)
  const [activeTab, setActiveTab]             = useState('All Queries')
  const [counts, setCounts]                   = useState({
    'All Queries': 0,
    'Trending': 0,
    'Recent': 0,
    'Unanswered': 0,
    'Resolved': 0,
  })
  const [contributions, setContributions]     = useState([])
  const [loadingContributions, setLoadingContributions] = useState(true)

  function handleCardClick(id) {
    navigate(`/query/${id}`, {
      state: {
        activeSidebarNav: sidebarNav === 'My Queries' ? 'My Queries' : 'Dashboard',
      },
    })
  }

  // Top FAQ Categories filter — shares selectedTags with the header tag popover.
  function toggleCategory(tag) {
    setSelectedTags?.(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }
  function clearCategories() {
    setSelectedTags?.([])
  }

  // ── Load contributions ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.userId) return
    setLoadingContributions(true)
    fetchUserContributions(user.userId, 5)
      .then(data => setContributions(data.contributions || []))
      .catch(() => setContributions([]))
      .finally(() => setLoadingContributions(false))
  }, [user?.userId])

  // ── Load questions ─────────────────────────────────────────────────────────
  const loadQuestions = useCallback(async () => {
    setLoadingQueries(true)
    try {
      const sort         = activeTab === 'Trending' ? 'trending' : 'latest'
      const status       = activeTab === 'Unanswered' ? 'unanswered'
                         : activeTab === 'Resolved' ? 'resolved'
                         : ''
      const createdAfter = activeTab === 'Recent'
        ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        : ''
      const my = sidebarNav === 'My Queries'

      const data = await fetchQuestions({
        search: searchQuery,
        tag: selectedTags.join(','),
        sort, status, createdAfter, my,
      })
      const normalized = (data.questions || []).map(q => normalizeQuestion(q, user?.userId))
      setQueries(normalized)
      // Cache the loaded questions so Similar Queries (Raise Query page) can reuse them
      queryClient.setQueryData(['dashboardQuestions'], normalized)
    } catch {
      setQueries([])
    } finally {
      setLoadingQueries(false)
    }
  }, [activeTab, sidebarNav, searchQuery, selectedTags, user?.userId])

  useEffect(() => { loadQuestions() }, [loadQuestions])

  // ── Load counts ────────────────────────────────────────────────────────────
  useEffect(() => {
    const my = sidebarNav === 'My Queries'
    fetchQuestionCounts({
      search: searchQuery,
      tag: selectedTags.join(','),
      my,
    })
      .then(data => {
        if (data.success && data.counts) {
          setCounts(data.counts)
        }
      })
      .catch(() => {})
  }, [sidebarNav, searchQuery, selectedTags])

  // ── Upvote ─────────────────────────────────────────────────────────────────
  async function handleUpvote(id) {
    setQueries(qs =>
      qs.map(q =>
        q.id === id
          ? { ...q, hasUpvoted: !q.hasUpvoted, upvotes: q.hasUpvoted ? q.upvotes - 1 : q.upvotes + 1 }
          : q,
      ),
    )
    try {
      const result = await voteQuestion(id)
      setQueries(qs => qs.map(q => q.id === id ? { ...q, upvotes: result.upvotes, hasUpvoted: result.hasVoted } : q))
    } catch (err) {
      setQueries(qs =>
        qs.map(q =>
          q.id === id
            ? { ...q, hasUpvoted: !q.hasUpvoted, upvotes: q.hasUpvoted ? q.upvotes - 1 : q.upvotes + 1 }
            : q,
        ),
      )
      notifyError(err.response?.data?.message || 'Could not register your vote.')
    }
  }

  // ── Filtered + counts ────────────────────────────────────────────────────────
  const filtered = queries

  return (
    <div className="flex flex-col gap-10 p-8 lg:flex-row">
      {/* ── Left column ────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        {sidebarNav === 'My Queries' && (
          <h2 className="font-display mb-6 text-[18px] font-semibold text-text-primary">My Queries</h2>
        )}

        {/* Tabs — hidden in My Queries */}
        {sidebarNav !== 'My Queries' && (
          <div className="mb-6 flex items-center border-b border-border pb-4">
            <div data-tour="tabs-filter" className="flex gap-7">
              {['All Queries', 'Trending', 'Recent', 'Unanswered', 'Resolved'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`mb-[-17px] flex items-center gap-1.5 pb-4 text-[13px] font-semibold transition ${
                    activeTab === tab
                      ? 'border-b-2 border-brand text-brand'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tab}
                  {counts[tab] > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      activeTab === tab ? 'bg-brand/15 text-brand' : 'bg-bg-tertiary text-text-muted'
                    }`}>
                      {counts[tab]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loadingQueries && (
          <div className="flex items-center gap-2 py-8 text-[13px] text-text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-[#8c6a40]" />
            Searching…
          </div>
        )}

        {/* Empty */}
        {!loadingQueries && filtered.length === 0 && (
          <p className="mt-5 text-[13px] text-text-muted">
            {searchQuery || selectedTags.length > 0
              ? `No results found${searchQuery ? ` for "${searchQuery}"` : ''}${selectedTags.length ? ` in ${selectedTags.join(', ')}` : ''}`
              : 'No queries yet. Ask your first question!'}
          </p>
        )}

        {/* Cards */}
        {!loadingQueries && filtered.map(query => (
          <QuestionCard
            key={query.id}
            query={query}
            onUpvote={handleUpvote}
            onClick={() => handleCardClick(query.id)}
          />
        ))}
      </div>

      {/* ── Right column ─────────────────────────────────────────── */}
      <div className="flex w-[300px] shrink-0 flex-col gap-6">

        {/* Top FAQ Categories — filters the query list (synced with header tags) */}
        <FAQCategories
          categories={tags || []}
          selected={selectedTags}
          onToggle={toggleCategory}
          onClear={clearCategories}
        />

        {/* Your Contribution */}
        <div data-tour="contributions-widget" className="rounded-xl border border-border bg-bg-card p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-md bg-brand p-1.5 text-white">
              <LinkIcon className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <span className="font-display text-[16px] font-semibold text-text-primary">Your Contribution</span>
          </div>

          {loadingContributions ? (
            <div className="flex items-center gap-2 py-4 text-[13px] text-text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-[#8c6a40]" />
              Loading…
            </div>
          ) : contributions.length === 0 ? (
            <p className="py-4 text-[13px] text-text-muted">No contributions yet.</p>
          ) : (
            <>
              <div className="relative pl-5">
                <div className="absolute bottom-2.5 left-1 top-2.5 w-px bg-bg-tertiary" />
                {[...contributions].sort((a, b) => new Date(b.time) - new Date(a.time)).map((item, i) => {
                  const color =
                    item.type === 'question' ? '#8c6a40'
                    : item.type === 'answer'  ? '#16a34a'
                    : '#3b82f6'
                  const label =
                    item.type === 'question' ? `Asked: ${item.title}`
                    : item.type === 'answer'  ? `Answered: ${item.body || '…'}`
                    : `Commented: ${item.body || '…'}`
                  return (
                    <div
                      key={i}
                      className="relative mb-2 cursor-pointer transition hover:opacity-70"
                      onClick={() => item.questionId && handleCardClick(item.questionId)}
                    >
                      <div
                        className="absolute -left-5 top-1.5 h-2 w-2 rounded-full"
                        style={{ background: color }}
                      />
                      <h5
                        className="text-[13px] font-medium text-text-primary"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={label}
                      >
                        {label}
                      </h5>
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                        {new Date(item.time).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        }).toUpperCase()}
                      </p>
                    </div>
                  )
                })}
              </div>
              <Button
                variant="secondary"
                className="mt-2 w-full"
                onClick={() => navigate('/my-contributions')}
              >
                See all contribution
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
