## Review: PR #17 — DeepSeek Provider (Correctness)

**Overall:** No blocking issues. The implementation is structurally sound, MANAGED_ENV_KEYS is correctly extended, and all 194 tests pass.

### Findings

- **`src/__tests__/providers.test.ts` — DeepSeek buildEnv test only exercises the default model** — The test calls `buildEnv("ds-key-123", "deepseek-v4-pro[1m]")` but never verifies behavior with `deepseek-v4-flash`. Since tier models are fixed regardless of user selection, the only thing that changes is `ANTHROPIC_MODEL`. Testing with the flash model would confirm `ANTHROPIC_MODEL` correctly tracks the user’s selection. — [severity: non-blocking] — [confidence: medium]

- **`src/__tests__/switcher.test.ts` — No DeepSeek-specific switching test** — While the generic `MANAGED_ENV_KEYS` cleanup test (via Zhipu→Ark) exercises the cleanup path for all managed keys including the two new ones, there is no test that switches _to_ or _from_ DeepSeek and asserts `CLAUDE_CODE_SUBAGENT_MODEL` / `CLAUDE_CODE_EFFORT_LEVEL` are written and cleaned correctly. The existing completeness test (`providers.test.ts:MANAGED_ENV_KEYS completeness`) does verify the keys are registered, which covers the contract, so risk is low. — [severity: non-blocking] — [confidence: low]

- **`src/providers.ts` — `buildEnv` ignores selected model for tier assignments** — `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL`, and `CLAUDE_CODE_EFFORT_LEVEL` are all hardcoded regardless of the `model` parameter. When a user selects `deepseek-v4-flash`, `ANTHROPIC_DEFAULT_OPUS_MODEL` and `ANTHROPIC_DEFAULT_SONNET_MODEL` still resolve to `deepseek-v4-pro[1m]`, routing heavy/complex tasks to the pro model. This is intentional per the “Fixed tier model assignments” comment, but may surprise users who expect all tasks to use their selected model. — [severity: non-blocking] — [confidence: high]

- **`src/providers.ts` — `CLAUDE_CODE_EFFORT_LEVEL: "max"` is unconditional** — Setting effort level to max regardless of user model selection means even flash-model users get maximum effort (higher cost/inference time). This is consistent with the “Fixed … per DeepSeek Claude Code integration docs” intent, but worth verifying against the actual DeepSeek integration guidelines. — [severity: non-blocking] — [confidence: medium]

- **`src/providers.ts` — No `API_TIMEOUT_MS` / `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` for DeepSeek** — Unlike Zhipu and MiniMax (both CN providers), DeepSeek does not set these keys. Ark also omits them, so this is not inconsistent, but it is an observable behavioral difference from the other CN providers that may affect reliability for high-latency connections. — [severity: non-blocking] — [confidence: low]

### What’s Correct

- `MANAGED_ENV_KEYS` is correctly extended with both new keys (`CLAUDE_CODE_SUBAGENT_MODEL`, `CLAUDE_CODE_EFFORT_LEVEL`), and the existing `MANAGED_ENV_KEYS completeness` test (iterating all providers’ `buildEnv` output) confirms no key is missing.
- The `detectActiveProviderFromSettings` test for DeepSeek uses the correct base URL and the detection logic correctly returns `"deepseek"`.
- The switch cleanup algorithm (`cleanManagedKeys`) automatically handles the two new keys because they are in `MANAGED_ENV_KEYS` — no code changes needed in `switcher.ts`.
- `buildEnv` does not leak `ANTHROPIC_API_KEY` (Kimi’s pattern) — confirmed by the negative assertion in tests.
- The `buildEnv` return type (`Record<string, string | number>`) is satisfied — all values are `string`.
- Provider uniqueness constraints (unique IDs, unique base URLs, unique model names, exactly one default model) are upheld.
- Version bump `0.6.1` → `0.7.0` correctly follows semver (new feature = minor bump).
- All 194 tests pass.
