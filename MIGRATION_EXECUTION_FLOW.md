# Migration Execution Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     MIGRATION EXECUTION SYSTEM                   │
└─────────────────────────────────────────────────────────────────┘

                            USER STARTS HERE
                                   │
                                   ▼
                     ┌─────────────────────────┐
                     │  Choose Execution Path  │
                     └─────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
    ┌─────────┐            ┌─────────────┐         ┌──────────┐
    │ SCRIPT  │            │     API     │         │  MANUAL  │
    │  PATH   │            │    PATH     │         │   PATH   │
    └─────────┘            └─────────────┘         └──────────┘
```

---

## Script Path (Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│                         SCRIPT PATH                              │
└─────────────────────────────────────────────────────────────────┘

USER: node scripts/setup-and-run-migration.mjs
         │
         ▼
┌────────────────────────┐
│ Load .env file         │
│ ✅ VITE_SUPABASE_URL   │
│ ✅ SERVICE_ROLE_KEY    │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Read migration SQL     │
│ ✅ Parse file          │
│ ✅ Remove comments     │
│ ✅ Validate content    │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Initialize Supabase    │
│ ✅ Service role client │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Try Method 1: exec_sql │
└────────────────────────┘
         │
         ├─── ✅ Success ────────────────┐
         │                               │
         └─── ❌ Failed                  │
              │                          │
              ▼                          │
┌────────────────────────┐              │
│ Try Method 2: sql RPC  │              │
└────────────────────────┘              │
         │                               │
         ├─── ✅ Success ───────────┐   │
         │                          │   │
         └─── ❌ Failed             │   │
              │                     │   │
              ▼                     │   │
┌────────────────────────┐         │   │
│ Try Method 3: Direct   │         │   │
└────────────────────────┘         │   │
         │                          │   │
         ├─── ✅ Success ──────┐   │   │
         │                     │   │   │
         └─── ❌ Failed        │   │   │
              │                │   │   │
              ▼                │   │   │
┌─────────────────────────┐   │   │   │
│ Provide Manual          │   │   │   │
│ Instructions:           │   │   │   │
│                         │   │   │   │
│ 1. Copy SQL            │   │   │   │
│ 2. Supabase Dashboard  │   │   │   │
│ 3. SQL Editor          │   │   │   │
│ 4. Execute             │   │   │   │
│                         │   │   │   │
│ + One-time RPC setup   │   │   │   │
└─────────────────────────┘   │   │   │
              │                │   │   │
              │                │   │   │
              └────────────────┴───┴───┴───────────┐
                                                   ▼
                                          ┌──────────────┐
                                          │  MIGRATION   │
                                          │   APPLIED    │
                                          └──────────────┘
```

---

## API Path

```
┌─────────────────────────────────────────────────────────────────┐
│                          API PATH                                │
└─────────────────────────────────────────────────────────────────┘

USER: node scripts/run-migration-via-api.mjs
         │
         ▼
┌────────────────────────┐
│ Build API Request      │
│ {                      │
│   migrationFile: "...",│
│   confirm: true        │
│ }                      │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ POST to Vercel API     │
│ /api/admin/            │
│ run-migration          │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ API Handler            │
│ - Read migration file  │
│ - Initialize Supabase  │
│ - Execute via RPC      │
└────────────────────────┘
         │
         ├─── ✅ Success ────────────────┐
         │                               │
         └─── ❌ Failed                  │
              │                          │
              ▼                          │
┌─────────────────────────┐             │
│ Return Setup            │             │
│ Instructions            │             │
│                         │             │
│ {                       │             │
│   solution: {           │             │
│     sql: "CREATE..."    │             │
│   }                     │             │
│ }                       │             │
└─────────────────────────┘             │
              │                          │
              │                          │
              └──────────────────────────┴───────────────┐
                                                         ▼
                                                ┌──────────────┐
                                                │  MIGRATION   │
                                                │   APPLIED    │
                                                └──────────────┘
```

---

## Manual Path

```
┌─────────────────────────────────────────────────────────────────┐
│                        MANUAL PATH                               │
└─────────────────────────────────────────────────────────────────┘

USER: Opens Supabase Dashboard
         │
         ▼
┌────────────────────────┐
│ Navigate to:           │
│ SQL Editor             │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Copy SQL from:         │
│ migrations/            │
│ fix_collaborators_*.sql│
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Paste in SQL Editor    │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Click "Run"            │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│  MIGRATION APPLIED     │
└────────────────────────┘
```

---

## RPC Method Fallback Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXECUTION METHOD PRIORITY                     │
└─────────────────────────────────────────────────────────────────┘

Priority 1: exec_sql RPC
         │
         ├── Available? ────────► ✅ Execute ────► Success
         │
         └── Not available
                 │
                 ▼
         Priority 2: sql RPC
                 │
                 ├── Available? ────────► ✅ Execute ────► Success
                 │
                 └── Not available
                         │
                         ▼
                 Priority 3: Direct Execution
                         │
                         ├── Works? ────────► ✅ Execute ────► Success
                         │
                         └── Fails
                                 │
                                 ▼
                         Priority 4: Manual Instructions
                                 │
                                 └────────────────► 📋 Display SQL
```

---

## File Read Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     MIGRATION FILE PROCESSING                    │
└─────────────────────────────────────────────────────────────────┘

/migrations/fix_collaborators_infinite_recursion.sql
         │
         ▼
┌────────────────────────┐
│ Read file content      │
│ fs.readFileSync()      │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Parse SQL:             │
│ - Remove comments (--) │
│ - Trim whitespace      │
│ - Validate non-empty   │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Clean SQL ready for    │
│ execution:             │
│                        │
│ DROP POLICY ...        │
│ CREATE POLICY ...      │
│ COMMENT ...            │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Pass to execution      │
│ method                 │
└────────────────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING                              │
└─────────────────────────────────────────────────────────────────┘

Error Detected
         │
         ▼
┌────────────────────────┐
│ What type of error?    │
└────────────────────────┘
         │
         ├─── Missing .env ──────────► Helpful message + .env.example
         │
         ├─── RPC not found ─────────► Setup instructions + SQL
         │
         ├─── Permission denied ─────► Check service role key
         │
         ├─── File not found ────────► Verify path + available files
         │
         └─── SQL syntax error ──────► Show error + migration preview
                                                │
                                                ▼
                                        ┌───────────────┐
                                        │ Fallback to   │
                                        │ manual method │
                                        └───────────────┘
```

---

## Success Verification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    VERIFICATION PROCESS                          │
└─────────────────────────────────────────────────────────────────┘

Migration Executed
         │
         ▼
┌────────────────────────┐
│ Query pg_policies:     │
│ Check if policy exists │
└────────────────────────┘
         │
         ├─── Found ──────────► ✅ Policy updated
         │
         └─── Not found ──────► ⚠️  Manual verification needed
                 │
                 ▼
┌────────────────────────┐
│ Test query:            │
│ SELECT * FROM          │
│ project_files          │
└────────────────────────┘
         │
         ├─── Success ─────────► ✅ No infinite recursion
         │
         └─── Error 42P17 ────► ❌ Migration failed
                 │
                 ▼
         Retry or manual execution
```

---

## Complete System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   COMPLETE MIGRATION SYSTEM                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐
│    USER     │
└──────┬──────┘
       │
       │ Chooses execution method
       │
       ├──────────────────────┬───────────────────┬──────────────┐
       │                      │                   │              │
       ▼                      ▼                   ▼              ▼
┌──────────────┐      ┌──────────────┐   ┌──────────────┐  ┌─────────┐
│   SCRIPT 1   │      │   SCRIPT 2   │   │     API      │  │ MANUAL  │
│setup-and-run │      │run-migration │   │  Endpoint    │  │ Supabase│
└──────┬───────┘      └──────┬───────┘   └──────┬───────┘  └────┬────┘
       │                     │                   │               │
       │                     │                   │               │
       └─────────────────────┴───────────────────┴───────────────┘
                                    │
                                    ▼
                        ┌────────────────────┐
                        │ Migration SQL File │
                        │ fix_collaborators  │
                        │ _infinite_         │
                        │ recursion.sql      │
                        └─────────┬──────────┘
                                  │
                                  ▼
                        ┌────────────────────┐
                        │  Supabase Client   │
                        │  (Service Role)    │
                        └─────────┬──────────┘
                                  │
                         ┌────────┴────────┐
                         │                 │
                         ▼                 ▼
                  ┌─────────────┐   ┌─────────────┐
                  │   RPC Call  │   │   Manual    │
                  │  exec_sql   │   │  Execution  │
                  └──────┬──────┘   └──────┬──────┘
                         │                 │
                         └────────┬────────┘
                                  │
                                  ▼
                        ┌────────────────────┐
                        │   PostgreSQL DB    │
                        │                    │
                        │ ✅ Policy updated  │
                        │ ✅ Recursion fixed │
                        └────────────────────┘
```

---

## Key Decision Points

```
START
  │
  ▼
Is RPC function available?
  │
  ├─── YES ──────► Use automated execution (fastest)
  │
  └─── NO ───────► Is this first time?
                    │
                    ├─── YES ──────► Run setup-and-run-migration.mjs
                    │                 (provides setup SQL)
                    │
                    └─── NO ───────► Use manual execution
                                      (dashboard SQL editor)
```

---

## Recommended Path

```
RECOMMENDED: Always start here
         │
         ▼
┌────────────────────────────────────────┐
│ node scripts/setup-and-run-migration.mjs│
└────────────────────────────────────────┘
         │
         ├─── Automated execution works ──────► ✅ Done
         │
         └─── Automation fails
                  │
                  └──────► Script provides:
                           - Migration SQL (copy-paste ready)
                           - Setup SQL (for future automation)
                           - Step-by-step instructions
                           - Verification queries
                                  │
                                  └──────► User executes manually
                                                │
                                                └──────► ✅ Done
```

This approach **always succeeds** because it gracefully degrades from automation to guided manual execution.
