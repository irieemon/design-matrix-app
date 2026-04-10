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
    } catch (err) {
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
    } catch (err) {
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
      <div className="min-h-screen flex items-center justify-center bg-canvas-primary">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full animate-spin mx-auto mb-4 border-2 border-solid border-info-500 border-t-transparent"></div>
          <p className="text-graphite-600">Loading FAQ...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-canvas-primary">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <HelpCircle className="w-12 h-12 text-sapphire-600" />
          </div>
          <h1 className="text-4xl font-bold mb-4 text-graphite-900">
            Help & Support
          </h1>
          <p className="text-lg text-graphite-600">
            Find answers to common questions and learn how to get the most out of Prioritas
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-graphite-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search FAQs..."
              className={`w-full pl-12 pr-4 py-4 rounded-lg border-2 transition-all bg-canvas-secondary text-graphite-900 ${searchQuery ? 'border-sapphire-300' : 'border-graphite-200'}`}
            />
          </div>
          {searchResults.length > 0 && (
            <p className="text-sm mt-2 text-graphite-600">
              Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 rounded-lg border bg-ruby-50 border-ruby-300 text-ruby-900">
            {error}
          </div>
        )}

        {/* Search Results */}
        {searchQuery && searchResults.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-graphite-900">
              Search Results
            </h2>
            <div className="space-y-3">
              {searchResults.map(item => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all bg-canvas-secondary ${expandedItems.has(item.id) ? 'border-sapphire-300' : 'border-graphite-200'}`}
                  onClick={() => toggleItem(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium flex-1 text-graphite-900">
                      {item.question}
                    </h3>
                    {expandedItems.has(item.id) ? (
                      <ChevronDown className="w-5 h-5 flex-shrink-0 text-graphite-600" />
                    ) : (
                      <ChevronRight className="w-5 h-5 flex-shrink-0 text-graphite-600" />
                    )}
                  </div>
                  {expandedItems.has(item.id) && (
                    <p className="mt-3 text-sm leading-relaxed text-graphite-700">
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
                className="border rounded-lg overflow-hidden bg-canvas-secondary border-graphite-200"
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full p-4 flex items-center justify-between transition-all hover:bg-opacity-80 bg-graphite-50"
                >
                  <div className="text-left">
                    <h2 className="text-xl font-bold text-graphite-900">
                      {category.name}
                    </h2>
                    {category.description && (
                      <p className="text-sm mt-1 text-graphite-600">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm px-3 py-1 rounded-full bg-sapphire-100 text-sapphire-900">
                      {category.items.length} FAQ{category.items.length !== 1 ? 's' : ''}
                    </span>
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown className="w-5 h-5 text-graphite-600" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-graphite-600" />
                    )}
                  </div>
                </button>

                {/* Category Items */}
                {expandedCategories.has(category.id) && category.items.length > 0 && (
                  <div className="p-4 space-y-3">
                    {category.items.map(item => (
                      <div
                        key={item.id}
                        className={`border rounded-lg overflow-hidden cursor-pointer transition-all ${expandedItems.has(item.id) ? 'border-sapphire-300' : 'border-graphite-200'}`}
                        onClick={() => toggleItem(item.id)}
                      >
                        <div className={`p-4 flex items-start justify-between gap-3 ${expandedItems.has(item.id) ? 'bg-sapphire-50' : 'bg-canvas-primary'}`}>
                          <h3 className="font-medium flex-1 text-graphite-900">
                            {item.question}
                          </h3>
                          {expandedItems.has(item.id) ? (
                            <ChevronDown className="w-5 h-5 flex-shrink-0 text-sapphire-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 flex-shrink-0 text-graphite-600" />
                          )}
                        </div>
                        {expandedItems.has(item.id) && (
                          <div className="px-4 pb-4">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-graphite-700">
                              {item.answer}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {expandedCategories.has(category.id) && category.items.length === 0 && (
                  <div className="p-8 text-center bg-canvas-primary">
                    <p className="text-graphite-500">
                      No FAQs in this category yet.
                    </p>
                  </div>
                )}
              </div>
            ))}

            {categories.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg border-graphite-300">
                <HelpCircle className="w-16 h-16 mx-auto mb-4 text-graphite-400" />
                <p className="text-lg mb-2 text-graphite-700">
                  No FAQs available yet
                </p>
                <p className="text-sm text-graphite-500">
                  Check back soon for helpful resources
                </p>
              </div>
            )}
          </div>
        )}

        {/* Still need help */}
        <div className="mt-12 p-6 rounded-lg text-center bg-sapphire-50 border-sapphire-200">
          <h3 className="text-lg font-bold mb-2 text-graphite-900">
            Still need help?
          </h3>
          <p className="mb-4 text-graphite-600">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <a
            href="mailto:support@prioritas.app"
            className="inline-block px-6 py-3 rounded-lg font-semibold transition-all bg-sapphire-600 text-white"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}
