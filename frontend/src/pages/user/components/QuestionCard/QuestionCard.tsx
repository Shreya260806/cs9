import type { FC } from 'react'
import { ChevronUp, MessageCircle, Reply, CheckCircle, Clock } from 'lucide-react'
import { STATUS_CONFIG } from '../../constants'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface QuestionTag {
  label: string
  type: 'dark'
}

export interface NormalizedQuestion {
  id: string
  upvotes: number
  hasUpvoted: boolean
  author: 'self' | 'other'
  authorName: string
  timestamp: number
  tags: QuestionTag[]
  meta: string
  title: string
  desc: string
  comments: number
  status: 'Active' | 'In Progress' | 'Resolved' | 'Closed'
}

interface QuestionCardProps {
  query: NormalizedQuestion
  onUpvote: (id: string) => void
  onClick?: (id: string) => void
}

// ─── Component ─────────────────────────────────────────────────────────────

const QuestionCard: FC<QuestionCardProps> = ({ query, onUpvote, onClick }) => {
  const { color: statusColor } = STATUS_CONFIG[query.status] ?? STATUS_CONFIG.Active
  const StatusIcon =
    query.status === 'Active' ? CheckCircle
    : query.status === 'In Progress' ? Clock
    : CheckCircle

  return (
    <div
      className="mb-4 flex cursor-pointer rounded-xl border border-border bg-bg-card p-5 transition hover:border-brand hover:shadow-sm"
      onClick={() => onClick?.(query.id)}
    >
      {/* Upvote */}
      <button
        data-tour="upvote-btn"
        type="button"
        onClick={(e) => { e.stopPropagation(); onUpvote(query.id) }}
        className="mr-5 flex h-[60px] min-w-[60px] cursor-pointer flex-col items-center justify-center rounded-lg text-[18px] font-bold transition-all"
        style={{
          background: query.hasUpvoted ? '#8c6a40' : '#d1d5db',
          color:      query.hasUpvoted ? '#fff'    : '#111827',
        }}
      >
        <ChevronUp
          className="h-6 w-6"
          strokeWidth={2}
          style={{ color: query.hasUpvoted ? '#fff' : '#111827' }}
        />
        <span>{query.upvotes}</span>
      </button>

      {/* Content — clickable via parent div */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {query.tags.map((tag, i) => (
              <span
                key={i}
                className="rounded bg-black px-2 py-0.5 text-[10px] font-semibold capitalize text-white"
              >
                {tag.label}
              </span>
            ))}
          </div>
          <span className="shrink-0 text-[12px] font-medium text-text-muted">
            <span className="text-text-primary">{query.authorName}</span> · {query.meta}
          </span>
        </div>

        <h3 className="font-display mb-2 text-[18px] font-semibold text-text-primary break-words">{query.title}</h3>
        <p className="mb-4 text-[13px] leading-6 text-text-secondary break-words" dangerouslySetInnerHTML={{ __html: query.desc }} />

        <div className="flex items-center gap-5 text-[12px] font-medium text-text-secondary">
          {/* Total replies (answer_count) */}
          <span className="flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
            {query.comments} {query.comments === 1 ? 'reply' : 'replies'}
          </span>

          {/* Reply indicator — card is fully clickable */}
          <span className="flex items-center gap-1.5">
            <Reply className="h-3.5 w-3.5" strokeWidth={1.8} />
            Reply
          </span>

          <span className="flex items-center gap-1.5" style={{ color: statusColor }}>
            <StatusIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
            {query.status}
          </span>
        </div>
      </div>
    </div>
  )
}

export default QuestionCard