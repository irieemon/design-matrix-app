import { useState } from 'react'
import { X, Sparkles, ArrowRight, MessageCircle, Lightbulb, Loader } from 'lucide-react'
import { aiService } from '../lib/aiService'
import { DatabaseService } from '../lib/database'
import { Project, IdeaCard, User, ProjectType } from '../types'
import { logger } from '../utils/logger'

interface AIStarterModalProps {
  currentUser: User
  onClose: () => void
  onProjectCreated: (project: Project, ideas: IdeaCard[]) => void
}

interface ClarifyingQuestion {
  question: string
  context: string
}

interface ProjectAnalysis {
  needsClarification: boolean
  clarifyingQuestions: ClarifyingQuestion[]
  projectAnalysis: {
    industry: string
    scope: string
    timeline: string
    primaryGoals: string[]
    recommendedProjectType?: string
    projectTypeReasoning?: string
  }
  generatedIdeas: Array<{
    content: string
    details: string
    x: number
    y: number
    priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
    reasoning?: string
  }>
}

const AIStarterModal: React.FC<AIStarterModalProps> = ({ currentUser, onClose, onProjectCreated }) => {
  const [step, setStep] = useState<'initial' | 'questions' | 'generating' | 'review'>('initial')
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [selectedProjectType, setSelectedProjectType] = useState<ProjectType | 'auto'>('auto')
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ideaCount, setIdeaCount] = useState(8)
  const [ideaTolerance, setIdeaTolerance] = useState(50) // 0-100 scale

  const analyzeProjectContext = (projectName: string, description: string): { 
    recommendedProjectType: ProjectType, 
    reasoning: string,
    industry: string,
    timeline: string,
    primaryGoals: string[],
    needsClarification: boolean,
    clarifyingQuestions: ClarifyingQuestion[]
  } => {
    const descLower = description.toLowerCase()
    const nameLower = projectName.toLowerCase()
    const combined = `${nameLower} ${descLower}`
    
    // Extract key information
    const goals = []
    if (combined.includes('launch') || combined.includes('release')) goals.push('Product Launch')
    if (combined.includes('improve') || combined.includes('optimize')) goals.push('Process Improvement')
    if (combined.includes('market') || combined.includes('campaign')) goals.push('Market Expansion')
    if (combined.includes('develop') || combined.includes('build')) goals.push('Development')
    if (combined.includes('research')) goals.push('Research & Analysis')
    if (goals.length === 0) goals.push(projectName)
    
    // Determine timeline
    let timeline = 'Medium-term'
    if (combined.includes('quarter') || combined.includes('3 month') || combined.includes('short')) timeline = 'Short-term'
    if (combined.includes('year') || combined.includes('annual') || combined.includes('long')) timeline = 'Long-term'
    
    // Intelligent industry detection with context awareness
    let industry = 'General'
    
    // Healthcare patterns (prioritized for care/senior services)
    if (combined.match(/(healthcare|health|medical|care|senior|elder|aging|caregiver|patient|clinical|wellness|therapy|nursing)/)) {
      industry = 'Healthcare'
    }
    // Finance patterns
    else if (combined.match(/(finance|financial|bank|investment|insurance|loan|credit|payment|trading|fintech)/)) {
      industry = 'Finance'
    }
    // Education patterns
    else if (combined.match(/(education|school|university|learning|training|course|curriculum|student|academic)/)) {
      industry = 'Education'
    }
    // Retail/E-commerce patterns
    else if (combined.match(/(retail|ecommerce|e-commerce|store|shop|product|inventory|sales|customer|commerce)/)) {
      industry = 'Retail'
    }
    // Real Estate patterns
    else if (combined.match(/(real estate|property|housing|rental|lease|commercial|residential)/)) {
      industry = 'Real Estate'
    }
    // Food & Hospitality patterns
    else if (combined.match(/(restaurant|food|hospitality|hotel|catering|dining|cuisine|chef)/)) {
      industry = 'Food & Hospitality'
    }
    // Non-profit patterns
    else if (combined.match(/(nonprofit|non-profit|charity|community|volunteer|social impact|foundation|donation)/)) {
      industry = 'Non-profit'
    }
    // Technology patterns (only if no other industry detected and clear tech focus)
    else if (combined.match(/(software development|app development|programming|coding|api|database|saas|tech startup)/) || 
             (combined.match(/(technology|software|app|platform|system|digital)/) && 
              !combined.match(/(marketing|campaign|care|health|service|community|social)/))) {
      industry = 'Technology'
    }
    
    // Smart project type detection with improved priority
    let recommendedProjectType: ProjectType = 'other'
    let reasoning = ''
    
    // Marketing patterns (checked first for higher priority)
    if (combined.match(/(marketing|campaign|brand|customer|audience|social|content|seo|ads|advertising|promotion)/)) {
      recommendedProjectType = 'marketing'
      reasoning = 'Contains marketing, branding, and customer acquisition elements'
    }
    // Software patterns (only if no marketing terms detected)
    else if (combined.match(/(software development|app development|coding|programming|api|database|backend|frontend)/) || 
             (combined.match(/(app|software|platform|system|website|mobile|web)/) && !combined.match(/(marketing|campaign|brand|customer|audience|social|content|seo|ads)/))) {
      recommendedProjectType = 'software'
      reasoning = 'Detected software development keywords and technical requirements'
    }
    // Product development patterns
    else if (combined.match(/(product|prototype|design|feature|mvp|launch|release)/)) {
      recommendedProjectType = 'product_development' 
      reasoning = 'Focus on product creation, features, and market launch activities'
    }
    // Business plan patterns
    else if (combined.match(/(business|strategy|plan|revenue|model|growth|expansion|partnership)/)) {
      recommendedProjectType = 'business_plan'
      reasoning = 'Strategic business planning and growth-focused initiative'
    }
    // Operations patterns  
    else if (combined.match(/(process|workflow|operation|efficiency|automat|improve|optimize)/)) {
      recommendedProjectType = 'operations'
      reasoning = 'Operational improvement and process optimization focus'
    }
    // Research patterns
    else if (combined.match(/(research|study|analysis|investigate|explore|experiment)/)) {
      recommendedProjectType = 'research'
      reasoning = 'Research and development focus with analytical components'
    }
    else {
      reasoning = 'Could not clearly categorize - general project approach recommended'
    }
    
    // Generate contextual clarifying questions based on project type and content
    let needsClarification = false
    const clarifyingQuestions: ClarifyingQuestion[] = []
    
    // Always check for missing key details, but make questions contextual to project type
    if (description.length < 50) {
      needsClarification = true
      clarifyingQuestions.push({
        question: `Can you provide more details about the ${recommendedProjectType === 'marketing' ? 'campaign objectives and target messaging' : 
                   recommendedProjectType === 'software' ? 'technical requirements and key features' :
                   recommendedProjectType === 'business_plan' ? 'business model and revenue strategy' :
                   'project scope and key objectives'}?`,
        context: 'More specific context will help generate better-targeted ideas'
      })
    }
    
    // Context-aware audience questions
    if (!combined.match(/(target|audience|user|customer|demographic)/) && recommendedProjectType !== 'operations') {
      needsClarification = true
      const audienceQuestion = recommendedProjectType === 'marketing' ? 
        'Who is your target demographic and what are their key characteristics (age, income, location, interests)?' :
        industry === 'Healthcare' ?
        'Who are the primary patients/clients and what are their specific care needs?' :
        recommendedProjectType === 'software' ?
        'Who are the primary users and what problems are you solving for them?' :
        'Who is the primary target audience or user base for this project?'
        
      clarifyingQuestions.push({
        question: audienceQuestion,
        context: 'Understanding the audience helps prioritize features and ideas'
      })
    }
    
    // Project-type specific clarifying questions
    if (recommendedProjectType === 'marketing' && !combined.match(/(budget|spend|cost|timeline|duration)/)) {
      needsClarification = true
      clarifyingQuestions.push({
        question: 'What is your marketing budget range and campaign timeline?',
        context: 'Budget and timeline inform realistic marketing strategies and channel selection'
      })
    }
    
    if (industry === 'Healthcare' && !combined.match(/(regulation|compliance|hipaa|privacy)/)) {
      needsClarification = true
      clarifyingQuestions.push({
        question: 'Are there specific healthcare regulations or compliance requirements to consider?',
        context: 'Healthcare projects often have regulatory constraints that affect strategy'
      })
    }
    
    if (recommendedProjectType === 'software' && !combined.match(/(platform|mobile|web|desktop|api)/)) {
      needsClarification = true  
      clarifyingQuestions.push({
        question: 'What platforms or technologies should this solution support (web, mobile, desktop, API)?',
        context: 'Platform decisions affect development approach and user experience'
      })
    }
    
    return {
      recommendedProjectType,
      reasoning, 
      industry,
      timeline,
      primaryGoals: goals,
      needsClarification,
      clarifyingQuestions
    }
  }

  const handleInitialAnalysis = async () => {
    if (!projectName.trim() || !projectDescription.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      logger.debug('🎯 Starting AI project analysis...')
      
      // Analyze project context
      const contextAnalysis = analyzeProjectContext(projectName, projectDescription)
      
      // Generate ideas with appropriate project type
      const effectiveProjectType = selectedProjectType === 'auto' 
        ? contextAnalysis.recommendedProjectType 
        : selectedProjectType
        
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
          industry: contextAnalysis.industry,
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
      setError('Failed to analyze project. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuestionsSubmit = async () => {
    if (!analysis) return

    setIsLoading(true)
    setError(null)

    try {
      // Compile answers into additional context
      const additionalContext = analysis.clarifyingQuestions
        .map((q, index) => `${q.question} ${questionAnswers[index] || 'Not specified'}`)
        .join('\n')

      logger.debug('🎯 Re-analyzing with additional context...')
      
      // Enhanced description with user answers
      const enhancedDescription = `${projectDescription}\n\nAdditional Details:\n${additionalContext}`
      
      // Re-analyze with enhanced context
      const contextAnalysis = analyzeProjectContext(projectName, enhancedDescription)
      
      const effectiveProjectType = selectedProjectType === 'auto' 
        ? contextAnalysis.recommendedProjectType 
        : selectedProjectType
        
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
          industry: contextAnalysis.industry,
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
      setError('Failed to generate ideas. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!analysis || analysis.generatedIdeas.length === 0) return

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
        })

        if (newIdea.success && newIdea.data) {
          createdIdeas.push(newIdea.data)
        }
      }

      logger.debug('✅ AI Starter complete! Created project and', createdIdeas.length, 'ideas')
      onProjectCreated(project, createdIdeas)
      onClose()

    } catch (err) {
      logger.error('Error creating project:', err)
      setError('Failed to create project and ideas. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const renderInitialStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">AI Project Starter</h3>
        <p className="text-slate-600">Let AI help you set up your project and generate prioritized ideas</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Project Name
        </label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="e.g., Mobile App Launch, Marketing Campaign, Process Improvement"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Project Description
        </label>
        <textarea
          value={projectDescription}
          onChange={(e) => setProjectDescription(e.target.value)}
          rows={4}
          placeholder="Describe your project goals, target audience, scope, timeline, or any other relevant details..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Project Type
        </label>
        <select
          value={selectedProjectType}
          onChange={(e) => setSelectedProjectType(e.target.value as ProjectType | 'auto')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        >
          <option value="auto">🤖 Let AI recommend the best type</option>
          <option value="software">💻 Software Development</option>
          <option value="product_development">🛠️ Product Development</option>
          <option value="business_plan">📊 Business Plan</option>
          <option value="marketing">📢 Marketing Campaign</option>
          <option value="operations">⚙️ Operations Improvement</option>
          <option value="research">🔬 Research & Development</option>
          <option value="other">❓ Other</option>
        </select>
        <p className="text-xs text-slate-500 mt-1">
          This helps generate more relevant roadmaps and user stories
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Number of Ideas: {ideaCount}
          </label>
          <input
            type="range"
            min="3"
            max="12"
            value={ideaCount}
            onChange={(e) => setIdeaCount(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>3</span>
            <span>12</span>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Idea Tolerance: {ideaTolerance}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={ideaTolerance}
            onChange={(e) => setIdeaTolerance(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>Conservative</span>
            <span>Experimental</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Higher tolerance includes more experimental or challenging ideas
          </p>
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <Lightbulb className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-purple-900 mb-1">How it works</h4>
            <p className="text-sm text-purple-700">
              AI will analyze your project and generate {ideaCount} strategic ideas positioned on the priority matrix. 
              If more context is needed, you'll be asked clarifying questions to ensure the best recommendations.
            </p>
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleInitialAnalysis}
          disabled={!projectName.trim() || !projectDescription.trim() || isLoading}
          className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2"
        >
          {isLoading ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>{isLoading ? 'Analyzing...' : 'Start AI Analysis'}</span>
        </button>
      </div>
    </div>
  )

  const renderQuestionsStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-8 h-8 text-amber-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">A few questions to help me understand better</h3>
        <p className="text-slate-600">This will help generate more relevant and strategic ideas for your project</p>
      </div>

      {analysis?.clarifyingQuestions.map((q, index) => (
        <div key={index} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {q.question}
            </label>
            <p className="text-xs text-slate-500 mb-2">{q.context}</p>
            <textarea
              value={questionAnswers[index] || ''}
              onChange={(e) => setQuestionAnswers({...questionAnswers, [index]: e.target.value})}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Your answer..."
            />
          </div>
        </div>
      ))}

      <div className="flex space-x-3">
        <button
          onClick={() => setStep('initial')}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleQuestionsSubmit}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center space-x-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2"
        >
          {isLoading ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          <span>{isLoading ? 'Generating Ideas...' : 'Generate Ideas'}</span>
        </button>
      </div>
    </div>
  )

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lightbulb className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Project Analysis Complete</h3>
        <p className="text-slate-600">Review the generated ideas and create your project</p>
      </div>

      {analysis && (
        <div className="space-y-6">
          {/* Project Analysis Summary */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 mb-3">Project Analysis</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Industry:</span>
                <span className="ml-2 font-medium">{analysis.projectAnalysis.industry}</span>
              </div>
              <div>
                <span className="text-slate-500">Timeline:</span>
                <span className="ml-2 font-medium">{analysis.projectAnalysis.timeline}</span>
              </div>
            </div>
            
            {/* Show project type recommendation if auto was selected */}
            {selectedProjectType === 'auto' && analysis.projectAnalysis.recommendedProjectType && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-blue-700 text-sm font-medium">🤖 AI Recommended Project Type:</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                    {analysis.projectAnalysis.recommendedProjectType}
                  </span>
                </div>
                {analysis.projectAnalysis.projectTypeReasoning && (
                  <p className="text-blue-700 text-xs">{analysis.projectAnalysis.projectTypeReasoning}</p>
                )}
              </div>
            )}
            
            <div className="mt-3">
              <span className="text-slate-500 text-sm">Primary Goals:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {analysis.projectAnalysis.primaryGoals.map((goal, i) => (
                  <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {goal}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Generated Ideas Preview */}
          <div>
            <h4 className="font-medium text-slate-900 mb-3">Generated Ideas ({analysis.generatedIdeas.length})</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {analysis.generatedIdeas.map((idea, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium text-slate-900">{idea.content}</h5>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      idea.priority === 'high' ? 'bg-red-100 text-red-800' :
                      idea.priority === 'strategic' ? 'bg-blue-100 text-blue-800' :
                      idea.priority === 'moderate' ? 'bg-amber-100 text-amber-800' :
                      idea.priority === 'innovation' ? 'bg-purple-100 text-purple-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {idea.priority}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{idea.details}</p>
                  {idea.reasoning && (
                    <p className="text-xs text-slate-500 italic">Positioned: {idea.reasoning}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={analysis?.needsClarification ? () => setStep('questions') : () => setStep('initial')}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleCreateProject}
          disabled={isLoading || !analysis?.generatedIdeas.length}
          className="flex-1 flex items-center justify-center space-x-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2"
        >
          {isLoading ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Lightbulb className="w-4 h-4" />
          )}
          <span>{isLoading ? 'Creating...' : `Create Project & ${analysis?.generatedIdeas.length || 0} Ideas`}</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">AI Project Starter</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 text-sm underline mt-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {step === 'initial' && renderInitialStep()}
          {step === 'questions' && renderQuestionsStep()}
          {step === 'review' && renderReviewStep()}
        </div>
      </div>
    </div>
  )
}

export default AIStarterModal