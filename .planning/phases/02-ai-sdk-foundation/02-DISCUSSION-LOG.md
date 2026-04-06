# Phase 2: AI SDK Foundation - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-06
**Phase:** 02-ai-sdk-foundation
**Mode:** assumptions
**Areas analyzed:** AI SDK Package Integration, Handler Decomposition, Model Router Design, Streaming Adoption Scope

## Assumptions Presented

### AI SDK Package Integration
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Install `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`; replace raw fetch() with generateText() | Confident | package.json has zero AI SDK packages; api/ai.ts uses raw fetch at lines 188, 377, 810, 881, 1204, 1724+ |

### Handler Decomposition
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Extract 6 handlers to api/_lib/ai/; api/ai.ts becomes thin router; preserve ?action=X URL contract | Confident | Router switch at api/ai.ts:2496 provides clean handler boundaries; api/_lib/ convention matches existing structure |

### Model Router Design
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| New server-side api/_lib/ai/modelRouter.ts replaces existing OpenAIModelRouter | Likely | openaiModelRouter.ts references fictional gpt-5 IDs; lives in frontend src/ bundle; production code uses gpt-4o |

### Streaming Adoption Scope
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Keep all 6 actions non-streaming; use generateText() not streamText() | Confident | All handlers return res.json(); BaseAiService.fetchWithErrorHandling calls response.json() |

## Corrections Made

No corrections — all assumptions confirmed.

## External Research Flagged

- **MiniMax provider for AI SDK v6**: Unknown if first-party `@ai-sdk/minimax` exists or requires community adapter. Researcher should verify package availability before planning.
- **Real OpenAI model IDs**: `openaiModelRouter.ts` references fictional `gpt-5` IDs; production code uses `gpt-4o`. Researcher should confirm current valid model IDs (gpt-4o, gpt-4o-mini, claude-3-5-sonnet, etc.) before building the new router.
