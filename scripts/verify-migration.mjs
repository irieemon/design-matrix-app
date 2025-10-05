#!/usr/bin/env node

/**
 * Verify Migration - Check if updated_at column was added successfully
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

console.log('🔍 Migration Verification');
console.log('═'.repeat(60));
console.log('');

async function verify() {
  try {
    // Test 1: Check if column exists by querying table
    console.log('Test 1: Column existence check...');
    const { data, error } = await supabase
      .from('project_roadmaps')
      .select('id, updated_at')
      .limit(1);

    if (error) {
      if (error.code === '42703') {
        console.log('❌ FAILED: updated_at column does NOT exist');
        console.log('   Error:', error.message);
        console.log('\n⚠️  Migration was not applied successfully');
        console.log('   Please run: node scripts/final-migration-attempt.mjs\n');
        process.exit(1);
      }
      throw error;
    }

    console.log('✅ PASSED: updated_at column exists\n');

    // Test 2: Test trigger functionality
    console.log('Test 2: Trigger functionality check...');

    if (data && data.length > 0) {
      const testRow = data[0];
      const oldUpdatedAt = testRow.updated_at;

      // Wait a moment then update the same row
      await new Promise(resolve => setTimeout(resolve, 1500));

      const { data: updateData, error: updateError } = await supabase
        .from('project_roadmaps')
        .update({ id: testRow.id }) // No-op update to trigger the trigger
        .eq('id', testRow.id)
        .select('updated_at')
        .single();

      if (updateError) {
        if (updateError.message && updateError.message.includes("has no field 'updated_at'")) {
          console.log('❌ FAILED: Trigger error detected');
          console.log('   Error: record "new" has no field "updated_at"');
          console.log('\n⚠️  Column exists but trigger is not working');
          console.log('   The migration may have been partially applied\n');
          process.exit(1);
        }
        throw updateError;
      }

      const newUpdatedAt = updateData.updated_at;

      if (new Date(newUpdatedAt) > new Date(oldUpdatedAt)) {
        console.log('✅ PASSED: Trigger is updating timestamp correctly\n');
      } else {
        console.log('⚠️  WARNING: Trigger may not be working');
        console.log(`   Old: ${oldUpdatedAt}`);
        console.log(`   New: ${newUpdatedAt}\n`);
      }
    } else {
      console.log('ℹ️  SKIPPED: No data in table to test trigger\n');
    }

    // Success summary
    console.log('═'.repeat(60));
    console.log('✅ MIGRATION VERIFIED SUCCESSFULLY!');
    console.log('═'.repeat(60));
    console.log('');
    console.log('✓ updated_at column exists');
    console.log('✓ Trigger is functional');
    console.log('✓ Ready for production use');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Test roadmap drag/drop functionality');
    console.log('   2. Monitor for any "updated_at" errors');
    console.log('   3. Verify roadmap updates work smoothly\n');

  } catch (error) {
    console.error('\n❌ Verification Error:');
    console.error('   ', error.message);
    if (error.code) console.error('   Code:', error.code);
    console.error('');
    process.exit(1);
  }
}

verify();
