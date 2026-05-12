# Cookrew Arcade — Beta

> Mobile-first arcade UI for the **krewhub** backend. Compose missions, hire agents, watch tasks tick over SSE, answer human-in-the-loop prompts.
>
> **Status:** beta. Backend contracts and UI are both moving — expect breakage.

---

## Quick start

Requires **Node 18+** and **pnpm**.

```bash
pnpm install
pnpm dev          # http://localhost:5173 (host: true — reachable on LAN)
pnpm build        # tsc -b && vite build
pnpm preview      # serve the production build
pnpm typecheck    # tsc -b --noEmit
```

Then create `.env.local`:

| Variable | Purpose |
|---|---|
| `VITE_KREWHUB_URL` | Base URL for the krewhub API (bundles, tasks, runtimes, SSE). |
| `VITE_KREWAUTH_URL` | Base URL for the krewauth OAuth/PKCE service. |
| `VITE_KREWHUB_RECIPE_ID` | *(optional)* Local-dev fallback recipe id. In prod the active recipe is resolved per-account via `resolveActiveRecipeId(account_id)`. |

---

## Stack

- **React 18** + **TypeScript 5**
- **Vite 5** dev server + bundler
- **PKCE OAuth** against krewauth
- **Server-Sent Events** for the live recipe stream
- Retro arcade typography (VT323, Silkscreen, JetBrains Mono, Inter)
- **No mock data** — every screen is driven by the real krewhub backend

## What it does

- **Compose missions.** Draft a mission, auto-bundle on `403`, ship it to the backend.
- **Hire agents.** Pair runtimes via `/agents/pair` + `/api/v1/agents/runtimes`.
- **Live mission board.** Per-task cards attach to their own SSE streams.
- **Event feed.** Per-agent and per-task tabs, with synthetic `sse.open` / `sse.error` rows so connectivity is visible.
- **HITL.** Blocked tasks surface in the popout; operator answers post back via `postHitlAnswer`.

## Project layout

```
src/
  app/
    MobileApp.tsx          mobile shell — auth, bundles, SSE, HITL wiring
  components/
    atoms/                 sprite + primitive UI atoms
    auth-view/             OAuth callback + hire-agent modals
    bundle-tabs.tsx        bundle switcher
    event-feed.tsx         per-agent / per-task event tabs
    footer.tsx             arcade footer
    header.tsx             arcade header
    hitl-popout.tsx        human-in-the-loop answer UI
    mission-board.tsx      live mission / task board
    mission-composer.tsx   compose a new mission
    mode-dial.tsx          mode selector
    party-sidebar.tsx      roster / party view
    task-live-card.tsx     per-task card, attaches to task SSE
  data/
    roster.ts              runtime → roster member mapping
    tasks.ts               task lifecycle + HITL derivation
  lib/
    api/krewhub-client.ts  HTTP client (bundles, tasks, runtimes, HITL)
    api/recipe-stream.ts   SSE attach helpers
    auth/auth-client.ts    redirect + token exchange
    auth/pkce.ts           PKCE verifier / challenge
    auth/useAuth.tsx       auth context + hook
    insets.ts              safe-area insets
  styles/
    tokens.css             design tokens
  main.tsx                 entry point
```

## Architecture notes

- **Backend-driven UI.** Every list, badge, and event row originates from krewhub. The in-process event bus is intentionally *not* wired into the feed — on-screen events come from the recipe SSE stream so the UI cannot drift from server truth.
- **Recipe resolution.** On load, `resolveActiveRecipeId(account_id)` discovers the operator's auto-bootstrapped "my-cookbook" / "my-recipe". `VITE_KREWHUB_RECIPE_ID` is only a local-dev fallback.
- **Drafts.** Mission drafts use a single-draft ref guard; on `403` the client auto-bundles and retries.
- **HITL.** Blocked tasks surface through `hitl-popout.tsx`; answers post back via `postHitlAnswer`.

## Contributing

Private beta. If you have access, open an issue or PR — small, focused changes preferred.

## License

No public license. All rights reserved by the author.
