## Review: Documentation Sync — PR #17 (Add DeepSeek provider)

### Correct
- CLI/CLAUDE.md and AGENTS.md — the "Adding a New Provider" checklist (steps 1–4) is a process document, not a provider catalog. It does not enumerate current providers, so no drift here.
- README.md shell-override section — lists `ANTHROPIC_AUTH_TOKEN` which DeepSeek uses; no update needed.
- The two new env keys (`CLAUDE_CODE_SUBAGENT_MODEL`, `CLAUDE_CODE_EFFORT_LEVEL`) are internal to `buildEnv()`; they do not need user-facing README documentation.

### Findings

1. **README.md:14 — "Supported Providers" table missing DeepSeek** — [severity: blocking] — [confidence: high]
   - The README lists five providers in its table: Claude, Volcano Ark, Zhipu, MiniMax, Kimi.
   - DeepSeek — with two models (`deepseek-v4-pro[1m]`, `deepseek-v4-flash`) — is absent.
   - The README is the public-facing documentation. Per instructions, a missed provider in a doc that lists supported providers is blocking.

2. **docs/2026-04-01-claude-switch-design.md:5,131 — Chinese design doc is stale: says "four providers" and env-cleanup list is incomplete** — [severity: non-blocking] — [confidence: high]
   - Line 5: claims "支持 Claude 原生、火山方舟、智谱、MiniMax 四个 Provider" — now six exist (Kimi + DeepSeek added since).
   - Lines 131–141: the "env 清理全集" block lists 9 managed env keys but is missing `CLAUDE_CODE_SUBAGENT_MODEL` and `CLAUDE_CODE_EFFORT_LEVEL` (both added by this PR) and `ANTHROPIC_API_KEY` (added by an earlier Kimi PR).
   - This is a historical/archival spec, not a living operational doc. Flagging as non-blocking.

3. **docs/superpowers/specs/2026-04-10-custom-providers-design.md:197 — built-in provider IDs list `claude`, `ark`, `zhipu`, `minimax`; missing `kimi` and `deepseek`** — [severity: non-blocking] — [confidence: medium]
   - The ID conflict section references only four built-in IDs. Since this is a spec from April 10 that predates both Kimi and DeepSeek, it is historical. May cause confusion if someone references it as the authoritative list of reserved IDs.

4. **`docs-sync.md` file itself — reviewer output artifact** — [severity: none] — [confidence: high]
   - This file (the review output) is being written by instruction. It is not project documentation and should not be committed without review.

### Summary
The only blocking drift: **README.md "Supported Providers" table** must add a DeepSeek row with its two models. All other docs either don't enumerate providers or are historical design specs where staleness is expected.
