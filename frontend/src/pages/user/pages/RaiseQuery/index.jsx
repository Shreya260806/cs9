import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field, Label, Textarea, Switch } from '@headlessui/react'
import { CheckCircle2, Lightbulb, EyeOff, Image as ImageIcon, ExternalLink, Sparkles, Send, Bold, Italic, Link, Code, List } from 'lucide-react'
import Input from '../../../../components/Input/Input'
import Select from '../../../../components/Select/Select'
import { createQuestion, fetchQuestionTags } from '../../service'
import { queryClient } from '../../../../lib/queryClient'
import { notifyError } from '../../../../lib/notify'
import { parseMarkdown } from '../../../../lib/markdown'

const STATUS_BADGE = {
  Resolved:      'bg-success/10 text-success',
  'In Progress': 'bg-warning/10 text-warning',
  Active:        'bg-brand/10 text-brand',
}

const FALLBACK_CATEGORIES = [{ value: 'others', label: 'Others' }]

function stripHtml(s = '') {
  return s.replace(/<[^>]*>/g, '').trim()
}

function categoryOptionsFromTags(tags = []) {
  const options = (tags || []).map(t => ({
    value: t.tag,
    label: t.tag.charAt(0).toUpperCase() + t.tag.slice(1),
  }))
  const hasOthers = options.some(option => option.value.toLowerCase() === 'others')

  return hasOthers ? options : [...options, ...FALLBACK_CATEGORIES]
}

function submitErrorMessage(err) {
  if (err.response?.status === 401) {
    return 'Your session has expired. Please log in again.'
  }
  if (!err.response) {
    return 'Could not reach the server. Please check that the backend is running.'
  }

  return err.response?.data?.message || 'Could not submit your query.'
}

function RaiseQueryPage() {
  const navigate = useNavigate()

  const [categories, setCategories] = useState([]) // { value, label }
  const [category, setCategory]     = useState('')
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [anonymous, setAnonymous]   = useState(false)
  const [attachments, setAttachments] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [activeTab, setActiveTab]   = useState('write')
  const fileInputRef = useRef(null)

  function insertFormat(prefix, suffix = '') {
    const textarea = document.getElementById('query-description-textarea')
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value

    const selectedText = text.substring(start, end)
    const replacement = prefix + (selectedText || '') + suffix

    setDescription(text.substring(0, start) + replacement + text.substring(end))

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selectedText || '').length
      )
    }, 0)
  }

  // Similar queries come from the cached dashboard questions (empty until the
  // dashboard has been visited; cleared + refetched when Dashboard is reopened).
  const cachedQuestions = queryClient.getQueryData(['dashboardQuestions']) || []

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function handleFileChange(files) {
    const maxSize = 5 * 1024 * 1024
    const maxTotalSize = 12 * 1024 * 1024
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg']
    const nextFiles = []

    for (const file of Array.from(files)) {
      if (!allowedTypes.includes(file.type)) {
        notifyError('Only PDF, JPG and PNG files are allowed.')
        continue
      }
      if (file.size > maxSize) {
        notifyError(`File ${file.name} must be 5MB or smaller.`)
        continue
      }
      nextFiles.push(file)
    }

    if (nextFiles.length) {
      setAttachments((current) => {
        const combined = [...current, ...nextFiles].slice(0, 5)
        const totalSize = combined.reduce((sum, file) => sum + file.size, 0)
        if (totalSize > maxTotalSize) {
          notifyError('Total attachments must be 12MB or smaller.')
          return current
        }
        return combined
      })
    }
  }

  function removeAttachment(index) {
    setAttachments((current) => current.filter((_, idx) => idx !== index))
  }
  const pool = category
    ? cachedQuestions.filter(q => q.tags?.some(t => t.label.toLowerCase() === category.toLowerCase()))
    : cachedQuestions
  const similar = (pool.length ? pool : cachedQuestions).slice(0, 3)

  // Category options come from the DB tags so the query lands in the right bucket
  useEffect(() => {
    fetchQuestionTags()
      .then(tags => setCategories(categoryOptionsFromTags(tags)))
      .catch(() => setCategories(FALLBACK_CATEGORIES))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    if (!category)                return notifyError('Please choose a category.')
    if (title.trim().length < 10) return notifyError('Title must be at least 10 characters.')
    if (!description.trim())      return notifyError('Please add a description.')

    setSubmitting(true)
    try {
      await createQuestion({
        title: title.trim(),
        body: description.trim(),
        tags: [category],
        isAnonymous: anonymous,
        attachments,
      })
      setSubmitted(true)
      setTimeout(() => navigate('/dashboard'), 2500)
    } catch (err) {
      notifyError(submitErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 py-16">
        <div className="flex max-w-md flex-col items-center rounded-2xl border border-border-light bg-bg-card p-12 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-7 w-7" strokeWidth={1.8} />
          </div>
          <h2 className="font-display mb-2 text-[22px] font-bold text-text-primary">Thank you!</h2>
          <p className="text-[13px] leading-6 text-text-secondary">
            We have noted your concern and will look into it.
          </p>
          <p className="mt-3 text-[12px] text-text-muted">Redirecting to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-8 py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── Form card ─────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-border-light bg-bg-card p-8 shadow-sm">
          <Field className="flex flex-col">
            <Label className="mb-2 text-[13px] font-semibold text-text-secondary">Query Category</Label>
            <Select
              options={categories}
              value={category}
              onChange={setCategory}
              placeholder="Select category…"
            />
          </Field>

          <Field className="flex flex-col">
            <Label className="mb-2 text-[13px] font-semibold text-text-secondary">Query Title</Label>
            <Input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Briefly state your concern (e.g., Delay in Grade Upload)"
            />
          </Field>

          <Field className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[13px] font-semibold text-text-secondary">Detailed Description</Label>
              <div className="flex border border-border-light rounded-lg overflow-hidden p-0.5 bg-bg-primary">
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className={`px-3 py-1 text-[11px] font-bold rounded transition ${
                    activeTab === 'write'
                      ? 'bg-bg-card text-brand shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 text-[11px] font-bold rounded transition ${
                    activeTab === 'preview'
                      ? 'bg-bg-card text-brand shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>

            {activeTab === 'write' ? (
              <div className="relative rounded-lg border border-border bg-bg-card shadow-sm focus-within:border-text-primary focus-within:ring-1 focus-within:ring-text-primary overflow-hidden">
                {/* Formatting Toolbar */}
                <div className="flex items-center gap-1 border-b border-border-light bg-bg-primary px-3 py-1.5">
                  <button
                    type="button"
                    title="Bold"
                    onClick={() => insertFormat('**', '**')}
                    className="p-1 text-text-secondary hover:text-brand hover:bg-bg-tertiary rounded transition"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Italic"
                    onClick={() => insertFormat('*', '*')}
                    className="p-1 text-text-secondary hover:text-brand hover:bg-bg-tertiary rounded transition"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Insert Link"
                    onClick={() => insertFormat('[', '](url)')}
                    className="p-1 text-text-secondary hover:text-brand hover:bg-bg-tertiary rounded transition"
                  >
                    <Link className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Code Block"
                    onClick={() => insertFormat('```\n', '\n```')}
                    className="p-1 text-text-secondary hover:text-brand hover:bg-bg-tertiary rounded transition"
                  >
                    <Code className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Bullet List"
                    onClick={() => insertFormat('- ', '')}
                    className="p-1 text-text-secondary hover:text-brand hover:bg-bg-tertiary rounded transition"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Textarea
                  id="query-description-textarea"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Provide as much detail as possible to help us resolve this quickly. Markdown is supported (e.g. bold, bullet lists, code blocks)..."
                  className="w-full resize-y bg-transparent px-4 py-3 text-[13px] text-text-primary outline-none transition placeholder:text-text-muted"
                />
              </div>
            ) : (
              <div 
                className="markdown-body min-h-[178px] w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[13px] text-text-secondary overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(description) || '<em class="text-text-muted">Nothing to preview</em>' }}
              />
            )}
          </Field>

          <Field className="flex flex-col">
            <Label className="mb-2 text-[13px] font-semibold text-text-secondary">Attachments (Optional)</Label>
            <div className="rounded-xl border-2 border-dashed border-border bg-bg-card p-4">
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-10 text-center transition hover:border-brand hover:bg-brand/5">
                <ImageIcon className="h-7 w-7 text-text-muted" strokeWidth={1.6} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[13px] font-bold text-text-primary underline-offset-4 hover:text-brand"
                >
                  Choose files
                </button>
                <span className="text-[12px] text-text-muted">PDF, JPG, PNG (Max 5MB each, 12MB total)</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="application/pdf,image/png,image/jpeg"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    handleFileChange(e.target.files)
                    e.target.value = ''
                  }
                }}
              />
              {attachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  {attachments.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl bg-bg-primary px-4 py-3 text-sm text-text-secondary">
                      <div>
                        <p className="font-medium text-text-primary">{file.name}</p>
                        <p className="text-[11px] text-text-muted">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-[11px] font-semibold text-brand transition hover:text-brand/80"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {/* Raise anonymously */}
          <div className="flex items-center justify-between rounded-xl bg-[#eef2f7] px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-brand" strokeWidth={1.8} />
                <span className="text-[14px] font-bold text-text-primary">Raise Anonymously</span>
              </div>
              <p className="mt-1 text-[12px] text-text-muted">
                Admins won't see your profile details, but resolution may take longer.
              </p>
            </div>
            <Switch
              checked={anonymous}
              onChange={setAnonymous}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition ${
                anonymous ? 'bg-brand' : 'bg-[#cbd5e1]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-bg-card shadow transition ${
                  anonymous ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </Switch>
          </div>

          {/* Footer actions */}
          <div className="mt-1 flex items-center justify-end gap-5">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-[14px] font-semibold text-text-muted transition hover:text-text-primary"
            >
              Discard Draft
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-[#0b1528] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" strokeWidth={1.8} />
              {submitting ? 'Submitting…' : 'Submit Query'}
            </button>
          </div>
        </form>

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Similar Queries */}
          <div className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 font-display text-[20px] font-bold text-text-primary">
              <Sparkles className="h-5 w-5 text-brand" strokeWidth={1.8} /> Similar Queries
            </h3>
            <p className="mb-5 text-[13px] leading-6 text-text-muted">
              We found some queries similar to yours. Checking these might give you an instant answer.
            </p>

            {similar.length === 0 ? (
              <p className="text-[12px] text-text-muted">No similar queries yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {similar.map(q => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => navigate(`/query/${q.id}`)}
                    className="rounded-xl border border-border-light p-4 text-left transition hover:border-brand hover:shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${STATUS_BADGE[q.status] || STATUS_BADGE.Active}`}>
                        {q.status}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-text-muted" strokeWidth={1.8} />
                    </div>
                    <h4 className="mb-1 text-[14px] font-bold text-text-primary">{q.title}</h4>
                    <p className="line-clamp-2 text-[12px] leading-5 text-text-muted">
                      "{stripHtml(q.desc)}"
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pro Tip — dark card */}
          <div className="rounded-2xl bg-[#0b1528] p-6 text-white">
            <h3 className="mb-3 flex items-center gap-2 font-display text-[16px] font-bold">
              <Lightbulb className="h-4 w-4 text-[#f5c451]" strokeWidth={1.8} /> Pro Tip
            </h3>
            <p className="text-[13px] leading-6 text-text-muted">
              Adding screenshots or PDF receipts usually speeds up the resolution process by up to 40%.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RaiseQueryPage
