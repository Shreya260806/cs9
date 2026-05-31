import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, Tag, Pin, Lock, CheckCircle, Zap, ChevronUp, MessageSquare,
  User, Clock, Loader, ShieldCheck, VenetianMask, Eye, Award, Trash2, AlertTriangle, Send,
} from 'lucide-react'
import { fetchQuestionDetail } from '../../../user/service'
import { adminResolveQuery } from '../../service'
import { notifyError, notifySuccess } from '../../../../lib/notify'
import useAuthStore from '../../../../store/useAuthStore'

const STATUS_STYLE = {
  unanswered: 'bg-amber-50 text-amber-700',
  answered:   'bg-blue-50 text-blue-700',
  closed:     'bg-gray-100 text-gray-600',
  removed:    'bg-red-50 text-red-700',
  draft:      'bg-gray-100 text-gray-600',
  published:  'bg-emerald-50 text-emerald-700',
  archived:   'bg-gray-100 text-gray-500',
}

function initialsOf(name = '') {
  return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function Badge({ className, children }) {
  return <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${className}`}>{children}</span>
}

// Real moderation state from the raw fields (admin always receives bodies, so we
// derive the flag ourselves rather than trusting the redaction helper).
function modState(doc) {
  if (doc.is_deleted) return 'deleted'
  if (doc.moderation_status && doc.moderation_status !== 'approved') return 'under_review'
  return 'visible'
}

function AnswerCard({ answer, comments }) {
  const score = (answer.upvotes ?? 0) - (answer.downvotes ?? 0)
  const state = modState(answer)
  return (
    <div className="rounded-xl border border-border-light bg-bg-card p-5">
      <div className="flex items-start gap-4">
        {/* Score */}
        <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-bg-tertiary py-2">
          <ChevronUp className="h-4 w-4 text-text-muted" strokeWidth={2} />
          <span className="text-[15px] font-bold text-text-primary">{score}</span>
          <span className="text-[9px] uppercase text-text-muted">{answer.upvotes ?? 0}↑ {answer.downvotes ?? 0}↓</span>
        </div>

        <div className="min-w-0 flex-1">
          {/* Author + badges */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0b1528] text-[10px] font-bold text-white">
              {initialsOf(answer.author_name)}
            </div>
            <span className="text-[13px] font-semibold text-text-primary">{answer.author_name || 'User'}</span>
            {answer.is_accepted && (
              <Badge className="bg-emerald-50 text-emerald-700"><CheckCircle className="mr-0.5 inline h-3 w-3" strokeWidth={2.4} /> Accepted</Badge>
            )}
            {answer.is_expert && (
              <Badge className="bg-purple-50 text-purple-700"><ShieldCheck className="mr-0.5 inline h-3 w-3" strokeWidth={2.4} /> Expert</Badge>
            )}
            {answer.is_official && <Badge className="bg-blue-50 text-blue-700">Official</Badge>}
            {state === 'deleted' && (
              <Badge className="bg-red-50 text-red-700"><Trash2 className="mr-0.5 inline h-3 w-3" strokeWidth={2.4} /> Deleted</Badge>
            )}
            {state === 'under_review' && (
              <Badge className="bg-amber-50 text-amber-700"><AlertTriangle className="mr-0.5 inline h-3 w-3" strokeWidth={2.4} /> Under review</Badge>
            )}
            <span className="ml-auto flex items-center gap-1 text-[11px] text-text-muted">
              <Clock className="h-3 w-3" strokeWidth={1.8} /> {formatDateTime(answer.created_at)}
            </span>
          </div>

          {/* Body */}
          <div
            className="text-[13px] leading-6 text-text-secondary [&_a]:text-brand [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: answer.body || '<em>(empty)</em>' }}
          />

          {/* References */}
          {(answer.references || []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {answer.references.map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noreferrer"
                  className="rounded bg-bg-tertiary px-2 py-0.5 text-[11px] text-brand hover:underline">
                  {r.label || r.url}
                </a>
              ))}
            </div>
          )}

          {/* Comments on this answer */}
          {comments.length > 0 && (
            <div className="mt-3 space-y-2 border-l-2 border-border-light pl-3">
              {comments.map(c => {
                const cs = modState(c)
                return (
                  <div key={c.comment_id} className="text-[12px]">
                    <span className="font-semibold text-text-primary">{c.author_name || 'User'}</span>
                    <span className="ml-2 text-[10px] text-text-muted">{formatDateTime(c.created_at)}</span>
                    {cs === 'deleted' && <span className="ml-2 text-[10px] font-bold uppercase text-red-600">deleted</span>}
                    {cs === 'under_review' && <span className="ml-2 text-[10px] font-bold uppercase text-amber-600">under review</span>}
                    <p className="mt-0.5 text-text-secondary" dangerouslySetInnerHTML={{ __html: c.body || '' }} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AdminQueryDetailView({ queryId, onBack }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAuthStore()
  const userRoles = user?.roles ?? (user?.role ? [user.role] : [])
  const isAdmin = userRoles.includes('ADMIN')

  const load = useCallback(async () => {
    if (!queryId) return
    setLoading(true)
    setError(false)
    try {
      setData(await fetchQuestionDetail(queryId))
    } catch {
      setError(true)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [queryId])

  useEffect(() => { load() }, [load])

  async function submitComment() {
    if (!comment.trim() || submitting) return
    setSubmitting(true)
    try {
      await adminResolveQuery(queryId, comment.trim())
      setComment('')
      notifySuccess('Comment posted as ADMIN — question resolved.')
      await load()
    } catch (err) {
      notifyError(err?.response?.data?.message || 'Could not post comment.')
    } finally {
      setSubmitting(false)
    }
  }

  const BackButton = (
    <button
      type="button"
      onClick={onBack}
      className="mb-5 flex items-center gap-1.5 text-[13px] font-semibold text-text-muted transition hover:text-text-primary"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.8} /> Back to queries
    </button>
  )

  if (loading) {
    return (
      <div className="flex-1 p-5 lg:p-8">
        {BackButton}
        <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-text-muted">
          <Loader className="h-4 w-4 animate-spin" /> Loading question…
        </div>
      </div>
    )
  }

  if (error || !data?.question) {
    return (
      <div className="flex-1 p-5 lg:p-8">
        {BackButton}
        <p className="py-16 text-center text-[13px] text-text-muted">This question could not be loaded.</p>
      </div>
    )
  }

  const { question: q, answers = [], comments = [] } = data

  // Group comments by their answer; comments with no answer_id are question-level.
  const commentsByAnswer = {}
  const questionComments = []
  for (const c of comments) {
    if (c.answer_id) (commentsByAnswer[c.answer_id] ||= []).push(c)
    else questionComments.push(c)
  }

  // Admins always see the real author name; anonymity only applies to students
  const author = isAdmin ? (q.author_name || 'Unknown') : (q.is_anonymous ? 'Anonymous' : (q.author_name || 'Unknown'))

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-8">
      {BackButton}

      {/* Question */}
      <article className="rounded-xl border border-border-light bg-bg-card p-6 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-text-muted">#{q.question_id?.slice(0, 8)}</span>
          <Badge className={q.kind === 'faq' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}>{q.kind || 'community'}</Badge>
          <Badge className={STATUS_STYLE[q.status] || 'bg-gray-100 text-gray-600'}>{q.status}</Badge>
          {q.moderation_status && q.moderation_status !== 'approved' && (
            <Badge className="bg-amber-50 text-amber-700">{q.moderation_status}</Badge>
          )}
          {q.is_anonymous && (
            <Badge className="bg-indigo-50 text-indigo-700"><VenetianMask className="mr-0.5 inline h-3 w-3" strokeWidth={2.2} /> Anonymous</Badge>
          )}
          {q.is_pinned && <Badge className="bg-brand/10 text-brand"><Pin className="mr-0.5 inline h-3 w-3" strokeWidth={2.4} /> Pinned</Badge>}
          {q.is_locked && <Badge className="bg-gray-100 text-gray-600"><Lock className="mr-0.5 inline h-3 w-3" strokeWidth={2.4} /> Locked</Badge>}
          {q.has_expert_answer && <Badge className="bg-emerald-50 text-emerald-700">Expert answered</Badge>}
          {q.spark_bounty > 0 && (
            <Badge className="bg-amber-50 text-amber-700"><Zap className="mr-0.5 inline h-3 w-3" strokeWidth={2.4} /> {q.spark_bounty}</Badge>
          )}
        </div>

        <h1 className="font-display text-[22px] font-bold text-text-primary">{q.title}</h1>

        <div
          className="mt-3 text-[14px] leading-7 text-text-secondary [&_a]:text-brand [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: q.body || '' }}
        />

        {(q.tags || []).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {q.tags.map(t => (
              <span key={t} className="flex items-center gap-1 rounded bg-bg-tertiary px-2 py-0.5 text-[11px] font-medium capitalize text-text-muted">
                <Tag className="h-2.5 w-2.5" strokeWidth={2} /> {t}
              </span>
            ))}
          </div>
        )}

        {/* Author + stats */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border-light pt-4 text-[12px] text-text-muted">
          <span className="flex items-center gap-1.5">
            {isAdmin || !q.is_anonymous
              ? <User className="h-4 w-4" strokeWidth={1.8} />
              : <VenetianMask className="h-4 w-4" strokeWidth={1.8} />}
            <span className={isAdmin || !q.is_anonymous ? 'font-semibold text-text-secondary' : 'italic'}>{author}</span>
          </span>
          <span className="flex items-center gap-1"><ChevronUp className="h-3.5 w-3.5" strokeWidth={1.8} /> {q.upvotes ?? 0} upvotes</span>
          <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" strokeWidth={1.8} /> {q.answer_count ?? answers.length} answers</span>
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" strokeWidth={1.8} /> {q.view_count ?? 0} views</span>
          {q.assigned_to && <span className="flex items-center gap-1 text-brand"><Award className="h-3.5 w-3.5" strokeWidth={1.8} /> Assigned: {q.assigned_to.slice(0, 8)}</span>}
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" strokeWidth={1.8} /> {formatDateTime(q.created_at)}</span>
        </div>
      </article>

      {/* Question-level comments */}
      {questionComments.length > 0 && (
        <div className="mt-4 space-y-2 rounded-xl border border-border-light bg-bg-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Comments on question</p>
          {questionComments.map(c => (
            <div key={c.comment_id} className="text-[12px]">
              <span className="font-semibold text-text-primary">{c.author_name || 'User'}</span>
              <span className="ml-2 text-[10px] text-text-muted">{formatDateTime(c.created_at)}</span>
              <p className="mt-0.5 text-text-secondary" dangerouslySetInnerHTML={{ __html: c.body || '' }} />
            </div>
          ))}
        </div>
      )}

      {/* Admin response composer — posts as ADMIN and resolves immediately */}
      <div className="mt-6 rounded-xl border border-border-light bg-bg-card p-5 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700">
            <ShieldCheck className="h-3 w-3" strokeWidth={2.4} /> Respond as ADMIN
          </span>
          {q.status === 'closed' && (
            <span className="text-[11px] text-text-muted">This question is already resolved — a new response re-resolves it.</span>
          )}
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          placeholder="Write an authoritative response… Posting it resolves the question."
          className="w-full resize-none rounded-lg border border-border bg-bg-primary px-4 py-3 text-[13px] text-text-primary placeholder:text-text-muted outline-none transition focus:border-text-primary focus:ring-1 focus:ring-text-primary"
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[11px] text-text-muted">Shown as <strong className="text-text-secondary">ADMIN</strong>, not your name.</p>
          <button
            type="button"
            onClick={submitComment}
            disabled={submitting || !comment.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-black px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-[#2e3132] disabled:opacity-50"
          >
            {submitting
              ? <><Loader className="h-3.5 w-3.5 animate-spin" /> Posting…</>
              : <><Send className="h-3.5 w-3.5" strokeWidth={2} /> Comment &amp; Resolve</>}
          </button>
        </div>
      </div>

      {/* Answers */}
      <div className="mt-6">
        <h2 className="mb-3 text-[15px] font-bold text-text-primary">
          {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
        </h2>
        {answers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-bg-card py-10 text-center text-[13px] text-text-muted">
            No answers yet.
          </p>
        ) : (
          <div className="space-y-3">
            {answers.map(a => (
              <AnswerCard key={a.answer_id} answer={a} comments={commentsByAnswer[a.answer_id] || []} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminQueryDetailView
