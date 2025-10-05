#!/usr/bin/env node

/**
 * Migration Runner Script
 *
 * Purpose: Execute SQL migrations programmatically using Supabase service role
 * Usage: node scripts/run-migration.mjs [migration-file-path]
 *
 * Examples:
 *   node scripts/run-migration.mjs migrations/fix_collaborators_infinite_recursion.sql
 *   node scripts/run-migration.mjs path/to/migration.sql
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Utility functions
const log = (message, data = null) => {
  console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
};

const logSuccess = (message) => {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
};

const logError = (message, error = null) => {
  console.error(`${colors.red}❌ ERROR: ${message}${colors.reset}`);
  if (error) {
    console.error(error);
  }
};

const logWarning = (message) => {
  console.warn(`${colors.yellow}⚠️  WARNING: ${message}${colors.reset}`);
};

const logHeader = (message) => {
  const separator = '='.repeat(60);
  console.log(`\n${colors.bright}${separator}`);
  console.log(message);
  console.log(`${separator}${colors.reset}\n`);
};

/**
 * Load environment variables from .env file
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

    logSuccess('.env file loaded successfully');
    return true;
  } catch (error) {
    logError('Error loading .env file', error);
    return false;
  }
}

/**
 * Read and parse SQL migration file
 */
function readMigrationFile(filePath) {
  try {
    // Resolve path relative to project root if not absolute
    const absolutePath = filePath.startsWith('/')
      ? filePath
      : resolve(PROJECT_ROOT, filePath);

    if (!existsSync(absolutePath)) {
      throw new Error(`Migration file not found: ${absolutePath}`);
    }

    const sql = readFileSync(absolutePath, 'utf8');

    // Remove comments for cleaner execution
    const cleanedSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .trim();

    if (!cleanedSql) {
      throw new Error('Migration file is empty or contains only comments');
    }

    logSuccess(`Migration file read: ${absolutePath}`);
    log(`SQL content (${cleanedSql.length} bytes)`, {
      preview: cleanedSql.substring(0, 200) + (cleanedSql.length > 200 ? '...' : ''),
      fullLength: cleanedSql.length
    });

    return { sql: cleanedSql, path: absolutePath };
  } catch (error) {
    logError('Failed to read migration file', error);
    throw error;
  }
}

/**
 * Initialize Supabase admin client
 */
function initializeSupabaseAdmin() {
  log('Initializing Supabase admin client...');

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL or SUPABASE_URL environment variable is required');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  log('Environment check:', {
    supabaseUrl: supabaseUrl.substring(0, 30) + '...',
    serviceRoleKeyLength: serviceRoleKey.length,
    keyPrefix: serviceRoleKey.substring(0, 20) + '...'
  });

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  logSuccess('Supabase admin client initialized with service role');
  return client;
}

/**
 * Execute SQL migration
 * Tries multiple RPC methods to handle different Supabase configurations
 */
async function executeMigration(client, sql) {
  log('Attempting to execute migration...');

  // Try method 1: exec_sql RPC (used in migrate-database.ts)
  try {
    log('Trying RPC method: exec_sql');
    const { data, error } = await client.rpc('exec_sql', { sql });

    if (error) {
      logWarning(`exec_sql method failed: ${error.message}`);
      throw error;
    }

    logSuccess('Migration executed successfully via exec_sql');
    return { method: 'exec_sql', data };
  } catch (execSqlError) {
    log('exec_sql method not available, trying alternative...');
  }

  // Try method 2: sql RPC (used in enable-realtime-sql.ts)
  try {
    log('Trying RPC method: sql');
    const { data, error } = await client.rpc('sql', { query: sql });

    if (error) {
      logWarning(`sql method failed: ${error.message}`);
      throw error;
    }

    logSuccess('Migration executed successfully via sql RPC');
    return { method: 'sql', data };
  } catch (sqlError) {
    log('sql method not available, trying direct execution...');
  }

  // Try method 3: Direct SQL execution (may not work with DDL)
  try {
    log('Trying direct SQL execution (this may fail for DDL statements)');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    logWarning('Direct execution may not support all DDL operations');
    log(`Executing ${statements.length} statement(s)`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      log(`Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);

      // This is a last resort and may not work
      const result = await client.rpc('query', { sql: statement + ';' });
      if (result.error) {
        throw result.error;
      }
    }

    logSuccess('Migration executed successfully via direct execution');
    return { method: 'direct', data: null };
  } catch (directError) {
    logError('All execution methods failed', directError);
    throw new Error('No available method to execute SQL migration. Please ensure RPC functions are enabled in Supabase.');
  }
}

/**
 * Verify migration was applied successfully
 */
async function verifyMigration(client) {
  log('Verifying migration...');

  try {
    // Check if the policy exists
    const { data, error } = await client.rpc('sql', {
      query: `
        SELECT policyname, cmd, qual::text as condition
        FROM pg_policies
        WHERE tablename = 'project_collaborators'
        AND policyname = 'Users can view collaborators of accessible projects';
      `
    });

    if (error) {
      logWarning('Verification query failed (this is not critical)', error);
      return false;
    }

    if (data && data.length > 0) {
      logSuccess('Migration verified: Policy exists and was updated');
      log('Policy details:', data);
      return true;
    } else {
      logWarning('Verification: Policy not found (may need manual verification)');
      return false;
    }
  } catch (error) {
    logWarning('Verification failed (this is not critical)', error);
    return false;
  }
}

/**
 * Main execution function
 */
async function runMigration() {
  logHeader('SQL MIGRATION RUNNER');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const migrationPath = args[0] || 'migrations/fix_collaborators_infinite_recursion.sql';

  log('Migration configuration:', {
    migrationPath,
    projectRoot: PROJECT_ROOT,
    cwd: process.cwd()
  });

  let client;
  let migration;

  try {
    // Step 1: Load environment variables
    logHeader('STEP 1: Load Environment Variables');
    const envPath = resolve(PROJECT_ROOT, '.env');
    if (!loadEnv(envPath)) {
      throw new Error('Failed to load .env file. Ensure it exists and contains SUPABASE credentials.');
    }

    // Step 2: Read migration file
    logHeader('STEP 2: Read Migration File');
    migration = readMigrationFile(migrationPath);

    // Step 3: Initialize Supabase client
    logHeader('STEP 3: Initialize Supabase Admin Client');
    client = initializeSupabaseAdmin();

    // Step 4: Execute migration
    logHeader('STEP 4: Execute Migration');
    const result = await executeMigration(client, migration.sql);
    log('Execution result:', result);

    // Step 5: Verify migration (optional, may fail)
    logHeader('STEP 5: Verify Migration');
    await verifyMigration(client);

    // Success summary
    logHeader('MIGRATION COMPLETE');
    logSuccess(`Migration applied successfully: ${migration.path}`);
    logSuccess(`Execution method: ${result.method}`);

    console.log(`\n${colors.green}${colors.bright}✅ Migration completed successfully!${colors.reset}\n`);

    return 0;

  } catch (error) {
    logHeader('MIGRATION FAILED');
    logError('Migration execution failed', error);

    console.log(`\n${colors.red}${colors.bright}❌ Migration failed. See error details above.${colors.reset}\n`);

    // Provide helpful troubleshooting tips
    console.log(`${colors.yellow}Troubleshooting tips:${colors.reset}`);
    console.log('1. Ensure SUPABASE_SERVICE_ROLE_KEY is set in .env');
    console.log('2. Verify the service role key has admin privileges');
    console.log('3. Check if RPC functions (exec_sql, sql) are enabled in Supabase');
    console.log('4. Try running the SQL manually in Supabase SQL Editor');
    console.log('5. Check migration file syntax for errors\n');

    return 1;
  }
}

// Execute migration
runMigration()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    logError('Unhandled error', error);
    process.exit(1);
  });
