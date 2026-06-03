import { useCallback, useEffect, useState } from 'react'
import { FileText, Pencil, Trash2, Loader, AlertTriangle, ChevronLeft, ChevronRight, Plus, Tag, Save, X } from 'lucide-react'
import Modal from '../../../../components/Modal/Modal'
import Button from '../../../../components/Button/Button'
import { notifyError, notifySuccess } from '../../../../lib/notify'
import { fetchFAQs, updateFAQ, deleteFAQ, createFAQ, fetchTags, createTag, renameTag, deleteTag } from '../../service'
import { parseMarkdown } from '../../../../lib/markdown'
import { queryClient } from '../../../../lib/queryClient'

const EMPTY_FORM = { title: '', body: '', tags: '' }
const PAGE_SIZE = 10
const EMPTY_TAG_FORM = { name: '', description: '' }

// Shared field styling (Stitch "Add FAQ" redesign), mapped to our theme tokens.
const LABEL_CLS = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted transition-colors group-focus-within:text-text-primary'
const INPUT_CLS = 'w-full rounded-lg border border-border bg-bg-primary px-4 py-2.5 text-[13px] text-text-primary placeholder:text-text-muted outline-none transition focus:border-text-primary focus:ring-1 focus:ring-text-primary'

// Convert HTML tags to Markdown for editing
function htmlToMarkdown(html = '') {
  if (!html) return ''
  let text = html
  // Replace list items
  text = text.replace(/<li>\s*(.*?)\s*<\/li>/gi, '* $1\n')
  // Replace headers
  text = text.replace(/<h1>\s*(.*?)\s*<\/h1>/gi, '# $1\n\n')
  text = text.replace(/<h2>\s*(.*?)\s*<\/h2>/gi, '## $1\n\n')
  text = text.replace(/<h3>\s*(.*?)\s*<\/h3>/gi, '### $1\n\n')
  // Replace bold/italic/code
  text = text.replace(/<strong[^>]*>\s*(.*?)\s*<\/strong>/gi, '**$1**')
  text = text.replace(/<b[^>]*>\s*(.*?)\s*<\/b>/gi, '**$1**')
  text = text.replace(/<em[^>]*>\s*(.*?)\s*<\/em>/gi, '*$1*')
  text = text.replace(/<i[^>]*>\s*(.*?)\s*<\/i>/gi, '*$1*')
  text = text.replace(/<code[^>]*>\s*(.*?)\s*<\/code>/gi, '`$1`')
  // Replace paragraphs and line breaks
  text = text.replace(/<p[^>]*>/gi, '')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  // Strip any other tags
  text = text.replace(/<[^>]*>/g, '')
  // Clean up entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  return text.trim()
}

// Sectioned create/edit FAQ modal — header (serif title + subtitle), grouped
// fields with focus-aware labels, leading tag icon, and a ghost/black footer.
function FaqFormModal({ open, onClose, title, subtitle, form, setForm, onSubmit, busy, submitLabel }) {
  const [tab, setTab] = useState('write') // 'write' | 'preview'

  // Reset tab to write when opening/closing
  useEffect(() => {
    if (!open) {
      setTab('write')
    }
  }, [open])

  return (
    <Modal isOpen={open} onClose={onClose} title={title} panelClassName="!max-w-xl !rounded-xl !p-0 overflow-hidden">
      <form onSubmit={onSubmit}>
        <div className="border-b border-border-light px-8 pb-6 pt-8">
          <h2 className="font-display text-[26px] font-bold leading-tight text-text-primary">{title}</h2>
          <p className="mt-1 text-[13px] text-text-secondary">{subtitle}</p>
        </div>

        <div className="space-y-5 px-8 py-7">
          <div className="group">
            <label className={LABEL_CLS}>QUESTION</label>
            <input
              className={INPUT_CLS}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g., How do I submit my weekly report?"
            />
          </div>
          <div className="group">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted transition-colors group-focus-within:text-text-primary">
                ANSWER
              </label>
              <div className="flex border border-border-light rounded-lg overflow-hidden p-0.5 bg-bg-primary">
                <button
                  type="button"
                  onClick={() => setTab('write')}
                  className={`px-3 py-1 text-[11px] font-bold rounded transition ${
                    tab === 'write'
                      ? 'bg-bg-card text-brand shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setTab('preview')}
                  className={`px-3 py-1 text-[11px] font-bold rounded transition ${
                    tab === 'preview'
                      ? 'bg-bg-card text-brand shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>

            {tab === 'write' ? (
              <textarea
                className={`${INPUT_CLS} resize-none`}
                rows={6}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Detail the step-by-step process or policy here… Markdown is supported."
              />
            ) : (
              <div
                className="markdown-body min-h-[148px] w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[13px] text-text-secondary overflow-y-auto leading-6 [&_a]:text-brand [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(form.body) || '<em class="text-text-muted">Nothing to preview</em>' }}
              />
            )}
          </div>
          <div className="group">
            <label className={LABEL_CLS}>
              TAGS <span className="ml-0.5 text-[10px] font-medium normal-case tracking-normal text-text-muted">(comma-separated)</span>
            </label>
            <div className="relative flex items-center">
              <Tag className="pointer-events-none absolute left-3 h-4 w-4 text-text-muted" strokeWidth={1.8} />
              <input
                className={`${INPUT_CLS} pl-10`}
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="internship, onboarding, reports"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-8 pb-8">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-6 py-2.5 text-[14px] font-medium text-text-secondary transition hover:bg-hover-bg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-black px-8 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-[#2e3132] disabled:opacity-50"
          >
            {busy ? `${submitLabel}…` : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function FAQManagementView() {
  const [faqs, setFaqs]       = useState([])
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(null)   // faq under edit, or null
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)

  const [deleting, setDeleting] = useState(null)  // faq pending delete, or null
  const [removing, setRemoving] = useState(false)

  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [creatingSaving, setCreatingSaving] = useState(false)

  const [tagPanel, setTagPanel]         = useState(false)
  const [tags, setTags]                 = useState([])
  const [tagsLoading, setTagsLoading]   = useState(false)
  const [tagForm, setTagForm]           = useState(EMPTY_TAG_FORM)
  const [tagCreatingSaving, setTagCreatingSaving] = useState(false)
  const [editingTag, setEditingTag]     = useState(null)   // { name, description }
  const [editTagName, setEditTagName]   = useState('')
  const [editTagSaving, setEditTagSaving] = useState(false)
  const [deletingTag, setDeletingTag]   = useState(null)   // tag name pending delete
  const [deleteTagSaving, setDeleteTagSaving] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(faqs.length / PAGE_SIZE))
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const paginated = faqs.slice(pageStart, pageStart + PAGE_SIZE)

  // Keep the current page in range as the list shrinks (e.g. after a delete).
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setFaqs(await fetchFAQs({ limit: 1000 }))
    } catch {
      setFaqs([])
      notifyError('Could not load FAQs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openEdit(faq) {
    setEditing(faq)
    setForm({
      title: faq.title || '',
      body: htmlToMarkdown(faq.body || ''),
      tags: (faq.tags || []).join(', '),
    })
  }

  function closeEdit() {
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function closeCreate() {
    setCreating(false)
    setCreateForm(EMPTY_FORM)
  }

  async function saveCreate(event) {
    event.preventDefault()
    if (!createForm.title.trim() || !createForm.body.trim()) {
      notifyError('Title and answer are required.')
      return
    }
    setCreatingSaving(true)
    try {
      const created = await createFAQ({
        title: createForm.title.trim(),
        body: parseMarkdown(createForm.body.trim()),
        tags: createForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      setFaqs((prev) => [created, ...prev])
      queryClient.invalidateQueries({ queryKey: ['landing-faqs'] })
      notifySuccess('FAQ created.')
      closeCreate()
    } catch {
      notifyError('Failed to create FAQ.')
    } finally {
      setCreatingSaving(false)
    }
  }

  async function saveEdit(event) {
    event.preventDefault()
    if (!form.title.trim() || !form.body.trim()) {
      notifyError('Title and answer are required.')
      return
    }
    setSaving(true)
    try {
      const updated = await updateFAQ(editing.question_id, {
        title: form.title.trim(),
        body: parseMarkdown(form.body.trim()),
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      setFaqs((prev) => prev.map((f) => (f.question_id === editing.question_id ? { ...f, ...updated } : f)))
      queryClient.invalidateQueries({ queryKey: ['landing-faqs'] })
      notifySuccess('FAQ updated.')
      closeEdit()
    } catch {
      notifyError('Failed to update FAQ.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    setRemoving(true)
    try {
      await deleteFAQ(deleting.question_id)
      setFaqs((prev) => prev.filter((f) => f.question_id !== deleting.question_id))
      queryClient.invalidateQueries({ queryKey: ['landing-faqs'] })
      notifySuccess('FAQ deleted.')
      setDeleting(null)
    } catch {
      notifyError('Failed to delete FAQ.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-semibold text-text-primary">FAQ Management</h1>
          <p className="mt-2 text-[13px] text-text-secondary">View, edit, and remove published FAQ entries.</p>
        </div>
        <div className="mt-1 flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => { setCreating(true); setCreateForm(EMPTY_FORM) }}
            aria-label="Add FAQ"
            className="flex items-center gap-1.5 rounded-lg border border-brand px-3 py-1.5 text-[10px] font-bold text-brand transition hover:bg-brand/5"
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
            Add FAQ
          </button>
          <button
            type="button"
            onClick={() => {
              setTagPanel(true)
              setTagsLoading(true)
              fetchTags().then(setTags).catch(() => notifyError('Failed to load tags')).finally(() => setTagsLoading(false))
            }}
            aria-label="Tag management"
            className="flex items-center gap-1.5 rounded-lg border border-brand px-3 py-1.5 text-[10px] font-bold text-brand transition hover:bg-brand/5"
          >
            <Tag className="h-3 w-3" strokeWidth={2.5} />
            Tag Management
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-border-light bg-bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="flex items-center gap-2 text-[16px] font-bold text-text-primary">
              <FileText className="h-4 w-4 text-brand" strokeWidth={1.8} />
              All FAQs
            </h2>
            <span className="rounded-full bg-bg-tertiary px-2.5 py-1 text-[11px] font-bold text-text-muted">
              {faqs.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-text-muted">
            <Loader className="h-4 w-4 animate-spin" /> Loading FAQs…
          </div>
        ) : faqs.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-text-muted">
            No FAQs published yet.
          </p>
        ) : (
          <div className="divide-y divide-border-light">
            {paginated.map((faq) => (
              <div key={faq.question_id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-text-primary">{faq.title}</p>
                  <div
                    className="markdown-body mt-1 line-clamp-2 text-[12px] text-text-secondary [&_p]:inline"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(faq.body || '') }}
                  />
                  {(faq.tags || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {faq.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-bg-tertiary px-2 py-0.5 text-[10px] font-semibold capitalize text-text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(faq)}
                    aria-label="Edit FAQ"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-hover-bg hover:text-text-primary"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(faq)}
                    aria-label="Delete FAQ"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && faqs.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 border-t border-border-light px-5 py-4">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              aria-label="Previous FAQ page"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-light text-text-muted transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-light disabled:hover:text-text-muted"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <span className="text-[11px] font-medium text-text-muted">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next FAQ page"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-light text-text-muted transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-light disabled:hover:text-text-muted"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        )}
      </section>

      {/* Edit modal */}
      <FaqFormModal
        open={!!editing}
        onClose={closeEdit}
        title="Edit FAQ"
        subtitle="Update this published FAQ entry."
        form={form}
        setForm={setForm}
        onSubmit={saveEdit}
        busy={saving}
        submitLabel="Save changes"
      />

      {/* Create FAQ modal */}
      <FaqFormModal
        open={!!creating}
        onClose={closeCreate}
        title="Create New FAQ"
        subtitle="Provide clear information for prospective interns."
        form={createForm}
        setForm={setCreateForm}
        onSubmit={saveCreate}
        busy={creatingSaving}
        submitLabel="Create FAQ"
      />

      {/* Tag management panel */}
      <Modal
        isOpen={!!tagPanel}
        onClose={() => setTagPanel(false)}
        title="Tag Management"
        panelClassName="!max-w-lg !rounded-xl !p-0 overflow-hidden"
      >
        <div className="flex flex-col gap-0">
          {/* Create tag form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!tagForm.name.trim()) { notifyError('Tag name is required'); return }
              setTagCreatingSaving(true)
              try {
                const tag = await createTag({ name: tagForm.name.trim(), description: tagForm.description.trim() })
                setTags(prev => [{ ...tag, questionCount: 0 }, ...prev])
                setTagForm(EMPTY_TAG_FORM)
                notifySuccess('Tag created.')
              } catch (err) {
                notifyError(err?.response?.data?.message || 'Failed to create tag.')
              } finally {
                setTagCreatingSaving(false)
              }
            }}
            className="flex gap-2 border-b border-border px-6 py-4"
          >
            <input
              value={tagForm.name}
              onChange={e => setTagForm(f => ({ ...f, name: e.target.value }))}
              placeholder="New tag name…"
              maxLength={30}
              className="flex-1 rounded-lg border border-border bg-bg-primary px-3 py-2 text-[13px] text-text-primary outline-none transition focus:border-brand"
            />
            <button
              type="submit"
              disabled={tagCreatingSaving}
              className="shrink-0 rounded-lg bg-brand px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
            >
              {tagCreatingSaving ? '…' : 'Add'}
            </button>
          </form>

          {/* Tag list */}
          <div className="max-h-72 overflow-y-auto px-6 py-3">
            {tagsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-text-muted">
                <Loader className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : tags.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-text-muted">No tags yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {tags.map(tag => (
                  <li key={tag.name} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-bg-primary">
                    <div className="flex min-w-0 flex-col">
                      {editingTag === tag.name ? (
                        <input
                          value={editTagName}
                          onChange={e => setEditTagName(e.target.value)}
                          maxLength={30}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') document.getElementById(`tag-save-${tag.name}`)?.click()
                            if (e.key === 'Escape') setEditingTag(null)
                          }}
                          className="w-full max-w-[200px] rounded-lg border border-brand bg-bg-card px-2 py-0.5 text-[13px] font-semibold text-text-primary outline-none"
                        />
                      ) : (
                        <span className="text-[13px] font-semibold text-text-primary truncate">
                          {tag.displayName || tag.name}
                        </span>
                      )}
                      <span className="text-[11px] text-text-muted">
                        {tag.questionCount} question{tag.questionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {editingTag === tag.name ? (
                        <>
                          <button
                            id={`tag-save-${tag.name}`}
                            type="button"
                            disabled={editTagSaving || !editTagName.trim() || editTagName.trim() === tag.name}
                            onClick={async () => {
                              if (!editTagName.trim() || editTagName.trim() === tag.name) { setEditingTag(null); return }
                              setEditTagSaving(true)
                              try {
                                await renameTag(tag.name, editTagName.trim())
                                setTags(prev => prev.map(t =>
                                  t.name === tag.name ? { ...t, name: editTagName.trim().toLowerCase(), displayName: editTagName.trim() } : t
                                ))
                                setEditingTag(null)
                                notifySuccess('Tag renamed.')
                              } catch (err) {
                                notifyError(err?.response?.data?.message || 'Failed to rename tag.')
                              } finally {
                                setEditTagSaving(false)
                              }
                            }}
                            aria-label="Save tag"
                            className="rounded-lg border border-brand bg-brand p-1.5 text-white transition hover:bg-brand/90 disabled:opacity-40"
                          >
                            <Save className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTag(null)}
                            aria-label="Cancel"
                            className="rounded-lg border border-border p-1.5 text-text-secondary transition hover:border-border hover:text-text-primary"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTag(tag.name)
                              setEditTagName(tag.displayName || tag.name)
                            }}
                            aria-label="Rename tag"
                            className="rounded-lg border border-border p-1.5 text-text-secondary transition hover:border-brand hover:text-brand"
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTag(tag.name)}
                            aria-label="Delete tag"
                            className="rounded-lg border border-danger/30 p-1.5 text-danger transition hover:bg-danger/5"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete tag confirmation */}
      <Modal isOpen={!!deletingTag} onClose={() => setDeletingTag(null)} title="Delete Tag">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
            <AlertTriangle className="h-6 w-6 text-danger" strokeWidth={1.8} />
          </div>
          <h3 className="text-[18px] font-bold text-text-primary">Delete tag “{deletingTag}”?</h3>
          <p className="mt-2 text-[13px] text-text-secondary">
            This removes the tag from all questions that use it. Questions without tags will receive “General” on next save.
          </p>
          <div className="mt-6 flex w-full justify-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeletingTag(null)} disabled={deleteTagSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                setDeleteTagSaving(true)
                try {
                  await deleteTag(deletingTag)
                  setTags(prev => prev.filter(t => t.name !== deletingTag))
                  notifySuccess('Tag deleted.')
                  setDeletingTag(null)
                } catch (err) {
                  notifyError(err?.response?.data?.message || 'Failed to delete tag.')
                } finally {
                  setDeleteTagSaving(false)
                }
              }}
              disabled={deleteTagSaving}
              className="bg-danger hover:bg-danger/90"
            >
              {deleteTagSaving ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title="Delete FAQ">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
            <AlertTriangle className="h-6 w-6 text-danger" strokeWidth={1.8} />
          </div>
          <h3 className="text-[18px] font-bold text-text-primary">Delete this FAQ?</h3>
          <p className="mt-2 text-[13px] text-text-secondary">
            “{deleting?.title}” will be removed from the published FAQs. This can’t be undone here.
          </p>
          <div className="mt-6 flex w-full justify-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleting(null)} disabled={removing}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              disabled={removing}
              className="bg-danger hover:bg-danger/90"
            >
              {removing ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default FAQManagementView
