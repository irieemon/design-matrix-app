/**
 * MatrixGrid - Background grid and depth field
 */

import React from 'react'
import type { MatrixDimensions } from '../../lib/matrix/coordinates'
import { Z_INDEX } from '../../lib/matrix/zIndex'

interface MatrixGridProps {
  dimensions: MatrixDimensions
}

export const MatrixGrid: React.FC<MatrixGridProps> = ({ /* dimensions */ }) => {
  return (
    <div
      className="absolute inset-0 matrix-grid-background matrix-depth-field"
      style={{ zIndex: Z_INDEX.MATRIX_GRID }}
    />
  )
}

export default React.memo(MatrixGrid)