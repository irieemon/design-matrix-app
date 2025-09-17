import React from 'react'
import { ArrowRight, Lightbulb, AlertTriangle, CheckCircle } from 'lucide-react'
import { Phase } from './types'
import EpicCard from './EpicCard'

interface PhaseListProps {
  phases: Phase[]
  expandedPhases: Set<number>
  onTogglePhaseExpansion: (phaseIndex: number) => void
}

const PhaseList: React.FC<PhaseListProps> = ({
  phases,
  expandedPhases,
  onTogglePhaseExpansion
}) => {
  return (
    <div className="space-y-6">
      {phases.map((phase, phaseIndex) => (
        <div key={phaseIndex} className="relative" data-testid={`phase-${phaseIndex}`}>
          {/* Phase Timeline Line */}
          {phaseIndex < phases.length - 1 && (
            <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-slate-200"></div>
          )}

          {/* Phase Header */}
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              {phaseIndex + 1}
            </div>

            <div className="flex-1">
              <div
                className="cursor-pointer hover:bg-slate-50 rounded-lg p-3 -m-3 transition-colors"
                onClick={() => onTogglePhaseExpansion(phaseIndex)}
                data-testid={`phase-header-${phaseIndex}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-slate-900">{phase.phase}</h3>
                  <div className="flex items-center space-x-3">
                    <span
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                      data-testid={`phase-duration-${phaseIndex}`}
                    >
                      {phase.duration}
                    </span>
                    <ArrowRight
                      className={`w-5 h-5 text-slate-400 transition-transform ${
                        expandedPhases.has(phaseIndex) ? 'rotate-90' : ''
                      }`}
                      data-testid={`phase-arrow-${phaseIndex}`}
                    />
                  </div>
                </div>
                <p className="text-slate-600 mb-2">{phase.description}</p>
                <p className="text-xs text-slate-400 flex items-center space-x-1">
                  <span>Click to {expandedPhases.has(phaseIndex) ? 'collapse' : 'expand'} details</span>
                  <ArrowRight className={`w-3 h-3 transition-transform ${expandedPhases.has(phaseIndex) ? 'rotate-90' : ''}`} />
                </p>
              </div>

              {/* Expanded Phase Content */}
              {expandedPhases.has(phaseIndex) && (
                <div className="space-y-6 pl-4 border-l-2 border-slate-100" data-testid={`phase-content-${phaseIndex}`}>
                  {/* Epics */}
                  <div>
                    <h4 className="font-medium text-slate-900 mb-3 flex items-center space-x-2">
                      <Lightbulb className="w-4 h-4" />
                      <span data-testid={`epics-count-${phaseIndex}`}>Epics ({phase.epics?.length || 0})</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(phase.epics || []).map((epic, epicIndex) => (
                        <EpicCard
                          key={epicIndex}
                          epic={epic}
                          epicIndex={epicIndex}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Risks and Success Criteria */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Risks */}
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <h4 className="font-medium text-red-900 mb-2 flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Risks</span>
                      </h4>
                      <ul className="text-sm text-red-800 space-y-1" data-testid={`risks-${phaseIndex}`}>
                        {(phase.risks || []).map((risk, riskIndex) => (
                          <li
                            key={riskIndex}
                            className="flex items-start space-x-1"
                            data-testid={`risk-${phaseIndex}-${riskIndex}`}
                          >
                            <span className="text-red-400 flex-shrink-0">•</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                        {(!phase.risks || phase.risks.length === 0) && (
                          <li className="text-red-600 italic">No risks identified</li>
                        )}
                      </ul>
                    </div>

                    {/* Success Criteria */}
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="font-medium text-green-900 mb-2 flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Success Criteria</span>
                      </h4>
                      <ul className="text-sm text-green-800 space-y-1" data-testid={`success-criteria-${phaseIndex}`}>
                        {(phase.successCriteria || []).map((criteria, criteriaIndex) => (
                          <li
                            key={criteriaIndex}
                            className="flex items-start space-x-1"
                            data-testid={`criteria-${phaseIndex}-${criteriaIndex}`}
                          >
                            <span className="text-green-400 flex-shrink-0">•</span>
                            <span>{criteria}</span>
                          </li>
                        ))}
                        {(!phase.successCriteria || phase.successCriteria.length === 0) && (
                          <li className="text-green-600 italic">No success criteria defined</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default PhaseList