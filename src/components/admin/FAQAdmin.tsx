import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Save, X } from 'lucide-react'
import { faqService } from '../../lib/services/faqService'
import type { FAQCategory, FAQItem, FAQCategoryWithItems } from '../../types/faq'
import { logger } from '../../utils/logger'

export default function FAQAdmin() {
  const [categories, setCategories] = useState<FAQCategoryWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Edit states
  const [editingCategory, setEditingCategory] = useState<FAQCategory | null>(null)
  const [editingItem, setEditingItem] = useState<FAQItem | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [creatingItem, setCreatingItem] = useState<string | null>(null) // category ID

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await faqService.getCategoriesWithItems(false) // Load all, including unpublished
      setCategories(data)
      setError(null)
    } catch (_err) {
      logger.error('Failed to load FAQ categories:', err)
      setError('Failed to load FAQ data')
    } finally {
      setLoading(false)
    }
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const handleSaveCategory = async (category: Partial<FAQCategory>) => {
    try {
      if (editingCategory) {
        await faqService.updateCategory(editingCategory.id, category)
      } else {
        await faqService.createCategory({
          ...category,
          display_order: categories.length
        })
      }
      await loadCategories()
      setEditingCategory(null)
      setCreatingCategory(false)
    } catch (_err) {
      logger.error('Failed to save category:', err)
      setError('Failed to save category')
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Delete this category and all its FAQ items?')) return

    try {
      await faqService.deleteCategory(categoryId)
      await loadCategories()
    } catch (_err) {
      logger.error('Failed to delete category:', err)
      setError('Failed to delete category')
    }
  }

  const handleSaveItem = async (item: Partial<FAQItem>) => {
    try {
      if (editingItem) {
        await faqService.updateItem(editingItem.id, item)
      } else if (creatingItem) {
        const category = categories.find(c => c.id === creatingItem)
        await faqService.createItem({
          ...item,
          category_id: creatingItem,
          display_order: category?.items.length || 0
        })
      }
      await loadCategories()
      setEditingItem(null)
      setCreatingItem(null)
    } catch (_err) {
      logger.error('Failed to save FAQ item:', err)
      setError('Failed to save FAQ item')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Delete this FAQ item?')) return

    try {
      await faqService.deleteItem(itemId)
      await loadCategories()
    } catch (_err) {
      logger.error('Failed to delete FAQ item:', err)
      setError('Failed to delete FAQ item')
    }
  }

  const handleTogglePublish = async (
    type: 'category' | 'item',
    id: string,
    currentStatus: boolean
  ) => {
    try {
      if (type === 'category') {
        await faqService.updateCategory(id, { is_published: !currentStatus })
      } else {
        await faqService.updateItem(id, { is_published: !currentStatus })
      }
      await loadCategories()
    } catch (_err) {
      logger.error('Failed to toggle publish status:', err)
      setError('Failed to update publish status')
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4" style={{
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: 'var(--sapphire-500)',
          borderTopColor: 'transparent'
        }}></div>
        <p style={{ color: 'var(--graphite-600)' }}>Loading FAQ manager...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--graphite-900)' }}>
            FAQ & Support Manager
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--graphite-600)' }}>
            Manage support categories and FAQ items
          </p>
        </div>
        <button
          onClick={() => setCreatingCategory(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
          style={{
            backgroundColor: 'var(--sapphire-600)',
            color: 'white'
          }}
        >
          <Plus className="w-4 h-4" />
          New Category
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg border" style={{
          backgroundColor: 'var(--ruby-50)',
          borderColor: 'var(--ruby-300)',
          color: 'var(--ruby-900)'
        }}>
          {error}
        </div>
      )}

      {/* Create Category Form */}
      {creatingCategory && (
        <CategoryForm
          onSave={handleSaveCategory}
          onCancel={() => setCreatingCategory(false)}
        />
      )}

      {/* Categories List */}
      <div className="space-y-4">
        {categories.map(category => (
          <div
            key={category.id}
            className="border rounded-lg overflow-hidden"
            style={{
              backgroundColor: 'var(--canvas-secondary)',
              borderColor: 'var(--graphite-200)'
            }}
          >
            {/* Category Header */}
            {editingCategory?.id === category.id ? (
              <CategoryForm
                category={editingCategory}
                onSave={handleSaveCategory}
                onCancel={() => setEditingCategory(null)}
              />
            ) : (
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="p-1 rounded hover:bg-opacity-80 transition-all"
                      style={{ backgroundColor: 'var(--graphite-100)' }}
                    >
                      {expandedCategories.has(category.id) ? (
                        <ChevronDown className="w-4 h-4" style={{ color: 'var(--graphite-700)' }} />
                      ) : (
                        <ChevronRight className="w-4 h-4" style={{ color: 'var(--graphite-700)' }} />
                      )}
                    </button>
                    <div className="flex-1">
                      <h3 className="font-semibold" style={{ color: 'var(--graphite-900)' }}>
                        {category.name}
                        {!category.is_published && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{
                            backgroundColor: 'var(--amber-100)',
                            color: 'var(--amber-900)'
                          }}>
                            Draft
                          </span>
                        )}
                      </h3>
                      {category.description && (
                        <p className="text-sm mt-0.5" style={{ color: 'var(--graphite-600)' }}>
                          {category.description}
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'var(--graphite-500)' }}>
                        {category.items.length} FAQ{category.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePublish('category', category.id, category.is_published)}
                      className="px-3 py-1 text-xs rounded transition-all"
                      style={{
                        backgroundColor: category.is_published ? 'var(--emerald-100)' : 'var(--graphite-100)',
                        color: category.is_published ? 'var(--emerald-900)' : 'var(--graphite-700)'
                      }}
                    >
                      {category.is_published ? 'Published' : 'Publish'}
                    </button>
                    <button
                      onClick={() => setEditingCategory(category)}
                      className="p-2 rounded hover:bg-opacity-80 transition-all"
                      style={{ backgroundColor: 'var(--graphite-100)' }}
                    >
                      <Edit2 className="w-4 h-4" style={{ color: 'var(--graphite-700)' }} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-2 rounded hover:bg-opacity-80 transition-all"
                      style={{ backgroundColor: 'var(--ruby-100)' }}
                    >
                      <Trash2 className="w-4 h-4" style={{ color: 'var(--ruby-700)' }} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Category Items */}
            {expandedCategories.has(category.id) && (
              <div className="border-t" style={{ borderColor: 'var(--graphite-200)' }}>
                <div className="p-4" style={{ backgroundColor: 'var(--canvas-primary)' }}>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-sm" style={{ color: 'var(--graphite-700)' }}>
                      FAQ Items
                    </h4>
                    <button
                      onClick={() => setCreatingItem(category.id)}
                      className="flex items-center gap-1 px-3 py-1 text-sm rounded transition-all"
                      style={{
                        backgroundColor: 'var(--sapphire-100)',
                        color: 'var(--sapphire-900)'
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      Add FAQ
                    </button>
                  </div>

                  {/* Create Item Form */}
                  {creatingItem === category.id && (
                    <div className="mb-3">
                      <ItemForm
                        onSave={handleSaveItem}
                        onCancel={() => setCreatingItem(null)}
                      />
                    </div>
                  )}

                  {/* Items List */}
                  <div className="space-y-2">
                    {category.items.map(item => (
                      <div key={item.id}>
                        {editingItem?.id === item.id ? (
                          <ItemForm
                            item={editingItem}
                            onSave={handleSaveItem}
                            onCancel={() => setEditingItem(null)}
                          />
                        ) : (
                          <div className="p-3 rounded-lg border" style={{
                            backgroundColor: 'var(--canvas-secondary)',
                            borderColor: 'var(--graphite-200)'
                          }}>
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                <h5 className="font-medium text-sm" style={{ color: 'var(--graphite-900)' }}>
                                  Q: {item.question}
                                  {!item.is_published && (
                                    <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{
                                      backgroundColor: 'var(--amber-100)',
                                      color: 'var(--amber-900)'
                                    }}>
                                      Draft
                                    </span>
                                  )}
                                </h5>
                                <p className="text-sm mt-1" style={{ color: 'var(--graphite-600)' }}>
                                  A: {item.answer}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleTogglePublish('item', item.id, item.is_published)}
                                  className="px-2 py-1 text-xs rounded transition-all"
                                  style={{
                                    backgroundColor: item.is_published ? 'var(--emerald-100)' : 'var(--graphite-100)',
                                    color: item.is_published ? 'var(--emerald-900)' : 'var(--graphite-700)'
                                  }}
                                >
                                  {item.is_published ? 'Published' : 'Publish'}
                                </button>
                                <button
                                  onClick={() => setEditingItem(item)}
                                  className="p-1.5 rounded hover:bg-opacity-80 transition-all"
                                  style={{ backgroundColor: 'var(--graphite-100)' }}
                                >
                                  <Edit2 className="w-3 h-3" style={{ color: 'var(--graphite-700)' }} />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1.5 rounded hover:bg-opacity-80 transition-all"
                                  style={{ backgroundColor: 'var(--ruby-100)' }}
                                >
                                  <Trash2 className="w-3 h-3" style={{ color: 'var(--ruby-700)' }} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {category.items.length === 0 && !creatingItem && (
                      <p className="text-sm text-center py-4" style={{ color: 'var(--graphite-500)' }}>
                        No FAQ items yet. Click "Add FAQ" to create one.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {categories.length === 0 && !creatingCategory && (
          <div className="text-center py-12 border-2 border-dashed rounded-lg" style={{
            borderColor: 'var(--graphite-300)'
          }}>
            <p className="text-lg mb-2" style={{ color: 'var(--graphite-700)' }}>
              No categories yet
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--graphite-500)' }}>
              Create your first FAQ category to get started
            </p>
            <button
              onClick={() => setCreatingCategory(true)}
              className="px-4 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: 'var(--sapphire-600)',
                color: 'white'
              }}
            >
              Create Category
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Category Form Component
function CategoryForm({
  category,
  onSave,
  onCancel
}: {
  category?: FAQCategory
  onSave: (category: Partial<FAQCategory>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(category?.name || '')
  const [slug, setSlug] = useState(category?.slug || '')
  const [description, setDescription] = useState(category?.description || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ name, slug, description })
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded-lg" style={{
      backgroundColor: 'var(--sapphire-50)',
      borderColor: 'var(--sapphire-200)'
    }}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--graphite-900)' }}>
            Category Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!category) {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
              }
            }}
            required
            className="w-full px-3 py-2 rounded border"
            style={{
              backgroundColor: 'var(--canvas-secondary)',
              borderColor: 'var(--graphite-300)',
              color: 'var(--graphite-900)'
            }}
            placeholder="e.g., Getting Started"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--graphite-900)' }}>
            Slug * <span className="text-xs font-normal" style={{ color: 'var(--graphite-600)' }}>(URL-friendly)</span>
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            className="w-full px-3 py-2 rounded border"
            style={{
              backgroundColor: 'var(--canvas-secondary)',
              borderColor: 'var(--graphite-300)',
              color: 'var(--graphite-900)'
            }}
            placeholder="e.g., getting-started"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--graphite-900)' }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded border"
            style={{
              backgroundColor: 'var(--canvas-secondary)',
              borderColor: 'var(--graphite-300)',
              color: 'var(--graphite-900)'
            }}
            placeholder="Brief description of this category"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded transition-all flex items-center gap-1"
            style={{
              backgroundColor: 'var(--graphite-100)',
              color: 'var(--graphite-700)'
            }}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded transition-all flex items-center gap-1"
            style={{
              backgroundColor: 'var(--sapphire-600)',
              color: 'white'
            }}
          >
            <Save className="w-4 h-4" />
            Save Category
          </button>
        </div>
      </div>
    </form>
  )
}

// Item Form Component
function ItemForm({
  item,
  onSave,
  onCancel
}: {
  item?: FAQItem
  onSave: (item: Partial<FAQItem>) => void
  onCancel: () => void
}) {
  const [question, setQuestion] = useState(item?.question || '')
  const [answer, setAnswer] = useState(item?.answer || '')
  const [slug, setSlug] = useState(item?.slug || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ question, answer, slug })
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 border rounded-lg" style={{
      backgroundColor: 'var(--emerald-50)',
      borderColor: 'var(--emerald-200)'
    }}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--graphite-900)' }}>
            Question *
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value)
              if (!item) {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50))
              }
            }}
            required
            className="w-full px-3 py-2 rounded border"
            style={{
              backgroundColor: 'var(--canvas-secondary)',
              borderColor: 'var(--graphite-300)',
              color: 'var(--graphite-900)'
            }}
            placeholder="e.g., How do I reset my password?"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--graphite-900)' }}>
            Answer *
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
            rows={4}
            className="w-full px-3 py-2 rounded border"
            style={{
              backgroundColor: 'var(--canvas-secondary)',
              borderColor: 'var(--graphite-300)',
              color: 'var(--graphite-900)'
            }}
            placeholder="Provide a clear, helpful answer..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--graphite-900)' }}>
            Slug * <span className="text-xs font-normal" style={{ color: 'var(--graphite-600)' }}>(URL-friendly)</span>
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            className="w-full px-3 py-2 rounded border"
            style={{
              backgroundColor: 'var(--canvas-secondary)',
              borderColor: 'var(--graphite-300)',
              color: 'var(--graphite-900)'
            }}
            placeholder="e.g., reset-password"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded transition-all flex items-center gap-1"
            style={{
              backgroundColor: 'var(--graphite-100)',
              color: 'var(--graphite-700)'
            }}
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-sm rounded transition-all flex items-center gap-1"
            style={{
              backgroundColor: 'var(--emerald-700)',
              color: 'white'
            }}
          >
            <Save className="w-3 h-3" />
            Save FAQ
          </button>
        </div>
      </div>
    </form>
  )
}
