# Cookrew Arcade — Beta

Mobile-first web client for the Cookrew / krewhub backend. Lets you compose missions, hire agents, watch live task activity over SSE, and answer human-in-the-loop prompts — all in a retro arcade UI.

> Status: **beta**. APIs and UI are still moving fast.

## Stack

- React 18 + TypeScript
- Vite 5
- PKCE OAuth against krewhub
- Live updates via Server-Sent Events (recipe stream)

## Quick start

Requires Node 18+ and `pnpm`.

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # tsc -b && vite build
pnpm preview      # serve the production build
pnpm typecheck    # tsc -b --noEmit
```

Dev server binds `host: true` so it's reachable from other devices on the LAN.

## What's in here

```
src/
  app/                    MobileApp shell
  components/
    mission-board.tsx     live mission/task board
    mission-composer.tsx  compose a new mission
    task-live-card.tsx    per-task card, attaches to task SSE
    event-feed.tsx        per-agent / per-task event tabs
    hitl-popout.tsx       human-in-the-loop answer UI
    bundle-tabs.tsx       bundle switcher
    party-sidebar.tsx     roster / party view
    auth-view/            OAuth callback + hire-agent modals
  lib/
    api/krewhub-client.ts HTTP client for krewhub
    api/recipe-stream.ts  SSE attach helpers
    auth/                 PKCE + useAuth
  styles/tokens.css       design tokens
  data/                   static roster / task seed
```

## Architecture notes

- All UI is driven by the real krewhub backend — no mock data.
- The event feed subscribes to the recipe SSE stream and renders per-agent and per-task tabs, including synthetic `sse.open` / `sse.error` rows.
- Blocked tasks surface through the HITL popout; answers are posted back to the live task.
- Agents are hired through `/agents/pair` + `/api/v1/agents/runtimes`.
- Drafts use a single-draft ref guard; on `403` the client auto-bundles and retries.

## Contributing

This is a private beta — open an issue or PR if you have access.
