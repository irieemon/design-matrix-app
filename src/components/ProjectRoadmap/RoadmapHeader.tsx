import React, { useState, useEffect, useRef } from 'react'
import { Map, Download, History, Sparkles, Loader, ChevronDown } from 'lucide-react'
import { Project, ProjectRoadmap as ProjectRoadmapType } from '../../types'
import { RoadmapData } from './types'
import { Button } from '../ui/Button'

interface RoadmapHeaderProps {
  currentProject: Project | null
  roadmapData: RoadmapData | null
  isLoading: boolean
  roadmapHistory: ProjectRoadmapType[]
  selectedRoadmapId: string | null
  onGenerateRoadmap: () => void
  onHistorySelect: (roadmap: ProjectRoadmapType) => void
  onExportClick: () => void
}

const RoadmapHeader: React.FC<RoadmapHeaderProps> = ({
  currentProject,
  roadmapData,
  isLoading,
  roadmapHistory,
  selectedRoadmapId,
  onGenerateRoadmap,
  onHistorySelect,
  onExportClick
}) => {
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsHistoryDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
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
    <div className="mb-4">
      {/* Project Info & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {currentProject.name} Roadmap
          </h1>
          <p className="text-slate-600">
            Strategic execution plan for your {currentProject.project_type?.toLowerCase()} project
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Generate/Regenerate Button */}
          <Button
            onClick={onGenerateRoadmap}
            disabled={isLoading}
            variant="sapphire"
            size="lg"
            state={isLoading ? 'loading' : 'idle'}
            icon={isLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          >
            {isLoading ? 'Generating...' : `${roadmapData ? 'Regenerate' : 'Generate'} Roadmap`}
          </Button>

          {/* Export Button */}
          {roadmapData && (
            <Button
              onClick={onExportClick}
              variant="secondary"
              size="lg"
              icon={<Download className="w-5 h-5" />}
              title="Export roadmap"
            >
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}

          {/* History Dropdown */}
          {roadmapHistory.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsHistoryDropdownOpen(!isHistoryDropdownOpen)}
                className="flex items-center space-x-2 bg-slate-100 text-slate-700 px-4 py-3 rounded-xl hover:bg-slate-200 transition-colors"
                title="View roadmap history"
              >
                <History className="w-5 h-5" />
                <span className="hidden sm:inline">History ({roadmapHistory.length})</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isHistoryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isHistoryDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg border border-slate-200 shadow-lg z-50">
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-slate-900 mb-3">Roadmap History</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {roadmapHistory.map((roadmap) => (
                        <button
                          key={roadmap.id}
                          onClick={() => {
                            onHistorySelect(roadmap)
                            setIsHistoryDropdownOpen(false)
                          }}
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
          )}
        </div>
      </div>


    </div>
  )
}

export default RoadmapHeader