/**
 * MatrixQuadrants - Static quadrant labels and styling
 */

import React from 'react'
import type { MatrixDimensions } from '../../lib/matrix/coordinates'
import { Z_INDEX } from '../../lib/matrix/zIndex'

interface MatrixQuadrantsProps {
  dimensions: MatrixDimensions
}

export const MatrixQuadrants: React.FC<MatrixQuadrantsProps> = ({ /* dimensions */ }) => {
  return (
    <div className="matrix-quadrants" style={{ zIndex: Z_INDEX.QUADRANT_LABELS }}>
      {/* Quick Wins - Top Left */}
      <div className="absolute top-8 left-8 spatial-object--quickwin px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-white rounded-full shadow-sm"></div>
          <span
            style={{
              color: 'var(--brand-primary)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)'
            }}
          >
            Quick Wins
          </span>
        </div>
        <div
          style={{
            color: 'var(--brand-secondary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)'
          }}
        >
          High Impact • Low Complexity
        </div>
      </div>

      {/* Strategic - Top Right */}
      <div className="absolute top-8 right-8 spatial-object--strategic px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-white rounded-full shadow-sm"></div>
          <span
            style={{
              color: 'var(--brand-primary)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)'
            }}
          >
            Strategic Investments
          </span>
        </div>
        <div
          style={{
            color: 'var(--brand-secondary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)'
          }}
        >
          High Impact • High Complexity
        </div>
      </div>

      {/* Reconsider - Bottom Left */}
      <div
        className="absolute bottom-24 left-8 spatial-object px-6 py-4"
        style={{
          background: 'linear-gradient(135deg, var(--reconsider-primary), var(--reconsider-accent))',
          color: 'var(--brand-primary)'
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-white rounded-full shadow-sm"></div>
          <span
            style={{
              color: 'var(--brand-primary)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)'
            }}
          >
            Reconsider
          </span>
        </div>
        <div
          style={{
            color: 'var(--brand-secondary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)'
          }}
        >
          Low Impact • Low Complexity
        </div>
      </div>

      {/* Avoid - Bottom Right */}
      <div
        className="absolute bottom-24 right-8 spatial-object px-6 py-4"
        style={{
          background: 'linear-gradient(135deg, var(--avoid-primary), var(--avoid-accent))',
          color: 'var(--brand-primary)'
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-white rounded-full shadow-sm"></div>
          <span
            style={{
              color: 'var(--brand-primary)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)'
            }}
          >
            Avoid
          </span>
        </div>
        <div
          style={{
            color: 'var(--brand-secondary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)'
          }}
        >
          Low Impact • High Complexity
        </div>
      </div>
    </div>
  )
}

export default React.memo(MatrixQuadrants)