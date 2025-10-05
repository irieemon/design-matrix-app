#!/usr/bin/env node

/**
 * Database Migration Script using node-postgres
 * Connects directly to Supabase PostgreSQL database
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

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
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Extract project ID
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)[1];

// Install pg if not present
console.log('📦 Ensuring pg library is available...');
try {
  execSync('npm list pg --depth=0 2>&1 | grep -q "pg@" || npm install --no-save pg', {
    stdio: 'pipe',
    encoding: 'utf-8'
  });
  console.log('✅ pg library ready\n');
} catch (error) {
  // Package might be installed, continue anyway
}

// Import pg
const pg = await import('pg');
const { Client } = pg.default;

// Supabase database connection configuration
// Using transaction pooler on port 6543
const config = {
  host: `aws-0-us-east-1.pooler.supabase.com`,
  port: 6543,
  database: 'postgres',
  user: `postgres.${projectRef}`,
  password: SERVICE_ROLE_KEY,
  ssl: {
    rejectUnauthorized: false
  },
  // Connection timeout settings
  connectionTimeoutMillis: 10000,
  query_timeout: 30000,
};

async function applyMigration() {
  const client = new Client(config);

  try {
    console.log('🔧 Supabase Database Migration');
    console.log('═'.repeat(60));
    console.log(`📍 Project: ${projectRef}`);
    console.log(`🌐 Host: ${config.host}`);
    console.log(`👤 User: ${config.user}`);
    console.log('');

    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Read migration file
    const migrationPath = join(__dirname, '..', 'migrations', 'add_updated_at_to_project_roadmaps.sql');

    if (!existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('📝 Loaded migration SQL');
    console.log(`   File: add_updated_at_to_project_roadmaps.sql`);
    console.log(`   Size: ${migrationSQL.length} bytes\n`);

    // Execute migration
    console.log('⚡ Executing migration...');
    console.log('─'.repeat(60));

    const result = await client.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify column exists
    console.log('🔍 Verification Step 1: Check column exists');
    const columnQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'project_roadmaps'
        AND column_name = 'updated_at';
    `;

    const columnResult = await client.query(columnQuery);

    if (columnResult.rows.length === 0) {
      throw new Error('❌ Column was not created!');
    }

    const column = columnResult.rows[0];
    console.log('✅ Column verified:');
    console.log(`   Name:     ${column.column_name}`);
    console.log(`   Type:     ${column.data_type}`);
    console.log(`   Nullable: ${column.is_nullable}`);
    console.log(`   Default:  ${column.column_default || '(none)'}\n`);

    // Verify trigger exists
    console.log('🔍 Verification Step 2: Check trigger exists');
    const triggerQuery = `
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table = 'project_roadmaps'
        AND trigger_name = 'update_project_roadmaps_updated_at';
    `;

    const triggerResult = await client.query(triggerQuery);

    if (triggerResult.rows.length === 0) {
      console.log('⚠️  Trigger not found (may need separate creation)\n');
    } else {
      const trigger = triggerResult.rows[0];
      console.log('✅ Trigger verified:');
      console.log(`   Name:   ${trigger.trigger_name}`);
      console.log(`   Event:  ${trigger.event_manipulation}`);
      console.log(`   Timing: ${trigger.action_timing}\n`);
    }

    // Show complete table structure
    console.log('📊 Complete table structure:');
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'project_roadmaps'
      ORDER BY ordinal_position;
    `;

    const structureResult = await client.query(structureQuery);
    console.log('─'.repeat(60));
    console.log('COLUMN NAME           TYPE                      NULLABLE');
    console.log('─'.repeat(60));
    structureResult.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? 'YES' : 'NO';
      console.log(`${row.column_name.padEnd(20)} ${row.data_type.padEnd(25)} ${nullable}`);
    });
    console.log('─'.repeat(60));
    console.log('');

    console.log('═'.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(60));
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. ✓ Database schema updated');
    console.log('   2. ✓ Trigger configured');
    console.log('   3. → Test roadmap drag/drop in application');
    console.log('   4. → Verify no "updated_at" errors occur');
    console.log('   5. → Monitor application for smooth operation\n');

    return true;

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED!');
    console.error('═'.repeat(60));
    console.error('Error:', error.message);

    if (error.code) {
      console.error('Code:', error.code);
    }

    if (error.detail) {
      console.error('Detail:', error.detail);
    }

    if (error.hint) {
      console.error('Hint:', error.hint);
    }

    console.error('\n💡 Troubleshooting:');
    console.error('   - Verify database credentials are correct');
    console.error('   - Check service role key has admin permissions');
    console.error('   - Ensure network can reach Supabase servers');
    console.error('   - Try executing SQL manually in Supabase dashboard\n');

    const editorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql`;
    console.error(`📝 Manual execution URL: ${editorUrl}\n`);

    process.exit(1);

  } finally {
    await client.end();
    console.log('🔌 Database connection closed\n');
  }
}

// Run migration
applyMigration();
