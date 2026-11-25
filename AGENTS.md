# FMIT Post Studio

## Scope

VK post generator and community bot for ФМиИТ СФ УУНиТ, group 157438856. Reference style is violet/blue, based on https://vk.ru/fmiit_struust. Answer the user in Russian; code, comments and commit messages are English.

## Stack and commands

- Windows, PowerShell-compatible commands; Node.js >=24.18, npm, TypeScript, React 19/Vite, Express 5, Sharp, built-in SQLite.
- `npm ci` installs dependencies. `npm run dev` starts API and Vite. `npm run build` builds the browser client. `npm start` serves it and optionally starts Long Poll.
- `npm run verify` runs typecheck, behavior tests, lint and build. `npm audit` checks dependencies.
- Test behavior before implementing a bugfix. Confirm checks before claiming success, committing or pushing.

## Boundaries

- `shared/`: domain contracts and validation; `server/`: configuration, generation, persistence, PNGs, VK transport, publishing, bot state and HTTP API; `src/`: editor UI.
- Keep server code and secrets out of the client bundle. Credentials are environment variables; `.env.example` contains blanks, never real keys.
- `data/`, local tools, dependencies and build output are ignored. SQLite and chat sessions are local data.
- AI uses an OpenAI-compatible `/chat/completions` endpoint. Demo output must be explicitly identified. The prompt must never invent event facts.
- VK community tokens handle messages; separate user tokens with wall/photos rights handle publication. Publishing needs an expiring confirmation of the exact draft revision and a stable VK `guid`.
- Only `VK_ADMIN_IDS` may use the real bot. The browser simulator never publishes to VK.
- Bind to loopback by default; require an admin password for non-loopback access. Protect state-changing requests from cross-origin use.

## Git and external services

The user authorized creating the private repository `alexsashka1771/fmit-vk-post-bot`, making the initial commit and pushing this task's code. Do not change git config, force-push, reset work or publish actual VK posts unless separately requested. Review staged files for secrets.
