# AI Interaction Audit — Prioritas v1.3
**Session 7 | Date: 2026-04-19 | Author: Sable (UX Design Producer)**

---

## Ship/No-Ship Call

**NO-SHIP on AI surfaces.** One P0 confirmed: silent AI failure presents boilerplate as AI output, which a paying customer will detect and interpret as either a broken product or deliberate deception. The AI Idea Assistant modal also has a minor trust gap (no feedback during generation). Clear P0-AI-01 to flip AI surfaces to ship.

---

## Design System

**Design system:** No design system found (tokens referenced from Tailwind config and observed class names in source).

---

## Scope

This audit covers all AI-powered surfaces in Prioritas v1.3:

- AI Idea Assistant modal (Generate tab, Image tab, Audio tab)
- AI Project Starter modal (text-based project generation)
- Insights page (Generate AI Insights)
- Roadmap page (Generate Roadmap)
- Supporting Files / file upload for AI context

---

## TL;DR

| Severity | Count | Summary |
|---|---|---|
| P0 | 1 | Silent AI failure — fallback boilerplate presented as AI output with no error indication |
| P1 | 3 | No generation progress copy, AI model selector exposed without explanation, quota copy understates the constraint |
| P2 | 2 | "How it works" panel always visible (wastes space for returning users), Image/Audio tabs present but non-functional feel |

---

## P0 Findings — Ship Blockers

---

### P0-AI-01 — Silent AI Failure: Fallback Boilerplate Presented as AI Output

**Screen:** AI Idea Assistant modal (Generate tab)  
**File:** `src/components/AIIdeaModal.tsx:312-331`  
**User impact:** When the AI generation call fails (network error, quota exhausted, API 400), the catch block at line 312 calls `generateFallbackIdea(title.trim())` which returns an object with `details` set to: `"AI service temporarily unavailable. {title} represents an interesting opportunity that should be explored further with detailed analysis and stakeholder input."` This fallback idea is then set as `generatedIdea` via `setGeneratedIdea(fallbackIdea)` and presented in the modal exactly as a successful AI result would be. No error toast fires. No error state is shown in the modal. The "Add to Idea Matrix" button activates.

A paying customer who uses the AI Idea Assistant, gets a 400 from `/api/ai?action=generate-ideas`, and sees a card with their title plus a boilerplate generic sentence will do one of two things: (a) notice the text says "AI service temporarily unavailable" in the details field — in which case they feel deceived because the modal showed no error; or (b) not notice and add the boilerplate idea to their matrix thinking it was AI-generated — in which case they have paid for AI and received nothing. Either outcome is a trust failure.

The `showSuccess('Idea created', 3000)` toast at line 310 only fires on the happy path (before the catch), so the failure path receives no user feedback at all.

**Evidence:** Source at `AIIdeaModal.tsx:312-316` confirmed via direct read. The fallback text "AI service temporarily unavailable" confirmed at line 327. Screenshot `22-ai-generate-during-desktop.png` shows the Generate AI Ideas state; no error state screenshots were captured because the failure is silent.

#### Remediation Spec

Edit `src/components/AIIdeaModal.tsx`. In the catch block at line 312, replace the silent fallback pattern with an explicit error state. Remove the `generateFallbackIdea` call and the `setGeneratedIdea(fallbackIdea)` line from the catch block. Instead: (1) set an error state variable (e.g., `setGenerationError(true)` or use an existing error state if one exists); (2) call `showError('AI generation failed. Please try again.')` using the existing toast utility; (3) leave `generatedIdea` as null so the "Add to Idea Matrix" button remains disabled. The `generateFallbackIdea` function can be removed entirely — it exists solely to power the silent failure path and has no legitimate use case.

Before: failure path silently populates the modal with "AI service temporarily unavailable" boilerplate, Add button activates, no error is shown.

After: failure path shows an inline error message in the modal (e.g., "AI generation failed — check your connection or try again") plus a `showError` toast. The generated idea area is cleared. The "Add to Idea Matrix" button remains disabled. The user can retry or dismiss.

Acceptance criteria: trigger a generation failure (e.g., by temporarily blocking the `/api/ai` route or exhausting quota in test) and confirm: (a) no fallback boilerplate appears in the modal, (b) a visible error message appears, (c) the Add button is disabled, (d) the `showError` toast fires. Also confirm the `generateFallbackIdea` function is deleted (no dead code).

---

## P1 Findings — Polish

---

### P1-AI-01 — No In-Modal Progress Feedback During AI Generation

**Screen:** AI Idea Assistant modal (Generate tab)  
**File:** `src/components/AIIdeaModal.tsx`  
**User impact:** Screenshot `22-ai-generate-during-desktop.png` shows the "Generate AI Ideas" button with a spinner state — but no copy change, no animation on the result area, and no estimated time indication. AI generation on the backend can take 3-8 seconds. Users who submitted and see the spinner stop may be unsure whether generation succeeded or silently failed (particularly relevant given P0-AI-01's silent failure mode, which this finding compounds).

**Fix:** Add a transitional loading state to the modal content area when `isGenerating` is true. Minimum: replace the blank result area with a skeleton card (animated pulse) and a short progress label like "Generating your idea..." For extra polish (P2 territory): rotate through 2-3 brief loading messages ("Analyzing your brief title...", "Generating description...", "Assigning priority level...") at 2-second intervals. This sets expectation and reduces perceived wait time. The button spinner alone is insufficient for a 3-8 second wait.

---

### P1-AI-02 — AI Model Selector on Insights Page Unexplained

**Screen:** Insights  
**File:** Insights page component  
**User impact:** Screenshot `16-insights-desktop.png` shows "AI Model: GPT-5" in a dropdown in the top right of the Insights page. There is no explanation of what the model selector does, what the available options are, or how model choice affects the output quality or cost. For a free-tier user this is particularly confusing — they may select a model that requires a paid tier and receive a cryptic quota error. For a paid-tier user who is not technical, "GPT-5" is unexplained jargon that suggests hidden complexity.

**Fix:** Add a `?` tooltip icon next to the model selector that, on hover/focus, explains: "Choose the AI model for generating insights. More capable models may produce better results. Your current plan supports [model names]." If the free tier is locked to a specific model, disable the selector for free users and add a "Upgrade to access advanced models" tooltip instead of hiding the selector entirely (hiding it creates confusion about whether the feature exists at all).

---

### P1-AI-03 — AI Quota Copy Understates the Constraint for Free Users

**Screen:** User Settings / Subscription & Billing  
**File:** `src/components/pages/UserSettings.tsx` (Subscription section)  
**User impact:** Screenshot `19-user-settings-desktop.png` shows "AI Ideas/Month: 5" as a metric in the Subscription section for the free plan. This is a raw number with no context: users don't know (a) how many they've used this month, (b) when the counter resets, (c) what happens when they hit the limit (hard block or degraded mode). The "Upgrade to unlock more" CTA immediately follows but provides no urgency because the user doesn't know their current consumption.

**Fix:** Add a usage bar or inline count to the AI Ideas/Month metric: "3 of 5 used this month (resets May 1)." Source the reset date from the subscription period. If consumption data is not available in the current API response, the minimum acceptable fix is to add "(resets monthly)" as subscript copy next to "5" so users understand the constraint is monthly, not lifetime. This is a P1 because it directly affects upgrade conversion — a user who doesn't know they're near their limit won't upgrade proactively.

---

## P2 Findings — Delighters

---

### P2-AI-01 — "How It Works" Panel Always Visible in AI Idea Assistant

**Screen:** AI Idea Assistant modal (Generate tab)  
**File:** `src/components/AIIdeaModal.tsx`  
**Finding:** Screenshot `21-ai-idea-modal-desktop.png` shows a "How it works" info panel permanently visible below the title input, taking up ~30% of the modal's vertical space. For a first-time user this is helpful. For a returning user who generates ideas daily, the panel is noise they tab past every time. Consider collapsing it by default after the user's first successful generation (persist the collapsed state to localStorage or user preferences). An expandable "?" toggle keeps the help accessible without burning vertical space.

---

### P2-AI-02 — Image and Audio Tabs Feel Non-Functional

**Screen:** AI Idea Assistant modal (Image tab, Audio tab)  
**File:** `src/components/AIIdeaModal.tsx` (tab navigation)  
**Finding:** Screenshot `21-ai-idea-modal-desktop.png` shows "Generate | Image | Audio" tabs. The "Generate" tab is the clear primary path. The Image and Audio tabs are present but — based on available screenshots — show no content hints that suggest what they will do. For a paying customer, tabs that appear empty or non-functional erode trust in the entire modal. If Image and Audio features are not yet fully functional, the tabs should either be hidden (not an empty state) or clearly labeled as "Coming soon" with a brief description of the planned capability. An empty tab is worse than no tab.

---

## AI Trust Principles — Audit Checklist

| Principle | Status | Notes |
|---|---|---|
| AI failures are surfaced, not hidden | FAIL | P0-AI-01: silent fallback masks failures |
| AI output is clearly labeled as AI-generated | PASS | "AI Idea Assistant" modal frame makes source clear |
| Users can always opt out of AI path | PASS | Manual Setup and manual Add Idea flows exist |
| Quota limits are communicated proactively | PARTIAL | P1-AI-03: count shown but no usage context |
| Generation state is clear during processing | PARTIAL | P1-AI-01: spinner exists, no content-area feedback |
| Error recovery path is clear | FAIL | P0-AI-01: no recovery path when AI fails |
| Model selection is explained | FAIL | P1-AI-02: selector present with no explanation |
| Fallback/degraded mode is disclosed | FAIL | P0-AI-01: fallback is presented as AI output |

---

## Remediation Summary for P0

| ID | Finding | File | Priority |
|---|---|---|---|
| P0-AI-01 | Silent AI failure — boilerplate as AI output | `AIIdeaModal.tsx:312-331` | Ship blocker |

---

## Sign-Off

**Sable — UX Design Producer**  
**Verdict: NO-SHIP on AI surfaces.** P0-AI-01 is a product integrity failure — it presents non-AI output as AI output to paying customers with no disclosure. This must be fixed before any customer accesses the AI generation path. P1 items should ship in session if time permits; they affect conversion and trust signals. P2 items are backlog.
