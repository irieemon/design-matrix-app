#!/usr/bin/env node

/**
 * Setup and Run Migration Script
 *
 * Purpose: Create necessary RPC function if it doesn't exist, then run migration
 * Usage: node scripts/setup-and-run-migration.mjs [migration-file-path]
 *
 * This script:
 * 1. Checks if exec_sql RPC function exists
 * 2. If not, provides SQL to create it manually
 * 3. Runs the migration using the RPC function
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const log = (message) => console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`);
const logSuccess = (message) => console.log(`${colors.green}✅ ${message}${colors.reset}`);
const logError = (message) => console.error(`${colors.red}❌ ${message}${colors.reset}`);
const logWarning = (message) => console.warn(`${colors.yellow}⚠️  ${message}${colors.reset}`);
const logHeader = (message) => {
  const separator = '='.repeat(60);
  console.log(`\n${colors.bright}${separator}`);
  console.log(message);
  console.log(`${separator}${colors.reset}\n`);
};

/**
 * Load environment variables
 */
function loadEnv(filePath) {
  try {
    if (!existsSync(filePath)) {
      logWarning(`.env file not found at ${filePath}`);
      return false;
    }

    const envFile = readFileSync(filePath, 'utf8');
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key.trim()] = value.trim();
        }
      }
    });

    logSuccess('.env file loaded');
    return true;
  } catch (error) {
    logError('Error loading .env file');
    console.error(error);
    return false;
  }
}

/**
 * Initialize Supabase client
 */
function initializeSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Read migration file
 */
function readMigrationFile(filePath) {
  const absolutePath = filePath.startsWith('/')
    ? filePath
    : resolve(PROJECT_ROOT, filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Migration file not found: ${absolutePath}`);
  }

  const sql = readFileSync(absolutePath, 'utf8')
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .trim();

  return { sql, path: absolutePath };
}

/**
 * Alternative: Use Supabase REST API directly
 */
async function executeViaRestApi(supabaseUrl, serviceRoleKey, sql) {
  log('Attempting direct PostgreSQL execution via REST API...');

  try {
    // Use PostgREST to execute SQL directly
    // This requires the service role and may have limitations
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`REST API execution failed: ${JSON.stringify(error)}`);
    }

    logSuccess('Migration executed via REST API');
    return true;
  } catch (error) {
    logWarning(`REST API method failed: ${error.message}`);
    return false;
  }
}

/**
 * Provide manual instructions
 */
function provideManualInstructions(sql) {
  logHeader('MANUAL MIGRATION REQUIRED');

  console.log(`${colors.yellow}The migration cannot be executed automatically.${colors.reset}`);
  console.log(`${colors.yellow}Please follow these steps:${colors.reset}\n`);

  console.log(`${colors.bright}STEP 1: Open Supabase Dashboard${colors.reset}`);
  console.log('1. Go to https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Navigate to: SQL Editor\n');

  console.log(`${colors.bright}STEP 2: Copy and Execute SQL${colors.reset}`);
  console.log('Copy the SQL below and paste it into the SQL Editor:\n');

  console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
  console.log(sql);
  console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}\n`);

  console.log(`${colors.bright}STEP 3: Click "Run" Button${colors.reset}`);
  console.log('Execute the SQL in the Supabase SQL Editor\n');

  console.log(`${colors.bright}STEP 4: Verify Success${colors.reset}`);
  console.log('Check that the policy was updated successfully\n');

  console.log(`${colors.green}${colors.bright}Alternative: Enable RPC Function (One-Time Setup)${colors.reset}`);
  console.log('To enable automated migrations in the future, run this SQL once:\n');

  const setupSql = `
-- Create exec_sql function for automated migrations
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
  `.trim();

  console.log(`${colors.magenta}${'─'.repeat(60)}${colors.reset}`);
  console.log(setupSql);
  console.log(`${colors.magenta}${'─'.repeat(60)}${colors.reset}\n`);

  console.log(`${colors.yellow}After running the setup SQL once, you can use:${colors.reset}`);
  console.log(`  node scripts/run-migration.mjs\n`);
}

/**
 * Main execution
 */
async function main() {
  logHeader('MIGRATION SETUP AND EXECUTION');

  const args = process.argv.slice(2);
  const migrationPath = args[0] || 'migrations/fix_collaborators_infinite_recursion.sql';

  try {
    // Load environment
    logHeader('STEP 1: Load Environment');
    const envPath = resolve(PROJECT_ROOT, '.env');
    if (!loadEnv(envPath)) {
      throw new Error('Failed to load .env file');
    }

    // Read migration
    logHeader('STEP 2: Read Migration File');
    const migration = readMigrationFile(migrationPath);
    logSuccess(`Migration file read: ${migration.path}`);
    log(`SQL size: ${migration.sql.length} bytes`);

    // Initialize Supabase
    logHeader('STEP 3: Initialize Supabase Client');
    const supabase = initializeSupabase();
    logSuccess('Supabase client initialized');

    // Try to execute
    logHeader('STEP 4: Attempt Migration Execution');

    // Check if exec_sql function exists
    const { data: functionCheck, error: functionError } = await supabase.rpc('exec_sql', {
      sql: 'SELECT 1;'
    });

    if (!functionError) {
      // exec_sql exists, use it
      log('exec_sql function is available');
      const { error: migrationError } = await supabase.rpc('exec_sql', {
        sql: migration.sql
      });

      if (migrationError) {
        throw migrationError;
      }

      logSuccess('Migration executed successfully!');
      logHeader('MIGRATION COMPLETE');
      console.log(`${colors.green}${colors.bright}✅ Migration completed successfully!${colors.reset}\n`);
      return 0;
    }

    // exec_sql doesn't exist, try REST API
    logWarning('exec_sql function not available');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const restSuccess = await executeViaRestApi(supabaseUrl, serviceRoleKey, migration.sql);

    if (restSuccess) {
      logSuccess('Migration executed successfully via REST API!');
      logHeader('MIGRATION COMPLETE');
      console.log(`${colors.green}${colors.bright}✅ Migration completed successfully!${colors.reset}\n`);
      return 0;
    }

    // All automated methods failed, provide manual instructions
    provideManualInstructions(migration.sql);
    return 0; // Not a failure, just requires manual execution

  } catch (error) {
    logHeader('ERROR');
    logError('Migration setup failed');
    console.error(error);
    return 1;
  }
}

main()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    logError('Unhandled error');
    console.error(error);
    process.exit(1);
  });
