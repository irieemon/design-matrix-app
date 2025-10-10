import React, { useState } from 'react'
import { aiService } from '../lib/aiService'
import { DatabaseService } from '../lib/database'
import { supabase } from '../lib/supabase'
import { Project, IdeaCard, User, ProjectType } from '../types'
import { logger } from '../utils/logger'
import {
  AIStarterHeader,
  ProjectBasicsStep,
  ClarifyingQuestionsStep,
  ProjectReviewStep
} from './aiStarter'
import {
  analyzeProjectContext,
  validateAIStarterForm,
  generateEnhancedDescription
} from './aiStarter/config/aiStarterUtils'
import {
  AI_STARTER_VALIDATION,
  AI_STARTER_MESSAGES
} from './aiStarter/config/aiStarterConstants'
import type {
  AIStarterStep,
  ProjectAnalysis
} from './aiStarter/config/aiStarterTypes'

interface AIStarterModalProps {
  currentUser: User
  onClose: () => void
  onProjectCreated: (project: Project, ideas: IdeaCard[]) => void
}


const AIStarterModal: React.FC<AIStarterModalProps> = ({ currentUser, onClose, onProjectCreated }) => {
  const [step, setStep] = useState<AIStarterStep>('initial')
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [selectedProjectType, setSelectedProjectType] = useState<ProjectType | 'auto'>('auto')
  const [selectedIndustry, setSelectedIndustry] = useState<string | 'auto'>('auto')
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ideaCount, setIdeaCount] = useState<number>(AI_STARTER_VALIDATION.DEFAULT_IDEA_COUNT)
  const [ideaTolerance, setIdeaTolerance] = useState<number>(AI_STARTER_VALIDATION.DEFAULT_IDEA_TOLERANCE)


  const handleInitialAnalysis = async () => {
    if (!validateAIStarterForm(projectName, projectDescription)) return

    setIsLoading(true)
    setError(null)

    try {
      logger.debug('🎯 Starting AI project analysis...')
      
      // Analyze project context
      const contextAnalysis = analyzeProjectContext(projectName, projectDescription)
      
      // Use manual selections if provided
      const effectiveProjectType = selectedProjectType === 'auto' 
        ? contextAnalysis.recommendedProjectType 
        : selectedProjectType
      const effectiveIndustry = selectedIndustry === 'auto'
        ? contextAnalysis.industry
        : selectedIndustry
        
      const result = await aiService.generateProjectIdeas(
        projectName, 
        projectDescription,
        effectiveProjectType,
        ideaCount,
        ideaTolerance
      )
      
      setAnalysis({ 
        needsClarification: contextAnalysis.needsClarification,
        clarifyingQuestions: contextAnalysis.clarifyingQuestions,
        projectAnalysis: {
          industry: effectiveIndustry,
          scope: 'Standard',
          timeline: contextAnalysis.timeline,
          primaryGoals: contextAnalysis.primaryGoals,
          recommendedProjectType: contextAnalysis.recommendedProjectType,
          projectTypeReasoning: contextAnalysis.reasoning
        },
        generatedIdeas: result
      })

      if (contextAnalysis.needsClarification) {
        setStep('questions')
      } else {
        setStep('review')
      }
    } catch (err) {
      logger.error('Error in AI analysis:', err)
      setError(AI_STARTER_MESSAGES.ERROR_ANALYSIS_FAILED)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuestionsSubmit = async () => {
    if (!analysis) return

    setIsLoading(true)
    setError(null)

    try {

      logger.debug('🎯 Re-analyzing with additional context...')
      
      // Enhanced description with user answers
      const enhancedDescription = generateEnhancedDescription(
        projectDescription,
        analysis.clarifyingQuestions,
        questionAnswers
      )
      
      // Re-analyze with enhanced context
      const contextAnalysis = analyzeProjectContext(projectName, enhancedDescription)
      
      const effectiveProjectType = selectedProjectType === 'auto' 
        ? contextAnalysis.recommendedProjectType 
        : selectedProjectType
      const effectiveIndustry = selectedIndustry === 'auto'
        ? contextAnalysis.industry
        : selectedIndustry
        
      const result = await aiService.generateProjectIdeas(
        projectName,
        enhancedDescription,
        effectiveProjectType,
        ideaCount,
        ideaTolerance
      )
      
      setAnalysis({ 
        needsClarification: false,
        clarifyingQuestions: [],
        projectAnalysis: {
          industry: effectiveIndustry,
          scope: 'Enhanced',
          timeline: contextAnalysis.timeline,
          primaryGoals: contextAnalysis.primaryGoals,
          recommendedProjectType: contextAnalysis.recommendedProjectType,
          projectTypeReasoning: contextAnalysis.reasoning
        },
        generatedIdeas: result
      })
      setStep('review')
    } catch (err) {
      logger.error('Error in follow-up analysis:', err)
      setError(AI_STARTER_MESSAGES.ERROR_GENERATION_FAILED)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProject = async () => {
    logger.debug('🎯 AI Starter: handleCreateProject called')
    logger.debug('🎯 AI Starter: analysis exists?', !!analysis)
    logger.debug('🎯 AI Starter: generatedIdeas length:', analysis?.generatedIdeas?.length || 0)

    if (!analysis || analysis.generatedIdeas.length === 0) {
      logger.error('❌ AI Starter: Cannot create project - no analysis or no ideas!')
      logger.debug('❌ AI Starter: analysis:', analysis)
      return
    }

    logger.debug('✅ AI Starter: Starting project creation with', analysis.generatedIdeas.length, 'ideas')
    setIsLoading(true)
    setError(null)

    try {
      // Determine final project type
      const finalProjectType = selectedProjectType === 'auto' 
        ? (analysis.projectAnalysis.recommendedProjectType || 'other') as ProjectType
        : selectedProjectType as ProjectType

      // Create the project
      logger.debug('🏗️ Creating project with type:', finalProjectType)
      const project = await DatabaseService.createProject({
        name: projectName,
        description: projectDescription,
        project_type: finalProjectType,
        status: 'active',
        priority_level: 'medium',
        visibility: 'private',
        owner_id: currentUser.id,
        ai_analysis: analysis.projectAnalysis
      })

      if (!project) {
        throw new Error('Failed to create project')
      }

      // Create the ideas
      logger.debug('💡 Creating', analysis.generatedIdeas.length, 'ideas...')
      const createdIdeas: IdeaCard[] = []

      for (const ideaData of analysis.generatedIdeas) {
        const newIdea = await DatabaseService.createIdea({
          content: ideaData.content,
          details: ideaData.details,
          x: Math.round(ideaData.x),
          y: Math.round(ideaData.y),
          priority: ideaData.priority,
          created_by: currentUser.id,
          is_collapsed: true,
          project_id: project.id
        }, supabase)

        if (newIdea.success && newIdea.data) {
          createdIdeas.push(newIdea.data)
        }
      }

      logger.debug('✅ AI Starter complete! Created project and', createdIdeas.length, 'ideas')
      onProjectCreated(project, createdIdeas)
      onClose()

    } catch (err) {
      logger.error('Error creating project:', err)
      setError(AI_STARTER_MESSAGES.ERROR_CREATION_FAILED)
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid = validateAIStarterForm(projectName, projectDescription)



  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className="lux-modal-backdrop" onClick={onClose} />
      <div className="lux-modal rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <AIStarterHeader onClose={onClose} />

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 rounded-lg p-4 border" style={{
              backgroundColor: 'var(--garnet-50)',
              borderColor: 'var(--garnet-200)'
            }}>
              <p className="text-sm" style={{ color: 'var(--garnet-700)' }}>{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-sm underline mt-1"
                style={{ color: 'var(--garnet-600)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--garnet-800)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--garnet-600)'}
              >
                Dismiss
              </button>
            </div>
          )}

          {step === 'initial' && (
            <ProjectBasicsStep
              projectName={projectName}
              onProjectNameChange={setProjectName}
              projectDescription={projectDescription}
              onProjectDescriptionChange={setProjectDescription}
              selectedProjectType={selectedProjectType}
              onProjectTypeChange={setSelectedProjectType}
              selectedIndustry={selectedIndustry}
              onIndustryChange={setSelectedIndustry}
              ideaCount={ideaCount}
              onIdeaCountChange={setIdeaCount}
              ideaTolerance={ideaTolerance}
              onIdeaToleranceChange={setIdeaTolerance}
              isLoading={isLoading}
              isFormValid={isFormValid}
              onCancel={onClose}
              onStartAnalysis={handleInitialAnalysis}
            />
          )}
          {step === 'questions' && analysis && (
            <ClarifyingQuestionsStep
              questions={analysis.clarifyingQuestions}
              answers={questionAnswers}
              onAnswerChange={setQuestionAnswers}
              isLoading={isLoading}
              onBack={() => setStep('initial')}
              onSubmit={handleQuestionsSubmit}
            />
          )}
          {step === 'review' && analysis && (
            <ProjectReviewStep
              analysis={analysis}
              selectedProjectType={selectedProjectType}
              selectedIndustry={selectedIndustry}
              isLoading={isLoading}
              onBack={analysis.needsClarification ? () => setStep('questions') : () => setStep('initial')}
              onCreateProject={handleCreateProject}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default React.memo(AIStarterModal)