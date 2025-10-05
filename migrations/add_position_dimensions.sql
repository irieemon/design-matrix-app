-- Migration: Add Position Dimensions to Ideas Table
-- Date: 2025-10-03
-- Purpose: Fix card position desynchronization bug when toggling collapsed/expanded states
--
-- Background:
-- Cards use translate(-50%, -50%) for centering, which depends on card dimensions.
-- When dimensions change (collapsed 100x50 ↔ expanded 130x90), visual position shifts.
-- This migration adds dimension context to position data to maintain visual stability.
--
-- Related Documentation:
-- - claudedocs/CARD_POSITION_DESYNC_FIX_DESIGN.md
-- - claudedocs/CARD_POSITION_DESYNC_VISUAL_EXPLANATION.md
-- - claudedocs/CARD_POSITION_FIX_IMPLEMENTATION_SUMMARY.md

-- ==============================================================================
-- MIGRATION: ADD position_dimensions COLUMN
-- ==============================================================================

BEGIN;

-- Add position_dimensions column to store card dimensions at time of position update
ALTER TABLE ideas
ADD COLUMN IF NOT EXISTS position_dimensions JSONB DEFAULT NULL;

-- Add documentation comment
COMMENT ON COLUMN ideas.position_dimensions IS
'Stores card dimensions at time of position update. Format: {"width": number, "height": number, "was_collapsed": boolean}. Used to maintain visual position when card display state changes between collapsed and expanded.';

-- Create GIN index for efficient JSONB queries (optional, for future queries)
CREATE INDEX IF NOT EXISTS idx_ideas_position_dimensions
ON ideas USING GIN (position_dimensions);

-- Validate the schema change
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ideas'
    AND column_name = 'position_dimensions'
  ) THEN
    RAISE EXCEPTION 'Migration failed: position_dimensions column not added';
  END IF;

  RAISE NOTICE 'Migration successful: position_dimensions column added to ideas table';
END $$;

COMMIT;

-- ==============================================================================
-- OPTIONAL: BACKFILL EXISTING DATA
-- ==============================================================================

-- Uncomment this section to backfill position_dimensions for existing ideas
-- This is OPTIONAL - the application handles NULL dimensions gracefully

/*
BEGIN;

-- Backfill position_dimensions for ideas that don't have it yet
-- Assumes current is_collapsed state reflects the state when positioned
UPDATE ideas
SET position_dimensions = jsonb_build_object(
  'width', CASE WHEN is_collapsed THEN 100 ELSE 130 END,
  'height', CASE WHEN is_collapsed THEN 50 ELSE 90 END,
  'was_collapsed', is_collapsed
)
WHERE position_dimensions IS NULL
  AND x IS NOT NULL  -- Only update positioned cards
  AND y IS NOT NULL;

-- Log backfill results
DO $$
DECLARE
  backfilled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backfilled_count
  FROM ideas
  WHERE position_dimensions IS NOT NULL;

  RAISE NOTICE 'Backfill complete: % ideas now have position_dimensions', backfilled_count;
END $$;

COMMIT;
*/

-- ==============================================================================
-- ROLLBACK SCRIPT (Run if migration needs to be reverted)
-- ==============================================================================

/*
BEGIN;

-- Drop index
DROP INDEX IF EXISTS idx_ideas_position_dimensions;

-- Remove column
ALTER TABLE ideas DROP COLUMN IF EXISTS position_dimensions;

-- Verify rollback
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ideas'
    AND column_name = 'position_dimensions'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: position_dimensions column still exists';
  END IF;

  RAISE NOTICE 'Rollback successful: position_dimensions column removed';
END $$;

COMMIT;
*/

-- ==============================================================================
-- VALIDATION QUERIES
-- ==============================================================================

-- Check if migration was successful
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ideas'
    AND column_name = 'position_dimensions'
  ) as migration_successful;

-- Count ideas with position_dimensions
SELECT
  COUNT(*) FILTER (WHERE position_dimensions IS NOT NULL) as with_dimensions,
  COUNT(*) FILTER (WHERE position_dimensions IS NULL) as without_dimensions,
  COUNT(*) as total_ideas
FROM ideas;

-- Sample position_dimensions data
SELECT
  id,
  content,
  x, y,
  is_collapsed,
  position_dimensions
FROM ideas
WHERE position_dimensions IS NOT NULL
LIMIT 5;

-- ==============================================================================
-- EXPECTED BEHAVIOR AFTER MIGRATION
-- ==============================================================================

/*
1. New cards dragged after migration:
   - Will have position_dimensions automatically set during drag
   - Format: {"width": 100, "height": 50, "was_collapsed": true}

2. Existing cards (position_dimensions = NULL):
   - Application will use fallback logic based on current is_collapsed state
   - Will get position_dimensions on next drag operation

3. Cards toggled after migration:
   - position_dimensions will be updated to match new state
   - Visual position will remain stable

4. Application logic:
   - Read: position_dimensions || infer from is_collapsed
   - Update: Always set position_dimensions during drag/toggle
   - Render: Adjust coordinates based on dimension delta
*/

-- ==============================================================================
-- TESTING CHECKLIST
-- ==============================================================================

/*
After running this migration:

□ Verify column exists:
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'ideas' AND column_name = 'position_dimensions';

□ Test INSERT with position_dimensions:
  INSERT INTO ideas (content, x, y, is_collapsed, position_dimensions)
  VALUES ('Test', 200, 150, true, '{"width": 100, "height": 50, "was_collapsed": true}');

□ Test UPDATE with position_dimensions:
  UPDATE ideas
  SET position_dimensions = '{"width": 130, "height": 90, "was_collapsed": false}'
  WHERE content = 'Test';

□ Verify index exists:
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'ideas' AND indexname = 'idx_ideas_position_dimensions';

□ Check for NULL handling:
  SELECT COUNT(*) FROM ideas WHERE position_dimensions IS NULL;
*/
