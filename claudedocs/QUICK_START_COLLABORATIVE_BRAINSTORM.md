# Quick Start Guide - Collaborative Brainstorming Implementation

## 🚀 TL;DR - Get Started in 5 Minutes

```bash
# 1. Install dependencies
npm install qrcode.react

# 2. Apply database schema
psql $DATABASE_URL < supabase/migrations/20250120000000_create_brainstorm_sessions.sql

# 3. Create session service
cp templates/BrainstormSessionService.ts src/lib/services/

# 4. Add mobile join route
# In App.tsx: <Route path="/join/:accessToken" element={<MobileJoinPage />} />

# 5. Test locally
npm run dev
# Navigate to: http://localhost:3000/projects/test-project
# Click "Enable Mobile Join"
# Scan QR with phone
```

---

## 📋 Implementation Checklist

### Phase 1: Database (Day 1)
- [ ] Create migration file: `supabase/migrations/20250120000000_create_brainstorm_sessions.sql`
- [ ] Copy schema from design doc Part 1, Section 1.2
- [ ] Apply migration: `npm run supabase:db:migrate`
- [ ] Verify tables: `psql $DATABASE_URL -c "\dt brainstorm_*"`

### Phase 2: Backend Services (Day 2-3)
- [ ] Create `src/lib/services/BrainstormSessionService.ts`
- [ ] Create `src/lib/repositories/brainstormSessionRepository.ts`
- [ ] Create API endpoint: `api/brainstorm/create-session.ts`
- [ ] Create API endpoint: `api/brainstorm/submit-idea.ts`
- [ ] Test with cURL or Postman

### Phase 3: Real-Time (Day 4-5)
- [ ] Create `src/lib/realtime/brainstormChannel.ts`
- [ ] Create `src/hooks/useBrainstormRealtime.ts`
- [ ] Test real-time events with Supabase console

### Phase 4: Mobile Interface (Day 6-8)
- [ ] Create `src/pages/MobileJoinPage.tsx`
- [ ] Create `src/components/brainstorm/MobileIdeaSubmitForm.tsx`
- [ ] Add route in `App.tsx`
- [ ] Test on actual mobile device

### Phase 5: Desktop Integration (Day 9-10)
- [ ] Install `qrcode.react`: `npm install qrcode.react`
- [ ] Create `src/components/brainstorm/SessionQRCode.tsx`
- [ ] Enhance `MatrixFullScreenView.tsx` with session controls
- [ ] Test full flow: desktop → QR → mobile → submit → desktop

### Phase 6: Security & Testing (Day 11-12)
- [ ] Implement rate limiting in `api/brainstorm/submit-idea.ts`
- [ ] Create `src/lib/services/ContentModerationService.ts`
- [ ] Write E2E test: `tests/e2e/brainstorm-session.spec.ts`
- [ ] Run full test suite: `npm run test:e2e`

---

## 🔧 Key Code Snippets

### 1. Session Creation (Desktop)

```typescript
// src/components/matrix/MatrixFullScreenView.tsx

import { BrainstormSessionService } from '../../lib/services/BrainstormSessionService'
import { SessionQRCode } from '../brainstorm/SessionQRCode'

export const MatrixFullScreenView: React.FC = () => {
  const [session, setSession] = useState<BrainstormSession | null>(null)

  async function handleEnableMobileJoin() {
    const newSession = await BrainstormSessionService.createSession({
      projectId: currentProject.id,
      durationMinutes: 60
    })
    setSession(newSession)
  }

  return (
    <div className="fullscreen-container">
      {!session && (
        <button onClick={handleEnableMobileJoin}>
          📱 Enable Mobile Join
        </button>
      )}

      {session && (
        <SessionQRCode
          sessionId={session.id}
          qrCodeData={session.qrCodeData}
          joinCode={session.joinCode}
          expiresAt={session.expiresAt}
        />
      )}

      {/* Existing matrix content */}
    </div>
  )
}
```

### 2. Mobile Join Page

```typescript
// src/pages/MobileJoinPage.tsx

export const MobileJoinPage: React.FC = () => {
  const { accessToken } = useParams<{ accessToken: string }>()
  const [session, setSession] = useState<BrainstormSession | null>(null)

  useEffect(() => {
    async function validateAndJoin() {
      const validatedSession = await BrainstormSessionService.validateAccessToken(accessToken!)
      if (validatedSession) {
        setSession(validatedSession)
        await joinAsParticipant(validatedSession.id)
      }
    }
    validateAndJoin()
  }, [accessToken])

  if (!session) return <LoadingScreen />

  return <MobileIdeaSubmitForm session={session} participantId={participantId} />
}
```

### 3. Real-Time Subscription

```typescript
// src/hooks/useBrainstormRealtime.ts

export function useBrainstormRealtime(sessionId: string | null) {
  const [ideas, setIdeas] = useState<IdeaCard[]>([])

  useEffect(() => {
    if (!sessionId) return

    const manager = new BrainstormRealtimeManager()
    manager.subscribe({
      sessionId,
      onIdeaCreated: (idea) => {
        setIdeas(prev => [...prev, idea])
        showToast(`💡 New idea from ${idea.participant_name}`)
      },
      // ... other handlers
    })

    return () => manager.unsubscribe()
  }, [sessionId])

  return { ideas }
}
```

### 4. API Rate Limiting

```typescript
// api/brainstorm/submit-idea.ts

const rateLimitStore = new Map<string, number[]>()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { participantId } = req.body

  // Check rate limit (6 per minute)
  const now = Date.now()
  const requests = rateLimitStore.get(participantId) || []
  const recentRequests = requests.filter(t => now - t < 60000)

  if (recentRequests.length >= 6) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((recentRequests[0] + 60000 - now) / 1000)
    })
  }

  rateLimitStore.set(participantId, [...recentRequests, now])

  // ... rest of idea submission logic
}
```

---

## 🧪 Testing Commands

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests (requires running dev server)
npm run dev &
npm run test:e2e

# Performance tests
npm run test:performance

# Visual regression
npm run visual:test

# Run all tests
npm run test:all
```

---

## 🐛 Troubleshooting

### Issue: QR Code Not Generating
**Cause**: `qrcode.react` not installed
**Fix**: `npm install qrcode.react`

### Issue: Mobile Can't Join (404)
**Cause**: Route not configured
**Fix**: Add `<Route path="/join/:accessToken" element={<MobileJoinPage />} />` to App.tsx

### Issue: Ideas Not Syncing in Real-Time
**Cause**: Real-time channel not subscribed
**Fix**: Check browser console for Supabase realtime connection errors

### Issue: "Rate Limit Exceeded" on Mobile
**Cause**: Submitting too fast (> 6 ideas/minute)
**Fix**: Wait 10 seconds between submissions (expected behavior)

### Issue: Session Expired
**Cause**: Session duration passed (default 60 minutes)
**Fix**: Create new session from desktop

---

## 📊 Performance Benchmarks

Expected performance targets:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| QR code generation | < 100ms | Chrome DevTools Performance |
| Mobile join page load | < 2s | Lighthouse |
| Real-time sync latency | < 500ms | Custom timing logs |
| Desktop rendering (50 ideas) | 60fps | Chrome DevTools FPS meter |
| Concurrent participants | 50+ | Load testing script |

---

## 🔐 Security Checklist

Before deploying to production:

- [ ] RLS policies enabled on all brainstorm tables
- [ ] Access tokens generated with crypto-secure randomness
- [ ] Rate limiting enforced server-side (not just client)
- [ ] Content moderation validates all submissions
- [ ] Session expiration enforced at database level
- [ ] Audit logging captures all participant actions
- [ ] HTTPS enforced for all endpoints
- [ ] Environment variables stored securely (Vercel secrets)

---

## 📚 Documentation References

- **Full Design**: `claudedocs/DESIGN_COLLABORATIVE_MOBILE_BRAINSTORM.md`
- **Implementation Roadmap**: `claudedocs/DESIGN_COLLABORATIVE_MOBILE_BRAINSTORM_PART2.md`
- **Architecture Diagrams**: `claudedocs/ARCHITECTURE_COLLABORATIVE_BRAINSTORM.md`
- **User Guide**: `claudedocs/USER_GUIDE_COLLABORATIVE_BRAINSTORM.md` (to be created)

---

## 🚢 Deployment

```bash
# 1. Commit changes
git add .
git commit -m "feat: collaborative mobile brainstorming"

# 2. Push to Vercel
git push origin feature/collaborative-brainstorm

# 3. Vercel auto-deploys from GitHub
# Monitor: https://vercel.com/dashboard

# 4. Apply database migration to production
psql $PRODUCTION_DATABASE_URL < supabase/migrations/20250120000000_create_brainstorm_sessions.sql

# 5. Verify deployment
curl https://your-app.vercel.app/api/brainstorm/create-session \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","durationMinutes":60}'
```

---

## 🎯 Success Criteria

Before marking implementation complete, verify:

1. ✅ Desktop user can create session and display QR code
2. ✅ Mobile user can scan QR and join session (< 3 seconds)
3. ✅ Mobile user can submit idea
4. ✅ Desktop sees idea appear in < 2 seconds
5. ✅ Participant counter updates in real-time
6. ✅ Session expires after configured duration
7. ✅ Rate limiting prevents spam (6 ideas/minute)
8. ✅ Content moderation rejects invalid ideas
9. ✅ E2E tests pass (100% critical path coverage)
10. ✅ Performance benchmarks met (see table above)

---

## 💡 Next Steps After MVP

1. **User Testing**: Beta test with 5-10 real brainstorm sessions
2. **Analytics**: Track session creation, participant joins, idea submission rates
3. **Feedback Loop**: Collect user feedback on UX pain points
4. **Stretch Features**: Implement voting, AI summarization, timed rounds
5. **Scale Testing**: Load test with 100+ concurrent participants
6. **Documentation**: Create video tutorials for facilitators

---

## 🤝 Getting Help

- **Design Questions**: Review architecture diagrams in `claudedocs/`
- **Implementation Issues**: Check troubleshooting section above
- **Testing Problems**: Review E2E test examples in `tests/e2e/`
- **Performance Concerns**: Run benchmark tests and review results

Good luck with implementation! 🚀
