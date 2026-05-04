## Review: Robustness — PR #17 (DeepSeek provider)

### Security

- `src/providers.ts:146-153` — Raw API key stored in `settings.json` via `ANTHROPIC_AUTH_TOKEN` (mode 0o600). Consistent with existing providers (Ark, Zhipu, MiniMax) — no new risk. — [severity: non-blocking] — [confidence: high]

- `src/switcher.ts:223-231` — `checkShellOverrides()` only warns on `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`. The two new keys `CLAUDE_CODE_SUBAGENT_MODEL` and `CLAUDE_CODE_EFFORT_LEVEL` that DeepSeek now writes are **not** covered. If a user has either set in their shell environment, the settings.json values will be silently overridden with no warning, potentially causing subagents to use an unintended model or effort level. — [severity: non-blocking] — [confidence: high]

- `src/providers.ts:151` — `CLAUDE_CODE_EFFORT_LEVEL: "max"` is a numeric-looking value but declared as string `"max"` (not numeric `1`). Claude Code's documented values are `"high"`, `"medium"`, `"low"`, not `"max"`. If Claude Code rejects `"max"`, the effort level would fall back to default silently. — [severity: non-blocking] — [confidence: low]

- `src/switcher.ts:156,202-211` — API key redaction in logs confirmed correct: first 4 + `****` + last 4 chars (or `****` for short keys). Key is never logged in plaintext. No new exposure. — [severity: none] — [confidence: high]

### Edge Cases

- `src/providers.ts:150-151` — Tier model assignments (`ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`) always point to `deepseek-v4-pro[1m]` regardless of which model the user selects. If the user chooses `deepseek-v4-flash` as primary for cost reasons, Claude Code will still route Opus/Sonnet-tier tasks to the more expensive `pro[1m]`. This is documented as intentional ("Fixed tier model assignments per DeepSeek Claude Code integration docs") but users receive no warning. — [severity: non-blocking] — [confidence: high]

- `src/switcher.ts:119-173` — `switchProvider()` performs read-modify-write on both `settings.json` and `config.json` without file locking. Two concurrent `claude-switch` instances produce a last-writer-wins race, potentially losing env keys or backup state. Generic architectural issue, not DeepSeek-specific. — [severity: non-blocking] — [confidence: medium]

- `src/providers.ts:143` — DeepSeek API key URL `https://platform.deepseek.com/api_keys` is hardcoded. If DeepSeek changes this URL, users see a dead link in the API key prompt. Non-critical since keys can still be entered manually. — [severity: non-blocking] — [confidence: low]

- `src/providers.ts:148-149` — If `deepseek-v4-pro[1m]` becomes unavailable (rate-limited, deprecated, or not included in a user's API tier), all Opus/Sonnet-tier requests fail since both `ANTHROPIC_DEFAULT_OPUS_MODEL` and `ANTHROPIC_DEFAULT_SONNET_MODEL` hardcode it. No fallback mechanism. — [severity: non-blocking] — [confidence: medium]

- `src/__tests__/providers.test.ts:94-105` — DeepSeek test only exercises `buildEnv` with `deepseek-v4-pro[1m]` as the selected model. No test verifies behavior when the user selects `deepseek-v4-flash` (the other valid model), leaving the tier-fixation-with-flash-primary edge case untested. — [severity: non-blocking] — [confidence: high]

- `src/providers.ts:146` — Model name `deepseek-v4-pro[1m]` contains brackets `[]` in the value. Valid JSON and safe in settings.json (not shell-expanded). Claude Code reads directly from JSON. No issue. — [severity: none] — [confidence: high]
