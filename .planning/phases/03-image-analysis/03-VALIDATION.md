---
phase: 3
slug: image-analysis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/components/__tests__/AIIdeaModal.image.test.tsx` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/__tests__/AIIdeaModal.image.test.tsx`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-??-01 | TBD | 0 | MM-08 | — | Canvas resize limits image to ≤2048px before upload | unit | `npx vitest run src/lib/__tests__/imageResize.test.ts` | ❌ W0 | ⬜ pending |
| 03-??-02 | TBD | 1 | MM-01 | — | Visual analysis result returned and rendered | component | `npx vitest run src/components/__tests__/AIIdeaModal.image.test.tsx` | ❌ W0 | ⬜ pending |
| 03-??-03 | TBD | 1 | MM-02 | — | textContent field populated from OCR result | component | `npx vitest run src/components/__tests__/AIIdeaModal.image.test.tsx` | ❌ W0 | ⬜ pending |
| 03-??-04 | TBD | 1 | MM-07 | — | FileService.uploadFile called (not body POST); signed URL passed to AI | unit | `npx vitest run src/components/__tests__/AIIdeaModal.image.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/AIIdeaModal.image.test.tsx` — covers MM-01, MM-02, MM-07 (image upload + analysis + OCR + direct-storage assertions)
- [ ] `src/lib/__tests__/imageResize.test.ts` — covers MM-08 (Canvas resize ≤ 2048px utility)
- [ ] `src/test/mocks/fileService.ts` — extend mock for `FileService.uploadFile()` and `getFileUrl()` for signed URL flow

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Signed URL is fetchable from Vercel serverless environment | MM-07 | Network boundary between Vercel and Supabase private bucket — cannot mock end-to-end | Upload a real image in staging, trigger analysis, confirm no 403/401 from AI backend |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
