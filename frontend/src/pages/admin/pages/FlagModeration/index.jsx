import { useCallback, useEffect, useState } from 'react'
import {
  Flag, ShieldAlert, ChevronLeft, ChevronRight, Loader,
  User, Clock, FileText, MessageSquare,
} from 'lucide-react'
import Modal from '../../../../components/Modal/Modal'
import { notifyError, notifySuccess } from '../../../../lib/notify'
import { fetchFlags, fetchModerationQueue, resolveFlag } from '../../service'

const PAGE_SIZE = 10

const TABS = [
  { key: 'queue', label: 'Moderation Queue' },
  { key: 'flags', label: 'All Flags' },
]

const STATUS_FILTERS = [
  { value: '',         label: 'All statuses' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Upheld' },
  { value: 'rejected', label: 'Dismissed' },
]

const TARGET_TYPES = ['question', 'answer']

const STATUS_META = {
  pending:  { label: 'Pending',   cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Upheld',    cls: 'bg-red-50 text-red-700' },
  rejected: { label: 'Dismissed', cls: 'bg-gray-100 text-gray-600' },
}

const TARGET_META = {
  question: { cls: 'bg-blue-50 text-blue-700',     Icon: FileText },
  answer:   { cls: 'bg-emerald-50 text-emerald-700', Icon: MessageSquare },
  comment:  { cls: 'bg-purple-50 text-purple-700', Icon: MessageSquare },
}

// Resolve actions (only shown when upholding a flag).

const LABEL_CLS = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted'
const INPUT_CLS = 'w-full rounded-lg border border-border bg-bg-primary px-4 py-2.5 text-[13px] text-text-primary placeholder:text-text-muted outline-none transition focus:border-text-primary focus:ring-1 focus:ring-text-primary'

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Short readable preview of the flagged content.
function targetPreview(flag) {
  const t = flag.target
  if (!t) return null
  if (flag.target_type === 'question') return t.title || stripHtml(t.body) || stripHtml(t.body_plain)
  return stripHtml(t.body) || stripHtml(t.body_plain)
}

function FlagCard({ flag, onReview, showStatus = true }) {
  const tm = TARGET_META[flag.target_type] || TARGET_META.comment
  const sm = STATUS_META[flag.status] || STATUS_META.pending
  const preview = targetPreview(flag)
  const TargetIcon = tm.Icon
  return (
    <div className="rounded-xl border border-border-light bg-bg-card p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${tm.cls}`}>
          <TargetIcon className="h-3 w-3" strokeWidth={2.2} /> {flag.target_type}
        </span>
        <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">{flag.reason}</span>
        {showStatus && <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${sm.cls}`}>{sm.label}</span>}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-text-muted">
          <Clock className="h-3 w-3" strokeWidth={1.8} /> {formatDate(flag.created_at)}
        </span>
      </div>

      {/* Reporter note */}
      {flag.notes && <p className="mb-2 text-[12px] italic text-text-secondary">"{flag.notes}"</p>}

      {/* Flagged content */}
      <div className="rounded-lg border border-border-light bg-bg-tertiary px-3 py-2">
        {preview ? (
          <p className="line-clamp-3 text-[12px] text-text-secondary">{preview}</p>
        ) : (
          <p className="text-[12px] italic text-text-muted">Content no longer available.</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" strokeWidth={1.8} />
            Reported by <span className="font-semibold text-text-primary">{flag.reported_by_name || flag.reported_by?.slice(0, 8) || '—'}</span>
          </span>
          {flag.author_name && (
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" strokeWidth={1.8} />
              Author <span className="font-semibold text-text-primary">{flag.author_name}</span>
            </span>
          )}
        </div>
        {flag.status === 'pending' ? (
          <button
            type="button"
            onClick={() => onReview(flag)}
            className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#2e3132]"
          >
            <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} /> Review
          </button>
        ) : (
          <span className="text-[11px] text-text-muted">
            {flag.review_action && flag.review_action !== 'no_action'
              ? `Action: ${flag.review_action.replace('_', ' ')}`
              : 'Reviewed'}
            {flag.resolution_note ? ` · "${flag.resolution_note}"` : ''}
          </span>
        )}
      </div>
    </div>
  )
}

function FlagModerationView() {
  const [tab, setTab]               = useState('queue')
  const [items, setItems]           = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 })
  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [targetFilter, setTargetFilter] = useState('')

  // Review modal
  const [reviewing, setReviewing]   = useState(null)   // flag under review, or null
  const [selectedOutcome, setSelectedOutcome] = useState('') // 'resolved' | 'dismissed'
  const [note, setNote]             = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { setPage(1) }, [tab, statusFilter, targetFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const fetcher = tab === 'queue'
        ? fetchModerationQueue({ page, limit: PAGE_SIZE, targetType: targetFilter })
        : fetchFlags({ page, limit: PAGE_SIZE, status: statusFilter, targetType: targetFilter })
      const { items: rows, pagination: meta } = await fetcher
      setItems(rows)
      setPagination(meta)
    } catch {
      setItems([])
      setPagination({ page: 1, pages: 0, total: 0 })
      notifyError('Could not load flags.')
    } finally {
      setLoading(false)
    }
  }, [tab, page, statusFilter, targetFilter])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, pagination.pages || 1)

  function openReview(flag) {
    setReviewing(flag)
    setSelectedOutcome('')
    setNote('')
  }

  async function submitReview() {
    if (!reviewing || !selectedOutcome || submitting) return
    setSubmitting(true)
    try {
      await resolveFlag(reviewing.flag_id, {
        status: selectedOutcome,
        action: selectedOutcome === 'resolved' ? 'hide_content' : 'no_action',
        resolutionNote: note.trim(),
      })
      notifySuccess(selectedOutcome === 'resolved' ? 'Content hidden — author & reporter notified.' : 'Flag dismissed.')
      setReviewing(null)
      await load()
    } catch (err) {
      notifyError(err?.response?.data?.message || 'Could not resolve the flag.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display flex items-center gap-2 text-[24px] font-semibold text-text-primary">
            <Flag className="h-6 w-6 text-brand" strokeWidth={1.8} /> Flag Moderation
          </h1>
          <p className="mt-2 text-[13px] text-text-secondary">
            Review reported content and take moderation action.
          </p>
        </div>
        <span className="rounded-full bg-bg-tertiary px-3 py-1 text-[12px] font-semibold text-text-muted">
          {pagination.total} {tab === 'queue' ? 'pending' : 'flags'}
        </span>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-6 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px pb-3 text-[13px] font-semibold transition ${
              tab === t.key
                ? 'border-b-2 border-brand text-brand'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {tab === 'flags' && (
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-bg-card px-3 py-2 text-[12px] text-text-primary focus:border-brand focus:outline-none"
          >
            {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
        <select
          value={targetFilter}
          onChange={e => setTargetFilter(e.target.value)}
          className="rounded-lg border border-border bg-bg-card px-3 py-2 text-[12px] capitalize text-text-primary focus:border-brand focus:outline-none"
        >
          <option value="">All content types</option>
          {TARGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-text-muted">
          <Loader className="h-4 w-4 animate-spin" /> Loading flags...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-[13px] text-text-muted">
          <Flag className="h-8 w-8 text-[#d1d5db]" strokeWidth={1.5} />
          {tab === 'queue' ? 'Nothing pending - the queue is clear.' : 'No flags match this view.'}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {items.map(flag => (
              <FlagCard key={flag.flag_id} flag={flag} onReview={openReview} showStatus={tab !== 'queue'} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-light text-text-muted transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-light disabled:hover:text-text-muted"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <span className="text-[11px] font-medium text-text-muted">{pagination.page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-light text-text-muted transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-light disabled:hover:text-text-muted"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Review modal */}
      <Modal isOpen={!!reviewing} onClose={() => setReviewing(null)} title="Review flag" panelClassName="!max-w-lg !rounded-xl !p-0 overflow-hidden">
        {reviewing && (
          <>
            <div className="border-b border-border-light px-7 pb-5 pt-7">
              <h2 className="font-display text-[22px] font-bold text-text-primary">Review flag</h2>
              <p className="mt-1 text-[13px] text-text-secondary">
                <span className="font-semibold capitalize">{reviewing.target_type}</span> reported for{' '}
                <span className="font-semibold text-red-600">{reviewing.reason}</span>
                {reviewing.reported_by_name && (
                  <> by <span className="font-semibold text-text-primary">{reviewing.reported_by_name}</span></>
                )}
              </p>
            </div>

            <div className="space-y-5 px-7 py-6">
              {/* Flagged content */}
              <div className="rounded-lg border border-border-light bg-bg-tertiary px-3 py-2 text-[12px] text-text-secondary">
                {targetPreview(reviewing) || <span className="italic text-text-muted">Content no longer available.</span>}
              </div>

              {/* Decision */}
              <div>
                <p className={LABEL_CLS}>Decision</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedOutcome('resolved')}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 px-4 py-4 text-center transition ${
                      selectedOutcome === 'resolved'
                        ? 'border-red-500 bg-red-50'
                        : 'border-border bg-bg-card hover:border-red-300'
                    }`}
                  >
                    <span className={`text-[13px] font-bold ${selectedOutcome === 'resolved' ? 'text-red-700' : 'text-text-secondary'}`}>
                      Uphold
                    </span>
                    <span className={`text-[11px] ${selectedOutcome === 'resolved' ? 'text-red-600' : 'text-text-muted'}`}>
                      Hides content & notifies both
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOutcome('dismissed')}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-xl border-2 px-4 py-4 text-center transition ${
                      selectedOutcome === 'dismissed'
                        ? 'border-brand bg-brand/5'
                        : 'border-border bg-bg-card hover:border-brand'
                    }`}
                  >
                    <span className={`text-[13px] font-bold ${selectedOutcome === 'dismissed' ? 'text-brand' : 'text-text-secondary'}`}>
                      Dismiss
                    </span>
                    <span className={`text-[11px] ${selectedOutcome === 'dismissed' ? 'text-brand/80' : 'text-text-muted'}`}>
                      No action, flag closed
                    </span>
                  </button>
                </div>
              </div>

              {/* Note */}
              <div>
                <p className={LABEL_CLS}>
                  Resolution note
                  <span className="font-normal normal-case text-text-muted"> (optional — shared with author & reporter on uphold)</span>
                </p>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Describe the violation for the author and reporter…"
                  className={`${INPUT_CLS} resize-none`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border-light px-7 py-4">
              <button
                type="button"
                onClick={() => setReviewing(null)}
                disabled={submitting}
                className="rounded-lg px-5 py-2.5 text-[13px] font-medium text-text-secondary transition hover:bg-hover-bg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReview}
                disabled={submitting || !selectedOutcome}
                className={`rounded-lg px-6 py-2.5 text-[13px] font-semibold text-white transition disabled:opacity-50 ${
                  selectedOutcome === 'resolved'
                    ? 'bg-red-700 hover:bg-red-800'
                    : selectedOutcome === 'dismissed'
                    ? 'bg-brand hover:bg-brand/90'
                    : 'bg-black hover:bg-[#2e3132]'
                }`}
              >
                {submitting ? 'Applying…' : selectedOutcome === 'resolved' ? 'Hide content & notify' : selectedOutcome === 'dismissed' ? 'Dismiss flag' : 'Apply'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default FlagModerationView
