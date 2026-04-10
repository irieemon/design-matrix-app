-- Add indexes for foreign keys to optimize query performance
-- Resolves Supabase linter warnings about unindexed foreign keys
-- Foreign keys without indexes cause full table scans during joins and integrity checks

-- Index 1: ai_token_usage.project_id
-- Used for: Queries joining token usage to projects, deleting projects with token data
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_project_id
ON ai_token_usage(project_id);

-- Index 2: project_collaborators.invited_by
-- Used for: Finding who invited collaborators, user deletion cascades
CREATE INDEX IF NOT EXISTS idx_project_collaborators_invited_by
ON project_collaborators(invited_by);

-- Index 3: projects.team_id
-- Used for: Finding all projects in a team, team deletion cascades
CREATE INDEX IF NOT EXISTS idx_projects_team_id
ON projects(team_id);

-- Index 4: teams.owner_id
-- Used for: Finding teams owned by a user, user deletion cascades
CREATE INDEX IF NOT EXISTS idx_teams_owner_id
ON teams(owner_id);

-- Verify indexes were created
DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_ai_token_usage_project_id',
      'idx_project_collaborators_invited_by',
      'idx_projects_team_id',
      'idx_teams_owner_id'
    );

  IF idx_count = 4 THEN
    RAISE NOTICE 'Successfully created % foreign key indexes', idx_count;
    RAISE NOTICE 'Query performance optimized for foreign key lookups';
  ELSE
    RAISE WARNING 'Expected 4 indexes but found %', idx_count;
  END IF;
END $$;
