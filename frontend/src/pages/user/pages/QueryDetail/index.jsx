import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useOutletContext, useLocation } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, Check, CheckCircle, RotateCcw, ChevronUp, ChevronDown,
  AlertTriangle, MessageCircle, Loader,
} from 'lucide-react'
import ReportModal from '../../components/ReportModal/ReportModal'
import AnswerComments from '../../components/AnswerComments/AnswerComments'
import Button from '../../../../components/Button/Button'
import {
  fetchQuestionDetail, fetchQuestions, postAnswer, voteAnswer, reportContent, postComment,
  resolveQuestion, acceptAnswer, recordQuestionView,
} from '../../service'
import { notifySuccess, notifyError } from '../../../../lib/notify'
import { parseMarkdown } from '../../../../lib/markdown'

const STATUS_LABEL = {
  unanswered: 'Active',
  answered: 'In Progress',
  closed: 'Resolved',
}

function initialsOf(name = '') {
  return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
}

function QueryDetailPage() {
  const { queryId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useOutletContext()
  const activeSidebarNav = location.state?.activeSidebarNav || ''

  const [data, setData] = useState(null)   // { question, answers, comments }
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [posting, setPosting] = useState(false)
  const [reportTarget, setReportTarget] = useState(null) // { type, id }
  const [reporting, setReporting] = useState(false)
  const [related, setRelated] = useState([])     // latest queries sharing tags
  const [replyTab, setReplyTab] = useState('write') // 'write' | 'preview'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchQuestionDetail(queryId)
      setData(result)
      recordQuestionView(queryId)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [queryId])

  // Silent re-fetch — updates the thread in place WITHOUT toggling `loading`,
  // so actions like voting/commenting don't blank the page (no reload flash).
  const refresh = useCallback(async () => {
    try {
      setData(await fetchQuestionDetail(queryId))
    } catch {
      // Keep the current view if the refresh fails.
    }
  }, [queryId])

  useEffect(() => { load() }, [load])

  // ── Related recent queries sharing the same tags ────────────────────────────
  const tags = data?.question?.tags || []
  const tagKey = tags.join(',')
  useEffect(() => {
    if (!tagKey) { setRelated([]); return }
    fetchQuestions({ tag: tagKey, sort: 'latest', limit: 6 })
      .then(res => setRelated(
        (res.questions || [])
          .filter(q => q.question_id !== queryId)
          .slice(0, 5),
      ))
      .catch(() => setRelated([]))
  }, [tagKey, queryId])

  async function handleVote(answerId, vote) {
    try {
      await voteAnswer(answerId, vote)
      await refresh()
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not register your vote.')
    }
  }

  async function handleComment(answerId, body, parentId) {
    try {
      await postComment(answerId, body, parentId)
      await refresh()
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not post comment.')
    }
  }

  async function handleResolveToggle(resolved) {
    try {
      await resolveQuestion(queryId, resolved)
      notifySuccess(resolved ? 'Question marked as solved.' : 'Question reopened.')
      await refresh()
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not update the question.')
    }
  }

  async function handleAcceptAnswer(answerId) {
    try {
      await acceptAnswer(queryId, answerId)
      notifySuccess('Marked as the resolution. Question resolved.')
      await refresh()
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not mark resolution.')
    }
  }

  async function handlePostReply() {
    if (!reply.trim()) {
      notifyError('Write something before posting.')
      return
    }
    if (reply.trim().length < 15) {
      notifyError('Your reply must be at least 15 characters.')
      return
    }
    setPosting(true)
    try {
      await postAnswer(queryId, reply.trim())
      setReply('')
      notifySuccess('Your reply has been posted.')
      await refresh()
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not post your reply.')
    } finally {
      setPosting(false)
    }
  }

  async function handleReportSubmit({ reason, description }) {
    if (!reason) {
      notifyError('Please select a reason for reporting.')
      return
    }
    setReporting(true)
    try {
      await reportContent({
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason,
        description,
      })
      notifySuccess('Report submitted. Thank you.')
      setReportTarget(null)
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not submit report.')
    } finally {
      setReporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-[13px] text-text-muted">
        <Loader className="mr-2 h-4 w-4 animate-spin" /> Loading thread…
      </div>
    )
  }

  if (!data?.question) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10">
        <p className="text-[13px] text-text-muted">This query could not be found.</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-[13px] font-medium text-brand transition hover:underline"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} /> Back to dashboard
        </button>
      </div>
    )
  }

  const { question, answers, comments = [] } = data
  const statusLabel = STATUS_LABEL[question.status] || 'Active'
  const isResolved = statusLabel === 'Resolved'
  const isOwner = question.author_id === user?.userId
  const hasAcceptedAnswer = answers.some(a => a.is_accepted)

  // Group comments by their parent answer
  const commentsByAnswer = {}
  for (const c of comments) {
    (commentsByAnswer[c.answer_id] ||= []).push(c)
  }

  const steps = [
    { label: 'Submitted', meta: fmtDate(question.created_at), done: true },
    { label: 'In Discussion', meta: `${answers.length} ${answers.length === 1 ? 'reply' : 'replies'}`, done: answers.length > 0 },
    { label: 'Resolved', meta: isResolved ? `Closed ${fmtDate(question.updated_at)}` : 'Pending', done: isResolved, green: true },
  ]

  return (
    <div className="relative mx-auto w-full max-w-[1100px] px-8 py-8">
      <div className="flex gap-10">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="mb-10">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h1 className="font-display text-[28px] font-bold leading-tight text-text-primary">
                {question.title}
              </h1>
              {/* Owner: mark solved / reopen */}
              {isOwner && (
                isResolved ? (
                  <Button
                    variant="secondary"
                    className="shrink-0 gap-2 text-[12px]"
                    onClick={() => handleResolveToggle(false)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} /> Reopen
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="shrink-0 gap-2 border-brand text-[12px] text-brand hover:border-brand hover:text-brand"
                    onClick={() => handleResolveToggle(true)}
                  >
                    <CheckCircle className="h-3.5 w-3.5" strokeWidth={1.8} /> Mark as Solved
                  </Button>
                )
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-text-secondary">
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold ${isResolved ? 'bg-success/10 text-success' : 'bg-brand/10 text-brand'
                }`}>
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} /> {statusLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <strong className="font-semibold text-text-primary">{question.author_name}</strong>
                opened this on {fmtDate(question.created_at)}
              </span>
            </div>
          </div>

          {/* Thread */}
          <div className="relative pl-[60px]">
            <div className="absolute bottom-0 left-6 top-6 w-px bg-bg-tertiary" aria-hidden="true" />

            {/* Original post */}
            <ThreadItem
              authorName={question.author_name}
              isSelf={question.author_id === user?.userId}
              date={fmtDate(question.created_at)}
              body={question.body}
              isOriginal
            />

            {/* Answers */}
            {answers.length === 0 && (
              <p className="mb-8 text-[13px] text-text-muted">No replies yet — be the first to respond.</p>
            )}
            {answers.map(ans => {
              const moderationState = ans.moderation_state || 'visible'
              const hidden = moderationState !== 'visible'
              return (
                <ThreadItem
                  key={ans.answer_id}
                  authorName={ans.author_name}
                  isSelf={ans.author_id === user?.userId}
                  date={fmtDate(ans.created_at)}
                  body={ans.body}
                  moderationState={moderationState}
                  accepted={ans.is_accepted}
                  score={(ans.upvotes ?? 0) - (ans.downvotes ?? 0)}
                  myVote={ans.my_vote ?? 0}
                  canAccept={isOwner && !hasAcceptedAnswer && !hidden && ans.author_id !== user?.userId}
                  onAccept={() => handleAcceptAnswer(ans.answer_id)}
                  onVoteUp={() => handleVote(ans.answer_id, 'up')}
                  onVoteDown={() => handleVote(ans.answer_id, 'down')}
                  authorRole={ans.author_role}
                  onReport={() => setReportTarget({ type: 'answer', id: ans.answer_id })}
                >
                  {!hidden && (
                    <AnswerComments
                      answerId={ans.answer_id}
                      comments={commentsByAnswer[ans.answer_id] || []}
                      currentUserId={user?.userId}
                      locked={isResolved}
                      onSubmit={handleComment}
                    />
                  )}
                </ThreadItem>
              )
            })}

            {/* Reply box — closed once the question is resolved */}
            {isResolved ? (
              <div className="relative mt-8">
                <div className="rounded-xl border border-dashed border-border bg-bg-tertiary px-5 py-4 text-center text-[13px] text-text-muted">
                  This question is resolved — new replies are closed.
                </div>
              </div>
            ) : (
              <div className="relative mt-8">
                <div className="absolute -left-[54px] top-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-[12px] font-bold text-white ring-4 ring-border-light">
                  {initialsOf(user?.name)}
                </div>
                <div className="rounded-xl border border-border-light bg-bg-card p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between border-b border-border-light pb-2">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setReplyTab('write')}
                        className={`text-[11px] font-bold pb-0.5 transition ${replyTab === 'write' ? 'border-b-2 border-brand text-brand' : 'text-text-muted hover:text-text-primary'}`}
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyTab('preview')}
                        className={`text-[11px] font-bold pb-0.5 transition ${replyTab === 'preview' ? 'border-b-2 border-brand text-brand' : 'text-text-muted hover:text-text-primary'}`}
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  {replyTab === 'write' ? (
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Drop your resolution, comment, or suggestions here. Markdown is supported…"
                      className="min-h-[80px] w-full resize-y text-[13px] leading-6 text-text-primary outline-none placeholder:text-text-muted"
                    />
                  ) : (
                    <div
                      className="markdown-body min-h-[80px] w-full text-[13px] text-text-secondary overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(reply) || '<em class="text-text-muted">Nothing to preview</em>' }}
                    />
                  )}

                  <div className="mt-2 flex justify-end border-t border-border-light pt-4">
                    <button
                      type="button"
                      onClick={handlePostReply}
                      disabled={posting}
                      className="rounded-lg bg-brand px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {posting ? 'Posting…' : 'Submit Reply'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Side column ─────────────────────────────────────────── */}
        <div className="hidden w-[280px] shrink-0 flex-col gap-6 lg:flex">
          {/* Tags */}
          {(question.tags || []).length > 0 && (
            <div className="rounded-lg border border-border-light bg-bg-card p-6">
              <h4 className="mb-4 text-[11px] font-extrabold uppercase tracking-wide text-text-muted">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {question.tags.map(t => (
                  <span
                    key={t}
                    className="rounded-md bg-brand/10 px-2.5 py-1 text-[12px] font-semibold capitalize text-brand"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Query Status */}
          <div className="rounded-lg border border-border-light bg-bg-card p-6">
            <h4 className="mb-6 text-[11px] font-extrabold uppercase tracking-wide text-text-muted">Query Status</h4>
            <div className="relative pl-5">
              <div className="absolute bottom-2.5 left-2.5 top-2.5 w-px bg-bg-tertiary" />
              {steps.map((s, i) => (
                <div key={i} className={`relative ${i < steps.length - 1 ? 'mb-6' : ''}`}>
                  <div
                    className={`absolute -left-5 top-0 flex h-5 w-5 items-center justify-center rounded-full text-white ${s.done ? (s.green ? 'bg-success' : 'bg-brand') : 'bg-bg-tertiary'
                      }`}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </div>
                  <div className="pl-2">
                    <h5 className={`text-[13px] font-bold ${s.green && s.done ? 'text-success' : 'text-text-primary'}`}>{s.label}</h5>
                    <p className="text-[11px] text-text-muted">{s.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Related Recent Queries */}
          <div className="rounded-lg border border-border-light bg-bg-card p-6">
            <h4 className="mb-5 text-[11px] font-extrabold uppercase tracking-wide text-text-muted">Related Recent Queries</h4>
            {related.length === 0 ? (
              <p className="text-[12px] text-text-muted">No related queries found.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {related.map(q => (
                  <li key={q.question_id}>
                    <button
                      type="button"
                      title={q.title}
                      onClick={() => navigate(`/query/${q.question_id}`, {
                        state: { activeSidebarNav },
                      })}
                      className="flex w-full items-center gap-2 text-left transition hover:text-brand"
                    >
                      <MessageCircle className="h-3.5 w-3.5 shrink-0 text-text-muted" strokeWidth={1.8} />
                      <span className="truncate text-[13px] font-medium text-text-secondary">{q.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ReportModal
        open={!!reportTarget}
        submitting={reporting}
        onClose={() => setReportTarget(null)}
        onSubmit={handleReportSubmit}
      />
    </div>
  )
}

// ── Thread item (OP or answer) ──────────────────────────────────────────────
function ThreadItem({
  authorName, isSelf, authorRole, date, body, isOriginal, accepted, score, myVote = 0,
  moderationState = 'visible', canAccept = false, onAccept, onVoteUp, onVoteDown, onReport, children,
}) {
  const initials = initialsOf(authorName)
  const hidden = moderationState !== 'visible'
  const tombstone = moderationState === 'deleted'
    ? `This reply from ${authorName} was deleted.`
    : `This reply from ${authorName} is under review.`

  return (
    <div className="relative mb-8">
      <div className={`absolute -left-[60px] top-0 flex h-12 w-12 items-center justify-center rounded-lg text-[14px] font-bold text-white ring-4 ring-border-light ${hidden ? 'bg-text-muted' : 'bg-[#191c1d]'}`}>
        {initials}
      </div>

      <div className={`overflow-hidden rounded-xl border bg-bg-card shadow-sm ${hidden ? 'border-dashed border-border' : 'border-border-light'}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-bold text-text-primary">
              {authorName}{isSelf && ' (You)'}
            </span>
            <span className="text-[12px] text-text-muted">
              {isOriginal ? 'opened this' : 'commented'} {date}
            </span>
          </div>
          {accepted && !hidden && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-success">
              <Check className="h-3.5 w-3.5" strokeWidth={3} /> SOLUTION
            </span>
          )}
          {hidden && (
            <span className={`flex items-center gap-1.5 text-[11px] font-bold ${moderationState === 'deleted' ? 'text-text-muted' : 'text-warning'}`}>
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.8} />
              {moderationState === 'deleted' ? 'DELETED' : 'UNDER REVIEW'}
            </span>
          )}
        </div>

        {/* Body — tombstone when hidden */}
        {hidden ? (
          <p className="px-5 py-5 text-[13px] italic leading-6 text-text-muted">{tombstone}</p>
        ) : (
          <div
            className="markdown-body px-5 py-5 text-[14px] leading-6 text-text-secondary"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(body) }}
          />
        )}

        {/* Footer (visible answers only) */}
        {!isOriginal && !hidden && (
          <div className="flex items-center justify-between border-t border-border-light bg-bg-tertiary px-5 py-3">
            <div className="flex items-center gap-2 text-[14px] font-bold text-text-primary">
              <button
                type="button"
                onClick={onVoteUp}
                title={myVote === 1 ? 'Remove upvote' : 'Upvote'}
                className={`transition ${myVote === 1 ? 'text-brand' : 'text-text-muted hover:text-brand'}`}
              >
                <ChevronUp className="h-5 w-5" strokeWidth={myVote === 1 ? 3 : 2} />
              </button>
              <span className={myVote === 1 ? 'text-brand' : myVote === -1 ? 'text-danger' : ''}>{score}</span>
              <button
                type="button"
                onClick={onVoteDown}
                title={myVote === -1 ? 'Remove downvote' : 'Downvote'}
                className={`transition ${myVote === -1 ? 'text-danger' : 'text-text-muted hover:text-danger'}`}
              >
                <ChevronDown className="h-5 w-5" strokeWidth={myVote === -1 ? 3 : 2} />
              </button>
            </div>
            <div className="flex items-center gap-4">
              {/* Owner: accept this answer as the resolution */}
              {canAccept && (
                <button
                  type="button"
                  onClick={onAccept}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-success transition hover:text-success"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} /> MARK AS RESOLUTION
                </button>
              )}
              {isSelf ? (
                <span className="text-[11px] italic text-text-muted">Cannot report own reply</span>
              ) : authorRole === 'ADMIN' ? (
                <span className="text-[11px] italic text-text-muted">Cannot report admin</span>
              ) : (
                <button
                  type="button"
                  onClick={onReport}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-text-muted transition hover:text-danger"
                >
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.8} /> REPORT
                </button>
              )}
            </div>
          </div>
        )}

        {/* Comments / replies under this answer */}
        {!isOriginal && children}
      </div>
    </div>
  )
}

export default QueryDetailPage
