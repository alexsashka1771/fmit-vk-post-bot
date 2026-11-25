# FMIT Post Studio

## Purpose

A VK community bot and a browser editor for preparing Russian posts for **ФМиИТ СФ УУНиТ**, community `157438856` (`https://vk.ru/fmiit_struust`). The reference is the community page provided by the user, inspected on 2026-11-25. Its visual identity combines violet, blue, white type and a circular faculty avatar. Existing posts use short introductory headings, readable paragraphs, occasional emoji and the tags `#СФУУНиТ` and `#СФУУНиТ_ФМиИТ`.

## Editorial flow

1. An editor selects a category, tone and length, then supplies a topic and verified facts.
2. An OpenAI-compatible provider generates a heading, body, hashtags and cover copy. The prompt prohibits inventing dates, places, names, links or results; the editor checks facts before publication. Demo mode uses explicit templates and is visibly labelled.
3. The editor adjusts the copy and chooses one of three original cover layouts: violet/blue brand, dark technical blueprint, light editorial paper. PNG export is 1600 × 1000 with bundled Cyrillic fonts.
4. Drafts persist in local SQLite and can be opened from either the browser or an authorized VK chat.
5. Publishing requires an explicit confirmation tied to the current draft revision. The server uploads the cover and calls `wall.post` once with a stable `guid`. Published drafts cannot be accidentally reposted.

## Bot

The bot uses Bots Long Poll and community messages. Commands: `начать`, `пост <brief>`, `черновики`, `открыть <id>`, `текст <new body>`, `обложка`, `ещё вариант`, `публиковать`, `подтвердить`, `отмена`, `помощь`. VK keyboards provide the common actions. Only VK user IDs in `VK_ADMIN_IDS` may generate, view or publish drafts. Conversation state and processed events persist in SQLite. A community token handles chat; a separate user token with wall/photos permissions handles wall publication, as required by the official VK API schema.

## Browser experience

An editorial workspace with a dark navigation rail, warm off-white canvas, violet accents, original geometric faculty illustrations and an immediate VK-style preview. Sections: new post, draft library, bot chat preview and connection settings. Every visible action operates on real data. Desktop uses a two-column editor/preview; mobile stacks panels. Forms have labels, keyboard focus, clear progress, recoverable errors and reduced-motion support. The reference avatar is a local asset; no external trackers are included.

## Architecture

One Node.js 24 process serves an Express API and the compiled Vite/React client. TypeScript shared types define the draft contract. Separate modules own validation, prompt generation, SQLite, image rendering, VK transport, publishing and bot state. Long Poll runs only when a community token and admin allowlist are configured. The app binds to loopback by default. Non-loopback access requires an admin password. Password authentication uses signed HttpOnly cookies; API writes enforce same-origin requests. Secrets are environment variables and are never returned to clients or written to the repository.

## Verification

Automated tests exercise input validation, preservation of provided facts in demo output, provider parsing and errors, SQLite persistence, authorization, revisions, confirmation and duplicate publication protection, VK API request contracts, bot handling and PNG dimensions. Build/typecheck and lint must pass. Browser checks cover generation, editing, cover download, drafts, connection state, chat demo and mobile overflow. Real VK publishing is not attempted without the user's credentials; integration tests use a local API double.

## Delivery

Source, lockfile, tests, setup guide, `.env.example`, font license and a reusable CI example go to a new private repository `alexsashka1771/fmit-vk-post-bot`. The authenticated GitHub account has repository scope; the Actions example stays in `docs/` because activating workflows requires additional workflow scope. The user's request authorizes the initial commit and push. Local data, secrets, tools and build output are excluded.
