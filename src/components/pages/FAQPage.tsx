import { useState, useEffect } from 'react'
import { Search, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react'
import { faqService } from '../../lib/services/faqService'
import type { FAQCategoryWithItems, FAQItem } from '../../types/faq'
import { logger } from '../../utils/logger'

export default function FAQPage() {
  const [categories, setCategories] = useState<FAQCategoryWithItems[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FAQItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadFAQs()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch()
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  const loadFAQs = async () => {
    try {
      setLoading(true)
      const data = await faqService.getCategoriesWithItems(true) // Only published
      setCategories(data)
      // Auto-expand all categories for easy browsing
      const allCategoryIds = new Set(data.map(c => c.id))
      setExpandedCategories(allCategoryIds)
      setError(null)
    } catch (_err) {
      logger.error('Failed to load FAQs:', err)
      setError('Failed to load FAQ content. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const performSearch = async () => {
    try {
      const results = await faqService.searchFAQs(searchQuery)
      setSearchResults(results)
    } catch (_err) {
      logger.error('Failed to search FAQs:', err)
      // Silent fail for search, don't show error to user
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

  const toggleItem = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--canvas-primary)' }}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4" style={{
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: 'var(--sapphire-500)',
            borderTopColor: 'transparent'
          }}></div>
          <p style={{ color: 'var(--graphite-600)' }}>Loading FAQ...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: 'var(--canvas-primary)' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <HelpCircle className="w-12 h-12" style={{ color: 'var(--sapphire-600)' }} />
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--graphite-900)' }}>
            Help & Support
          </h1>
          <p className="text-lg" style={{ color: 'var(--graphite-600)' }}>
            Find answers to common questions and learn how to get the most out of Prioritas
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--graphite-400)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search FAQs..."
              className="w-full pl-12 pr-4 py-4 rounded-lg border-2 transition-all"
              style={{
                backgroundColor: 'var(--canvas-secondary)',
                borderColor: searchQuery ? 'var(--sapphire-300)' : 'var(--graphite-200)',
                color: 'var(--graphite-900)'
              }}
            />
          </div>
          {searchResults.length > 0 && (
            <p className="text-sm mt-2" style={{ color: 'var(--graphite-600)' }}>
              Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 rounded-lg border" style={{
            backgroundColor: 'var(--ruby-50)',
            borderColor: 'var(--ruby-300)',
            color: 'var(--ruby-900)'
          }}>
            {error}
          </div>
        )}

        {/* Search Results */}
        {searchQuery && searchResults.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--graphite-900)' }}>
              Search Results
            </h2>
            <div className="space-y-3">
              {searchResults.map(item => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border cursor-pointer transition-all"
                  style={{
                    backgroundColor: 'var(--canvas-secondary)',
                    borderColor: expandedItems.has(item.id) ? 'var(--sapphire-300)' : 'var(--graphite-200)'
                  }}
                  onClick={() => toggleItem(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium flex-1" style={{ color: 'var(--graphite-900)' }}>
                      {item.question}
                    </h3>
                    {expandedItems.has(item.id) ? (
                      <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--graphite-600)' }} />
                    ) : (
                      <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--graphite-600)' }} />
                    )}
                  </div>
                  {expandedItems.has(item.id) && (
                    <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--graphite-700)' }}>
                      {item.answer}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories and FAQs */}
        {!searchQuery && (
          <div className="space-y-6">
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
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full p-4 flex items-center justify-between transition-all hover:bg-opacity-80"
                  style={{ backgroundColor: 'var(--graphite-50)' }}
                >
                  <div className="text-left">
                    <h2 className="text-xl font-bold" style={{ color: 'var(--graphite-900)' }}>
                      {category.name}
                    </h2>
                    {category.description && (
                      <p className="text-sm mt-1" style={{ color: 'var(--graphite-600)' }}>
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm px-3 py-1 rounded-full" style={{
                      backgroundColor: 'var(--sapphire-100)',
                      color: 'var(--sapphire-900)'
                    }}>
                      {category.items.length} FAQ{category.items.length !== 1 ? 's' : ''}
                    </span>
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown className="w-5 h-5" style={{ color: 'var(--graphite-600)' }} />
                    ) : (
                      <ChevronRight className="w-5 h-5" style={{ color: 'var(--graphite-600)' }} />
                    )}
                  </div>
                </button>

                {/* Category Items */}
                {expandedCategories.has(category.id) && category.items.length > 0 && (
                  <div className="p-4 space-y-3">
                    {category.items.map(item => (
                      <div
                        key={item.id}
                        className="border rounded-lg overflow-hidden cursor-pointer transition-all"
                        style={{
                          borderColor: expandedItems.has(item.id) ? 'var(--sapphire-300)' : 'var(--graphite-200)'
                        }}
                        onClick={() => toggleItem(item.id)}
                      >
                        <div className="p-4 flex items-start justify-between gap-3" style={{
                          backgroundColor: expandedItems.has(item.id) ? 'var(--sapphire-50)' : 'var(--canvas-primary)'
                        }}>
                          <h3 className="font-medium flex-1" style={{ color: 'var(--graphite-900)' }}>
                            {item.question}
                          </h3>
                          {expandedItems.has(item.id) ? (
                            <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--sapphire-600)' }} />
                          ) : (
                            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--graphite-600)' }} />
                          )}
                        </div>
                        {expandedItems.has(item.id) && (
                          <div className="px-4 pb-4">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--graphite-700)' }}>
                              {item.answer}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {expandedCategories.has(category.id) && category.items.length === 0 && (
                  <div className="p-8 text-center" style={{ backgroundColor: 'var(--canvas-primary)' }}>
                    <p style={{ color: 'var(--graphite-500)' }}>
                      No FAQs in this category yet.
                    </p>
                  </div>
                )}
              </div>
            ))}

            {categories.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg" style={{
                borderColor: 'var(--graphite-300)'
              }}>
                <HelpCircle className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--graphite-400)' }} />
                <p className="text-lg mb-2" style={{ color: 'var(--graphite-700)' }}>
                  No FAQs available yet
                </p>
                <p className="text-sm" style={{ color: 'var(--graphite-500)' }}>
                  Check back soon for helpful resources
                </p>
              </div>
            )}
          </div>
        )}

        {/* Still need help */}
        <div className="mt-12 p-6 rounded-lg text-center" style={{
          backgroundColor: 'var(--sapphire-50)',
          borderColor: 'var(--sapphire-200)'
        }}>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--graphite-900)' }}>
            Still need help?
          </h3>
          <p className="mb-4" style={{ color: 'var(--graphite-600)' }}>
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <a
            href="mailto:support@prioritas.app"
            className="inline-block px-6 py-3 rounded-lg font-semibold transition-all"
            style={{
              backgroundColor: 'var(--sapphire-600)',
              color: 'white'
            }}
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}
