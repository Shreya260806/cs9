import { useState } from 'react'
import { CornerDownRight, MessageSquare, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { parseMarkdown } from '../../../../lib/markdown'
import Modal from '../../../../components/Modal/Modal'
import Button from '../../../../components/Button/Button'

function initialsOf(name = '') {
  return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'
}

function fmtDate(d) {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''

  // Format the time part in 24-hour IST format (HH:MM)
  const timePart = date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  // Get date parts in Asia/Kolkata timezone to compare days correctly
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  })
  const parts = formatter.formatToParts(date)
  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]))
  
  const targetYear = parseInt(partMap.year, 10)
  const targetMonth = parseInt(partMap.month, 10) - 1 // 0-indexed
  const targetDay = parseInt(partMap.day, 10)

  // Get current date parts in Asia/Kolkata timezone
  const now = new Date()
  const nowParts = formatter.formatToParts(now)
  const nowPartMap = Object.fromEntries(nowParts.map(p => [p.type, p.value]))
  const nowYear = parseInt(nowPartMap.year, 10)
  const nowMonth = parseInt(nowPartMap.month, 10) - 1
  const nowDay = parseInt(nowPartMap.day, 10)

  // Create clean Date objects representing just the calendar days in IST
  const targetDateIST = new Date(targetYear, targetMonth, targetDay)
  const nowDateIST = new Date(nowYear, nowMonth, nowDay)

  const diffTime = nowDateIST.getTime() - targetDateIST.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  // Format month and day
  const dateOptions = { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }
  if (targetYear !== nowYear) {
    dateOptions.year = 'numeric'
  }
  const datePart = date.toLocaleDateString('en-IN', dateOptions)

  if (diffDays === 0) {
    return `Today at ${timePart}`
  } else if (diffDays === 1) {
    return `Yesterday at ${timePart}`
  } else {
    return `${datePart} at ${timePart}`
  }
}

/**
 * Threaded comments under a single answer.
 *  - comments: all Comment docs for this answer (depth 0 = top-level, depth 1 = reply)
 *  - onSubmit(answerId, body, parentId)
 *
 * NOTE: render helpers below are plain functions returning JSX (not nested
 * components) so the reply <textarea> keeps focus across keystrokes.
 */
function AnswerComments({ answerId, comments = [], currentUserId, locked = false, onSubmit, onEdit, onDelete }) {
  const [replyTo, setReplyTo] = useState(null)   // parentId being replied to, or 'root'
  const [value, setValue]     = useState('')
  const [busy, setBusy]       = useState(false)

  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  const [commentToDelete, setCommentToDelete] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const topLevel = comments.filter(c => !c.parent_id)
  const repliesOf = id => comments.filter(c => c.parent_id === id)

  // Nothing to show: resolved question with no existing comments on this answer
  if (locked && comments.length === 0) return null

  const isEditable = (c) => {
    if (c.author_id !== currentUserId) return false
    if (c.is_deleted || c.moderation_state !== 'visible') return false
    const createdTime = new Date(c.created_at).getTime()
    const diffMs = Date.now() - createdTime
    return diffMs <= 15 * 60 * 1000
  }

  function startEdit(comment) {
    setEditingCommentId(comment.comment_id)
    setEditText(comment.body || '')
    setReplyTo(null)
  }

  async function saveEdit(commentId) {
    if (!editText.trim()) return
    setEditBusy(true)
    try {
      if (onEdit) {
        await onEdit(commentId, editText.trim())
      }
      setEditingCommentId(null)
    } finally {
      setEditBusy(false)
    }
  }

  async function confirmDelete() {
    if (!commentToDelete) return
    setDeleteBusy(true)
    try {
      if (onDelete) {
        await onDelete(commentToDelete)
      }
      setCommentToDelete(null)
    } catch (e) {
      console.error(e)
    } finally {
      setDeleteBusy(false)
    }
  }

  function openReply(parentKey) {
    setReplyTo(parentKey)
    setValue('')
    setEditingCommentId(null)
  }

  async function submit(parentId) {
    if (!value.trim()) return
    setBusy(true)
    try {
      await onSubmit(answerId, value.trim(), parentId)
      setValue('')
      setReplyTo(null)
    } finally {
      setBusy(false)
    }
  }

  const replyBox = (parentId) => (
    <div className="mt-2 flex items-start gap-2">
      <textarea
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Write a reply…"
        className="min-h-[44px] w-full resize-y rounded-lg border border-border-light p-2.5 text-[12px] leading-5 text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => submit(parentId)}
          disabled={busy}
          className="rounded-md bg-brand px-3 py-1.5 font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
        >
          <span className="!text-[10px] leading-none">{busy ? '…' : 'Reply'}</span>
        </button>
        <button
          type="button"
          onClick={() => setReplyTo(null)}
          className="rounded-md px-3 py-1.5 font-medium text-text-muted transition hover:text-text-primary"
        >
          <span className="!text-[10px] leading-none">Cancel</span>
        </button>
      </div>
    </div>
  )

  const commentRow = (c, isReply) => {
    const isSelf = c.author_id === currentUserId
    const state = c.moderation_state || 'visible'
    const hidden = state !== 'visible'
    const tombstone = state === 'deleted'
      ? `This comment from ${c.author_name} was deleted.`
      : `This comment from ${c.author_name} is under review.`

    return (
      <div className={`flex gap-2.5 ${isReply ? 'ml-7' : ''}`}>
        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${hidden ? 'bg-text-muted' : 'bg-[#191c1d]'}`}>
          {initialsOf(c.author_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-semibold text-text-primary">
              {c.author_name}{isSelf && ' (You)'}
            </span>
            <span className="text-[10px] text-text-muted">{fmtDate(c.created_at)}</span>
          </div>
          {hidden ? (
            <p className="text-[12px] italic leading-5 text-text-muted">{tombstone}</p>
          ) : editingCommentId === c.comment_id ? (
            <div className="mt-2 flex items-start gap-2">
              <textarea
                autoFocus
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="min-h-[44px] w-full resize-y rounded-lg border border-border-light p-2.5 text-[12px] leading-5 text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => saveEdit(c.comment_id)}
                  disabled={editBusy}
                  className="rounded-md bg-brand px-3 py-1.5 font-semibold text-white transition hover:bg-brand-hover"
                >
                  <span className="!text-[10px] leading-none">{editBusy ? '…' : 'Save'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCommentId(null)}
                  className="rounded-md px-3 py-1.5 font-medium text-text-muted transition hover:text-text-primary"
                >
                  <span className="!text-[10px] leading-none">Cancel</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="markdown-body text-[12px] leading-5 text-text-secondary" dangerouslySetInnerHTML={{ __html: parseMarkdown(c.body) }} />
          )}

          {/* Action Row */}
          {editingCommentId !== c.comment_id && (
            <div className="mt-2.5 flex items-center gap-2">
              {/* Only visible top-level comments can receive a (one-level) reply */}
              {!isReply && !hidden && !locked && (
                <button
                  type="button"
                  onClick={() => openReply(c.comment_id)}
                  className="flex items-center gap-1.5 rounded-lg border border-border-light bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition-all duration-200 hover:border-brand hover:text-brand hover:bg-brand/5 shadow-xs cursor-pointer"
                >
                  <CornerDownRight className="h-3 w-3 text-text-muted transition-colors hover:text-brand" strokeWidth={1.8} />
                  <span className="leading-none">Reply</span>
                </button>
              )}

              {!hidden && isSelf && (
                <>
                  {isEditable(c) && (
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="flex items-center gap-1.5 rounded-lg border border-border-light bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition-all duration-200 hover:border-brand hover:text-brand hover:bg-brand/5 shadow-xs cursor-pointer"
                    >
                      <Pencil className="h-3 w-3 text-text-muted transition-colors hover:text-brand" strokeWidth={1.8} />
                      <span className="leading-none">Edit</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCommentToDelete(c.comment_id)}
                    className="flex items-center gap-1.5 rounded-lg border border-border-light bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition-all duration-200 hover:border-danger hover:text-danger hover:bg-danger/5 shadow-xs cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3 text-text-muted transition-colors hover:text-danger" strokeWidth={1.8} />
                    <span className="leading-none">Delete</span>
                  </button>
                </>
              )}
            </div>
          )}

          {replyTo === c.comment_id && replyBox(c.comment_id)}
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-border-light bg-bg-card px-5 py-4">
      {topLevel.length > 0 && (
        <div className="mb-3 flex flex-col gap-4">
          {topLevel.map(c => (
            <div key={c.comment_id} className="flex flex-col gap-3">
              {commentRow(c, false)}
              {repliesOf(c.comment_id).map(r => (
                <div key={r.comment_id}>{commentRow(r, true)}</div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add a comment to the answer — hidden once the question is resolved */}
      {!locked && (
        replyTo === 'root' ? (
          replyBox(null)
        ) : (
          <button
            type="button"
            onClick={() => openReply('root')}
            className="flex items-center gap-1.5 font-semibold text-text-muted transition hover:text-brand"
          >
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span className="!text-[10px] leading-none">
              {topLevel.length > 0 ? 'Add a comment' : 'Comment'}
            </span>
          </button>
        )
      )}

      {/* Premium Deletion Confirmation Modal */}
      <Modal
        isOpen={commentToDelete !== null}
        onClose={() => setCommentToDelete(null)}
        title="Delete Comment"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mb-4 dark:bg-red-950/30 dark:text-red-400">
            <AlertTriangle className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <h3 className="text-[16px] font-bold text-text-primary mb-2">Delete Comment</h3>
          <p className="text-[13px] text-text-muted mb-6 leading-5">
            Are you sure you want to delete this comment? This action cannot be undone.
          </p>
          <div className="flex w-full gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={() => setCommentToDelete(null)}
              className="flex-1 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteBusy}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 text-xs font-semibold focus:ring-red-500 cursor-pointer disabled:opacity-60"
            >
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AnswerComments
