import React from 'react'
import { Project, IdeaCard } from '../types'
import ProjectRoadmapComponent from './ProjectRoadmap/ProjectRoadmap'

interface ProjectRoadmapProps {
  currentUser: string
  currentProject: Project | null
  ideas: IdeaCard[]
}

const ProjectRoadmap: React.FC<ProjectRoadmapProps> = ({ currentUser, currentProject, ideas }) => {
  return (
    <ProjectRoadmapComponent
      currentUser={currentUser}
      currentProject={currentProject}
      ideas={ideas}
    />
  )
}

export default ProjectRoadmap