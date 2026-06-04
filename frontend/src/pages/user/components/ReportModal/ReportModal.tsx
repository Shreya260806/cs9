import type { FC } from 'react'
import { useState } from 'react'
import Modal from '../../../../components/Modal/Modal'
import Button from '../../../../components/Button/Button'
import Select from '../../../../components/Select/Select'

// ─── Types ──────────────────────────────────────────────────────────────────

const REASONS = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'incorrect',     label: 'Incorrect information' },
  { value: 'spam',          label: 'Spam' },
  { value: 'other',         label: 'Other' },
] as const

interface ReportModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: { reason: string; description: string }) => void
  submitting: boolean
  targetType?: 'question' | 'answer'
}

// ─── Component ───────────────────────────────────────────────────────────────

const ReportModal: FC<ReportModalProps> = ({ open, onClose, onSubmit, submitting, targetType }) => {
  const [reason, setReason]   = useState('')
  const [details, setDetails] = useState('')

  function handleSubmit() {
    onSubmit({ reason, description: details })
  }

  const filteredReasons = targetType === 'question'
    ? REASONS.filter(r => r.value !== 'incorrect')
    : REASONS

  return (
    <Modal isOpen={open} onClose={onClose} position="center" title="Report Content">
      {/* Reason dropdown */}
      <Select
        options={[...filteredReasons]}
        value={reason}
        onChange={setReason}
        placeholder="Select a reason"
        className="mb-4"
      />

      {/* Details textbox */}
      <textarea
        value={details}
        onChange={e => setDetails(e.target.value)}
        placeholder="Additional details (optional)…"
        className="mb-6 h-20 w-full resize-none rounded-lg border border-border bg-bg-card p-3 text-[13px] text-text-primary outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-1 focus:ring-brand/15"
      />

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onClose} className="text-[13px]">
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-red-600 text-[13px] hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send Report'}
        </Button>
      </div>
    </Modal>
  )
}

export default ReportModal
