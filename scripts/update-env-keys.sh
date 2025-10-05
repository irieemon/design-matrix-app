#!/bin/bash

# Script to safely update Supabase keys in .env
# Usage: ./scripts/update-env-keys.sh

echo "================================================"
echo "Supabase Key Update Script"
echo "================================================"
echo ""
echo "⚠️  SECURITY: Never paste your service role key in chat or commit it to git!"
echo ""
echo "To update your .env file with the correct keys:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/vfovtgtjailvrphsgafv/settings/api"
echo ""
echo "2. Copy the 'service_role' key (the long JWT token starting with eyJhbGc...)"
echo ""
echo "3. Edit .env file and replace BOTH occurrences:"
echo "   - Line 12: SUPABASE_SERVICE_ROLE_KEY=<paste_service_role_key_here>"
echo "   - Line 15: VITE_SUPABASE_SERVICE_ROLE_KEY=<paste_service_role_key_here>"
echo ""
echo "4. The ANON key should also be a JWT (eyJhbGc...) not sb_secret_*"
echo "   - Copy the 'anon' / 'public' key from Supabase"
echo "   - Update lines 5 and 9: VITE_SUPABASE_ANON_KEY=<paste_anon_key_here>"
echo ""
echo "5. Save the file and restart dev server:"
echo "   pkill -f vite && npm run dev"
echo ""
echo "================================================"
echo ""
echo "Current .env status:"
echo ""

# Check current keys
if [ -f .env ]; then
    echo "VITE_SUPABASE_ANON_KEY format:"
    grep "^VITE_SUPABASE_ANON_KEY=" .env | cut -d'=' -f2 | head -c 30
    echo "..."

    echo ""
    echo "VITE_SUPABASE_SERVICE_ROLE_KEY format:"
    grep "^VITE_SUPABASE_SERVICE_ROLE_KEY=" .env | cut -d'=' -f2 | head -c 30
    echo "..."
    echo ""

    # Check if keys are JWT format
    if grep -q "^VITE_SUPABASE_ANON_KEY=eyJhbGc" .env; then
        echo "✅ Anon key appears to be JWT format (correct)"
    else
        echo "❌ Anon key is NOT JWT format (incorrect - should start with eyJhbGc)"
    fi

    if grep -q "^VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc" .env; then
        echo "✅ Service role key appears to be JWT format (correct)"
    else
        echo "❌ Service role key is NOT JWT format (incorrect - should start with eyJhbGc)"
    fi
else
    echo "❌ .env file not found!"
fi

echo ""
echo "================================================"
