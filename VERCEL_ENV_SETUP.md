# Vercel Environment Variables Setup

## Required Environment Variables

The following environment variables must be set in Vercel for the admin panel to work:

### 1. Supabase Configuration
```bash
VITE_SUPABASE_URL=https://vfovtgtjailvrphsgafv.supabase.co
SUPABASE_URL=https://vfovtgtjailvrphsgafv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmb3Z0Z3RqYWlsdnJwaHNnYWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5MjU3NTIsImV4cCI6MjA0NjUwMTc1Mn0.xbE7llk52L2-HUuWW4mN-yQEtOoO7OZPc3L-BqU18DE
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
```

### 2. Stripe Configuration (if using subscription features)
```bash
STRIPE_SECRET_KEY=<YOUR_STRIPE_SECRET_KEY>
STRIPE_WEBHOOK_SECRET=<YOUR_STRIPE_WEBHOOK_SECRET>
```

## How to Add Environment Variables to Vercel

### Option 1: Via Vercel Dashboard (Recommended)
1. Go to https://vercel.com/dashboard
2. Select your project: `design-matrix-app`
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Key**: Variable name (e.g., `SUPABASE_SERVICE_ROLE_KEY`)
   - **Value**: Variable value
   - **Environments**: Select `Production`, `Preview`, and `Development`
5. Click "Save"
6. **Important**: Redeploy after adding variables

### Option 2: Via Vercel CLI
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Link project
vercel link

# Add environment variables
vercel env add SUPABASE_SERVICE_ROLE_KEY
# Enter value when prompted
# Select: Production, Preview, Development

vercel env add VITE_SUPABASE_URL
vercel env add SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# Trigger redeployment
vercel --prod
```

## Verify Environment Variables

After adding variables, verify they're set:

```bash
vercel env ls
```

## Current Issue

**Problem**: Admin panel APIs return 500 "Server configuration error"

**Cause**: Missing `SUPABASE_SERVICE_ROLE_KEY` and potentially other environment variables in Vercel

**Fix**: Add the required environment variables above, then redeploy

## After Adding Variables

1. Go to Vercel Dashboard → Deployments
2. Click **Redeploy** on the latest deployment
3. Verify admin panel works at: https://your-app.vercel.app/admin

## Security Notes

- **Never commit** the service role key to git
- Service role key has **full database access** - keep it secure
- Only use service role key on the **server side** (API routes)
- Never expose service role key to the **client side**
