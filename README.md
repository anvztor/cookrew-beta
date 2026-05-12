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
| `VITE_KREWHUB_URL` | Base URL for the krewhub API (cookbooks, tasks, runtimes, SSE). |
| `VITE_KREWAUTH_URL` | Base URL for the krewauth OAuth/PKCE service. |
| `VITE_KREWHUB_COOKBOOK_ID` | *(optional)* Local-dev fallback cookbook id. In prod the active cookbook is resolved per-account via `resolveActiveCookbookId(account_id)`. |
| `VITE_KREWHUB_RECIPE_ID` | *(deprecated)* Pre-rename fallback. Still read for back-compat; new envs should set `VITE_KREWHUB_COOKBOOK_ID`. |

---

## Stack

- **React 18** + **TypeScript 5**
- **Vite 5** dev server + bundler
- **PKCE OAuth** against krewauth
- **Server-Sent Events** for the live cookbook + per-invocation streams
- Retro arcade typography (VT323, Silkscreen, JetBrains Mono, Inter)
- **No mock data** — every screen is driven by the real krewhub backend

## What it does

- **Compose missions.** Draft a mission, auto-bundle on `403`, ship it to the backend.
- **Hire agents.** Pair runtimes via `/agents/pair` + `/api/v1/agents/runtimes`.
- **Live mission board.** Per-task cards attach to their own SSE streams.
- **Event feed.** Per-agent and per-task tabs, with synthetic `sse.open` / `sse.error` rows so connectivity is visible.
- **HITL.** Blocked tasks surface in the popout; operator answers post back via `postHitlAnswer`. Sub-invocation elicitations route through `invocation-elicit-popout.tsx`.
- **Task review.** Completed tasks open a review popout (`task-review-popout.tsx`) with the full agent reply rendered as sanitized HTML.
- **Auth-required.** When an upstream tool returns 401/403, the agent surfaces an `auth_required` card (`auth-required-popout.tsx`) for OAuth / paste-token.

## Project layout

```
src/
  app/
    MobileApp.tsx                  mobile shell — auth, bundles, SSE, HITL wiring
  components/
    atoms/                         sprite + primitive UI atoms (incl. agent-html.tsx)
    auth-view/                     OAuth callback + hire-agent modals
    auth-required-popout.tsx       upstream-auth (vault PAT / OAuth) prompt
    bundle-tabs.tsx                bundle switcher
    event-feed.tsx                 per-agent / per-task event tabs
    footer.tsx                     arcade footer
    header.tsx                     arcade header
    hitl-popout.tsx                human-in-the-loop answer UI (legacy HITL path)
    invocation-elicit-popout.tsx   sub-invocation elicitation UI (PR1 projection path)
    mission-board.tsx              live mission / task board
    mission-composer.tsx           compose a new mission
    mode-dial.tsx                  mode selector
    party-sidebar.tsx              roster / party view
    task-live-card.tsx             per-task card, attaches to task SSE
    task-review-popout.tsx         completed-task review (sanitized agent HTML)
  data/
    roster.ts                      runtime → roster member mapping
    tasks.ts                       task lifecycle + HITL derivation
  lib/
    api/krewhub-client.ts          HTTP client (cookbooks, tasks, runtimes, HITL)
    api/cookbook-stream.ts         cookbook-level SSE attach helpers
    api/invocation-stream.ts       per-invocation SSE attach helpers
    auth/auth-client.ts            redirect + token exchange
    auth/pkce.ts                   PKCE verifier / challenge
    auth/useAuth.tsx               auth context + hook
    insets.ts                      safe-area insets
  styles/
    tokens.css                     design tokens
    agent-html.css                 styles for sanitized agent HTML output
  main.tsx                         entry point
```

## Architecture notes

- **Backend-driven UI.** Every list, badge, and event row originates from krewhub. The in-process event bus is intentionally *not* wired into the feed — on-screen events come from the cookbook / invocation SSE streams so the UI cannot drift from server truth.
- **Cookbook resolution.** On load, `resolveActiveCookbookId(account_id)` discovers the operator's auto-bootstrapped "my-cookbook". `VITE_KREWHUB_COOKBOOK_ID` (and the legacy `VITE_KREWHUB_RECIPE_ID`) are local-dev fallbacks only.
- **Recipe → cookbook rename.** The backend renamed `recipe` to `cookbook` across API + SSE; the UI follows. `recipe-*` filenames and env vars are gone except for the back-compat env fallback in `MobileApp.tsx`.
- **Drafts.** Mission drafts use a single-draft ref guard; on `403` the client auto-bundles and retries.
- **HITL vs. invocation elicitation.** Top-level human prompts on a task still route through `hitl-popout.tsx` and `postHitlAnswer` (legacy `/hitl/answer`). Nested sub-invocation prompts route through `invocation-elicit-popout.tsx` against the invocation projection.
- **Sanitized agent HTML.** Agent replies are HTML, rendered via DOMPurify (`atoms/agent-html.tsx` + `styles/agent-html.css`). No inline event handlers, no external resources.

## Contributing

Private beta. If you have access, open an issue or PR — small, focused changes preferred.

## License

No public license. All rights reserved by the author.
