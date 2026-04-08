# 07 Mobile Audit

Authoritative classification of every page route for Phase 07 mobile polish work. Drives plan 07-02.

## Classifications (per D-01)

- **mobile-native** — Designed for phones first. Must work fully on a 375-wide viewport with touch-first interactions, thumb-reach targets, and no horizontal scroll.
- **mobile-view-only** — Must render legibly and be navigable on mobile, but primary authoring / editing flows live on desktop. Read + minor actions only.
- **desktop-only** — Complex authoring, data-dense tables, or admin surfaces. Mobile users see a `DesktopOnlyHint` component explaining they should use a larger screen (per D-06).

Polish priority tiers (per D-09):

- **P0** — Critical path. Must ship in 07-02.
- **P1** — Should-have. Ship in 07-02 if budget allows.
- **P2** — Nice-to-have. Defer to a later phase.
- **N/A** — Desktop-only, no mobile polish required beyond the `DesktopOnlyHint`.

## Page Classification Table

| Page | File | Classification | Rationale | Polish Priority |
|------|------|----------------|-----------|-----------------|
| Auth / Login | `src/components/app/AuthenticationFlow.tsx` | mobile-native | D-09 critical path: users must be able to sign in from a phone. Single form, naturally mobile-friendly. | P0 |
| Projects List / Landing | `src/components/pages/MatrixPage.tsx` (project selection + matrix host) | mobile-view-only | D-09 critical path: users must see and open projects on mobile. Creating/editing projects stays desktop. | P0 |
| Matrix View (Idea Matrix) | `src/components/pages/MatrixPage.tsx` | mobile-view-only | D-09 critical path: viewing the prioritized matrix on mobile is core value. Drag-and-drop authoring remains desktop. | P0 |
| Brainstorm Session (Mobile Join) | `src/pages/MobileJoinPage.tsx` | mobile-native | D-09 critical path and the entire reason mobile exists: participants join via QR and submit ideas from phones. | P0 |
| User Settings | `src/components/pages/UserSettings.tsx` | mobile-view-only | D-09 critical path: account/subscription management must be reachable on mobile. | P0 |
| Invitation Accept | `src/pages/InvitationAcceptPage.tsx` | mobile-native | Invitations arrive via email and are commonly opened on phones. Single accept/decline action. | P1 |
| Pricing | `src/components/pages/PricingPage.tsx` | mobile-view-only | Marketing / conversion surface; must render well on phones even if checkout completes on desktop. | P1 |
| Subscription Success | `src/components/pages/SubscriptionSuccessPage.tsx` | mobile-view-only | Post-checkout confirmation; users may land here from a phone browser. | P1 |
| FAQ | `src/components/pages/FAQPage.tsx` | mobile-view-only | Read-only content; trivially responsive. | P1 |
| Project Collaboration | `src/components/pages/ProjectCollaboration.tsx` | desktop-only | Complex authoring: invites, roles, activity — data-dense per D-06. Show `DesktopOnlyHint` on mobile. | N/A |
| Reports & Analytics | `src/components/pages/ReportsAnalytics.tsx` | desktop-only | Data-dense charts and tables per D-06. Show `DesktopOnlyHint`. | N/A |
| Data Management | `src/components/pages/DataManagement.tsx` | desktop-only | Complex authoring / admin per D-06. Show `DesktopOnlyHint`. | N/A |
| Component Showcase | `src/pages/ComponentShowcase.tsx` | desktop-only | Internal design system reference; not user-facing. | N/A |
| Button Test | `src/components/pages/ButtonTestPage.tsx` | desktop-only | Internal test harness. | N/A |
| Form Test | `src/components/pages/FormTestPage.tsx` | desktop-only | Internal test harness. | N/A |
| Skeleton Test | `src/components/pages/SkeletonTestPage.tsx` | desktop-only | Internal test harness. | N/A |

## D-09 Critical Path Call-outs

These five surfaces MUST be P0 and working end-to-end on mobile by the end of 07-02:

1. **Auth** (`AuthenticationFlow.tsx`) — mobile-native
2. **Projects list** (MatrixPage landing / project switcher) — mobile-view-only
3. **Matrix view** (`MatrixPage.tsx`) — mobile-view-only
4. **Brainstorm session** (`MobileJoinPage.tsx`) — mobile-native
5. **Settings** (`UserSettings.tsx`) — mobile-view-only

## Downstream Work List (consumed by 07-02)

Every P0 and P1 page below gets responsive + touch polish in plan 07-02:

### P0 (must ship)
- `src/components/app/AuthenticationFlow.tsx`
- `src/components/pages/MatrixPage.tsx` (both the projects-list state and the matrix view state)
- `src/pages/MobileJoinPage.tsx`
- `src/components/pages/UserSettings.tsx`

### P1 (should ship if budget allows)
- `src/pages/InvitationAcceptPage.tsx`
- `src/components/pages/PricingPage.tsx`
- `src/components/pages/SubscriptionSuccessPage.tsx`
- `src/components/pages/FAQPage.tsx`

### Desktop-only (no polish — wrap with `DesktopOnlyHint` in 07-02)
- `src/components/pages/ProjectCollaboration.tsx`
- `src/components/pages/ReportsAnalytics.tsx`
- `src/components/pages/DataManagement.tsx`
- `src/pages/ComponentShowcase.tsx`
- `src/components/pages/ButtonTestPage.tsx`
- `src/components/pages/FormTestPage.tsx`
- `src/components/pages/SkeletonTestPage.tsx`
