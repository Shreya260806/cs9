import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock3,
  Loader,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Eye,
  Minus,
} from 'lucide-react'
import Button from '../../../../components/Button/Button'
import Input from '../../../../components/Input/Input'
import Select from '../../../../components/Select/Select'
import Modal from '../../../../components/Modal/Modal'
import { notifyError, notifySuccess } from '../../../../lib/notify'
import { fetchAdminSettings, updateAdminSettingsSection, previewLeaderboardWeights } from '../../service'

const TABS = [
  { key: 'leaderboard', label: 'Leaderboard Settings', Icon: SlidersHorizontal },
  { key: 'userThresholds', label: 'User Reputation & Threshold Settings', Icon: Users },
  { key: 'questionEscalation', label: 'Question Escalation Settings', Icon: Clock3 },
]

const LEADERBOARD_FIELDS = [
  { path: ['questionsAskedWeight'], label: 'Questions asked', step: '0.1' },
  { path: ['answersGivenWeight'], label: 'Answers given', step: '0.1' },
  { path: ['commentsGivenWeight'], label: 'Comments given', step: '0.1' },
  { path: ['acceptedResolutionsWeight'], label: 'Accepted resolutions', step: '0.1' },
  { path: ['upvotesReceivedWeight'], label: 'Upvotes/upholds received', step: '0.1' },
  { path: ['resolverActivityWeight'], label: 'Resolver activity', step: '0.1' },
  { path: ['sparkPointsWeight'], label: 'Spark points', step: '0.1' },
  { path: ['reputationWeight'], label: 'Reputation score', step: '0.1' },
  { path: ['warningPenaltyWeight'], label: 'Warning/negative penalty', step: '0.1' },
]

const RESOLVER_FIELDS = [
  { path: ['resolverEligibility', 'minAnswersOrComments'], label: 'Minimum comments/answers for resolver badge', integer: true },
  { path: ['resolverEligibility', 'minUpheldContributions'], label: 'Minimum upheld contributions', integer: true },
  { path: ['resolverEligibility', 'minSuccessfulResolverActions'], label: 'Minimum successful resolver actions', integer: true },
  { path: ['resolverEligibility', 'minAcceptedResolutions'], label: 'Minimum accepted resolutions', integer: true },
  { path: ['resolverEligibility', 'minReputationScore'], label: 'Minimum reputation score', integer: true },
  { path: ['resolverEligibility', 'minSparkPoints'], label: 'Minimum spark points', integer: true },
]

const MODERATION_FIELDS = [
  { path: ['moderationThresholds', 'warningsBeforeInactive'], label: 'Warnings before inactive', integer: true },
  { path: ['moderationThresholds', 'rejectedContentReviewThreshold'], label: 'Rejected/downheld/reported content review threshold', integer: true },
  { path: ['moderationThresholds', 'negativeFlagsBeforeAction'], label: 'Negative flags before action', integer: true },
  { path: ['moderationThresholds', 'inactivityDaysBeforeReview'], label: 'Inactivity days before review', integer: true },
]

const ESCALATION_FIELDS = [
  { path: ['unresolvedHoursToEscalate'], label: 'Hours before admin escalation', integer: true, min: 1 },
  { path: ['reminderHoursBeforeEscalation'], label: 'Reminder hours before escalation', integer: true },
]

const NUMERIC_FIELDS_BY_SECTION = {
  leaderboard: LEADERBOARD_FIELDS,
  userThresholds: [...RESOLVER_FIELDS, ...MODERATION_FIELDS],
  questionEscalation: ESCALATION_FIELDS,
}

const STRATEGY_OPTIONS = [
  { value: 'any_admin', label: 'Any active admin' },
  { value: 'round_robin_admin', label: 'Round-robin admin' },
  { value: 'default_admin', label: 'Default admin' },
]

const FORMULA_COMPONENTS = [
  { key: 'questionsAskedWeight',       label: 'Questions asked × weight' },
  { key: 'answersGivenWeight',         label: 'Answers given × weight' },
  { key: 'commentsGivenWeight',         label: 'Comments given × weight' },
  { key: 'acceptedResolutionsWeight',  label: 'Accepted resolutions × weight' },
  { key: 'upvotesReceivedWeight',      label: 'Upvotes received × weight' },
  { key: 'resolverActivityWeight',      label: 'Resolver activity × weight' },
  { key: 'sparkPointsWeight',           label: 'Spark points × weight' },
  { key: 'reputationWeight',            label: 'Reputation score × weight' },
  { key: 'warningPenaltyWeight',        label: 'Warning penalty × weight (−)' },
]

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function fieldKey(path) {
  return path.join('.')
}

function getValue(source, path) {
  return path.reduce((current, key) => current?.[key], source)
}

function setValue(source, path, value) {
  const next = clone(source)
  let cursor = next
  path.slice(0, -1).forEach((key) => {
    cursor[key] = cursor[key] || {}
    cursor = cursor[key]
  })
  cursor[path[path.length - 1]] = value
  return next
}

function validateAndBuildPayload(section, values) {
  const errors = {}
  const payload = clone(values)

  for (const field of NUMERIC_FIELDS_BY_SECTION[section] || []) {
    const value = getValue(payload, field.path)
    const key = fieldKey(field.path)
    const number = Number(value)
    const min = field.min ?? 0

    if (value === '' || value === null || value === undefined || !Number.isFinite(number)) {
      errors[key] = 'Enter a valid number'
      continue
    }
    if (field.integer && !Number.isInteger(number)) {
      errors[key] = 'Enter a whole number'
      continue
    }
    if (number < min) {
      errors[key] = `Must be at least ${min}`
      continue
    }

    let cursor = payload
    field.path.slice(0, -1).forEach((pathPart) => { cursor = cursor[pathPart] })
    cursor[field.path[field.path.length - 1]] = number
  }

  if (section === 'questionEscalation') {
    const reminder = Number(payload.reminderHoursBeforeEscalation)
    const escalation = Number(payload.unresolvedHoursToEscalate)
    if (Number.isFinite(reminder) && Number.isFinite(escalation) && reminder > escalation) {
      errors.reminderHoursBeforeEscalation = 'Must not exceed escalation hours'
    }
    if (payload.assignmentStrategy === 'default_admin' && !payload.defaultAdminUserId?.trim()) {
      errors.defaultAdminUserId = 'Enter an admin user ID'
    }
  }

  return { errors, payload }
}

function NumericField({ field, value, error, disabled, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-text-secondary">
        {field.label}
      </span>
      <Input
        type="number"
        min={field.min ?? 0}
        step={field.step || '1'}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(field.path, event.target.value)}
        className={error ? 'border-danger focus:border-danger focus:ring-danger' : ''}
      />
      {error && <span className="mt-1 block text-[11px] font-medium text-danger">{error}</span>}
    </label>
  )
}

function FieldGrid({ fields, values, errors, disabled, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        <NumericField
          key={fieldKey(field.path)}
          field={field}
          value={getValue(values, field.path)}
          error={errors[fieldKey(field.path)]}
          disabled={disabled}
          onChange={onChange}
        />
      ))}
    </div>
  )
}

function ToggleRow({ label, description, checked, disabled, onChange }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border-light bg-bg-primary px-4 py-3">
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-border text-brand focus:ring-brand disabled:opacity-60"
      />
      <span>
        <span className="block text-[13px] font-semibold text-text-primary">{label}</span>
        {description && (
          <span className="mt-1 block text-[12px] leading-5 text-text-muted">{description}</span>
        )}
      </span>
    </label>
  )
}

function Panel({ title, description, Icon, children }) {
  return (
    <section className="rounded-lg border border-border-light bg-bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-text-primary">{title}</h2>
          {description && <p className="mt-1 text-[12px] leading-5 text-text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function SaveBar({ disabled, saving, previewing, onPreview, onSubmit }) {
  return (
    <div className="mt-5 flex items-center justify-end gap-3">
      {onPreview && (
        <Button
          type="button"
          variant="secondary"
          onClick={onPreview}
          disabled={disabled || saving || previewing}
          className="gap-2 text-[13px]"
        >
          {previewing ? <Loader className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" strokeWidth={1.8} />}
          Preview impact
        </Button>
      )}
      <Button type="submit" onClick={onSubmit} disabled={disabled || saving || previewing} className="gap-2 text-[13px]">
        {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={1.8} />}
        Save changes
      </Button>
    </div>
  )
}

function RankChange({ change }) {
  if (change === 0) {
    return <span className="flex items-center gap-1 text-[12px] text-text-muted"><Minus className="h-3 w-3" /> —</span>
  }
  if (change > 0) {
    return <span className="flex items-center gap-1 text-[12px] font-bold text-success"><ArrowUp className="h-3 w-3" /> {change}</span>
  }
  return <span className="flex items-center gap-1 text-[12px] font-bold text-danger"><ArrowDown className="h-3 w-3" /> {Math.abs(change)}</span>
}

function WeightDiffTag({ from, to }) {
  const same = from === to
  const increased = to > from
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
      same ? 'bg-bg-tertiary text-text-muted' : increased ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
    }`}>
      {same ? 'unchanged' : increased ? `+${(to - from).toFixed(1)}` : `${(to - from).toFixed(1)}`}
    </span>
  )
}

function LeaderboardPreviewModal({ isOpen, onClose, previewData, loading }) {
  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Leaderboard Preview" panelClassName="!max-w-3xl !rounded-xl !p-0 overflow-hidden">
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-[13px] text-text-muted">
          <Loader className="h-4 w-4 animate-spin" /> Computing projected leaderboard…
        </div>
      ) : previewData ? (
        <>
          <div className="border-b border-border-light px-7 py-5">
            <h3 className="text-[14px] font-bold text-text-primary">Weight changes</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(previewData.weightDiff || {}).map(([key, { from, to }]) => {
                const field = LEADERBOARD_FIELDS.find(f => f.path[0] === key)
                return (
                  <span key={key} className="flex items-center gap-1.5 rounded bg-bg-tertiary px-2 py-1 text-[11px] text-text-secondary">
                    <span>{field?.label || key}</span>
                    <WeightDiffTag from={from} to={to} />
                  </span>
                )
              })}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border-light bg-bg-tertiary text-left text-[11px] font-bold uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Contributor</th>
                  <th className="px-4 py-2.5 text-right">Current score</th>
                  <th className="px-4 py-2.5 text-right">Projected score</th>
                  <th className="px-4 py-2.5 text-center">Rank shift</th>
                  <th className="px-4 py-2.5 text-right">Answers</th>
                  <th className="px-4 py-2.5 text-right">Upvotes</th>
                  <th className="px-4 py-2.5 text-right">Reputation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {(previewData.projected || []).map((entry) => (
                  <tr key={entry.userId} className="hover:bg-bg-tertiary/50 transition">
                    <td className="px-4 py-3 font-display font-bold text-text-muted">{entry.rank}</td>
                    <td className="px-4 py-3 font-semibold text-text-primary">{entry.displayName}</td>
                    <td className="px-4 py-3 text-right text-text-muted">
                      {entry.currentScore != null ? entry.currentScore.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text-primary">
                      {entry.score.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <RankChange change={entry.rankChange} />
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">{entry.answersCount}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">{entry.upvotesReceived}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">{entry.reputation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border-light px-7 py-4">
            <p className="text-[11px] text-text-muted">
              Showing top {previewData.projected?.length} contributors. Based on current platform data — spark balances, contributions, and reputation as of now.
            </p>
          </div>
        </>
      ) : null}
    </Modal>
  )
}

function FormulaCard({ weights }) {
  return (
    <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">Score formula</p>
      <div className="space-y-1 text-[12px] text-text-secondary">
        <p>Score = Σ(component × weight) − negativeActions × warningPenaltyWeight</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {FORMULA_COMPONENTS.map(({ key, label }) => (
            <span key={key} className="flex items-center gap-1">
              <code className="rounded bg-bg-primary px-1 py-0.5 text-[11px] font-mono text-text-primary">
                {(weights[key] ?? 0).toFixed(1)}
              </code>
              <span className="text-text-muted">{label.replace(' × weight', '').replace(' × weight (−)', '')}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function AdminSettingsView() {
  const [activeTab, setActiveTab] = useState('leaderboard')
  const [forms, setForms] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingSection, setSavingSection] = useState('')
  const [errors, setErrors] = useState({})

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    let isActive = true
    async function loadSettings() {
      setLoading(true)
      try {
        const settings = await fetchAdminSettings()
        if (isActive) setForms(settings)
      } catch (error) {
        if (isActive) {
          notifyError(error?.response?.data?.message || 'Could not load settings.')
          setForms(null)
        }
      } finally {
        if (isActive) setLoading(false)
      }
    }
    loadSettings()
    return () => { isActive = false }
  }, [])

  function updateSectionValue(section, path, value) {
    setErrors((current) => {
      const next = { ...current }
      delete next[fieldKey(path)]
      return next
    })
    setForms((current) => ({
      ...current,
      [section]: setValue(current[section], path, value),
    }))
  }

  async function handlePreview() {
    const { errors: nextErrors, payload } = validateAndBuildPayload('leaderboard', forms.leaderboard)
    if (Object.keys(nextErrors).length) {
      notifyError('Fix validation errors before previewing.')
      return
    }
    setPreviewing(true)
    setPreviewOpen(true)
    try {
      const result = await previewLeaderboardWeights(payload)
      setPreviewData(result)
    } catch (err) {
      notifyError(err?.response?.data?.message || 'Preview failed.')
      setPreviewOpen(false)
    } finally {
      setPreviewing(false)
    }
  }

  async function saveSection(section) {
    const { errors: nextErrors, payload } = validateAndBuildPayload(section, forms[section])
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      notifyError('Please fix the highlighted fields.')
      return
    }
    setSavingSection(section)
    try {
      const settings = await updateAdminSettingsSection(section, payload)
      setForms(settings)
      notifySuccess('Settings saved.')
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Could not save settings.')
    } finally {
      setSavingSection('')
    }
  }

  const isSaving = Boolean(savingSection)

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="flex items-center gap-2 text-[13px] text-text-muted">
          <Loader className="h-4 w-4 animate-spin" /> Loading settings...
        </div>
      </div>
    )
  }

  if (!forms) {
    return (
      <div className="flex-1 p-8">
        <div className="rounded-lg border border-border-light bg-bg-card p-6 text-[13px] text-text-muted">
          Settings are unavailable right now.
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-8">
      <div className="mb-8">
        <h1 className="font-display text-[24px] font-semibold leading-tight text-text-primary">Settings</h1>
        <p className="mt-2 text-[13px] leading-6 text-text-secondary">
          Configure scoring, eligibility thresholds, and unresolved question escalation.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-5 border-b border-border">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setActiveTab(key); setErrors({}) }}
              className={`mb-[-1px] flex min-h-11 items-center gap-2 border-b-2 text-[13px] font-semibold transition ${
                isActive ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
              {label}
            </button>
          )
        })}
      </div>

      {activeTab === 'leaderboard' && (
        <form onSubmit={(event) => { event.preventDefault(); saveSection('leaderboard') }}>
          <Panel
            title="Leaderboard Settings"
            description="The reputation leaderboard uses these weights when ranking contributors."
            Icon={SlidersHorizontal}
          >
            <FormulaCard weights={forms.leaderboard} />
            <div className="mt-5">
              <FieldGrid
                fields={LEADERBOARD_FIELDS}
                values={forms.leaderboard}
                errors={errors}
                disabled={isSaving}
                onChange={(path, value) => updateSectionValue('leaderboard', path, value)}
              />
            </div>
            <SaveBar
              disabled={false}
              saving={savingSection === 'leaderboard'}
              previewing={previewing}
              onPreview={handlePreview}
              onSubmit={() => saveSection('leaderboard')}
            />
          </Panel>
        </form>
      )}

      {activeTab === 'userThresholds' && (
        <form onSubmit={(event) => { event.preventDefault(); saveSection('userThresholds') }}>
          <div className="grid grid-cols-1 gap-5">
            <Panel
              title="Resolver Badge / Resolver Role Eligibility"
              description="Thresholds for identifying users ready for resolver badge or role review."
              Icon={ShieldCheck}
            >
              <FieldGrid
                fields={RESOLVER_FIELDS}
                values={forms.userThresholds}
                errors={errors}
                disabled={isSaving}
                onChange={(path, value) => updateSectionValue('userThresholds', path, value)}
              />
            </Panel>

            <Panel
              title="Warning / Inactive Account Thresholds"
              description="Thresholds for warnings, repeated negative moderation outcomes, and inactivity review."
              Icon={AlertTriangle}
            >
              <FieldGrid
                fields={MODERATION_FIELDS}
                values={forms.userThresholds}
                errors={errors}
                disabled={isSaving}
                onChange={(path, value) => updateSectionValue('userThresholds', path, value)}
              />
              <div className="mt-4">
                <ToggleRow
                  label="Automatically mark accounts inactive at warning threshold"
                  description="When disabled, the account is flagged for admin review instead."
                  checked={forms.userThresholds.moderationThresholds.autoDeactivateOnWarningThreshold}
                  disabled={isSaving}
                  onChange={(checked) => updateSectionValue(
                    'userThresholds',
                    ['moderationThresholds', 'autoDeactivateOnWarningThreshold'],
                    checked,
                  )}
                />
              </div>
            </Panel>
          </div>
          <SaveBar disabled={false} saving={savingSection === 'userThresholds'} onSubmit={() => saveSection('userThresholds')} />
        </form>
      )}

      {activeTab === 'questionEscalation' && (
        <form onSubmit={(event) => { event.preventDefault(); saveSection('questionEscalation') }}>
          <Panel
            title="Question Escalation Settings"
            description="Admin escalation applies to community questions that are not finally resolved."
            Icon={Clock3}
          >
            <div className="mb-5 rounded-lg border border-info/20 bg-info/5 px-4 py-3 text-[12px] leading-5 text-text-secondary">
              Comments and replies do not count as resolution. A question is unresolved until a final resolution is marked.
            </div>

            <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
              <div>
                <FieldGrid
                  fields={ESCALATION_FIELDS}
                  values={forms.questionEscalation}
                  errors={errors}
                  disabled={isSaving}
                  onChange={(path, value) => updateSectionValue('questionEscalation', path, value)}
                />
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ToggleRow
                    label="Escalate unresolved questions automatically"
                    checked={forms.questionEscalation.automaticEscalationEnabled}
                    disabled={isSaving}
                    onChange={(checked) => updateSectionValue('questionEscalation', ['automaticEscalationEnabled'], checked)}
                  />
                  <ToggleRow
                    label="Include commented but unresolved questions"
                    checked={forms.questionEscalation.includeCommentedUnresolved}
                    disabled={isSaving}
                    onChange={(checked) => updateSectionValue('questionEscalation', ['includeCommentedUnresolved'], checked)}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border-light bg-bg-primary p-4">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-text-secondary">
                    Admin assignment strategy
                  </span>
                  <Select
                    options={STRATEGY_OPTIONS}
                    value={forms.questionEscalation.assignmentStrategy}
                    onChange={(value) => updateSectionValue('questionEscalation', ['assignmentStrategy'], value)}
                    disabled={isSaving}
                    className="w-full"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-text-secondary">
                    Default admin user ID
                  </span>
                  <Input
                    type="text"
                    value={forms.questionEscalation.defaultAdminUserId || ''}
                    disabled={isSaving || forms.questionEscalation.assignmentStrategy !== 'default_admin'}
                    onChange={(event) => {
                      setErrors((current) => { const next = { ...current }; delete next.defaultAdminUserId; return next })
                      updateSectionValue('questionEscalation', ['defaultAdminUserId'], event.target.value)
                    }}
                    className={errors.defaultAdminUserId ? 'border-danger focus:border-danger focus:ring-danger' : ''}
                  />
                  {errors.defaultAdminUserId && (
                    <span className="mt-1 block text-[11px] font-medium text-danger">{errors.defaultAdminUserId}</span>
                  )}
                </label>
              </div>
            </div>
            <SaveBar disabled={false} saving={savingSection === 'questionEscalation'} onSubmit={() => saveSection('questionEscalation')} />
          </Panel>
        </form>
      )}

      <LeaderboardPreviewModal
        isOpen={previewOpen}
        onClose={() => { setPreviewOpen(false); setPreviewData(null) }}
        previewData={previewData}
        loading={previewing}
      />
    </div>
  )
}

export default AdminSettingsView
