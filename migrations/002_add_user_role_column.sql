-- Migration: Add role column to user_profiles
-- Date: 2025-10-02
-- Description: Simple migration to add role column for admin functionality

-- Add role column to user_profiles table
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'super_admin'));

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role
  ON user_profiles(role)
  WHERE role IN ('admin', 'super_admin');

-- Update existing users to have default role
UPDATE user_profiles
SET role = 'user'
WHERE role IS NULL;

-- Verify the column was added
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name = 'role';
