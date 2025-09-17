import React from 'react'
import { Users } from 'lucide-react'

interface Month {
  index: number
  name: string
  fullName: string
  isCurrentMonth: boolean
}

interface TimelineGridHeaderProps {
  months: Month[]
  className?: string
}

const TimelineGridHeader: React.FC<TimelineGridHeaderProps> = ({
  months,
  className = "bg-slate-50 border-b border-slate-200"
}) => {
  return (
    <div className={className}>
      <div className="flex">
        {/* Team column header */}
        <div className="w-48 flex items-center justify-center py-4 bg-slate-100 border-r border-slate-200">
          <Users className="w-5 h-5 text-slate-600 mr-2" />
          <span className="font-semibold text-slate-800 text-sm tracking-wide">TEAMS</span>
        </div>

        {/* Month headers */}
        <div className="flex-1 flex">
          {months.map((month) => (
            <div
              key={month.index}
              className={`flex-1 py-4 text-center border-r border-slate-200 font-semibold text-sm ${
                month.isCurrentMonth
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-50 text-slate-700'
              }`}
              title={month.fullName}
            >
              {month.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TimelineGridHeader