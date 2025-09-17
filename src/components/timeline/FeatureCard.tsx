import React from 'react'
import { RoadmapFeature } from '../../hooks/timeline/useTimelineFeatures'

interface FeatureStyles {
  bgColor: string
  textColor: string
  borderColor: string
}

interface FeaturePosition {
  left: string
  width: string
}

interface FeatureCardProps {
  feature: RoadmapFeature
  styles: FeatureStyles
  position: FeaturePosition
  rowPosition: number
  isDragged: boolean
  isResizing: boolean
  onDragStart: (e: React.DragEvent, feature: RoadmapFeature) => void
  onFeatureClick: (feature: RoadmapFeature) => void
  onMouseDown: (e: React.MouseEvent, featureId: string, direction: 'left' | 'right') => void
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  feature,
  styles,
  position,
  rowPosition,
  isDragged,
  isResizing,
  onDragStart,
  onFeatureClick,
  onMouseDown
}) => {
  return (
    <div
      key={feature.id}
      draggable
      onDragStart={(e) => onDragStart(e, feature)}
      className={`group absolute h-8 rounded-lg border-2 ${styles.bgColor} ${styles.textColor} ${styles.borderColor} flex items-center shadow-sm hover:shadow-md transition-all cursor-move hover:scale-105 hover:z-10 ${
        isDragged ? 'opacity-50' : ''
      } ${isResizing ? 'ring-2 ring-blue-400 scale-105' : ''}`}
      style={{
        ...position,
        top: `${rowPosition * 36 + 16}px`
      }}
      title={`Drag to move, resize handles on hover: ${feature.title}`}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 w-2 h-full bg-transparent hover:bg-blue-400 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={(e) => onMouseDown(e, feature.id, 'left')}
        title="Drag to resize start date"
      />

      {/* Feature content */}
      <div
        className="flex-1 px-3 py-1 truncate"
        onClick={(e) => {
          e.stopPropagation()
          onFeatureClick(feature)
        }}
      >
        <span className="text-xs font-semibold">
          {feature.title}
        </span>
      </div>

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 w-2 h-full bg-transparent hover:bg-blue-400 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={(e) => onMouseDown(e, feature.id, 'right')}
        title="Drag to resize duration"
      />
    </div>
  )
}

export default FeatureCard