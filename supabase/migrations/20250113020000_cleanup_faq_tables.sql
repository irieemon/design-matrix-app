-- Cleanup script for FAQ tables
-- Run this FIRST if you get "already exists" errors

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view published categories" ON faq_categories;
DROP POLICY IF EXISTS "Public can view published FAQ items" ON faq_items;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON faq_categories;
DROP POLICY IF EXISTS "Authenticated users can manage FAQ items" ON faq_items;
DROP POLICY IF EXISTS "Admin user can manage categories" ON faq_categories;
DROP POLICY IF EXISTS "Admin user can manage FAQ items" ON faq_items;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_faq_categories_updated_at ON faq_categories;
DROP TRIGGER IF EXISTS update_faq_items_updated_at ON faq_items;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_faq_categories_published;
DROP INDEX IF EXISTS idx_faq_items_category;
DROP INDEX IF EXISTS idx_faq_items_published;
DROP INDEX IF EXISTS idx_faq_items_search;

-- Drop existing tables (CASCADE will remove foreign key constraints)
DROP TABLE IF EXISTS faq_items CASCADE;
DROP TABLE IF EXISTS faq_categories CASCADE;

-- Drop the trigger function if it exists
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Confirmation message
SELECT 'Cleanup completed - you can now run the main FAQ migration' as status;
