-- Add updated_at column to project_roadmaps table
-- This fixes the error: record "new" has no field "updated_at"
-- which occurs because the update_project_roadmaps_updated_at trigger expects this column

-- Check if column exists before adding (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'project_roadmaps'
    AND column_name = 'updated_at'
  ) THEN
    -- Add updated_at column with default value
    ALTER TABLE public.project_roadmaps
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

    -- Update existing rows to have created_at as initial updated_at
    UPDATE public.project_roadmaps
    SET updated_at = created_at
    WHERE updated_at IS NULL;

    -- Make column NOT NULL after setting initial values
    ALTER TABLE public.project_roadmaps
    ALTER COLUMN updated_at SET NOT NULL;

    RAISE NOTICE 'Added updated_at column to project_roadmaps table';
  ELSE
    RAISE NOTICE 'updated_at column already exists in project_roadmaps table';
  END IF;
END $$;

-- Ensure the trigger exists (it should already exist from fix_function_search_paths.sql)
-- This is defensive programming to make sure the trigger is present
DROP TRIGGER IF EXISTS update_project_roadmaps_updated_at ON public.project_roadmaps;
CREATE TRIGGER update_project_roadmaps_updated_at
  BEFORE UPDATE ON public.project_roadmaps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment explaining the column
COMMENT ON COLUMN public.project_roadmaps.updated_at IS 'Automatically updated timestamp when row is modified';
