# Rogāre — Frontend

React 19 + Vite + Tailwind CSS v4. SPA for the Rogāre Q&A platform.

## Tech Stack

| | |
|---|---|
| Framework | React 19 (`^19.2.6`) |
| Build | Vite (`^8.0.12`) |
| Styling | Tailwind CSS v4 (CSS variables, `dark:` variant) |
| Routing | React Router DOM (`^7.16.0`) |
| State | Zustand (`^5.0.14`) + React Query (`@tanstack/react-query`) |
| Icons | lucide-react (`^1.17.0`) |
| HTTP | Axios (`^1.16.1`) |
| UI Primitives | Headless UI (`@headlessui/react` `^2.2.10`) |
| Charts | Recharts (`^3.8.1`) |

## Scripts

```sh
npm run dev      # development server with HMR
npm run build    # production build
npm run lint     # ESLint
npm run preview  # preview production build locally
```

## Architecture

See [`CONTEXT.md`](../CONTEXT.md) for component patterns, state ownership, routing, and import depth.

See [`DESIGN.md`](./DESIGN.md) for the design system — color tokens, typography, shared component specs.

## Environment

Create a `.env` file in `frontend/`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

The frontend proxies `/api` to the backend in development via `vite.config.js`.
