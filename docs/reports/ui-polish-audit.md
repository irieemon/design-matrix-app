# UI Polish Audit — Prioritas v1.3
**Session 7 | Date: 2026-04-19 | Author: Sable (UX Design Producer)**

---

## Ship/No-Ship Call

**NO-SHIP.** Seven P0 items are confirmed across auth, onboarding, roadmap copy, collaboration copy, contact email, admin UI exposure, and accessibility. None are cosmetic — each is a trust or functional regression that a paying customer will notice in their first session. Clear the P0 list and this ships.

---

## Design System

**Design system:** No design system found (tokens referenced from Tailwind config and observed class names in source).

---

## TL;DR

| Severity | Count | Summary |
|---|---|---|
| P0 | 7 | Dead legal links, duplicate onboarding empty states, misleading "Access Matrix Now", raw DB value in roadmap subtitle, wrong contact domain sitewide, admin FAQ panel exposed to all users, duplicate a11y skip link |
| P1 | 5 | Button palette incoherence, AI Starter modal duplicate heading, emoji overload in form dropdowns, feature card visual imbalance, user email truncation in sidebar |
| P2 | 2 | Collaboration page raw status value, Data Management button color inconsistency |

---

## P0 Findings — Ship Blockers

---

### P0-01 — Dead Legal Links on Signup (Terms of Service + Privacy Policy)

**Screen:** Auth / Signup  
**File:** `src/components/auth/AuthScreen.tsx:614-615`  
**User impact:** A paying customer clicks "Terms of Service" or "Privacy Policy" before committing their credit card. Both links go to `href="#"` — a page-top jump with no content. This is a trust and legal compliance failure at the moment of highest scrutiny.

**Evidence:** Screenshot `02-auth-signup-desktop.png` and `07-auth-signup-mobile.png` confirm both links are present and clickable. Source at lines 614-615 confirms `href="#"` for both.

#### Remediation Spec

Edit `src/components/auth/AuthScreen.tsx` lines 614-615. Replace both `href="#"` values with the production URLs for the live legal documents. If live ToS/Privacy pages do not yet exist, the minimum acceptable fix is to open a mailto contact link or route to an in-app `/terms` and `/privacy` page that at minimum says "Terms of service effective [date] — contact us at support@prioritas.ai for the full document." The before state: clicking the link jumps to page top and looks broken. The after state: clicking opens the correct legal document or a clear placeholder. Acceptance criteria: both links navigate to non-`#` destinations; no console errors on click; links accessible by keyboard.

---

### P0-02 — Duplicate Empty States on First-Run Onboarding

**Screen:** Onboarding / Matrix Page (no project state)  
**File:** `src/components/pages/MatrixPage.tsx:155-193`, sidebar component  
**User impact:** A brand-new user lands on the matrix page and sees three simultaneous "nothing here" states: (1) "Create Your First Project" with AI Starter + Manual Setup buttons in the top card, (2) "No Project Selected" with "Go to Projects" + "Access Matrix Now" in a second card below it, and (3) a third "No Project Selected" card in the sidebar. The user faces four CTAs for the same action with no clear hierarchy. This reads as a half-built screen, not a deliberate onboarding flow.

**Evidence:** Screenshot `10-onboarding-empty-desktop.png` shows all three states simultaneously visible.

#### Remediation Spec

The fix has two parts. First, suppress the `MatrixPage` no-project empty state (lines 155-193) entirely when `ProjectStartupFlow` is already rendering the "Create Your First Project" card. The startup flow is the canonical first-run path — the matrix-level empty state should only render when the user has navigated directly to the matrix URL without a project context after onboarding is complete. Second, the sidebar "No Project Selected" card should be suppressed when no projects exist at all (first-run state), showing only the app navigation shell. Before: three stacked empty states, four CTAs. After: one clean "Create Your First Project" card with two clearly differentiated entry points (AI Starter, Manual Setup), zero duplication. Acceptance criteria: no user in the first-run state ever sees more than one empty-state panel simultaneously.

---

### P0-03 — "Access Matrix Now" Creates Phantom Demo Project

**Screen:** Matrix Page / No Project Empty State  
**File:** `src/components/pages/MatrixPage.tsx:169-193`  
**User impact:** The green "Access Matrix Now" button (variant="success", visually jarring against the dark/blue palette) silently creates a `Demo Matrix Access` project with a demo UUID and sets it as the active project — with no confirmation or explanation. A user who clicks it expecting to see their matrix gets a blank matrix tied to a throwaway project they didn't intend to create. On next login the project may persist or vanish depending on persistence logic, creating confusion about their data.

**Evidence:** Screenshot `10-onboarding-empty-desktop.png` shows the green button. Source at lines 169-192 confirms the button creates a demo project client-side and calls `onProjectChange` silently.

#### Remediation Spec

Remove the "Access Matrix Now" button from the no-project empty state entirely. It serves no legitimate user need at first-run: the correct path is to create a real project via AI Starter or Manual Setup. If a quick-demo path is genuinely needed, it should be gated behind a "Try a demo" tertiary link styled as a link (not a green primary button), and the created project should be clearly labeled as a demo with an explicit "not saved" indicator. Before: green primary button creates a phantom project silently. After: two-CTA layout with AI Starter and Manual Setup only, consistent button palette (blue primary / dark secondary). Acceptance criteria: no demo project is created without explicit user acknowledgment; "Access Matrix Now" button is removed.

---

### P0-04 — Roadmap Subtitle Renders Raw DB Enum Value "other project"

**Screen:** Roadmap Page  
**File:** `src/components/ProjectRoadmap/RoadmapHeader.tsx:63`  
**User impact:** The subtitle reads "Strategic execution plan for your other project" for any project with `project_type = "other"` (the default). This is visible to every user who hasn't set a custom project type — which includes all new projects created via the AI Starter default flow. It reads as a developer console leak, not product copy.

**Evidence:** Screenshot `15-roadmap-empty-desktop.png` shows "Strategic execution plan for your other project" as the page subtitle. Source at line 63 confirms the template string `your {currentProject.project_type?.toLowerCase()} project` with no enum-to-label mapping.

#### Remediation Spec

Edit `src/components/ProjectRoadmap/RoadmapHeader.tsx` line 63. Replace the raw template interpolation with a label map. Define a mapping object (e.g., `{ other: 'project', software: 'software project', marketing: 'marketing project', ... }`) and use `labelMap[currentProject.project_type] ?? 'project'` as the interpolated value. The fallback for unknown types should be "project" (generic, never leaks an enum value). Before: "Strategic execution plan for your other project." After: "Strategic execution plan for your project." (for type=other) or "Strategic execution plan for your software project." (for type=software). Acceptance criteria: no raw enum value appears in any user-facing string; "other" type renders the generic "project" label.

---

### P0-05 — Wrong Contact Domain Sitewide (prioritas.app vs prioritas.ai)

**Screen:** Pricing Page, FAQ Page, Subscription Success Page, email templates  
**Files:**  
- `src/components/pages/PricingPage.tsx:123` (`sales@prioritas.app`)  
- `src/components/pages/PricingPage.tsx:366` (`support@prioritas.app`)  
- `src/components/pages/FAQPage.tsx:265` (`support@prioritas.app`)  
- `src/components/pages/SubscriptionSuccessPage.tsx:229` (`support@prioritas.app`)  
- `src/lib/emailService.ts:172` (`https://prioritas.app` as fallback base URL)  
- `src/lib/services/CollaborationService.ts:134` (`noreply@prioritas.app`)  

**User impact:** A paying customer who clicks "Contact Support" on the Pricing page, FAQ, or post-checkout success screen sends email to a dead domain. Collaboration invitation emails are sent from a dead sender address. Both erode trust at high-stakes moments.

**Evidence:** grep confirms six occurrences of `prioritas.app` across these files. Production domain is `prioritas.ai`.

#### Remediation Spec

Global find-and-replace `prioritas.app` → `prioritas.ai` across all six files listed above. For `emailService.ts:172`, update the fallback base URL to `https://prioritas.ai`. For `CollaborationService.ts:134`, update the `noreply` sender to `noreply@prioritas.ai`. After the change, verify no remaining `prioritas.app` references exist in `src/`. Before: support emails route to dead domain, collaboration invites come from dead sender. After: all contact and sender addresses use `prioritas.ai`. Acceptance criteria: `grep -r "prioritas.app" src/` returns zero results.

---

### P0-06 — FAQ Admin Panel Exposed to All Users in User Settings

**Screen:** User Settings  
**File:** `src/components/pages/UserSettings.tsx:493-500` (imports and renders `FAQAdmin` unconditionally)  
**User impact:** Every user — free, paid, and guest — sees the full "Content Management / FAQ & Support Manager" admin panel in their Settings page, including "New Category", "Published" status toggles, and edit/delete buttons. This is a clear admin-only feature rendered without any role gate. A free-tier user can see and interact with content management UI they should never encounter. It looks broken and undermines the product's sense of professional boundary.

**Evidence:** Screenshot `19-user-settings-desktop.png` shows the full FAQAdmin component rendered in the Settings page for the test user (role: Standard User). Source at `UserSettings.tsx:9` imports `FAQAdmin` and line 499 renders it unconditionally with no role check.

#### Remediation Spec

Edit `src/components/pages/UserSettings.tsx`. The `FAQAdmin` component must be gated behind a super_admin role check. Obtain the user's role from the auth context and conditionally render `FAQAdmin` only when `currentUser.role === 'super_admin'`. The "FAQ & Support" section header and "View FAQ Page" link can remain visible for all users (they navigate to public content). Only the "Content Management" admin panel should be hidden for non-admins. Before: every user sees the admin content management panel. After: only super_admin users see the Content Management panel; standard users see only the "View FAQ Page" link. Acceptance criteria: sign in as a non-admin user and confirm the FAQAdmin panel is not rendered; sign in as super_admin and confirm it is.

---

### P0-07 — Duplicate "Skip to Main Content" Skip Link

**Screen:** All authenticated pages  
**Files:** `src/components/layout/AppLayout.tsx:169-179`, `src/hooks/useAccessibility.ts:223-244`  
**User impact:** The a11y tree contains two "Skip to main content" links on every authenticated page. For keyboard users, Tab focuses the first link (injected by `useSkipLinks()` into `document.body`), then Tab again before reaching any nav item focuses the second (rendered by `AppLayout`). Screen readers announce the skip link twice. This is an accessibility regression — the experience is confusing for screen reader users and incorrect per WCAG 2.4.1.

**Evidence:** `useAccessibility.ts:227` calls `document.body.insertBefore(skipLink, document.body.firstChild)` which injects a skip link programmatically. `AppLayout.tsx:170-179` renders a second skip link as JSX. Both run on every authenticated page render.

#### Remediation Spec

Choose one implementation and remove the other. The JSX link in `AppLayout.tsx:169-179` is the preferred approach because it is declarative, testable, and tracked in the React tree. Remove the `useSkipLinks()` call from wherever it is invoked (find the call site with `grep -r "useSkipLinks" src/`), and remove the `useSkipLinks` function from `useAccessibility.ts` (or keep the function but stop calling it). Verify the remaining JSX link in `AppLayout.tsx` has matching styling. Before: two skip links in tab order, screen readers announce the same link twice. After: one skip link, correct tab order, WCAG 2.4.1 satisfied. Acceptance criteria: `document.querySelectorAll('[href="#main-content"]')` returns exactly one node on any authenticated page.

---

## P1 Findings — Polish

---

### P1-01 — Button Palette Incoherence on Onboarding

**Screen:** Matrix Page / Onboarding  
**File:** `src/components/pages/MatrixPage.tsx`  
**User impact:** The onboarding empty state uses three different button styles simultaneously: blue (AI Starter), dark charcoal (Manual Setup), and green (Access Matrix Now). Once P0-03 removes the green button, the remaining two should be visually harmonized. AI Starter as the primary path should use the primary blue. Manual Setup as secondary should use the outlined/secondary variant. The current dark-fill secondary reads as near-equal priority to the primary, reducing the AI Starter's conversion advantage.

**Fix:** Change Manual Setup to `variant="secondary"` (outlined) to create clear visual hierarchy. Verify both buttons have consistent sizing and icon alignment.

---

### P1-02 — AI Project Starter Modal Has Duplicate Headings

**Screen:** AI Starter Modal  
**File:** Component rendering the AI Project Starter modal  
**User impact:** Screenshot `11-ai-starter-modal-desktop.png` shows "AI Project Starter" as both the modal title (top left) and as an h2/h3 heading mid-modal above the form fields. The title is redundant and the heading hierarchy is broken. For screen readers, the modal announces its name twice before the user reaches any interactive element.

**Fix:** Remove the mid-modal "AI Project Starter" heading and its subtext from the form body. The modal title bar already establishes context. Keep the AI icon — it is a useful visual anchor. Replace the duplicate heading area with the icon + subtitle text only (e.g., "Let AI help you set up your project and generate prioritized ideas" — this copy already exists and is sufficient without a redundant heading).

---

### P1-03 — Emoji in Priority Level and Project Type Dropdowns

**Screen:** Add Idea Modal (Priority Level), AI Project Starter (Project Type, Industry)  
**File:** Add Idea modal component, AI Starter modal  
**User impact:** Screenshot `13-add-idea-modal-desktop.png` shows "🟡 Moderate" in the Priority Level dropdown. The emoji renders inconsistently across operating systems and is read aloud by screen readers as "yellow circle Moderate." In a B2B SaaS context — especially one appearing in enterprise pricing tiers — this reduces perceived professionalism. The emoji pattern is playful in consumer apps; here it signals unfinished design.

**Fix:** Replace emoji indicators with colored dot components (CSS `w-2 h-2 rounded-full` with semantic color classes) inline with the label text. This preserves the color-coding intent without emoji. Apply the same pattern to Project Type and Industry dropdowns if they use emoji.

---

### P1-04 — Feature Card Visual Imbalance Below Auth Screen

**Screen:** Auth / Login, Auth / Signup  
**File:** `src/components/auth/AuthScreen.tsx:622-634`  
**User impact:** Screenshots `01-auth-login-desktop.png` and `02-auth-signup-desktop.png` show "Strategic Planning" wrapping to two lines ("Strategic / Planning") while "Smart Prioritization" also wraps ("Smart / Prioritization") — both wrap at the same point. "Team Collaboration" stays on one line. On mobile the three cards stack vertically and look fine, but on desktop the uneven card heights break the grid's visual baseline. It reads as an afterthought rather than deliberate marketing copy.

**Fix:** Shorten the feature card titles so they fit on one line at the rendered card width: "Smart Priority Matrix", "Team Collaboration", "Strategic Roadmaps" — or constrain card width to force consistent wrapping. Alternatively, use `whitespace-nowrap` with horizontal overflow hidden and test at key breakpoints. Verify the three-column grid is balanced at 1440px and 1280px viewport widths.

---

### P1-05 — User Email Truncated in Sidebar Footer

**Screen:** All authenticated pages (sidebar visible)  
**File:** Sidebar component  
**User impact:** Screenshots `10-onboarding-empty-desktop.png`, `15-roadmap-empty-desktop.png` and others show `sable-qa-test+polish@prioritas.t...` — truncated mid-domain with an ellipsis. The full email is `sable-qa-test+polish@prioritas.test`. Users with long emails or the `+tag` pattern (common for professional users) see an incomplete address. The truncation also gives no tooltip or expand interaction to reveal the full value.

**Fix:** Add a `title` attribute to the sidebar email element so hover reveals the full email. Alternatively, show only the email prefix (before the `@`) in the footer with the domain on a second line at reduced size. Ensure the fix is tested with emails up to 50 characters. This is a P1 not P0 because the user can see their account in Settings — it is not broken, just frustrating.

---

## P2 Findings — Delighters

---

### P2-01 — Collaboration Page Shows Raw Status Value "active"

**Screen:** Team Collaboration  
**File:** `src/components/pages/ProjectCollaboration.tsx:201`  
**Finding:** The Project Status card in Team Collaboration shows the badge text "active" (lowercase, raw DB enum). Compare Roadmap which at least title-cases with `project_type.replace('_', ' ')`. The status should be capitalized: "Active". At P2 because it is not a trust signal — it looks intentional to most users — but it is inconsistent with how the rest of the app formats status values.

---

### P2-02 — Data Management Export/Import Button Colors Inconsistent

**Screen:** Data Management  
**File:** Data Management component  
**Finding:** Screenshot `18-data-management-desktop.png` shows "Export to CSV" in green (success variant) and "Import from CSV" in blue (primary variant). Neither action is destructive or confirmatory — they are equivalent-tier operations. Using two different button colors here creates a false hierarchy and inconsistency with the palette. Both should use the same variant (recommend: both as `variant="secondary"` outlined, with the Danger Zone "Delete All Ideas" remaining as the only red/destructive CTA on the page).

---

## Sign-Off

**Sable — UX Design Producer**  
**Verdict: NO-SHIP.** Seven P0 items confirmed via screenshot evidence and source verification. Clear P0-01 through P0-07 to flip this to ship. P1s are runway work — ship them in the same session if Colby's pace allows, but they do not block the release.

**P0 items for Colby dispatch (in priority order):**
1. Dead ToS + Privacy links — `AuthScreen.tsx:614-615`
2. Duplicate onboarding empty states — `MatrixPage.tsx:155-193`
3. "Access Matrix Now" phantom project button — `MatrixPage.tsx:169-193`
4. Roadmap raw enum subtitle — `RoadmapHeader.tsx:63`
5. Wrong contact domain sitewide — six files, prioritas.app → prioritas.ai
6. FAQ Admin exposed to all users — `UserSettings.tsx:493-500`
7. Duplicate skip link — `AppLayout.tsx:169-179` + `useAccessibility.ts:223-244`
