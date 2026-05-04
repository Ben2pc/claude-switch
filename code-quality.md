# Code Quality Review — PR #17 (DeepSeek provider)

## Review summary

The DeepSeek provider addition follows existing project conventions well. The `ProviderDefinition` shape, naming conventions, test patterns, and inline comment style all match. The new env keys (`CLAUDE_CODE_SUBAGENT_MODEL`, `CLAUDE_CODE_EFFORT_LEVEL`) are properly registered in `MANAGED_ENV_KEYS` and covered by tests. No blocking issues. Two low-confidence maintainability notes around hardcoded model strings and test coverage for non-default model selection.

---

### Consistency

- Correct: Provider structure (`id`, `displayName`, `baseUrl`, `apiKeyUrl`, `models`, `buildEnv`) matches all existing providers identically. `src/providers.ts:95-120` ✅
- Correct: `displayName: "DeepSeek (CN)"` matches the `"Zhipu (CN)"`, `"MiniMax (CN)"`, `"Kimi (CN)"` suffix convention. `src/providers.ts:96` ✅
- Correct: Model `displayName` format (`"DeepSeek V4 Pro"`, `"DeepSeek V4 Flash"`) matches Ark’s `"Doubao Seed 2.0 Code"` style. `src/providers.ts:101-102` ✅
- Correct: Inline comment `// Fixed tier model assignments …` inside `buildEnv` mirrors Kimi’s `// Kimi Coding Plan uses ANTHROPIC_API_KEY (not AUTH_TOKEN).` at `src/providers.ts:79`. `src/providers.ts:109` ✅
- Correct: Provider test `it("DeepSeek uses ANTHROPIC_AUTH_TOKEN with fixed tier model assignments", …)` mirrors the per-provider pattern of `Zhipu`, `MiniMax`, `Kimi` tests, including `not.toHaveProperty` assertions for absent keys. `src/__tests__/providers.test.ts` ✅
- Correct: Switcher test `it("returns 'deepseek' when ANTHROPIC_BASE_URL matches DeepSeek", …)` follows the same one-liner pattern as Ark/Zhipu/MiniMax detection tests. `src/__tests__/switcher.test.ts` ✅
- Correct: `MANAGED_ENV_KEYS` test for `CLAUDE_CODE_SUBAGENT_MODEL` / `CLAUDE_CODE_EFFORT_LEVEL` mirrors the pre-existing `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` assertion in the `"provider constraints"` block. `src/__tests__/providers.test.ts` ✅
- Note: No `kimi` base-URL detection test exists in `src/__tests__/switcher.test.ts`, so the test file was already missing coverage for one provider before this PR — pre-existing gap, not introduced here. [non-blocking] [confidence: high]

### Maintainability

- Note: Model name strings `"deepseek-v4-pro[1m]"` and `"deepseek-v4-flash"` appear in both the `models` array (lines 100-101) and `buildEnv` return object (lines 111-114). If model names change, two places need updates. Project is small and the two sources serve different purposes (user-facing model registry vs. tier-assignment env vars), so extracting a shared constant is arguably YAGNI. [non-blocking] [confidence: low]

- Note: The provider test only exercises `buildEnv` with the default model (`"deepseek-v4-pro[1m]"`). No assertion validates that selecting the non-default model (`"deepseek-v4-flash"`) still produces the correct tier assignments (which should remain fixed). Existing Ark provider test has the same pattern (only tests one model), so this is consistent with the codebase. [non-blocking] [confidence: low]

- Correct: `CLAUDE_CODE_EFFORT_LEVEL: "max"` is a DeepSeek-specific requirement per their Claude Code integration docs. No other provider sets it, but this is expected. The key is properly added to `MANAGED_ENV_KEYS` for cleanup on switch. [confidence: high]

- Correct: No dead code, no YAGNI violations. The new provider is a clean, self-contained addition. [confidence: high]
