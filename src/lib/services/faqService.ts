/**
 * FAQ Service
 * Handles CRUD operations for FAQ categories and items
 */

import { supabase, createAuthenticatedClientFromLocalStorage } from '../supabase'
import type { FAQCategory, FAQItem, FAQCategoryWithItems } from '../../types/faq'
import { logger } from '../../utils/logger'

export class FAQService {
  /**
   * Get appropriate Supabase client based on environment
   */
  private getClient() {
    const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined'
    return isBrowser ? createAuthenticatedClientFromLocalStorage() : supabase
  }

  // ===== CATEGORIES =====

  /**
   * Get all categories with their FAQ items
   */
  async getCategoriesWithItems(publishedOnly = true): Promise<FAQCategoryWithItems[]> {
    try {
      const client = this.getClient()

      let categoryQuery = client
        .from('faq_categories')
        .select('*')
        .order('display_order', { ascending: true })

      if (publishedOnly) {
        categoryQuery = categoryQuery.eq('is_published', true)
      }

      const { data: categories, error: categoryError } = await categoryQuery

      if (categoryError) throw categoryError

      // Fetch items for each category
      const categoriesWithItems: FAQCategoryWithItems[] = []

      for (const category of categories || []) {
        let itemQuery = client
          .from('faq_items')
          .select('*')
          .eq('category_id', category.id)
          .order('display_order', { ascending: true })

        if (publishedOnly) {
          itemQuery = itemQuery.eq('is_published', true)
        }

        const { data: items, error: itemError } = await itemQuery

        if (itemError) throw itemError

        categoriesWithItems.push({
          ...category,
          items: items || []
        })
      }

      return categoriesWithItems
    } catch (_error) {
      logger.error('Failed to get categories with items:', error)
      throw error
    }
  }

  /**
   * Get all categories (without items)
   */
  async getCategories(publishedOnly = true): Promise<FAQCategory[]> {
    try {
      const client = this.getClient()

      let query = client
        .from('faq_categories')
        .select('*')
        .order('display_order', { ascending: true })

      if (publishedOnly) {
        query = query.eq('is_published', true)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (_error) {
      logger.error('Failed to get categories:', error)
      throw error
    }
  }

  /**
   * Create a new category
   */
  async createCategory(category: Partial<FAQCategory>): Promise<FAQCategory> {
    try {
      const client = this.getClient()

      const { data, error } = await client
        .from('faq_categories')
        .insert(category)
        .select()
        .single()

      if (error) throw error

      logger.info('Created FAQ category:', data.name)
      return data
    } catch (_error) {
      logger.error('Failed to create category:', error)
      throw error
    }
  }

  /**
   * Update a category
   */
  async updateCategory(id: string, updates: Partial<FAQCategory>): Promise<FAQCategory> {
    try {
      const client = this.getClient()

      const { data, error } = await client
        .from('faq_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      logger.info('Updated FAQ category:', id)
      return data
    } catch (_error) {
      logger.error('Failed to update category:', error)
      throw error
    }
  }

  /**
   * Delete a category (and all its items due to CASCADE)
   */
  async deleteCategory(id: string): Promise<void> {
    try {
      const client = this.getClient()

      const { error } = await client
        .from('faq_categories')
        .delete()
        .eq('id', id)

      if (error) throw error

      logger.info('Deleted FAQ category:', id)
    } catch (_error) {
      logger.error('Failed to delete category:', error)
      throw error
    }
  }

  // ===== FAQ ITEMS =====

  /**
   * Get FAQ items by category
   */
  async getItemsByCategory(categoryId: string, publishedOnly = true): Promise<FAQItem[]> {
    try {
      const client = this.getClient()

      let query = client
        .from('faq_items')
        .select('*')
        .eq('category_id', categoryId)
        .order('display_order', { ascending: true })

      if (publishedOnly) {
        query = query.eq('is_published', true)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (_error) {
      logger.error('Failed to get FAQ items:', error)
      throw error
    }
  }

  /**
   * Search FAQ items (full-text search on questions and answers)
   */
  async searchFAQs(searchQuery: string): Promise<FAQItem[]> {
    try {
      const client = this.getClient()

      const { data, error } = await client
        .from('faq_items')
        .select('*')
        .eq('is_published', true)
        .textSearch('question', searchQuery, {
          type: 'websearch',
          config: 'english'
        })

      if (error) throw error
      return data || []
    } catch (_error) {
      logger.error('Failed to search FAQs:', error)
      throw error
    }
  }

  /**
   * Create a new FAQ item
   */
  async createItem(item: Partial<FAQItem>): Promise<FAQItem> {
    try {
      const client = this.getClient()

      const { data, error } = await client
        .from('faq_items')
        .insert(item)
        .select()
        .single()

      if (error) throw error

      logger.info('Created FAQ item:', data.question)
      return data
    } catch (_error) {
      logger.error('Failed to create FAQ item:', error)
      throw error
    }
  }

  /**
   * Update a FAQ item
   */
  async updateItem(id: string, updates: Partial<FAQItem>): Promise<FAQItem> {
    try {
      const client = this.getClient()

      const { data, error } = await client
        .from('faq_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      logger.info('Updated FAQ item:', id)
      return data
    } catch (_error) {
      logger.error('Failed to update FAQ item:', error)
      throw error
    }
  }

  /**
   * Delete a FAQ item
   */
  async deleteItem(id: string): Promise<void> {
    try {
      const client = this.getClient()

      const { error } = await client
        .from('faq_items')
        .delete()
        .eq('id', id)

      if (error) throw error

      logger.info('Deleted FAQ item:', id)
    } catch (_error) {
      logger.error('Failed to delete FAQ item:', error)
      throw error
    }
  }
}

// Export singleton instance
export const faqService = new FAQService()
