# Custom Providers Design

## Problem

Providers are hardcoded in `src/providers.ts`. Users who want to connect Claude Code to a custom proxy or new API provider must fork the repo and modify source code.

## Goal

Allow users to define custom providers via TUI or config file, with the same switch experience as built-in providers.

## Data Model

Custom providers are stored in `~/.claude-switch/config.json` under `customProviders`:

```json
{
  "customProviders": [
    {
      "id": "my-proxy",
      "displayName": "My Proxy",
      "baseUrl": "https://my-proxy.example.com/v1",
      "models": [
        { "name": "gpt-4o", "default": true },
        { "name": "claude-3.5-sonnet" }
      ],
      "envVars": {
        "ANTHROPIC_BASE_URL": "https://my-proxy.example.com/v1",
        "ANTHROPIC_AUTH_TOKEN": "{{API_KEY}}",
        "ANTHROPIC_MODEL": "{{MODEL}}",
        "API_TIMEOUT_MS": "3000000"
      }
    }
  ]
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier, used for CLI quick-switch. Must not conflict with built-in provider IDs. |
| `displayName` | Yes | Shown in TUI menu. |
| `baseUrl` | Yes | API base URL. Also used for provider detection in `switcher.ts`. |
| `models` | No | Array of `{ name, displayName?, description?, default? }`. Omit for single-model providers where model selection is unnecessary. |
| `envVars` | No | Explicit env var mapping written to `~/.claude/settings.json`. Supports `{{API_KEY}}` and `{{MODEL}}` placeholders for runtime substitution. |

### Default env behavior

When `envVars` is omitted, the following default template is used:

```json
{
  "ANTHROPIC_BASE_URL": "<baseUrl>",
  "ANTHROPIC_AUTH_TOKEN": "<apiKey>",
  "ANTHROPIC_MODEL": "<model>"
}
```

### Placeholder substitution

- `{{API_KEY}}` → the stored API key for this provider
- `{{MODEL}}` → the selected model name

Values without placeholders are written as-is (e.g., `"API_TIMEOUT_MS": "3000000"`).

## Provider Unification

### `getAllProviders()` function

New function in `providers.ts` that merges built-in `PROVIDERS` with custom providers from config:

```typescript
function buildEnvFromConfig(
  envVars: Record<string, string>,
  apiKey: string,
  model: string,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(envVars)) {
    result[key] = value
      .replace(/\{\{API_KEY\}\}/g, apiKey)
      .replace(/\{\{MODEL\}\}/g, model);
  }
  return result;
}
```

Custom provider definitions are converted to `ProviderDefinition` with a generated `buildEnv()` that performs placeholder substitution.

### Consumers to update

All code that references the `PROVIDERS` array directly needs to use `getAllProviders()` instead:

- `src/index.ts` — TUI main menu, provider lookup
- `src/cli.ts` — `runList()`, `runQuickSwitch()`, `printHelp()`
- `src/switcher.ts` — `detectActiveProviderFromSettings()`

Since `getAllProviders()` requires reading config (async), the call sites need to pass config or call it at the appropriate point.

## TUI Design

### Main menu

Custom providers appear after built-in providers, before the separator:

```
  Claude (Native)      ● active
  Volcano Ark          ○ not configured
  Zhipu                ○ not configured
  MiniMax              ○ not configured
  My Proxy             ○ not configured        ← custom
  ──────────────────
  ⚙  Manage MCP Servers (0/5 active)
  ⚙  Manage Custom Providers                   ← new entry
```

Custom providers use the same switch flow as built-in providers (API key input → model selection → switch).

### Manage Custom Providers submenu

```
  + Add Provider
  ──────────────
  My Proxy                                     ← existing custom
  Another One
```

- Select existing → edit/delete submenu
- ESC → return to main menu

### Add Provider flow

Sequential prompts:

1. **Provider ID** — text input, validated: no spaces, no conflict with built-in IDs
2. **Display Name** — text input
3. **Base URL** — text input, validated: starts with `http://` or `https://`
4. **Models** — loop: add model (name, displayName?, description?, default?), or finish
5. **Env Vars** — select input method:
   - "Use default (3 vars)" → skip, use default template
   - "Key-value pairs" → loop: select/input key, input value, or finish
   - "Paste JSON" → multi-line text input, parsed as JSON object
6. **Confirm** — show summary, save on confirm

### Edit Provider

List all fields, user selects which to modify. Same input methods as add flow for each field.

### Delete Provider

Confirmation prompt → remove from `customProviders` + remove stored API key.

## CLI

- `claude-switch list` — includes custom providers in output
- `claude-switch <custom-id> [model]` — quick-switch works with custom provider IDs
- `claude-switch --help` — dynamically lists all provider IDs (built-in + custom)

## Constraints

- Built-in providers are not editable or deletable
- Custom providers do not support MCP association (MCP management remains built-in only)
- No import/export/sharing of provider configs
- No validation of envVars correctness (user responsibility)
- Custom provider IDs must not conflict with built-in IDs or reserved words (`list`, `help`)
- `apiKeyUrl` is not supported for custom providers; API key prompt uses generic message

## MANAGED_ENV_KEYS impact

Custom providers may write env keys not in the current `MANAGED_ENV_KEYS` list. Two options:

1. **Dynamic**: merge custom provider env keys into the managed set at runtime
2. **Static**: only clean known keys, custom keys persist

Approach: **Dynamic**. When building the full provider list, collect all env keys from custom provider `envVars` and union them with the static `MANAGED_ENV_KEYS`. This ensures clean switching between any providers.
