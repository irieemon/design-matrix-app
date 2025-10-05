#!/usr/bin/env node

/**
 * Run Migration via API
 *
 * Purpose: Execute migrations by calling the /api/admin/run-migration endpoint
 * Usage: node scripts/run-migration-via-api.mjs [--dry-run] [migration-file]
 *
 * Examples:
 *   node scripts/run-migration-via-api.mjs
 *   node scripts/run-migration-via-api.mjs --dry-run
 *   node scripts/run-migration-via-api.mjs fix_collaborators_infinite_recursion.sql
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const log = (message) => console.log(`${colors.cyan}[INFO]${colors.reset} ${message}`);
const logSuccess = (message) => console.log(`${colors.green}✅ ${message}${colors.reset}`);
const logError = (message) => console.error(`${colors.red}❌ ${message}${colors.reset}`);
const logWarning = (message) => console.warn(`${colors.yellow}⚠️  ${message}${colors.reset}`);

async function runMigration() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const migrationFile = args.find(arg => !arg.startsWith('--')) || 'fix_collaborators_infinite_recursion.sql';

  console.log(`\n${colors.bright}${'='.repeat(60)}`);
  console.log('RUN MIGRATION VIA API');
  console.log(`${'='.repeat(60)}${colors.reset}\n`);

  log('Configuration:');
  console.log(`  Migration File: ${migrationFile}`);
  console.log(`  Dry Run: ${dryRun ? 'Yes' : 'No'}`);
  console.log(`  API Endpoint: /api/admin/run-migration\n`);

  // Determine API URL
  const apiUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/admin/run-migration`
    : 'http://localhost:3000/api/admin/run-migration';

  log(`Using API URL: ${apiUrl}`);

  try {
    // Make API request
    log('Sending migration request...');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        migrationFile,
        confirm: true,
        dryRun
      })
    });

    const result = await response.json();

    if (!response.ok) {
      if (result.solution) {
        // Special handling for setup instructions
        console.log(`\n${colors.yellow}${'='.repeat(60)}`);
        console.log('SETUP REQUIRED');
        console.log(`${'='.repeat(60)}${colors.reset}\n`);

        console.log(result.solution.message);
        console.log(`\n${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
        console.log(result.solution.sql);
        console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}\n`);

        if (result.solution.manualMigration) {
          console.log(result.solution.manualMigration.message);
          console.log(`\n${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
          console.log(result.solution.manualMigration.sql);
          console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}\n`);
        }

        return 0; // Not a failure, just needs setup
      }

      throw new Error(`API error: ${result.error}\n${JSON.stringify(result, null, 2)}`);
    }

    // Success
    if (dryRun) {
      console.log(`\n${colors.bright}${'='.repeat(60)}`);
      console.log('DRY RUN - SQL PREVIEW');
      console.log(`${'='.repeat(60)}${colors.reset}\n`);

      console.log(`SQL Length: ${result.sqlLength} bytes\n`);
      console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
      console.log(result.sql);
      console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}\n`);

      logSuccess('Dry run completed - no changes made');
    } else {
      console.log(`\n${colors.green}${colors.bright}${'='.repeat(60)}`);
      console.log('MIGRATION SUCCESSFUL');
      console.log(`${'='.repeat(60)}${colors.reset}\n`);

      logSuccess(result.message);
      log(`Migration File: ${result.migrationFile}`);
      log(`Execution Method: ${result.executionMethod}`);
      log(`Timestamp: ${result.timestamp}`);
    }

    return 0;

  } catch (error) {
    console.log(`\n${colors.red}${colors.bright}${'='.repeat(60)}`);
    console.log('MIGRATION FAILED');
    console.log(`${'='.repeat(60)}${colors.reset}\n`);

    logError(error.message);

    if (error.cause) {
      console.log('\nCause:', error.cause);
    }

    return 1;
  }
}

runMigration()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    logError('Unhandled error');
    console.error(error);
    process.exit(1);
  });
