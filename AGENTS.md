# AGENTS.md

Instructions for AI coding agents (Codex, Cursor, Gemini, Copilot, etc.).

The single source of truth is [`CLAUDE.md`](./CLAUDE.md). Read it before changing anything, especially:

- **Git / PR workflow** (branch naming, English-only commits/comments/PRs, `feature -> dev -> main` with squash merge).
- **Golden rules** for UI and backend.

Quick reminders:

- Branch: `<type>/<kebab-case-summary>`, self-explanatory, from an up-to-date `dev`.
- Commits: Conventional Commits, in English.
- Code comments: only when strictly necessary, one line, in English.
- PRs: target `dev` first; `main` only receives a squash-merged PR from `dev`. Never push or merge into `main` directly.
