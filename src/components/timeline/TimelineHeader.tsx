import React from 'react'
import { Grid3X3, Map, Plus, Database } from 'lucide-react'

interface TimelineHeaderProps {
  title: string
  subtitle: string
  viewMode?: 'timeline' | 'detailed'
  onViewModeChange?: (mode: 'timeline' | 'detailed') => void
  featuresCount: number
  onCreateFeature: () => void
  onLoadSampleData: () => void
  className?: string
}

const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  title,
  subtitle,
  viewMode,
  onViewModeChange,
  featuresCount,
  onCreateFeature,
  onLoadSampleData,
  className = "bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-5"
}) => {
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-wide">{title}</h2>
          <p className="text-slate-300 text-sm mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* View Mode Toggle */}
          {onViewModeChange && (
            <div className="flex space-x-1 bg-slate-700/50 rounded-lg p-1 border border-slate-600">
              <button
                onClick={() => onViewModeChange('timeline')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                <span>Timeline</span>
              </button>
              <button
                onClick={() => onViewModeChange('detailed')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'detailed'
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Map className="w-4 h-4" />
                <span>Detailed</span>
              </button>
            </div>
          )}

          <button
            onClick={onCreateFeature}
            className="flex items-center space-x-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 rounded-xl text-white transition-all shadow-sm hover:shadow-md text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Add Feature</span>
          </button>

          {featuresCount === 0 && (
            <button
              onClick={onLoadSampleData}
              className="flex items-center space-x-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-xl text-white transition-all shadow-sm hover:shadow-md text-sm font-medium"
            >
              <Database className="w-4 h-4" />
              <span>Load Sample Data</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default TimelineHeader