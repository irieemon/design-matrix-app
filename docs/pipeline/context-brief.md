# Context Brief

Captures conversational decisions, user corrections, and rejected alternatives.
Reset at the start of each new feature pipeline.

## Scope
AI Gateway model profile system — admin-switchable model profiles (budget/balanced/premium) with per-task model editing. Refactor modelRouter.ts to read active profile from DB.

## Key Constraints
- All users get the same active profile (no per-tier model routing yet)
- Per-tier model routing flagged as future improvement / upgrade selling point
- Individual task→model mappings must be editable (admin UI) for when new models come out
- Whisper transcription stays as direct @ai-sdk/openai (gateway doesn't support it)
- Gateway fallbacks configured per-task in each profile
- Profile switching must be instant (no redeploy) → DB-driven, not env var

## User Decisions
- Three profiles: budget (Gemini Flash / DeepSeek), balanced (Claude Sonnet 4.6 / GPT-5.4), premium (Claude Opus 4.6 / GPT-5.4)
- Option A chosen: DB-driven profile storage with admin UI dropdown
- Individual task models editable within each profile
- Profile definitions start as code config, admin edits stored in DB override

## Rejected Alternatives
- Env var switching (Option B) — too slow for testing, requires redeploy
- Per-subscription-tier routing — deferred as future feature
