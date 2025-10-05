import React, { useState, useRef } from 'react'
import { X, Download, FileText, Image, Calendar, Users, BarChart3 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { RoadmapExporter } from '../utils/roadmapExport'
import OverviewExportView from './exports/OverviewExportView'
import TrackExportView from './exports/TrackExportView'
import DetailedExportView from './exports/DetailedExportView'
import { useToast } from '../contexts/ToastContext'
import { useLogger } from '../lib/logging'
import { Button } from './ui/Button'

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
  const logger = useLogger('RoadmapExportModal')
  const [exportMode, setExportMode] = useState<ExportMode>('overview')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const { showError, showWarning} = useToast()

  const teams = [...new Set(features.map(f => f.team))].sort()

  if (!isOpen) return null

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      // Check if we have any features to export
      logger.info('Starting export', {
        featureCount: features.length,
        projectType,
        exportMode,
        exportFormat
      })
      logger.debug('Export configuration', {
        features: features.map(f => ({ id: f.id, title: f.title, team: f.team })),
        firstFeature: features[0]
      })
      
      if (features.length === 0) {
        showWarning('No roadmap features found to export. Please click "Load Sample Data" first to populate the roadmap, then try exporting again.')
        return
      }

      // For all modes, use off-screen rendering for consistency and reliability
      logger.debug('Creating off-screen container for export')

      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.left = '-9999px'  // Hidden off-screen
      container.style.top = '0'
      container.style.width = '1400px'
      container.style.height = '1000px'
      container.style.backgroundColor = 'white'
      container.style.zIndex = '-1'
      container.style.overflow = 'hidden'
      document.body.appendChild(container)
      
      let exportComponent: React.ReactElement
      let exportMethodName = ''
      
      if (exportMode === 'overview') {
        exportComponent = (
          <OverviewExportView
            features={features}
            title={title}
            subtitle={subtitle}
            startDate={startDate}
            projectType={projectType}
          />
        )
        exportMethodName = 'exportOverview'
      } else if (exportMode === 'detailed') {
        exportComponent = (
          <DetailedExportView
            features={features}
            title={title}
            subtitle={subtitle}
            startDate={startDate}
            projectType={projectType}
          />
        )
        exportMethodName = 'exportDetailed'
      } else if (exportMode === 'track' && selectedTeam) {
        exportComponent = (
          <TrackExportView
            features={features}
            teamName={selectedTeam}
            title={title}
            subtitle={subtitle}
            startDate={startDate}
            projectType={projectType}
          />
        )
        exportMethodName = 'exportTrack'
      } else {
        throw new Error('Invalid export mode or missing team selection')
      }

      logger.debug('Rendering export component', {
        exportMode,
        exportMethodName
      })
      
      // Use React to render the export view
      const { createRoot } = await import('react-dom/client')
      const root = createRoot(container)
      
      // Render and wait for it to complete
      await new Promise<void>((resolve, reject) => {
        try {
          root.render(exportComponent)
          
          // Wait for styles to load and render
          setTimeout(() => {
            logger.debug('Checking rendered content', {
              childrenCount: container.children.length,
              innerHTMLLength: container.innerHTML.length
            })

            if (container.children.length > 0 && container.innerHTML.length > 100) {
              logger.debug('Content successfully rendered')
              resolve()
            } else {
              logger.error('Content not properly rendered', null, {
                childrenCount: container.children.length,
                innerHTMLLength: container.innerHTML.length
              })
              reject(new Error(`Content not rendered - children: ${container.children.length}, innerHTML: ${container.innerHTML.length}`))
            }
          }, 2000)  // Wait for rendering
        } catch (error) {
          logger.error('Error during render', error)
          reject(error)
        }
      })
      
      const exportElement = container.firstElementChild as HTMLElement
      
      if (!exportElement) {
        throw new Error('Export element not found')
      }

      logger.debug('Exporting rendered element', {
        exportMethod: exportMethodName,
        exportMode,
        exportFormat
      })
      
      // Export the rendered element using the appropriate method
      if (exportMode === 'overview') {
        await RoadmapExporter.exportOverview(exportElement, title, exportFormat)
      } else if (exportMode === 'detailed') {
        await RoadmapExporter.exportDetailed(exportElement, title, exportFormat)
      } else if (exportMode === 'track' && selectedTeam) {
        await RoadmapExporter.exportTrack(exportElement, selectedTeam, title, exportFormat)
      }
      
      // Cleanup
      logger.debug('Cleaning up export resources')
      root.unmount()
      document.body.removeChild(container)

    } catch (error) {
      logger.error('Export failed', error, {
        exportMode,
        exportFormat,
        featureCount: features.length,
        selectedTeam
      })
      showError(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`)
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
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'var(--scrim-overlay)' }}>
      <div className="rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--surface-primary)' }}>
        {/* Header */}
        <div className="p-6" style={{
          background: 'linear-gradient(to right, var(--graphite-700), var(--graphite-800))',
          color: 'var(--surface-primary)'
        }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">Export Roadmap</h2>
              <p style={{ color: 'var(--sapphire-100)' }}>Choose your export format and options</p>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="p-2 rounded-full transition-colors"
              style={{ color: 'var(--surface-primary)' }}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {/* Export Mode Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--graphite-900)' }}>Export Mode</h3>
            <div className="grid grid-cols-1 gap-3">
              {exportModes.map((mode) => (
                <div
                  key={mode.id}
                  onClick={() => setExportMode(mode.id)}
                  className="relative rounded-lg p-4 cursor-pointer transition-all"
                  style={exportMode === mode.id ? {
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--sapphire-500)',
                    backgroundColor: 'var(--sapphire-50)',
                    boxShadow: '0 0 0 3px var(--sapphire-100)'
                  } : {
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--hairline-default)'
                  }}
                  onMouseEnter={(e) => {
                    if (exportMode !== mode.id) {
                      e.currentTarget.style.borderColor = 'var(--hairline-hover)';
                      e.currentTarget.style.backgroundColor = 'var(--canvas-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (exportMode !== mode.id) {
                      e.currentTarget.style.borderColor = 'var(--hairline-default)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div className="flex items-start">
                    <mode.icon className="w-5 h-5 mt-1 mr-3" style={{
                      color: exportMode === mode.id ? 'var(--sapphire-600)' : 'var(--graphite-400)'
                    }} />
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h4 className="font-medium" style={{
                          color: exportMode === mode.id ? 'var(--sapphire-900)' : 'var(--graphite-900)'
                        }}>
                          {mode.name}
                        </h4>
                        {mode.recommended && (
                          <span className="ml-2 px-2 py-1 text-xs rounded-full" style={{
                            backgroundColor: 'var(--emerald-100)',
                            color: 'var(--emerald-700)'
                          }}>
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm mt-1" style={{
                        color: exportMode === mode.id ? 'var(--sapphire-700)' : 'var(--graphite-600)'
                      }}>
                        {mode.description}
                      </p>
                    </div>
                    <div className="w-4 h-4 rounded-full mt-1" style={{
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderColor: exportMode === mode.id ? 'var(--sapphire-500)' : 'var(--hairline-default)',
                      backgroundColor: exportMode === mode.id ? 'var(--sapphire-500)' : 'transparent'
                    }}>
                      {exportMode === mode.id && (
                        <div className="w-2 h-2 rounded-full m-auto mt-0.5" style={{ backgroundColor: 'var(--surface-primary)' }}></div>
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
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--graphite-900)' }}>Select Team</h3>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 rounded-lg"
                style={{
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--hairline-default)',
                  color: 'var(--graphite-900)'
                }}
                onFocus={(e) => {
                  e.target.style.boxShadow = '0 0 0 3px var(--sapphire-100)';
                  e.target.style.borderColor = 'var(--sapphire-500)';
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = 'none';
                  e.target.style.borderColor = 'var(--hairline-default)';
                }}
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
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--graphite-900)' }}>Export Format</h3>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setExportFormat('pdf')}
                className="rounded-lg p-4 cursor-pointer text-center transition-all"
                style={exportFormat === 'pdf' ? {
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--sapphire-500)',
                  backgroundColor: 'var(--sapphire-50)',
                  boxShadow: '0 0 0 3px var(--sapphire-100)'
                } : {
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--hairline-default)'
                }}
                onMouseEnter={(e) => {
                  if (exportFormat !== 'pdf') {
                    e.currentTarget.style.borderColor = 'var(--hairline-hover)';
                    e.currentTarget.style.backgroundColor = 'var(--canvas-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (exportFormat !== 'pdf') {
                    e.currentTarget.style.borderColor = 'var(--hairline-default)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <FileText className="w-8 h-8 mx-auto mb-2" style={{
                  color: exportFormat === 'pdf' ? 'var(--sapphire-600)' : 'var(--graphite-400)'
                }} />
                <h4 className="font-medium" style={{
                  color: exportFormat === 'pdf' ? 'var(--sapphire-900)' : 'var(--graphite-900)'
                }}>
                  PDF
                </h4>
                <p className="text-sm mt-1" style={{
                  color: exportFormat === 'pdf' ? 'var(--sapphire-700)' : 'var(--graphite-600)'
                }}>
                  Best for sharing and printing
                </p>
              </div>

              <div
                onClick={() => setExportFormat('png')}
                className="rounded-lg p-4 cursor-pointer text-center transition-all"
                style={exportFormat === 'png' ? {
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--sapphire-500)',
                  backgroundColor: 'var(--sapphire-50)',
                  boxShadow: '0 0 0 3px var(--sapphire-100)'
                } : {
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--hairline-default)'
                }}
                onMouseEnter={(e) => {
                  if (exportFormat !== 'png') {
                    e.currentTarget.style.borderColor = 'var(--hairline-hover)';
                    e.currentTarget.style.backgroundColor = 'var(--canvas-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (exportFormat !== 'png') {
                    e.currentTarget.style.borderColor = 'var(--hairline-default)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <Image className="w-8 h-8 mx-auto mb-2" style={{
                  color: exportFormat === 'png' ? 'var(--sapphire-600)' : 'var(--graphite-400)'
                }} />
                <h4 className="font-medium" style={{
                  color: exportFormat === 'png' ? 'var(--sapphire-900)' : 'var(--graphite-900)'
                }}>
                  PNG
                </h4>
                <p className="text-sm mt-1" style={{
                  color: exportFormat === 'png' ? 'var(--sapphire-700)' : 'var(--graphite-600)'
                }}>
                  High-quality image
                </p>
              </div>
            </div>
          </div>

          {/* Export Summary */}
          <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'var(--canvas-secondary)' }}>
            <h4 className="font-medium mb-2" style={{ color: 'var(--graphite-900)' }}>Export Summary</h4>
            <div className="space-y-1 text-sm" style={{ color: 'var(--graphite-600)' }}>
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

            {features.length === 0 && (
              <div className="mt-3 p-3 rounded-lg" style={{
                backgroundColor: 'var(--amber-50)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--amber-200)'
              }}>
                <div className="flex items-center space-x-2">
                  <span style={{ color: 'var(--amber-600)' }}>⚠️</span>
                  <p className="text-sm" style={{ color: 'var(--amber-800)' }}>
                    <strong>No features found.</strong> Please add roadmap features before exporting.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4" style={{
          backgroundColor: 'var(--canvas-secondary)',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderTopColor: 'var(--hairline-default)'
        }}>
          <div className="flex items-center justify-between">
            <Button
              onClick={onClose}
              variant="secondary"
              size="md"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || (exportMode === 'track' && !selectedTeam) || features.length === 0}
              variant="sapphire"
              size="md"
              state={isExporting ? 'loading' : 'idle'}
              icon={!isExporting ? <Download className="w-4 h-4" /> : undefined}
            >
              {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
            </Button>
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