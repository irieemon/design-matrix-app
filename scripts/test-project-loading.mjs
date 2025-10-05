#!/usr/bin/env node

/**
 * Test Script: Project Loading Flow Verification
 *
 * Purpose: Independently test the project loading functionality to isolate issues
 * Tests: Database connectivity, service role permissions, query execution
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple .env parser
function loadEnv(filePath) {
  try {
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
  } catch (error) {
    console.error('Error loading .env file:', error.message);
  }
}

loadEnv(resolve(__dirname, '../.env'));

// Test configuration
const TEST_USER_ID = 'e5aa576d-18bf-417a-86a9-1de0518f4f0e';

// Utility functions
const timestamp = () => new Date().toISOString();
const log = (message, data = null) => {
  console.log(`[${timestamp()}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
};

const logError = (message, error) => {
  console.error(`[${timestamp()}] ❌ ERROR: ${message}`);
  console.error(error);
};

const logSuccess = (message) => {
  console.log(`[${timestamp()}] ✅ ${message}`);
};

const logWarning = (message) => {
  console.warn(`[${timestamp()}] ⚠️  ${message}`);
};

/**
 * Initialize Supabase client with service role
 */
function initializeSupabaseClient(useServiceRole = true) {
  log(`Initializing Supabase client (${useServiceRole ? 'service role' : 'anon key'})...`);

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not defined in environment');
  }

  const apiKey = useServiceRole ? serviceRoleKey : anonKey;
  const keyName = useServiceRole ? 'SUPABASE_SERVICE_ROLE_KEY' : 'VITE_SUPABASE_ANON_KEY';

  if (!apiKey) {
    throw new Error(`${keyName} is not defined in environment`);
  }

  log('Environment variables found:', {
    supabaseUrl,
    keyType: useServiceRole ? 'service_role' : 'anon',
    keyLength: apiKey.length,
    keyPrefix: apiKey.substring(0, 20) + '...',
    keySuffix: '...' + apiKey.substring(apiKey.length - 20)
  });

  // Validate JWT format
  const jwtParts = apiKey.split('.');
  if (jwtParts.length !== 3) {
    throw new Error(`Invalid JWT format: expected 3 parts, got ${jwtParts.length}`);
  }
  log('JWT format validated:', {
    headerLength: jwtParts[0].length,
    payloadLength: jwtParts[1].length,
    signatureLength: jwtParts[2].length
  });

  const client = createClient(supabaseUrl, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  logSuccess('Supabase client initialized');
  return { client, useServiceRole };
}

/**
 * Test database connectivity
 */
async function testDatabaseConnectivity(client) {
  log('Testing database connectivity...');

  try {
    const { data, error } = await client
      .from('projects')
      .select('count')
      .limit(1);

    if (error) throw error;

    logSuccess('Database connectivity test passed');
    return true;
  } catch (error) {
    logError('Database connectivity test failed', error);
    return false;
  }
}

/**
 * Test service role permissions
 */
async function testServiceRolePermissions(client) {
  log('Testing service role permissions...');

  try {
    // Test read permission
    const { data: readData, error: readError } = await client
      .from('projects')
      .select('id')
      .limit(1);

    if (readError) {
      logError('Service role READ permission failed', readError);
      return false;
    }

    logSuccess('Service role READ permission verified');

    // Test if we can query with RLS bypassed (service role privilege)
    const { data: rlsData, error: rlsError } = await client
      .from('projects')
      .select('id, user_id')
      .limit(5);

    if (rlsError) {
      logWarning('Service role may not bypass RLS properly');
      log('RLS test error:', rlsError);
    } else {
      logSuccess('Service role can query with RLS bypass');
      log('Sample projects fetched:', { count: rlsData?.length || 0 });
    }

    return true;
  } catch (error) {
    logError('Service role permissions test failed', error);
    return false;
  }
}

/**
 * Test getUserOwnedProjects functionality
 */
async function testGetUserOwnedProjects(client, userId) {
  log(`Testing getUserOwnedProjects for user: ${userId}`);

  try {
    const startTime = Date.now();

    // Execute the exact query from projectRepository.ts
    const { data, error } = await client
      .from('projects')
      .select(`
        *,
        project_collaborators!inner (
          user_id,
          role
        )
      `)
      .eq('project_collaborators.user_id', userId)
      .order('updated_at', { ascending: false });

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (error) {
      logError('Query execution failed', error);
      return { success: false, error };
    }

    logSuccess(`Query executed successfully in ${duration}ms`);
    log('Query results:', {
      projectCount: data?.length || 0,
      duration: `${duration}ms`
    });

    if (data && data.length > 0) {
      log('Project details:');
      data.forEach((project, index) => {
        log(`  Project ${index + 1}:`, {
          id: project.id,
          name: project.name,
          user_id: project.user_id,
          created_at: project.created_at,
          updated_at: project.updated_at,
          collaborators: project.project_collaborators
        });
      });
    } else {
      logWarning('No projects found for this user');

      // Additional diagnostic query
      log('Running diagnostic query to check collaborators table...');
      const { data: collabData, error: collabError } = await client
        .from('project_collaborators')
        .select('*')
        .eq('user_id', userId);

      if (collabError) {
        logError('Collaborators diagnostic query failed', collabError);
      } else {
        log('Collaborators for user:', {
          count: collabData?.length || 0,
          collaborations: collabData
        });
      }
    }

    return { success: true, data };
  } catch (error) {
    logError('Unexpected error in getUserOwnedProjects test', error);
    return { success: false, error };
  }
}

/**
 * Test alternative query without inner join
 */
async function testAlternativeQuery(client, userId) {
  log(`Testing alternative query (without inner join) for user: ${userId}`);

  try {
    const { data, error } = await client
      .from('projects')
      .select(`
        *,
        project_collaborators (
          user_id,
          role
        )
      `)
      .eq('project_collaborators.user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      logError('Alternative query failed', error);
      return { success: false, error };
    }

    logSuccess('Alternative query executed successfully');
    log('Alternative query results:', {
      projectCount: data?.length || 0
    });

    return { success: true, data };
  } catch (error) {
    logError('Unexpected error in alternative query test', error);
    return { success: false, error };
  }
}

/**
 * Test direct user projects query
 */
async function testDirectUserProjectsQuery(client, userId) {
  log(`Testing direct user projects query for user: ${userId}`);

  try {
    // Use owner_id instead of user_id
    const { data, error } = await client
      .from('projects')
      .select('*')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      logError('Direct query failed', error);
      return { success: false, error };
    }

    logSuccess('Direct query executed successfully');
    log('Direct query results:', {
      projectCount: data?.length || 0
    });

    if (data && data.length > 0) {
      log('Projects owned directly by user:');
      data.forEach((project, index) => {
        log(`  Project ${index + 1}:`, {
          id: project.id,
          name: project.name,
          owner_id: project.owner_id
        });
      });
    } else {
      logWarning('No projects owned directly by this user');
    }

    return { success: true, data };
  } catch (error) {
    logError('Unexpected error in direct query test', error);
    return { success: false, error };
  }
}

/**
 * Test database schema inspection
 */
async function testDatabaseSchema(client) {
  log('Testing database schema inspection...');

  try {
    // Get projects table structure
    const { data: projectsData, error: projectsError } = await client
      .from('projects')
      .select('*')
      .limit(1);

    if (projectsError && projectsError.code !== 'PGRST116') { // PGRST116 = no rows
      logError('Projects table query failed', projectsError);
    } else {
      logSuccess('Projects table accessible');
      if (projectsData && projectsData.length > 0) {
        log('Sample project columns:', Object.keys(projectsData[0]));
      }
    }

    // Get collaborators table structure
    const { data: collabData, error: collabError } = await client
      .from('project_collaborators')
      .select('*')
      .limit(1);

    if (collabError && collabError.code !== 'PGRST116') {
      logError('Collaborators table query failed', collabError);
    } else {
      logSuccess('Collaborators table accessible');
      if (collabData && collabData.length > 0) {
        log('Sample collaborator columns:', Object.keys(collabData[0]));
      }
    }

    // Get total counts
    const { count: projectCount, error: countError } = await client
      .from('projects')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      log('Total projects in database:', { count: projectCount });
    }

    const { count: collabCount, error: collabCountError } = await client
      .from('project_collaborators')
      .select('*', { count: 'exact', head: true });

    if (!collabCountError) {
      log('Total collaborator records:', { count: collabCount });
    }

    return { success: true };
  } catch (error) {
    logError('Schema inspection failed', error);
    return { success: false, error };
  }
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('\n========================================');
  console.log('PROJECT LOADING FLOW VERIFICATION TEST');
  console.log('========================================\n');

  let client;
  let useServiceRole;
  const results = {
    initialization: false,
    connectivity: false,
    permissions: false,
    schema: false,
    getUserOwnedProjects: false,
    alternativeQuery: false,
    directQuery: false
  };

  try {
    // Step 1: Initialize client with service role
    log('STEP 1A: Initializing Supabase client with service role');
    try {
      const serviceRoleInit = initializeSupabaseClient(true);
      client = serviceRoleInit.client;
      useServiceRole = serviceRoleInit.useServiceRole;
      results.initialization = true;
      console.log();

      // Try a quick connectivity test
      const { error: testError } = await client.from('projects').select('id').limit(1);
      if (testError) {
        logWarning('Service role key failed, trying anon key...');
        throw testError;
      }
      logSuccess('Service role key validated successfully');
    } catch (serviceRoleError) {
      logWarning('Service role initialization failed, falling back to anon key');
      log('Error details:', serviceRoleError);

      log('\nSTEP 1B: Initializing Supabase client with anon key');
      const anonInit = initializeSupabaseClient(false);
      client = anonInit.client;
      useServiceRole = anonInit.useServiceRole;
      results.initialization = true;
    }
    console.log();

    // Step 2: Test connectivity
    log('STEP 2: Testing database connectivity');
    results.connectivity = await testDatabaseConnectivity(client);
    console.log();

    // Step 3: Test permissions
    log('STEP 3: Testing service role permissions');
    results.permissions = await testServiceRolePermissions(client);
    console.log();

    // Step 4: Test database schema
    log('STEP 4: Inspecting database schema');
    const schemaResult = await testDatabaseSchema(client);
    results.schema = schemaResult.success;
    console.log();

    // Step 5: Test getUserOwnedProjects
    log('STEP 5: Testing getUserOwnedProjects query');
    const projectsResult = await testGetUserOwnedProjects(client, TEST_USER_ID);
    results.getUserOwnedProjects = projectsResult.success;
    console.log();

    // Step 6: Test alternative query
    log('STEP 6: Testing alternative query approach');
    const altResult = await testAlternativeQuery(client, TEST_USER_ID);
    results.alternativeQuery = altResult.success;
    console.log();

    // Step 7: Test direct query
    log('STEP 7: Testing direct user projects query');
    const directResult = await testDirectUserProjectsQuery(client, TEST_USER_ID);
    results.directQuery = directResult.success;
    console.log();

  } catch (error) {
    logError('Fatal error during test execution', error);
  }

  // Print summary
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================\n');

  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  const allPassed = Object.values(results).every(result => result === true);
  console.log('\n========================================');
  console.log(allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  console.log('========================================\n');

  process.exit(allPassed ? 0 : 1);
}

// Execute tests
runTests().catch(error => {
  logError('Unhandled error in test execution', error);
  process.exit(1);
});
