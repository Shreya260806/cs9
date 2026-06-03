# QueryHub — Rogāre

**vicharanashala/cs9** — Internship FAQ / Doubt Resolution Platform

---

## Project Overview

Rogāre ( Sanskrit: Ṛṇa ) is a Q&A platform for internship-related questions. It has two surfaces:
- **FAQ** — curated, resolver-authored entries shown on a public FAQ page
- **Community** — student-asked questions with answers and voting

A single `questions` collection serves both by toggling `kind: "faq" | "community"`.

---

## Repository Structure

```
cs9/
├── README.md               ← You are here
├── CONTRIBUTING.md         ← PR template and author checklist
├── FEATURE.md              ← Auto-assignment cron feature spec
│
├── backend/
│   ├── ER_DIAGRAM.md       ← MongoDB entity relationships + cache ownership
│   ├── LEADERBOARD.md      ← Spark / reputation / accepted-answer scoring
│   ├── FILESTRUCTURE.md    ← Backend file tree
│   ├── src/
│   │   ├── app.js              ← Express app (CORS, rate-limit, helmet, routes)
│   │   ├── server.js           ← Entry point (DB connect, cron start, listen)
│   │   ├── db.js               ← Mongoose connection
│   │   ├── swagger.js          ← OpenAPI spec builder
│   │   │
│   │   ├── controllers/        ← Route handlers
│   │   │   ├── admin.controller.js
│   │   │   ├── answer.controller.js
│   │   │   ├── auth.controller.js
│   │   │   ├── comment.controller.js
│   │   │   ├── flag.controller.js
│   │   │   ├── moderation.controller.js
│   │   │   ├── notification.controller.js
│   │   │   ├── profile.controller.js
│   │   │   ├── question.controller.js
│   │   │   ├── resolver.controller.js
│   │   │   ├── spark.controller.js
│   │   │   └── user.controller.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js    ← JWT verify, role check, account status
│   │   │   └── error.middleware.js
│   │   │
│   │   ├── models/             ← Mongoose schemas
│   │   │   ├── answer.model.js
│   │   │   ├── comment.model.js
│   │   │   ├── flag.model.js
│   │   │   ├── notification.model.js
│   │   │   ├── question-assignment-log.model.js
│   │   │   ├── question.model.js
│   │   │   ├── role.model.js
│   │   │   ├── spark-transaction.model.js
│   │   │   ├── user-profile.model.js
│   │   │   ├── user.model.js
│   │   │   └── vote.model.js
│   │   │
│   │   ├── routes/             ← Express route definitions
│   │   │   ├── admin.routes.js, answer.routes.js, auth.routes.js,
│   │   │   ├── comment.routes.js, flag.routes.js, leaderboard.routes.js,
│   │   │   ├── moderation.routes.js, notification.routes.js,
│   │   │   ├── profile.routes.js, question.routes.js, resolver.routes.js,
│   │   │   ├── spark.routes.js, user.routes.js
│   │   │
│   │   ├── scheduled/
│   │   │   └── question-assignment.js   ← Cron: auto-assign old unanswered questions
│   │   │
│   │   ├── scripts/            ← Migrations, seeds, rebuild utilities
│   │   │   ├── migrations/
│   │   │   │   ├── 002-migrate-profile-identity.js
│   │   │   │   ├── 003-migrate-expert-profile-fields.js
│   │   │   │   ├── 004-migrate-upvoted-by-to-votes.js
│   │   │   │   ├── 005-reconcile-spark-points.js
│   │   │   │   └── 006-backfill-question-assignment-log-ids.js
│   │   │   ├── ingest-faqs.js, rebuild-*.js, recompute-reputation.js,
│   │   │   └── seed-admin.js, seed-all.js
│   │   │
│   │   ├── services/
│   │   │   ├── content.service.js
│   │   │   ├── question-allocation.service.js
│   │   │   ├── role.service.js
│   │   │   └── spark.service.js
│   │   │
│   │   └── utils/
│   │       ├── auth-token.js, featureLogger.js, http.js
│   │
│   └── package.json
│
└── frontend/
    ├── CONTEXT.md              ← Component patterns, state, routing, styling
    ├── DESIGN.md               ← Color tokens, typography, shared components
    ├── FILESTRUCTURE.md        ← Frontend file tree
    ├── index.html
    ├── vite.config.js
    ├── jsconfig.json
    └── src/
        ├── App.jsx, main.jsx
        ├── api/index.js             ← axiosPublic, axisPrivate helpers
        ├── components/              ← Shared UI (Button, Input, Modal, Select, Footer)
        │   ├── Button/Button.tsx
        │   ├── Footer/
        │   ├── Input/
        │   ├── Modal/Modal.tsx
        │   ├── NotificationModal/
        │   └── Select/Select.tsx    ← TypeScript; scrollable dropdown
        ├── contexts/                ← AuthContext, RoleContext
        ├── layouts/                 ← AdminLayout, UserLayout
        ├── lib/notify.js            ← notifyError / notifySuccess toasts
        ├── pages/
        │   ├── landing/             ← Public home page (/)
        │   │   ├── index.jsx, service.jsx, LoginModal/
        │   │   └── README.md
        │   ├── user/                ← Authenticated student section
        │   │   ├── layout.jsx
        │   │   ├── service.js, constants.js
        │   │   ├── components/
        │   │   │   ├── AnswerComments/, FAQCategories/
        │   │   │   ├── Header/DashboardHeader.jsx, NotifSidebar/
        │   │   │   ├── LeftPane/LeftPane.jsx, QuestionCard/, ReportModal/
        │   │   │   └── SearchModal/
        │   │   └── pages/
        │   │       ├── Dashboard/
        │   │       ├── Leaderboard/
        │   │       ├── MyContributions/
        │   │       ├── ProfileSettings/
        │   │       ├── QueryDetail/        ← Full question + answers + comments
        │   │       └── RaiseQuery/         ← Ask a new question
        │   └── admin/                ← Admin panel
        │       ├── service.js
        │       ├── components/Header/, LeftPane/
        │       └── pages/
        │           ├── Dashboard/
        │           ├── FAQManagement/
        │           ├── QueriesManagement/
        │           ├── SparkLeaderboard/
        │           └── AdminProfile/
        ├── stores/                  ← authStore, themeStore (Zustand, persisted)
        └── routes/index.jsx         ← Route definitions + ProtectedRoute
```

---

## Key Documentation

| File | What it covers |
|------|---------------|
| [`CONTEXT.md`](./CONTEXT.md) | **Frontend conventions** — component patterns, state ownership, service layer, routing, imports, styling, icons |
| [`frontend/DESIGN.md`](./frontend/DESIGN.md) | **Design system** — color tokens (light/dark), typography, shared component specs, layout, feedback |
| [`backend/ER_DIAGRAM.md`](./backend/ER_DIAGRAM.md) | **Data model** — MongoDB collections, relationships, polymorphic votes/flags, cache ownership |
| [`backend/LEADERBOARD.md`](./backend/LEADERBOARD.md) | **Scoring** — spark points ledger, reputation derivation, accepted-answer aggregation |
| [`backend/FILESTRUCTURE.md`](./backend/FILESTRUCTURE.md) | **Backend file tree** |
| [`frontend/FILESTRUCTURE.md`](./frontend/FILESTRUCTURE.md) | **Frontend file tree** |
| [`FEATURE.md`](./FEATURE.md) | **Auto-assignment cron** — spec, design, failure handling, rollback plan |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | **PR template** — required sections, author checklist, testing requirements |

---

## Current Status

| Area | Status | Notes |
|------|--------|-------|
| Issue #40 Select scroll + Others option | ✅ Committed (`60824ae`) | Not pushed |
| Issue #44 createAnswer validation | ✅ Committed (`2001eb7`) | Not pushed |
| Issue #43 body_plain removal | ✅ Committed (`eecdc8a`) | Not pushed |
| Issue #41 ReportModal import missing | 🔴 Open | Needs component creation |
| Issue #42 Vote cache atomicity | 🟡 Open | Needs transaction fix |
| Documentation sync | 🔄 In progress | This README |

**`main` SHA:** `da64bbf`

---

## Getting Started

### Backend

```sh
cd backend
cp .env.example .env     # fill in MongoDB URI, JWT secret, CORS origin
npm install
npm run seed:admin       # create initial admin account
npm run dev              # starts with --watch
```

### Frontend

```sh
cd frontend
npm install
npm run dev
```

### Rebuild / Reconciliation Scripts

```sh
npm run rebuild:votes           # sync upvotes/downvotes caches
npm run rebuild:question-counters
npm run rebuild:comment-counters
npm run recompute:reputation    # backfill UserProfile.reputation from answers
```

## Contributors

| # | Name |
|---|------|
| 1 | Samyabrata Roy |
| 2 | Nandini |
| 3 | SAMAD MOHAMMED |
| 4 | Ansh Varshney |
| 5 | Kashish Panwar |
| 6 | Shreya Choudhary |
| 7 | Rahul Prasad |
| 8 | Abhi Sriya |
| 9 | Adhin Mahesh |
| 10 | Udarsh Goyal |
