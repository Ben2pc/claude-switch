# claude-switch

Interactive TUI tool to switch [Claude Code](https://docs.anthropic.com/en/docs/claude-code) between API providers.

```
? Select Provider (ESC to quit)
❯ Claude (Native)  ● active
  Volcano Ark      ○ not configured
  Zhipu            ✔ configured
  MiniMax          ○ not configured
```

## Features

- Switch Claude Code between multiple API providers with one command
- Per-provider API key management (configure / reconfigure / remove)
- Native env backup & restore when switching away from Claude
- Shell env override detection (`ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`)
- ESC key navigation at every menu level
- File-based logging with API key redaction

## Supported Providers

| Provider | Models |
|---|---|
| **Claude (Native)** | Default Anthropic API |
| **Volcano Ark** | doubao-seed-2.0-code, doubao-seed-2.0-pro, deepseek-v3.2, kimi-k2.5, and more |
| **Zhipu** | GLM-4.7, GLM-5.1, GLM-5, GLM-5-Turbo, GLM-4.5-Air |
| **MiniMax** | MiniMax-M2.7 |

## Install

```bash
npm install -g github:pangcheng1849/claude-switch
```

Or clone and link locally:

```bash
git clone https://github.com/pangcheng1849/claude-switch.git
cd claude-switch
npm install && npm run build
npm link
```

Then run:

```bash
claude-switch
```

## How It Works

claude-switch writes provider-specific environment variables to `~/.claude/settings.json` (the `env` field). After switching, restart Claude Code to apply changes.

**Config** is stored at `~/.claude-switch/config.json` (API keys, native env backup).

**Logs** are written to `~/.claude-switch/logs/YYYY-MM-DD.log` with daily rotation and sensitive data redacted.

## Development

```bash
npm install
npm run build
npm start
```

## License

MIT
