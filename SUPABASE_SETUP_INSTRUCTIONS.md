# ⚠️ CRITICAL: Missing Supabase Service Role Key

## Problem Identified
The application is experiencing **500 Internal Server Error** on `/api/auth/user` endpoint because the `SUPABASE_SERVICE_ROLE_KEY` environment variable is missing.

## What You Need To Do

### 1. Get Your Supabase Service Role Key
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Open your project: `https://vfovtgtjailvrphsgafv.supabase.co`
3. Navigate to **Settings > API**
4. Find the **service_role** key (it's different from the anon/public key)
5. Copy the full service_role key

### 2. Update Your Environment File
Edit your `.env.local` file and replace this line:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

With your actual service role key:
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-actual-key
```

### 3. Restart Development Server
After updating the environment variable:
```bash
# Stop current server (Ctrl+C)
# Restart with:
npm run dev
```

## Security Notes
- ⚠️ **NEVER** expose the service role key to clients
- ⚠️ **NEVER** add `VITE_` prefix to the service role key
- ✅ This key should only be used server-side in `/api/*` endpoints
- ✅ Keep this key secure - it has elevated database permissions

## What This Key Does
The service role key allows the `/api/auth/user` endpoint to:
- Read user profiles from the database
- Access protected database tables
- Perform server-side authentication operations

Without this key, authentication endpoints will fail with 500 errors.

## Files That Require This Key
- `api/auth/roles.ts` (causing current 500 error)
- `api/auth/user.ts` (indirectly affected)
- `api/admin/migrate-database.ts`
- `api/admin/enable-realtime.ts`

## Current Status
✅ Environment configuration updated with placeholder
⚠️ **ACTION REQUIRED**: You must add the actual service role key
⚠️ API endpoints will return 500 errors until key is added