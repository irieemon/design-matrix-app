# Session Persistence Validation - USER ACTION REQUIRED

## Current Status

✅ **Automated tests PASSED**:
- Login screen loads in **1.4 seconds** (was 8+ seconds) - **82% improvement**
- No session token before login (expected behavior)

⏳ **Awaiting your action**: Manual login required to complete validation

---

## What You Need to Do RIGHT NOW

### Step 1: Find the Browser Window
A Chrome/Chromium browser window should be open showing https://prioritas.ai

### Step 2: Login
1. Enter your email and password
2. Click "Sign In"
3. Wait until you see the main application (NOT the login screen)

### Step 3: Return to Terminal
1. Go back to the terminal where you ran the test
2. **Press ENTER** to continue the automated validation

### Step 4: Wait
The automated test will:
- Verify your session token is stored in localStorage
- Perform multiple page refreshes
- Test project URL navigation
- Check for console errors
- Take screenshots of everything
- Generate a final pass/fail report

**Total time**: About 30-40 seconds after you press ENTER

---

## What the Test Will Validate

### Critical Test: Session Persistence After Refresh
This is THE test that validates the fix works:

1. After you login, the test will refresh the page
2. **PASS** ✅: You remain logged in (stay on main app)
3. **FAIL** ❌: You're redirected back to login screen

If you get redirected to login after refresh, the fix did NOT work.

### Other Validations
- Session token exists in localStorage with correct structure
- Session remains stable after 3+ consecutive refreshes
- Project URLs work without redirect to login
- No console errors about session timeout

---

## If You Don't See a Browser Window

### Option 1: Run the Test Yourself
```bash
cd /Users/sean.mcinerney/Documents/workshop/design-matrix-app
node tests/quick-session-validation.js
```

Then follow the instructions above.

### Option 2: Manual Validation
If the automated test won't run, do this manually:

1. **Open Browser**: Go to https://prioritas.ai
2. **Time Load**: Login screen should appear in < 5 seconds
3. **Login**: Sign in with your credentials
4. **Open DevTools**: Press F12 → Application tab → Local Storage
5. **Check Token**: Look for `sb-vfovtgtjailvrphsgafv-auth-token`
   - Should contain a JSON object with `access_token` field
6. **Hard Refresh**: Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
7. **CRITICAL**: Are you still logged in?
   - ✅ YES = Fix works
   - ❌ NO (redirected to login) = Fix failed
8. **Test Stability**: Refresh 2-3 more times, verify you stay logged in
9. **Test Project URL**: Navigate to:
   ```
   https://prioritas.ai/?project=deade958-e26c-4c4b-99d6-8476c326427b
   ```
   - Should load project, NOT redirect to login

---

## Expected Results

### If Fix is Working ✅
- Login screen loads quickly (< 5 seconds)
- Session token appears in localStorage after login
- **Page refresh keeps you logged in** (no redirect to login)
- Multiple refreshes are stable (no logout)
- Project URLs work correctly
- No console errors

### If Fix is NOT Working ❌
- Page refresh redirects you back to login screen
- Session token missing or disappears after refresh
- Console shows session timeout errors
- Project URLs redirect to login

---

## Screenshots Location

All validation screenshots are saved to `/tmp/`:
- `01-login-screen-load.png` ✅ Already captured
- `02-pre-login-state.png` ✅ Already captured
- `03-post-login-state.png` - Will capture after you login
- `04-session-token-verification.png` - localStorage verification
- `05-post-refresh-session.png` - **CRITICAL** - Post-refresh state
- `06-multiple-refresh-cycles.png` - Stability test
- `07-project-url-navigation.png` - Project URL test

You can view these images to see visual evidence of the test results.

---

## What Happens Next

### After You Complete Login and Press ENTER

The automated test will run for about 30-40 seconds, then display:

```
╔══════════════════════════════════════════════════════════════════╗
║                    VALIDATION SUMMARY                            ║
╚══════════════════════════════════════════════════════════════════╝

Total Tests: 8
✅ Passed: X
❌ Failed: X
⚠️  Skipped: X
```

### If All Tests Pass ✅
```
🎉 ALL TESTS PASSED - SESSION PERSISTENCE FIX VALIDATED

✅ Login screen loads quickly (< 5 seconds)
✅ Session token stored in localStorage
✅ Session persists across page refresh
✅ Session stable across multiple refresh cycles
✅ Project URLs work with maintained session
✅ No session-related console errors

The fix is working correctly. Session persistence is functioning.
```

**Action**: Document success, close the issue, celebrate!

### If Any Tests Fail ❌
```
⚠️  SOME TESTS FAILED - ISSUES DETECTED

Failed tests indicate remaining issues with session persistence.
```

**Action**: Review the detailed output to see which test(s) failed and why.

---

## Common Issues

### Browser Window Closed Accidentally
Run the test again:
```bash
node tests/quick-session-validation.js
```

### Can't Login (Wrong Credentials)
Use your actual prioritas.ai credentials. If you don't have access, we cannot complete the validation without credentials.

### Test Seems Stuck
Check the terminal - it's waiting for you to press ENTER after logging in.

### Want to See What's Happening
The browser is running in non-headless mode (visible) specifically so you can see what's happening during the test.

---

## Questions?

**Q: Why do I need to login manually?**
A: We don't store credentials in the test script for security. You need to login once, then the automated test validates that the session persists.

**Q: What if I'm already logged in?**
A: The test may skip the manual login step and proceed directly to validation tests.

**Q: How long will this take?**
A: About 1-2 minutes total (30 seconds for you to login + 30-40 seconds for automated tests).

**Q: Can I run this multiple times?**
A: Yes! Run it as many times as you want to verify stability.

---

## Bottom Line

**The Critical Question**: After you login and refresh the page, do you stay logged in?

- **YES** ✅ = Session persistence fix is working
- **NO** ❌ = Fix failed, session not persisting

That's what we're validating. Everything else is supporting evidence.
