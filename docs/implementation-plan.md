# FMIT Post Studio Implementation Plan

**Goal:** Build and verify a branded VK post generator and bot, then push it to the requested private GitHub repository.

**Architecture:** Node.js 24 + Express serves a React editor, a shared draft service and a VK Long Poll worker. SQLite persists drafts, confirmations and bot sessions. Sharp renders reproducible branded PNGs; an OpenAI-compatible endpoint generates copy.

**Execution:** Complete tasks in this session. The working directory is the empty user-selected `C:/Work/Cursach`; no worktree is needed. Verify before the user-authorized initial commit and push.

- [x] Bootstrap TypeScript, Vite, React, Express, linting and Node test scripts; add environment and ignore rules.
- [x] Write failing behavior tests for brief validation, AI responses, drafts, publishing, authorization, bot messages and cover rendering. Run `npm test` and verify the expected missing-feature failures.
- [x] Implement `shared/contracts.ts`, `server/config.ts`, `server/errors.ts`, `server/generator.ts`, `server/store.ts`, `server/cover.ts`, `server/vk.ts`, `server/publisher.ts` and `server/bot.ts`. Run the behavior tests and resolve failures at their source.
- [x] Implement `server/app.ts` and `server/index.ts`: password sessions, same-origin API guards, validation, rate limits, persistent drafts, PNG export, chat preview and static serving. Add HTTP integration tests before these endpoints.
- [x] Implement `src/App.tsx`, focused editor/preview/library/settings components, `src/styles.css` and local fonts/brand assets. Use accessible forms and responsive layouts.
- [x] Add Russian `README.md` with PowerShell commands, VK permissions, bot startup, demo/AI modes and publication confirmation; add project `AGENTS.md` and a GitHub Actions example in docs (current OAuth scope cannot activate workflows).
- [x] Run `npm run check`, `npm test`, `npm run lint` and `npm run build`. Exercise browser flows at desktop/mobile widths and inspect rendered covers. Save verification evidence.
- [ ] Inspect staged files for credentials. Create the private GitHub repository, make the authorized initial commit, push and verify repository visibility and the remote commit.
