import React from 'react'
import { Target } from 'lucide-react'

interface PrioritasLogoProps {
  className?: string
  size?: number
}

const PrioritasLogo: React.FC<PrioritasLogoProps> = ({ className = "", size = 24 }) => {
  return (
    <Target 
      className={className}
      size={size}
    />
  )
}

export default PrioritasLogo