import { useCallback, useEffect, useState } from 'react'
import { FileText, Pencil, Trash2, Loader, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from '../../../../components/Modal/Modal'
import Button from '../../../../components/Button/Button'
import Input from '../../../../components/Input/Input'
import { notifyError, notifySuccess } from '../../../../lib/notify'
import { fetchFAQs, updateFAQ, deleteFAQ } from '../../service'

const EMPTY_FORM = { title: '', body: '', tags: '' }
const PAGE_SIZE = 10

function FAQManagementView() {
  const [faqs, setFaqs]       = useState([])
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(null)   // faq under edit, or null
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)

  const [deleting, setDeleting] = useState(null)  // faq pending delete, or null
  const [removing, setRemoving] = useState(false)

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
      setFaqs(await fetchFAQs({ limit: 100 }))
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
      body: faq.body || '',
      tags: (faq.tags || []).join(', '),
    })
  }

  function closeEdit() {
    setEditing(null)
    setForm(EMPTY_FORM)
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
        body: form.body.trim(),
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      setFaqs((prev) => prev.map((f) => (f.question_id === editing.question_id ? { ...f, ...updated } : f)))
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
      <div className="mb-6">
        <h1 className="font-display text-[24px] font-semibold text-text-primary">FAQ Management</h1>
        <p className="mt-2 text-[13px] text-text-secondary">View, edit, and remove published FAQ entries.</p>
      </div>

      <section className="rounded-lg border border-border-light bg-bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <h2 className="flex items-center gap-2 text-[16px] font-bold text-text-primary">
            <FileText className="h-4 w-4 text-brand" strokeWidth={1.8} />
            All FAQs
          </h2>
          <span className="rounded-full bg-bg-tertiary px-2.5 py-1 text-[11px] font-bold text-text-muted">
            {faqs.length}
          </span>
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
                  <p
                    className="mt-1 line-clamp-2 text-[12px] text-text-secondary"
                    dangerouslySetInnerHTML={{ __html: faq.body || '' }}
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
      <Modal isOpen={!!editing} onClose={closeEdit} title="Edit FAQ" panelClassName="sm:p-8">
        <h3 className="mb-5 text-[18px] font-bold text-text-primary">Edit FAQ</h3>
        <form onSubmit={saveEdit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-text-secondary">Question</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="FAQ question"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-text-secondary">Answer</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={6}
              placeholder="FAQ answer"
              className="w-full rounded-lg border border-border bg-bg-card px-4 py-3 text-[13px] shadow-sm outline-none transition placeholder:text-text-muted focus:border-text-primary focus:ring-1 focus:ring-text-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-text-secondary">
              Tags <span className="font-normal text-text-muted">(comma-separated)</span>
            </label>
            <Input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="internship, joining"
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeEdit} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
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
