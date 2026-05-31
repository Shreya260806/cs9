# FAQ Management

Admin panel view for managing published FAQ content. Lists **all** FAQs and
supports inline **edit** and **delete**, with client-side **pagination**.

- **Component:** [`index.jsx`](./index.jsx) — `FAQManagementView`
- **Rendered by:** [`pages/admin/index.jsx`](../../index.jsx) when
  `currentAdminView === 'faqManagement'` (selected from the admin LeftPane).
- **Self-fetching:** takes no props. It loads its own data and does **not** read
  from the shared `dashboardData` feed (the previous version only showed "recent"
  FAQs from that feed, which is why most FAQs never appeared).

## Data flow

```
FAQManagementView
  ├─ fetchFAQs({ limit })                 → GET    /api/questions?kind=faq&limit=100
  │      ↳ admins receive all FAQs; soft-deleted (status='removed') filtered out client-side
  ├─ updateFAQ(id, { title, body, tags }) → PATCH  /api/questions/:id
  └─ deleteFAQ(id)                        → DELETE /api/questions/:id   (soft-delete → status 'removed')
```

Service functions live in [`pages/admin/service.js`](../../service.js). They wrap
the shared `/api/questions` endpoints — there is no FAQ-specific backend route.

### Backend contract

| Action | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| List | `GET /api/questions?kind=faq` | `USER`/`RESOLVER`/`ADMIN` | Admins bypass the moderation/`removed` filter (`isAdmin`), so they receive every FAQ. |
| Update | `PATCH /api/questions/:id` | any `ADMIN` via `canManage` | Accepts `title`, `body`, `tags`. |
| Delete | `DELETE /api/questions/:id` | `ADMIN` | **Soft delete** — sets `status: 'removed'`, `moderation_status: 'rejected'`. Not a hard DB delete. |

Because the API returns soft-deleted rows to admins, `fetchFAQs` filters out
`status === 'removed'` so the panel only shows live FAQs.

## State

| State | Purpose |
|-------|---------|
| `faqs`, `loading` | Fetched FAQ list + load flag |
| `editing`, `form`, `saving` | FAQ under edit, its form (`title`/`body`/`tags`), and in-flight save |
| `deleting`, `removing` | FAQ pending deletion + in-flight delete |
| `currentPage` | Active pagination page (1-based) |

## UI

### List
One section renders the FAQs with a live count badge. Each row shows:
- `title` — the FAQ question
- `body` — answer preview (`line-clamp-2`, trusted HTML via `dangerouslySetInnerHTML`)
- `tags` — chips (when present)
- **Edit** (pencil) and **Delete** (trash) icon actions

States: spinner while loading; "No FAQs published yet." when empty.

### Pagination
Client-side at **10 per page** (`PAGE_SIZE`). Prev/Next controls render only when
there is more than one page, showing `current / total`. The current page is
clamped back into range when the list shrinks (e.g. deleting the last row on the
final page steps back rather than showing an empty page).

> Paginated client-side because `fetchFAQs` already pulls the full set and strips
> `removed` rows in the browser — server-side paging would mis-count pages once
> those rows are filtered. Revisit (move paging + the `removed` filter into the
> query) only if FAQ volume outgrows the `limit: 100` fetch.

### Edit
Centered `Modal` with `title`, `body` (textarea), and comma-separated `tags`.
Title and answer are required (otherwise an error toast). On save → `updateFAQ`,
optimistic list update, success toast, close. Tags are split/trimmed into an array
before sending.

### Delete
Confirmation `Modal` naming the FAQ. On confirm → `deleteFAQ`, the row is removed
from the list, success toast.

## Feedback

All outcomes use `notifySuccess` / `notifyError` from
[`lib/notify.js`](../../../../lib/notify.js); no `window.alert`.

## Shared components used

[`Modal`](../../../../components/Modal/Modal.tsx),
[`Button`](../../../../components/Button/Button.tsx),
[`Input`](../../../../components/Input/Input.tsx).

## Not implemented / extension points

- **Create FAQ** — there is no "New FAQ" flow here (the old non-functional button
  was removed). To add one, post to `POST /api/questions` with `kind: 'faq'` and
  reuse the edit `Modal`/form.
- **Hard delete / restore** — deletion is soft only; there is no un-delete in this UI.
</content>
