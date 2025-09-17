import React from 'react'
import { Map, Grid3X3, Download, History, Sparkles, Loader } from 'lucide-react'
import { Project, ProjectRoadmap as ProjectRoadmapType } from '../../types'
import { RoadmapData, RoadmapViewMode } from './types'

interface RoadmapHeaderProps {
  currentProject: Project | null
  roadmapData: RoadmapData | null
  isLoading: boolean
  viewMode: RoadmapViewMode['mode']
  showHistory: boolean
  roadmapHistory: ProjectRoadmapType[]
  selectedRoadmapId: string | null
  onGenerateRoadmap: () => void
  onToggleViewMode: (mode: RoadmapViewMode['mode']) => void
  onToggleHistory: () => void
  onHistorySelect: (roadmap: ProjectRoadmapType) => void
  onExportClick: () => void
}

const RoadmapHeader: React.FC<RoadmapHeaderProps> = ({
  currentProject,
  roadmapData,
  isLoading,
  viewMode,
  showHistory,
  roadmapHistory,
  selectedRoadmapId,
  onGenerateRoadmap,
  onToggleViewMode,
  onToggleHistory,
  onHistorySelect,
  onExportClick
}) => {
  if (!currentProject) {
    return (
      <div className="text-center py-12">
        <Map className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-700 mb-2">No Project Selected</h2>
        <p className="text-slate-500">Select a project to view or generate its roadmap</p>
      </div>
    )
  }

  return (
    <div className="mb-8">
      {/* Project Info & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {currentProject.name} Roadmap
          </h1>
          <p className="text-slate-600">
            Strategic execution plan for your {currentProject.project_type?.toLowerCase()} project
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Generate/Regenerate Button */}
          <button
            onClick={onGenerateRoadmap}
            disabled={isLoading}
            className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {isLoading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>{roadmapData ? 'Regenerate' : 'Generate'} Roadmap</span>
              </>
            )}
          </button>

          {/* Export Button */}
          {roadmapData && (
            <button
              onClick={onExportClick}
              className="flex items-center space-x-2 bg-slate-100 text-slate-700 px-4 py-3 rounded-xl hover:bg-slate-200 transition-colors"
              title="Export roadmap"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {/* History Button */}
          {roadmapHistory.length > 0 && (
            <button
              onClick={onToggleHistory}
              className={`flex items-center space-x-2 px-4 py-3 rounded-xl transition-colors ${
                showHistory
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title="View roadmap history"
            >
              <History className="w-5 h-5" />
              <span className="hidden sm:inline">History ({roadmapHistory.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* View Mode Toggle */}
      {roadmapData && (
        <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4">
          <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => onToggleViewMode('timeline')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              <span>Timeline View</span>
            </button>
            <button
              onClick={() => onToggleViewMode('detailed')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'detailed'
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Map className="w-4 h-4" />
              <span>Detailed View</span>
            </button>
          </div>

          {roadmapData.roadmapAnalysis && (
            <div className="text-sm text-slate-600">
              <span className="font-medium">Total Duration:</span> {roadmapData.roadmapAnalysis.totalDuration}
            </div>
          )}
        </div>
      )}

      {/* History Panel */}
      {showHistory && roadmapHistory.length > 0 && (
        <div className="mt-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-900 mb-3">Roadmap History</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {roadmapHistory.map((roadmap) => (
                <button
                  key={roadmap.id}
                  onClick={() => onHistorySelect(roadmap)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedRoadmapId === roadmap.id
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {new Date(roadmap.created_at).toLocaleDateString()} at{' '}
                      {new Date(roadmap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs text-slate-500">
                      {roadmap.ideas_analyzed} ideas
                    </span>
                  </div>
                  {roadmap.roadmap_data?.roadmapAnalysis?.totalDuration && (
                    <div className="text-xs text-slate-500 mt-1">
                      Duration: {roadmap.roadmap_data.roadmapAnalysis.totalDuration}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoadmapHeader