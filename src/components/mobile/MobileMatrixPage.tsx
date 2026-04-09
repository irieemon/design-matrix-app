import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { IdeaCard } from '../../types'
import {
  calculateQuadrant,
  QUADRANT_COLORS,
  QUADRANT_LABELS,
  type Quadrant,
} from '../../utils/matrixQuadrant'

interface MobileMatrixPageProps {
  ideas: IdeaCard[]
  onEditIdea?: (idea: IdeaCard) => void
}

const QUADRANT_ORDER: Quadrant[] = ['quick-wins', 'strategic', 'reconsider', 'avoid']

export const MobileMatrixPage: React.FC<MobileMatrixPageProps> = ({ ideas, onEditIdea }) => {
  const grouped = useMemo(() => {
    const acc: Record<Quadrant, IdeaCard[]> = {
      'quick-wins': [],
      strategic: [],
      reconsider: [],
      avoid: [],
    }
    for (const idea of ideas) {
      acc[calculateQuadrant(idea.x, idea.y)].push(idea)
    }
    return acc
  }, [ideas])

  const [open, setOpen] = useState<Record<Quadrant, boolean>>({
    'quick-wins': true,
    strategic: true,
    reconsider: false,
    avoid: false,
  })

  if (ideas.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-neutral-500">
        <p className="text-sm">No ideas yet.</p>
        <p className="text-xs mt-1">Tap the + button below to capture one.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {QUADRANT_ORDER.map((q) => {
        const list = grouped[q]
        const isOpen = open[q]
        return (
          <section key={q} className="rounded-lg border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [q]: !s[q] }))}
              className="w-full flex items-center justify-between px-4 py-3 min-h-11"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: QUADRANT_COLORS[q] }}
                />
                <span className="font-medium text-neutral-900">{QUADRANT_LABELS[q]}</span>
                <span className="text-xs text-neutral-500">({list.length})</span>
              </div>
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-neutral-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              )}
            </button>

            {isOpen && list.length > 0 && (
              <ul className="border-t border-neutral-100 divide-y divide-neutral-100">
                {list.map((idea) => (
                  <li key={idea.id}>
                    <button
                      type="button"
                      onClick={() => onEditIdea?.(idea)}
                      className="w-full text-left px-4 py-3 min-h-14 hover:bg-neutral-50 active:bg-neutral-100"
                    >
                      <div className="text-sm font-medium text-neutral-900 line-clamp-2">
                        {idea.content}
                      </div>
                      {idea.details && (
                        <div className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                          {idea.details}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {isOpen && list.length === 0 && (
              <div className="px-4 py-3 text-xs text-neutral-400 border-t border-neutral-100">
                None
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default MobileMatrixPage
