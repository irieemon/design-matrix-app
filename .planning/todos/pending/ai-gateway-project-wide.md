---
title: Decide & migrate AI Gateway scope project-wide
created: 2026-04-07
source: HANDOFF.json item (e), transcribe-audio debug session
priority: medium
type: scope-decision + refactor
---

# AI Gateway: project-wide adoption

## Context

During the transcribe-audio 500 debug session, we hit `AI_GATEWAY_API_KEY`
missing in prod. Workaround shipped in `5e41531`: `api/_lib/ai/transcribeAudio.ts`
now calls OpenAI directly via `@ai-sdk/openai` + `OPENAI_API_KEY`, bypassing the
Vercel AI Gateway.

Other handlers (`api/_lib/ai/analyzeFile.ts`, anything using
`api/_lib/ai/providers.ts` `getModel`) still route through the gateway and
will fail under the same condition.

## User direction (2026-04-07)

> "centralized gateway makes sense"

User leans toward **Option B: adopt AI Gateway project-wide** rather than
ripping it out. transcribeAudio.ts is currently the *outlier*, not the model.

## Decision needed

- [ ] Confirm: AI Gateway is the project-wide standard (Option B)
- [ ] Provision `AI_GATEWAY_API_KEY` in Vercel prod env (or set up OIDC auth
      via `vercel env pull` per Vercel best practices — preferred for
      auto-rotation)
- [ ] Migrate `transcribeAudio.ts` *back* to the gateway pattern once key
      is in place (revert/replace the bypass from `5e41531`)
- [ ] Audit all `api/_lib/ai/*.ts` callsites for consistency
- [ ] Remove `OPENAI_API_KEY` direct usage from server-side AI handlers
      (keep only as gateway fallback if needed)

## Why this is a real plan, not a quick fix

- Touches every AI handler in `api/_lib/ai/`
- Requires env var provisioning + OIDC setup decision
- Has rollback implications (the bypass exists for a reason — must verify
  gateway is reachable before reverting)
- Should run as its own `/gsd-plan-phase` or `/gsd-quick` task with tests

## Related

- Commit `5e41531` — gateway bypass (to be reverted)
- Commit `3425242` — debug field cleanup
- Phase 04 (Audio & Voice-to-Idea) debug session: `.planning/debug/transcribe-audio-500.md`
