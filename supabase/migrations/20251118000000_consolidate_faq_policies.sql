-- Consolidate multiple permissive RLS policies for FAQ tables
-- This fixes performance warnings about multiple policies for same role+action

-- ===================================================================
-- FAQ_CATEGORIES: Consolidate SELECT policies
-- ===================================================================

-- Drop existing separate policies
DROP POLICY IF EXISTS "Admins can manage categories" ON public.faq_categories;
DROP POLICY IF EXISTS "Public can view published categories" ON public.faq_categories;

-- Create single consolidated SELECT policy
CREATE POLICY "faq_categories_select_policy" ON public.faq_categories
  FOR SELECT
  USING (
    -- Admin users can see everything
    (EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    ))
    OR
    -- All users can see published categories
    (is_published = true)
  );

-- Recreate admin-only policies for other operations (maintain existing security)
CREATE POLICY "faq_categories_insert_admin" ON public.faq_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "faq_categories_update_admin" ON public.faq_categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "faq_categories_delete_admin" ON public.faq_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ===================================================================
-- FAQ_ITEMS: Consolidate SELECT policies
-- ===================================================================

-- Drop existing separate policies
DROP POLICY IF EXISTS "Admins can manage FAQ items" ON public.faq_items;
DROP POLICY IF EXISTS "Public can view published FAQ items" ON public.faq_items;

-- Create single consolidated SELECT policy
CREATE POLICY "faq_items_select_policy" ON public.faq_items
  FOR SELECT
  USING (
    -- Admin users can see everything
    (EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    ))
    OR
    -- All users can see published items in published categories
    (is_published = true AND EXISTS (
      SELECT 1 FROM public.faq_categories
      WHERE faq_categories.id = faq_items.category_id
      AND faq_categories.is_published = true
    ))
  );

-- Recreate admin-only policies for other operations (maintain existing security)
CREATE POLICY "faq_items_insert_admin" ON public.faq_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "faq_items_update_admin" ON public.faq_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "faq_items_delete_admin" ON public.faq_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
