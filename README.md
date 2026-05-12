# Cookrew Arcade — Beta

Mobile-first web client for the Cookrew stack. Compose missions, hire
agents, watch live task activity over SSE, and answer human-in-the-loop
prompts — wrapped in a retro arcade UI.

> Status: **beta**. APIs and UI are still moving fast.

## Stack

- React 18 + TypeScript
- Vite 5
- OAuth 2.0 + PKCE against **krewauth**
- Live updates via Server-Sent Events from **krewhub**

The SPA talks to two backends; both URLs are configurable at build time:

| Service  | Env var             | Default                 | Used for                                   |
| -------- | ------------------- | ----------------------- | ------------------------------------------ |
| krewhub  | `VITE_KREWHUB_URL`  | `http://localhost:8420` | bundles, tasks, agents, SSE recipe stream  |
| krewauth | `VITE_KREWAUTH_URL` | `http://localhost:8421` | OAuth authorize + token endpoints          |

Authentication uses the hosted krewauth login page. After PKCE exchange,
the browser receives an httpOnly `krewauth_session` cookie on
`.cookrew.dev`; every API call uses `credentials: 'include'` so the
cookie travels with the request.

## Quick start

Requires Node 18+ and `pnpm`.

```bash
pnpm install
pnpm dev         # http://localhost:5173 (host: true, reachable on LAN)
pnpm build       # tsc -b && vite build
pnpm preview     # serve the production build
pnpm typecheck   # tsc -b --noEmit
```

For local dev pointing at non-default backends:

```bash
VITE_KREWHUB_URL=http://localhost:8420 \
VITE_KREWAUTH_URL=http://localhost:8421 \
pnpm dev
```

## Project layout

```
src/
  app/MobileApp.tsx            mobile shell
  components/
    atoms/                     low-level sprites + atoms
    auth-view/                 OAuth callback + hire-agent modals
    bundle-tabs.tsx            bundle switcher
    event-feed.tsx             per-agent / per-task event tabs
    footer.tsx, header.tsx     chrome
    hitl-popout.tsx            human-in-the-loop answer UI
    mission-board.tsx          live mission/task board
    mission-composer.tsx       compose a new mission
    mode-dial.tsx              arcade-style mode selector
    party-sidebar.tsx          roster / party view
    task-live-card.tsx         per-task card, attaches to task SSE
  data/                        static roster + task seed
  lib/
    api/krewhub-client.ts      HTTP client for krewhub
    api/recipe-stream.ts       SSE attach helpers
    auth/auth-client.ts        PKCE login + token exchange
    auth/pkce.ts               RFC 7636 helpers
    auth/useAuth.tsx           React auth context
    insets.ts                  safe-area helpers
  styles/tokens.css            design tokens
  main.tsx                     entrypoint
```

## Architecture notes

- **No mock data.** Every screen is driven by the live krewhub backend.
- **OAuth + PKCE.** `auth-client.ts` generates a verifier, redirects to
  krewauth's `/oauth/authorize`, then exchanges the code at
  `/oauth/token`. The resulting session is an httpOnly cookie scoped to
  `.cookrew.dev`.
- **SSE event feed.** `recipe-stream.ts` attaches to the krewhub recipe
  stream; `event-feed.tsx` renders per-agent and per-task tabs,
  including synthetic `sse.open` / `sse.error` rows so connection state
  is visible.
- **Human-in-the-loop.** Tasks that go `status='blocked'` carry a
  `blocked_reason`; the HITL popout surfaces that as the agent's
  question, and operator answers are posted back to the live task.
- **Hire-agent flow.** Agents are hired through `/agents/pair` and
  `/api/v1/agents/runtimes` from the auth-view modals.
- **Single-draft guard.** Mission drafts use a ref-based guard; on a
  `403` (stale draft) the client auto-bundles and retries.

## Contributing

This is a private beta — open an issue or PR if you have access.
