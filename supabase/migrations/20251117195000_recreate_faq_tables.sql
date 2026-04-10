-- ============================================================================
-- RECREATE FAQ TABLES WITH OPTIMIZED RLS
-- Date: 2025-01-17
-- ============================================================================
--
-- PURPOSE: Recreate FAQ system tables that were accidentally deleted
-- BACKGROUND: Migration 20250113020000 (cleanup) ran AFTER 20250113010000 (create)
--             and deleted the tables. This migration recreates them.
--
-- FEATURES:
--   - FAQ categories and items with full CMS capabilities
--   - Optimized RLS policies using (select auth.uid()) pattern
--   - Admin access via is_admin() function (not hardcoded user ID)
--   - Full-text search on questions and answers
--   - Seed data for initial FAQ content
--
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE TABLES
-- ============================================================================

-- Categories table (main sections like "Getting Started", "Billing", etc.)
CREATE TABLE IF NOT EXISTS faq_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAQ items table (individual questions and answers)
CREATE TABLE IF NOT EXISTS faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES faq_categories(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, slug)
);

-- ============================================================================
-- PART 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_faq_categories_published
  ON faq_categories(is_published, display_order);

CREATE INDEX IF NOT EXISTS idx_faq_items_category
  ON faq_items(category_id, display_order);

CREATE INDEX IF NOT EXISTS idx_faq_items_published
  ON faq_items(is_published);

-- Full-text search index on questions and answers
CREATE INDEX IF NOT EXISTS idx_faq_items_search
  ON faq_items USING gin(to_tsvector('english', question || ' ' || answer));

-- ============================================================================
-- PART 3: CREATE TRIGGERS
-- ============================================================================

-- Updated_at trigger function (reuse existing or create)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_faq_categories_updated_at ON faq_categories;
CREATE TRIGGER update_faq_categories_updated_at
  BEFORE UPDATE ON faq_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_faq_items_updated_at ON faq_items;
CREATE TRIGGER update_faq_items_updated_at
  BEFORE UPDATE ON faq_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 4: ENABLE RLS
-- ============================================================================

ALTER TABLE faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 5: CREATE OPTIMIZED RLS POLICIES
-- ============================================================================

-- Drop any existing policies
DROP POLICY IF EXISTS "Public can view published categories" ON faq_categories;
DROP POLICY IF EXISTS "Public can view published FAQ items" ON faq_items;
DROP POLICY IF EXISTS "Admin user can manage categories" ON faq_categories;
DROP POLICY IF EXISTS "Admin user can manage FAQ items" ON faq_items;
DROP POLICY IF EXISTS "Admins can manage categories" ON faq_categories;
DROP POLICY IF EXISTS "Admins can manage FAQ items" ON faq_items;

-- Public read access for published content
CREATE POLICY "Public can view published categories"
  ON faq_categories
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "Public can view published FAQ items"
  ON faq_items
  FOR SELECT
  USING (is_published = true);

-- Admin management (using is_admin() function, not hardcoded user ID)
CREATE POLICY "Admins can manage categories"
  ON faq_categories
  FOR ALL
  USING (is_admin());

CREATE POLICY "Admins can manage FAQ items"
  ON faq_items
  FOR ALL
  USING (is_admin());

-- ============================================================================
-- PART 6: SEED DATA
-- ============================================================================

-- Using ON CONFLICT to make the script idempotent
INSERT INTO faq_categories (name, slug, description, display_order) VALUES
  ('Getting Started', 'getting-started', 'Learn the basics of using Prioritas', 1),
  ('Billing & Subscriptions', 'billing', 'Questions about pricing and payments', 2),
  ('Features', 'features', 'Learn about Prioritas features', 3),
  ('Troubleshooting', 'troubleshooting', 'Common issues and solutions', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, slug, display_order) VALUES
  (
    (SELECT id FROM faq_categories WHERE slug = 'getting-started'),
    'How do I create my first project?',
    'Navigate to the Projects page and click the "Create Project" button. You can either create a blank project or use our AI starter to generate initial ideas based on your project description.',
    'create-first-project',
    1
  ),
  (
    (SELECT id FROM faq_categories WHERE slug = 'getting-started'),
    'What is the Design Matrix?',
    'The Design Matrix is our signature 2x2 prioritization framework that helps you organize ideas by Impact and Effort. This visual approach makes it easy to identify which ideas to tackle first.',
    'what-is-design-matrix',
    2
  ),
  (
    (SELECT id FROM faq_categories WHERE slug = 'billing'),
    'Can I upgrade or downgrade my plan anytime?',
    'Yes! You can upgrade or downgrade your plan at any time from the Settings page. Upgrades take effect immediately, and downgrades take effect at the end of your current billing period.',
    'change-plan',
    1
  ),
  (
    (SELECT id FROM faq_categories WHERE slug = 'billing'),
    'What payment methods do you accept?',
    'We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor, Stripe. We do not store your credit card information on our servers.',
    'payment-methods',
    2
  ),
  (
    (SELECT id FROM faq_categories WHERE slug = 'features'),
    'How does AI idea generation work?',
    'Our AI analyzes your project description and generates relevant ideas organized in the Design Matrix. Each idea includes a title, description, and suggested impact/effort positioning.',
    'ai-idea-generation',
    1
  ),
  (
    (SELECT id FROM faq_categories WHERE slug = 'troubleshooting'),
    'My project is not loading after refresh',
    'This is a known issue we recently fixed. Please clear your browser cache or use Ctrl+Shift+R (Cmd+Shift+R on Mac) to hard refresh the page. If the issue persists, please contact support.',
    'project-not-loading',
    1
  )
ON CONFLICT (category_id, slug) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify tables created
SELECT
  '✅ FAQ TABLES' as status,
  COUNT(*) FILTER (WHERE tablename = 'faq_categories') as categories_table,
  COUNT(*) FILTER (WHERE tablename = 'faq_items') as items_table
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('faq_categories', 'faq_items');

-- Verify policies
SELECT
  '✅ FAQ POLICIES' as status,
  tablename,
  COUNT(*) as policy_count,
  array_agg(policyname) as policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('faq_categories', 'faq_items')
GROUP BY tablename;

-- Verify seed data
SELECT
  '✅ FAQ SEED DATA' as status,
  (SELECT COUNT(*) FROM faq_categories) as categories_count,
  (SELECT COUNT(*) FROM faq_items) as items_count;

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================
--
-- ✅ Created faq_categories table with all indexes and triggers
-- ✅ Created faq_items table with full-text search capability
-- ✅ Applied optimized RLS policies (no hardcoded user IDs)
-- ✅ Seeded initial FAQ content (4 categories, 6 items)
--
-- 🔧 Improvements over original migration:
--    - Uses is_admin() function instead of hardcoded user UUID
--    - Consistent with other table RLS patterns
--    - Maintains all original functionality and seed data
--
-- ============================================================================
