import React from 'react'

interface StatusPriorityLegendProps {
  className?: string
}

const StatusPriorityLegend: React.FC<StatusPriorityLegendProps> = ({
  className = "bg-slate-50 px-6 py-4 border-t border-slate-200"
}) => {
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-6">
          <span className="font-semibold text-slate-700 tracking-wide">STATUS:</span>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-slate-200 rounded"></div>
            <span className="text-slate-600">Planned</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-400 rounded"></div>
            <span className="text-slate-600">In Progress</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-slate-400 rounded"></div>
            <span className="text-slate-600">Completed</span>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <span className="font-semibold text-slate-700 tracking-wide">PRIORITY:</span>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-400 rounded"></div>
            <span className="text-slate-600">High</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
            <span className="text-slate-600">Medium</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-400 rounded"></div>
            <span className="text-slate-600">Low</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatusPriorityLegend