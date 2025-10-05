#!/usr/bin/env node

/**
 * Final Migration Attempt - Using browser automation
 * Opens Supabase SQL Editor with pre-filled SQL for one-click execution
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

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

if (!SUPABASE_URL) {
  console.error('❌ Missing SUPABASE_URL');
  process.exit(1);
}

const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
const migrationPath = join(__dirname, '..', 'migrations', 'add_updated_at_to_project_roadmaps.sql');
const sql = readFileSync(migrationPath, 'utf-8');

console.log('🔧 Supabase Migration Helper');
console.log('═'.repeat(60));
console.log(`📍 Project: ${projectRef}\n`);

console.log('📝 Migration SQL ready:');
console.log('─'.repeat(60));
console.log(sql);
console.log('─'.repeat(60));
console.log('');

const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql`;

console.log('🌐 Supabase SQL Editor:');
console.log(`   ${sqlEditorUrl}\n`);

console.log('📋 EXECUTION STEPS:');
console.log('   1. The SQL Editor should open in your browser');
console.log('   2. Click "New Query" button');
console.log('   3. Copy the SQL shown above');
console.log('   4. Paste into the editor');
console.log('   5. Click "Run" (or press Cmd/Ctrl + Enter)');
console.log('   6. Verify success message appears\n');

console.log('🚀 Opening SQL Editor in browser...\n');

try {
  // Open browser based on OS
  const openCommand = process.platform === 'darwin' ? 'open' :
                     process.platform === 'win32' ? 'start' : 'xdg-open';

  execSync(`${openCommand} "${sqlEditorUrl}"`, { stdio: 'ignore' });
  console.log('✅ Browser opened!');
  console.log('');

  console.log('💾 The SQL has been copied to your clipboard:');

  // Copy SQL to clipboard based on OS
  try {
    if (process.platform === 'darwin') {
      execSync('pbcopy', { input: sql });
      console.log('✅ SQL copied! Just paste it (Cmd+V) in the editor\n');
    } else if (process.platform === 'linux') {
      execSync('xclip -selection clipboard', { input: sql });
      console.log('✅ SQL copied! Just paste it (Ctrl+V) in the editor\n');
    } else {
      console.log('ℹ️  Copy the SQL manually from above\n');
    }
  } catch (e) {
    console.log('ℹ️  Clipboard copy failed - copy the SQL manually from above\n');
  }

  console.log('⏳ After executing the migration, run this to verify:');
  console.log('   node scripts/verify-migration.mjs\n');

} catch (error) {
  console.error('⚠️  Could not open browser automatically');
  console.log(`\n🔗 Please open this URL manually:\n   ${sqlEditorUrl}\n`);
}
