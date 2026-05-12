# Cookrew Arcade — Beta

Mobile-first web client for the [Cookrew](https://github.com/anvztor) / krewhub backend. Compose missions, hire agents, watch live task activity over SSE, and answer human-in-the-loop prompts — all in a retro arcade UI.

> **Status:** beta. APIs and UI are still moving fast.

---

## Stack

- **React 18** + **TypeScript 5**
- **Vite 5** (dev server + bundler)
- **PKCE OAuth** against krewauth
- **Server-Sent Events** for the live recipe stream
- No mock data — every screen is driven by the real krewhub backend.

## Quick start

Requires **Node 18+** and **pnpm**.

```bash
pnpm install
pnpm dev          # http://localhost:5173 (host: true — reachable on LAN)
pnpm build        # tsc -b && vite build
pnpm preview      # serve the production build
pnpm typecheck    # tsc -b --noEmit
```

## Environment variables

Create a `.env.local` in the project root:

| Variable | Purpose |
|---|---|
| `VITE_KREWHUB_URL` | Base URL for the krewhub API (bundles, tasks, runtimes, SSE). |
| `VITE_KREWAUTH_URL` | Base URL for the krewauth OAuth/PKCE service. |
| `VITE_KREWHUB_RECIPE_ID` | Optional fallback recipe id for local dev when no operator is signed in. In production the active recipe is resolved per-account via `resolveActiveRecipeId(account_id)`. |

## Project layout

```
src/
  app/
    MobileApp.tsx          mobile shell — wires auth, bundles, SSE, HITL
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
    api/krewhub-client.ts  HTTP client for krewhub (bundles, tasks, runtimes, HITL)
    api/recipe-stream.ts   SSE attach helpers
    auth/auth-client.ts    redirect + token exchange
    auth/pkce.ts           PKCE code verifier / challenge
    auth/useAuth.tsx       auth context + hook
    insets.ts              safe-area insets
  styles/
    tokens.css             design tokens (VT323 / Silkscreen / Inter / JetBrains Mono)
  main.tsx                 entry point
```

## Architecture notes

- **Backend-driven UI.** No mock data anywhere — every list, badge, and event row originates from krewhub. The in-process event bus is intentionally not wired into the feed; on-screen events come from the recipe SSE stream so the UI cannot drift from server truth.
- **Event feed.** Subscribes to the recipe SSE stream and renders per-agent and per-task tabs, including synthetic `sse.open` / `sse.error` rows so connectivity is visible.
- **HITL flow.** Blocked tasks surface through the HITL popout; operator answers are posted back via `postHitlAnswer`.
- **Agent hiring.** Agents are hired through `/agents/pair` + `/api/v1/agents/runtimes` (see `hire-agent-runtime-modal.tsx`).
- **Drafts.** Mission drafts use a single-draft ref guard; on `403` the client auto-bundles and retries.
- **Recipe resolution.** On load, `resolveActiveRecipeId(account_id)` discovers the operator's auto-bootstrapped "my-cookbook" / "my-recipe"; the build-time `VITE_KREWHUB_RECIPE_ID` is only a local-dev fallback.

## Contributing

This is a private beta. If you have access, open an issue or PR.
