/**
 * FAQ System Types
 */

export interface FAQCategory {
  id: string
  name: string
  slug: string
  description: string | null
  display_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface FAQItem {
  id: string
  category_id: string
  question: string
  answer: string
  slug: string
  display_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface FAQItemWithCategory extends FAQItem {
  category: FAQCategory
}

export interface FAQCategoryWithItems extends FAQCategory {
  items: FAQItem[]
}
