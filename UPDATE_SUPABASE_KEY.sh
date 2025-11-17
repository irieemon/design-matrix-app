#!/bin/bash
# Script to update Supabase anon key in Vercel Production
# Usage: ./UPDATE_SUPABASE_KEY.sh "your-new-anon-key-here"

set -e

NEW_KEY="$1"

if [ -z "$NEW_KEY" ]; then
    echo "❌ Error: No key provided"
    echo ""
    echo "Usage: ./UPDATE_SUPABASE_KEY.sh \"your-new-anon-key-here\""
    echo ""
    echo "📋 Steps to get your new Supabase anon key:"
    echo "1. Go to: https://supabase.com/dashboard/project/vfovtgtjailvrphsgafv/settings/api"
    echo "2. Find 'anon public' key (starts with 'eyJ...')"
    echo "3. Copy the FULL key"
    echo "4. Run this script with the key as argument"
    exit 1
fi

# Validate key format (should be JWT)
if [[ ! "$NEW_KEY" =~ ^eyJ ]]; then
    echo "❌ Error: Invalid key format"
    echo "The anon key should start with 'eyJ' (JWT format)"
    exit 1
fi

# Check key length (full JWT should be > 150 chars)
if [ ${#NEW_KEY} -lt 150 ]; then
    echo "❌ Error: Key appears truncated"
    echo "Full JWT should be at least 150 characters long"
    echo "Current length: ${#NEW_KEY}"
    exit 1
fi

echo "🔄 Testing new key against Supabase..."
TEST_RESPONSE=$(curl -s -X POST "https://vfovtgtjailvrphsgafv.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $NEW_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}')

if echo "$TEST_RESPONSE" | grep -q "Invalid API key"; then
    echo "❌ Error: New key is also invalid"
    echo "Response: $TEST_RESPONSE"
    echo ""
    echo "Make sure you copied the EXACT key from Supabase dashboard"
    exit 1
fi

echo "✅ Key validation successful!"
echo ""

echo "🗑️ Removing old VITE_SUPABASE_ANON_KEY from Vercel..."
vercel env rm VITE_SUPABASE_ANON_KEY production --yes

echo "➕ Adding new VITE_SUPABASE_ANON_KEY to Vercel..."
echo -n "$NEW_KEY" | vercel env add VITE_SUPABASE_ANON_KEY production

echo "✅ Environment variable updated!"
echo ""

echo "🚀 Deploying fresh production build..."
vercel --prod --yes --force

echo ""
echo "🎉 Complete! New deployment created with updated Supabase key."
echo ""
echo "📋 Next steps:"
echo "1. Wait for deployment to finish"
echo "2. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)"
echo "3. Try logging in again"
echo ""
echo "The new bundle hash should be different from index-BKr7QGEQ.js"
