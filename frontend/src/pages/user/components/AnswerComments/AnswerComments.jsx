import { useState } from 'react'
import { CornerDownRight, MessageSquare } from 'lucide-react'
import { parseMarkdown } from '../../../../lib/markdown'

function initialsOf(name = '') {
  return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
}

/**
 * Threaded comments under a single answer.
 *  - comments: all Comment docs for this answer (depth 0 = top-level, depth 1 = reply)
 *  - onSubmit(answerId, body, parentId)
 *
 * NOTE: render helpers below are plain functions returning JSX (not nested
 * components) so the reply <textarea> keeps focus across keystrokes.
 */
function AnswerComments({ answerId, comments = [], currentUserId, locked = false, onSubmit }) {
  const [replyTo, setReplyTo] = useState(null)   // parentId being replied to, or 'root'
  const [value, setValue]     = useState('')
  const [busy, setBusy]       = useState(false)

  const topLevel = comments.filter(c => !c.parent_id)
  const repliesOf = id => comments.filter(c => c.parent_id === id)

  // Nothing to show: resolved question with no existing comments on this answer
  if (locked && comments.length === 0) return null

  function openReply(parentKey) {
    setReplyTo(parentKey)
    setValue('')
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
          ) : (
            <p className="markdown-body text-[12px] leading-5 text-text-secondary" dangerouslySetInnerHTML={{ __html: parseMarkdown(c.body) }} />
          )}
          {/* Only visible top-level comments can receive a (one-level) reply */}
          {!isReply && !hidden && !locked && (
            <button
              type="button"
              onClick={() => openReply(c.comment_id)}
              className="mt-1 flex items-center gap-1 font-medium text-text-muted transition hover:text-brand"
            >
              <CornerDownRight className="h-3 w-3" strokeWidth={1.8} />
              <span className="!text-[10px] leading-none">Reply</span>
            </button>
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
    </div>
  )
}

export default AnswerComments
