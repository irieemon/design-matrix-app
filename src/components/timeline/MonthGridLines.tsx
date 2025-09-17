import React from 'react'

interface Month {
  index: number
  name: string
  fullName: string
  isCurrentMonth: boolean
}

interface MonthGridLinesProps {
  months: Month[]
  className?: string
}

const MonthGridLines: React.FC<MonthGridLinesProps> = ({
  months,
  className = "absolute inset-0 flex"
}) => {
  return (
    <div className={className}>
      {months.map((month) => (
        <div key={month.index} className="flex-1 border-r border-slate-100"></div>
      ))}
    </div>
  )
}

export default MonthGridLines