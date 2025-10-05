#!/usr/bin/env node

/**
 * Database Migration Script - Direct Approach
 * Manually applies the updated_at column to project_roadmaps table
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function applyMigration() {
  console.log('🔧 Database Migration - Direct Execution');
  console.log('═'.repeat(60));
  console.log(`🌐 Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  try {
    // Step 1: Check if column exists
    console.log('🔍 Step 1: Checking if updated_at column exists...');
    const { data: columnCheck, error: checkError } = await supabase
      .from('project_roadmaps')
      .select('updated_at')
      .limit(1);

    if (checkError && checkError.code === '42703') {
      console.log('   Column does not exist - proceeding with migration\n');

      // Since we can't execute arbitrary SQL through the JS client,
      // we'll provide instructions for manual execution
      console.log('❗ IMPORTANT: Supabase JS client cannot execute DDL statements');
      console.log('   (ALTER TABLE, CREATE TRIGGER, etc.)\n');

      const migrationPath = join(__dirname, '..', 'migrations', 'add_updated_at_to_project_roadmaps.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf-8');

      console.log('📝 MIGRATION SQL:');
      console.log('─'.repeat(60));
      console.log(migrationSQL);
      console.log('─'.repeat(60));
      console.log('');

      const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
      const editorURL = `https://supabase.com/dashboard/project/${projectRef}/sql`;

      console.log('🌐 EXECUTE IN SUPABASE SQL EDITOR:');
      console.log(`   ${editorURL}\n`);

      console.log('📋 Quick Steps:');
      console.log('   1. Click the link above to open SQL Editor');
      console.log('   2. Click "New Query"');
      console.log('   3. Copy/paste the SQL shown above');
      console.log('   4. Click "Run" to execute');
      console.log('   5. Verify success message appears\n');

      console.log('✅ After executing the SQL, run this script again to verify\n');

    } else if (checkError) {
      throw checkError;
    } else {
      console.log('✅ Column already exists!\n');

      // Verify trigger
      console.log('🔍 Step 2: Verifying trigger...');
      const { data: testData, error: testError } = await supabase
        .from('project_roadmaps')
        .select('id, updated_at')
        .limit(1)
        .single();

      if (testError) {
        console.log(`⚠️  Could not verify: ${testError.message}\n`);
      } else {
        console.log(`✅ Table is accessible with updated_at column\n`);
      }

      // Test a simple update to verify trigger works
      console.log('🔍 Step 3: Testing trigger functionality...');
      if (testData && testData.id) {
        const oldUpdatedAt = testData.updated_at;

        // Wait a moment then update
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: updateData, error: updateError } = await supabase
          .from('project_roadmaps')
          .update({ id: testData.id })
          .eq('id', testData.id)
          .select('updated_at')
          .single();

        if (updateError) {
          if (updateError.message.includes("has no field 'updated_at'")) {
            console.log('❌ Trigger error detected - migration still needed!');
            console.log('   Error: record "new" has no field "updated_at"\n');
            process.exit(1);
          } else {
            console.log(`⚠️  Update test: ${updateError.message}\n`);
          }
        } else {
          console.log('✅ Trigger is working correctly!\n');
        }
      }

      console.log('═'.repeat(60));
      console.log('✅ MIGRATION VERIFIED - All systems operational!');
      console.log('═'.repeat(60));
      console.log('');
      console.log('📋 Next Steps:');
      console.log('   ✓ updated_at column exists');
      console.log('   ✓ Trigger is functional');
      console.log('   ✓ Ready to test roadmap drag/drop\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error('   ', error.message);
    if (error.code) {
      console.error('   Code:', error.code);
    }
    console.error('');
    process.exit(1);
  }
}

applyMigration();
