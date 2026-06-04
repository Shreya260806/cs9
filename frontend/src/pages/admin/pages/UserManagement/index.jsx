import { useCallback, useEffect, useState } from 'react'
import {
  Users, Search, ShieldCheck, ChevronLeft, ChevronRight, Loader,
  Check, Zap, Mail, Calendar, UserCog, Plus, CornerDownLeft, Filter, Eye, EyeOff,
} from 'lucide-react'
import Modal from '../../../../components/Modal/Modal'
import Button from '../../../../components/Button/Button'
import { notifyError, notifySuccess } from '../../../../lib/notify'
import { fetchUsers, assignUserRole, removeUserRole, updateUserStatus, createUser } from '../../service'

const PAGE_SIZE = 10
const ROLES = ['USER', 'ADMIN']
const STATUSES = ['active', 'disabled', 'suspended']

const ROLE_STYLE = {
  USER:  'bg-gray-100 text-gray-600',
  ADMIN: 'bg-purple-50 text-purple-700',
}
const STATUS_STYLE = {
  active:    'bg-emerald-50 text-emerald-700',
  disabled:  'bg-gray-100 text-gray-600',
  suspended: 'bg-red-50 text-red-700',
}

// Shared field styling (Stitch modal redesign), mapped to our theme tokens.
const LABEL_CLS = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted transition-colors group-focus-within:text-text-primary'
const INPUT_CLS = 'w-full rounded-lg border border-border bg-bg-primary px-4 py-2.5 text-[13px] text-text-primary placeholder:text-text-muted outline-none transition focus:border-text-primary focus:ring-1 focus:ring-text-primary'

function initialsOf(name = '') {
  return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function UserManagementView() {
  const [users, setUsers]           = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 })
  const [loading, setLoading]       = useState(true)

  const [page, setPage]             = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Modal state
  const [managing, setManaging]     = useState(null)   // user being managed, or null
  const [busyRole, setBusyRole]     = useState(null)   // role with an in-flight toggle
  const [statusDraft, setStatusDraft] = useState('active')
  const [statusReason, setStatusReason] = useState('')
  const [busyStatus, setBusyStatus] = useState(false)

  const [creating, setCreating]     = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'USER' })
  const [creatingSaving, setCreatingSaving] = useState(false)
  const [showPassword, setShowPassword]     = useState(false)

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset to page 1 whenever filters change.
  useEffect(() => { setPage(1) }, [search, roleFilter, statusFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { users: rows, pagination: meta } = await fetchUsers({
        page, limit: PAGE_SIZE, search, role: roleFilter, status: statusFilter,
      })
      setUsers(rows)
      setPagination(meta)
    } catch {
      setUsers([])
      setPagination({ page: 1, pages: 0, total: 0 })
      notifyError('Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, pagination.pages || 1)

  function openManage(user) {
    setManaging(user)
    setStatusDraft(user.status || 'active')
    setStatusReason('')
  }

  // Apply role change locally to both the list and the open modal.
  function applyRoles(userId, roles) {
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, roles } : u)))
    setManaging(prev => (prev && prev.id === userId ? { ...prev, roles } : prev))
  }

  async function toggleRole(role) {
    if (!managing || busyRole) return
    const has = managing.roles?.includes(role)
    setBusyRole(role)
    try {
      if (has) {
        await removeUserRole(managing.id, role)
        applyRoles(managing.id, managing.roles.filter(r => r !== role))
        notifySuccess(`Removed ${role} role.`)
      } else {
        await assignUserRole(managing.id, role)
        applyRoles(managing.id, [...(managing.roles || []), role])
        notifySuccess(`Granted ${role} role.`)
      }
    } catch (error) {
      notifyError(error?.response?.data?.message || `Could not update ${role} role.`)
    } finally {
      setBusyRole(null)
    }
  }

  async function applyStatus() {
    if (!managing || busyStatus) return
    setBusyStatus(true)
    try {
      await updateUserStatus(managing.id, statusDraft, statusReason)
      setUsers(prev => prev.map(u => (u.id === managing.id ? { ...u, status: statusDraft } : u)))
      setManaging(prev => ({ ...prev, status: statusDraft }))
      notifySuccess('Account status updated.')
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Could not update status.')
    } finally {
      setBusyStatus(false)
    }
  }

  function closeCreate() {
    setCreating(false)
    setCreateForm({ name: '', email: '', password: '', role: 'USER' })
  }

  async function saveCreate(event) {
    event.preventDefault()
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      notifyError('Name, email, and password are required.')
      return
    }
    setCreatingSaving(true)
    try {
      const user = await createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
      })
      setUsers(prev => [user, ...prev])
      setPagination(prev => ({ ...prev, total: prev.total + 1 }))
      notifySuccess('User created.')
      closeCreate()
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to create user.')
    } finally {
      setCreatingSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display flex items-center gap-2 text-[24px] font-semibold text-text-primary">
            <Users className="h-6 w-6 text-brand" strokeWidth={1.8} />
            User Management
          </h1>
          <p className="mt-2 text-[13px] text-text-secondary">
            Manage members, promote roles, and control account status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setCreating(true); setCreateForm({ name: '', email: '', password: '', role: 'USER' }) }}
          aria-label="Add user"
          className="mt-1 flex shrink-0 items-center gap-1.5 rounded-lg border border-brand px-3 py-1.5 text-[10px] font-bold text-brand transition hover:bg-brand/5"
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" strokeWidth={1.8} />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search name or email…"
              className="w-full rounded-lg border border-border bg-bg-card py-2.5 pl-10 pr-3 text-[13px] text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(o => !o)}
            aria-label="Toggle filters"
            aria-pressed={filtersOpen}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${
              filtersOpen || roleFilter || statusFilter
                ? 'border-brand text-brand'
                : 'border-border text-text-muted hover:border-brand hover:text-brand'
            }`}
          >
            <Filter className="h-4 w-4" strokeWidth={1.8} />
            {(roleFilter || statusFilter) && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-bg-primary bg-brand" />
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-border-light bg-bg-card p-3">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="rounded-lg border border-border bg-bg-card px-3 py-2 text-[12px] text-text-primary focus:border-brand focus:outline-none"
            >
              <option value="">All roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border bg-bg-card px-3 py-2 text-[12px] capitalize text-text-primary focus:border-brand focus:outline-none"
            >
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(roleFilter || statusFilter) && (
              <button
                type="button"
                onClick={() => { setRoleFilter(''); setStatusFilter('') }}
                className="text-[12px] font-semibold text-text-muted transition hover:text-text-primary"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-text-muted">
          <Loader className="h-4 w-4 animate-spin" /> Loading users…
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-[13px] text-text-muted">
          <Users className="h-8 w-8 text-[#d1d5db]" strokeWidth={1.5} />
          No users match this view.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border-light bg-bg-card shadow-sm">
            {users.map(user => (
              <div
                key={user.id}
                className="flex flex-wrap items-center gap-4 border-b border-border-light px-5 py-4 last:border-b-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white">
                  {initialsOf(user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-text-primary">{user.name}</p>
                  <p className="flex items-center gap-1 truncate text-[12px] text-text-muted">
                    <Mail className="h-3 w-3" strokeWidth={1.8} /> {user.email || '—'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(user.roles || []).filter(role => ROLES.includes(role)).map(role => (
                    <span key={role} className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_STYLE[role] || ROLE_STYLE.USER}`}>
                      {role}
                    </span>
                  ))}
                </div>

                <span className="flex items-center gap-1 text-[12px] font-semibold text-amber-600">
                  <Zap className="h-3.5 w-3.5" strokeWidth={1.8} /> {user.sparkPoints ?? 0}
                </span>

                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[user.status] || STATUS_STYLE.active}`}>
                  {user.status || 'active'}
                </span>

                <span className="hidden items-center gap-1 text-[11px] text-text-muted lg:flex">
                  <Calendar className="h-3 w-3" strokeWidth={1.8} /> {formatDate(user.createdAt)}
                </span>

                <Button variant="secondary" onClick={() => openManage(user)} className="min-h-8 px-3 text-[12px]">
                  <UserCog className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} /> Manage
                </Button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-light text-text-muted transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-light disabled:hover:text-text-muted"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <span className="text-[11px] font-medium text-text-muted">{pagination.page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-light text-text-muted transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-light disabled:hover:text-text-muted"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Manage modal */}
      <Modal isOpen={!!managing} onClose={() => setManaging(null)} title="Manage user" panelClassName="!max-w-md !rounded-xl !p-0 overflow-hidden">
        {managing && (
          <>
            {/* Identity */}
            <div className="flex items-center gap-3 border-b border-border-light px-7 pb-5 pt-7">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">
                {initialsOf(managing.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-text-primary">{managing.name}</p>
                <p className="truncate text-[12px] text-text-muted">{managing.email}</p>
              </div>
            </div>

            <div className="space-y-6 px-7 py-6">
              {/* Roles */}
              <div>
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">Roles</p>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(role => {
                    const has = managing.roles?.includes(role)
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        disabled={busyRole === role}
                        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 ${
                          has
                            ? 'bg-brand text-white'
                            : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {busyRole === role
                          ? <Loader className="h-3 w-3 animate-spin" />
                          : has && <Check className="h-3 w-3" strokeWidth={3} />}
                        {role}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Status */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted">Status</p>
                  {statusDraft !== (managing.status || 'active') && (
                    <button
                      type="button"
                      onClick={applyStatus}
                      disabled={busyStatus}
                      className="text-[11px] font-semibold text-brand transition hover:text-brand-hover disabled:opacity-50"
                    >
                      {busyStatus ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusDraft(s)}
                      className={`flex-1 rounded-lg py-2 text-[12px] font-semibold capitalize transition ${
                        statusDraft === s
                          ? 'bg-brand/10 text-brand'
                          : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {statusDraft !== 'active' && (
                  <div className="relative mt-3 flex items-center">
                    <input
                      value={statusReason}
                      onChange={e => setStatusReason(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') applyStatus() }}
                      placeholder="Reason (optional)"
                      className={`${INPUT_CLS} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={applyStatus}
                      disabled={busyStatus}
                      aria-label="Apply status"
                      className="absolute right-1.5 flex h-7 w-9 items-center justify-center rounded-md bg-brand text-white transition hover:bg-brand-hover disabled:opacity-50"
                    >
                      <CornerDownLeft className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Create user modal */}
      <Modal isOpen={!!creating} onClose={closeCreate} title="Add user" panelClassName="!max-w-xl !rounded-xl !p-0 overflow-hidden">
        <form onSubmit={saveCreate}>
          <div className="border-b border-border-light px-8 pb-6 pt-8">
            <h2 className="font-display text-[26px] font-bold leading-tight text-text-primary">Add New User</h2>
            <p className="mt-1 text-[13px] text-text-secondary">Create an account and assign an initial role.</p>
          </div>

          <div className="space-y-5 px-8 py-7">
            <div className="group">
              <label className={LABEL_CLS}>NAME</label>
              <input
                className={INPUT_CLS}
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Asha Verma"
              />
            </div>
            <div className="group">
              <label className={LABEL_CLS}>EMAIL</label>
              <input
                className={INPUT_CLS}
                type="email"
                value={createForm.email}
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div className="group">
              <label className={LABEL_CLS}>PASSWORD</label>
              <div className="relative flex items-center">
                <input
                  className={`${INPUT_CLS} pr-10`}
                  type={showPassword ? 'text' : 'password'}
                  value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Set a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 flex h-7 w-7 items-center justify-center rounded text-text-muted transition hover:text-text-primary"
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" strokeWidth={1.8} />
                    : <Eye className="h-4 w-4" strokeWidth={1.8} />
                  }
                </button>
              </div>
            </div>
            <div className="group">
              <label className={LABEL_CLS}>INITIAL ROLE</label>
              <div className="relative flex items-center">
                <ShieldCheck className="pointer-events-none absolute left-3 h-4 w-4 text-text-muted" strokeWidth={1.8} />
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                  className={`${INPUT_CLS} cursor-pointer appearance-none pl-10`}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-8 pb-8">
            <button
              type="button"
              onClick={closeCreate}
              disabled={creatingSaving}
              className="rounded-lg px-6 py-2.5 text-[14px] font-medium text-text-secondary transition hover:bg-hover-bg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingSaving}
              className="rounded-lg bg-black px-8 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-[#2e3132] disabled:opacity-50"
            >
              {creatingSaving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default UserManagementView
