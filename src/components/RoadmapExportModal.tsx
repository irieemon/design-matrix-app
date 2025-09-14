import React, { useState, useRef } from 'react'
import { X, Download, FileText, Image, Calendar, Users, BarChart3 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { RoadmapExporter } from '../utils/roadmapExport'
import OverviewExportView from './exports/OverviewExportView'
import TrackExportView from './exports/TrackExportView'

interface RoadmapFeature {
  id: string
  title: string
  description?: string
  startMonth: number
  duration: number
  team: string
  priority: 'high' | 'medium' | 'low'
  status: 'planned' | 'in-progress' | 'completed'
  userStories?: string[]
  deliverables?: string[]
  relatedIdeas?: string[]
  risks?: string[]
  successCriteria?: string[]
  complexity?: string
}

interface RoadmapExportModalProps {
  isOpen: boolean
  onClose: () => void
  features: RoadmapFeature[]
  title: string
  subtitle?: string
  startDate?: Date
  projectType?: string
}

type ExportMode = 'overview' | 'detailed' | 'track'
type ExportFormat = 'pdf' | 'png'

const RoadmapExportModal: React.FC<RoadmapExportModalProps> = ({
  isOpen,
  onClose,
  features,
  title,
  subtitle,
  startDate = new Date(),
  projectType = 'software'
}) => {
  const [exportMode, setExportMode] = useState<ExportMode>('overview')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  const teams = [...new Set(features.map(f => f.team))].sort()

  if (!isOpen) return null

  const handleExport = async () => {
    if (!exportRef.current) return

    setIsExporting(true)
    
    try {
      // Create the export view based on mode
      let exportElement: HTMLElement | null = null
      
      if (exportMode === 'overview') {
        // Create overview export element
        const container = document.createElement('div')
        container.style.position = 'absolute'
        container.style.left = '-9999px'
        container.style.top = '0'
        document.body.appendChild(container)
        
        // Use React to render the export view
        const { createRoot } = await import('react-dom/client')
        const root = createRoot(container)
        
        await new Promise<void>((resolve) => {
          root.render(
            <OverviewExportView
              features={features}
              title={title}
              subtitle={subtitle}
              startDate={startDate}
              projectType={projectType}
            />
          )
          // Wait for render
          setTimeout(resolve, 500)
        })
        
        exportElement = container.firstElementChild as HTMLElement
        
        if (exportElement) {
          await RoadmapExporter.exportOverview(exportElement, title, exportFormat)
        }
        
        // Cleanup
        root.unmount()
        document.body.removeChild(container)
        
      } else if (exportMode === 'track' && selectedTeam) {
        // Create track export element
        const container = document.createElement('div')
        container.style.position = 'absolute'
        container.style.left = '-9999px'
        container.style.top = '0'
        document.body.appendChild(container)
        
        const { createRoot } = await import('react-dom/client')
        const root = createRoot(container)
        
        await new Promise<void>((resolve) => {
          root.render(
            <TrackExportView
              features={features}
              teamName={selectedTeam}
              title={title}
              subtitle={subtitle}
              startDate={startDate}
              projectType={projectType}
            />
          )
          setTimeout(resolve, 500)
        })
        
        exportElement = container.firstElementChild as HTMLElement
        
        if (exportElement) {
          await RoadmapExporter.exportTrack(exportElement, selectedTeam, title, exportFormat)
        }
        
        root.unmount()
        document.body.removeChild(container)
        
      } else if (exportMode === 'detailed') {
        // For detailed mode, capture the current roadmap view
        const roadmapElement = document.querySelector('[data-roadmap-export]') as HTMLElement
        if (roadmapElement) {
          await RoadmapExporter.exportDetailed(roadmapElement, title, exportFormat)
        }
      }
      
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const exportModes = [
    {
      id: 'overview' as ExportMode,
      name: 'Overview',
      description: 'High-level timeline with team distribution and progress metrics',
      icon: BarChart3,
      recommended: true
    },
    {
      id: 'detailed' as ExportMode,
      name: 'Detailed Timeline',
      description: 'Current roadmap view with full timeline details',
      icon: Calendar,
      recommended: false
    },
    {
      id: 'track' as ExportMode,
      name: 'Team Track',
      description: 'Focused view on a specific team with detailed feature cards',
      icon: Users,
      recommended: false
    }
  ]

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">Export Roadmap</h2>
              <p className="text-blue-100">Choose your export format and options</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Export Mode Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Mode</h3>
            <div className="grid grid-cols-1 gap-3">
              {exportModes.map((mode) => (
                <div
                  key={mode.id}
                  onClick={() => setExportMode(mode.id)}
                  className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                    exportMode === mode.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start">
                    <mode.icon className={`w-5 h-5 mt-1 mr-3 ${
                      exportMode === mode.id ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h4 className={`font-medium ${
                          exportMode === mode.id ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {mode.name}
                        </h4>
                        {mode.recommended && (
                          <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${
                        exportMode === mode.id ? 'text-blue-700' : 'text-gray-600'
                      }`}>
                        {mode.description}
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 mt-1 ${
                      exportMode === mode.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {exportMode === mode.id && (
                        <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team Selection for Track Mode */}
          {exportMode === 'track' && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Team</h3>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a team...</option>
                {teams.map(team => (
                  <option key={team} value={team}>
                    {team} ({features.filter(f => f.team === team).length} features)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Format Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Format</h3>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setExportFormat('pdf')}
                className={`border rounded-lg p-4 cursor-pointer text-center transition-all ${
                  exportFormat === 'pdf'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <FileText className={`w-8 h-8 mx-auto mb-2 ${
                  exportFormat === 'pdf' ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <h4 className={`font-medium ${
                  exportFormat === 'pdf' ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  PDF
                </h4>
                <p className={`text-sm mt-1 ${
                  exportFormat === 'pdf' ? 'text-blue-700' : 'text-gray-600'
                }`}>
                  Best for sharing and printing
                </p>
              </div>
              
              <div
                onClick={() => setExportFormat('png')}
                className={`border rounded-lg p-4 cursor-pointer text-center transition-all ${
                  exportFormat === 'png'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Image className={`w-8 h-8 mx-auto mb-2 ${
                  exportFormat === 'png' ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <h4 className={`font-medium ${
                  exportFormat === 'png' ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  PNG
                </h4>
                <p className={`text-sm mt-1 ${
                  exportFormat === 'png' ? 'text-blue-700' : 'text-gray-600'
                }`}>
                  High-quality image
                </p>
              </div>
            </div>
          </div>

          {/* Export Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-gray-900 mb-2">Export Summary</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div>• <strong>Mode:</strong> {exportModes.find(m => m.id === exportMode)?.name}</div>
              <div>• <strong>Format:</strong> {exportFormat.toUpperCase()}</div>
              <div>• <strong>Features:</strong> {
                exportMode === 'track' && selectedTeam 
                  ? features.filter(f => f.team === selectedTeam).length
                  : features.length
              }</div>
              {exportMode === 'track' && selectedTeam && (
                <div>• <strong>Team:</strong> {selectedTeam}</div>
              )}
              <div>• <strong>Orientation:</strong> Landscape</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || (exportMode === 'track' && !selectedTeam)}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export {exportFormat.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden export container */}
      <div ref={exportRef} style={{ position: 'absolute', left: '-9999px', top: '0' }} />
    </div>,
    document.body
  )
}

export default RoadmapExportModal