# claude-switch

Interactive TUI CLI tool to switch Claude Code between API providers.

## Project Structure

```
src/
  index.ts      — Entry point, TUI menus and user interaction flow
  providers.ts  — Provider definitions (id, baseUrl, models, buildEnv)
  config.ts     — Read/write ~/.claude-switch/config.json (API keys, backup)
  settings.ts   — Read/write ~/.claude/settings.json (Claude Code settings)
  switcher.ts   — Provider detection, env backup/restore, switch logic
  logger.ts     — Append-only file logging with daily rotation
```

## Key Concepts

- **Provider switching** works by writing env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, etc.) to `~/.claude/settings.json`
- **Native env backup**: when switching away from Claude Native, existing managed env keys are saved to config and restored when switching back
- **Managed env keys** (`MANAGED_ENV_KEYS` in providers.ts): all env keys any provider may write — cleaned before each switch to avoid stale values
- **ESC navigation**: all inquirer prompts are wrapped with `withEsc()` which listens for raw ESC byte on stdin

## Build & Run

```bash
npm run build   # TypeScript → dist/
npm start       # Run from dist/
npm run dev     # Watch mode
```

## Adding a New Provider

1. Add a `ProviderDefinition` entry to the `PROVIDERS` array in `src/providers.ts`
2. Implement `buildEnv(apiKey, model)` returning the env vars Claude Code needs
3. Add any new env keys to `MANAGED_ENV_KEYS`
4. That's it — the TUI, config, and switching logic are provider-agnostic
