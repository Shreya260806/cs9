import { ChevronDown } from 'lucide-react'
import { parseMarkdown } from '../../../lib/markdown'

function getQuestionLabel(faq) {
  const category = String(faq.category || '').trim()
  const hasReadableCategory = /^\d+(\.\d+)?$/.test(category)
  return hasReadableCategory ? `${category} ${faq.question}` : faq.question
}

function FaqCard({ faq, sectionId, isOpen, onToggle }) {
  const answerId = `faq-answer-${sectionId}-${faq.id}`

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-bg-card transition">
      <button
        type="button"
        className="flex min-h-14 w-full items-center justify-between gap-4 p-4 text-left"
        aria-expanded={isOpen}
        aria-controls={answerId}
        onClick={onToggle}
      >
        <span className="text-[14px] font-semibold leading-relaxed text-text-primary">
          {getQuestionLabel(faq)}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={1.8}
        />
      </button>
      <div
        id={answerId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div
            className="markdown-body px-4 pb-4 text-[13px] leading-6 text-text-secondary [&_a]:text-brand [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(faq.answer || '') }}
          />
        </div>
      </div>
    </article>
  )
}

export default FaqCard
