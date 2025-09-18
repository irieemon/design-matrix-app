import React from 'react'
import { MessageCircle, ArrowRight, Loader } from 'lucide-react'
import type { ClarifyingQuestion } from '../../hooks/aiStarter'

interface ClarifyingQuestionsStepProps {
  questions: ClarifyingQuestion[]
  answers: Record<number, string>
  onAnswerChange: (answers: Record<number, string>) => void
  isLoading: boolean
  onBack: () => void
  onSubmit: () => void
}

const ClarifyingQuestionsStep: React.FC<ClarifyingQuestionsStepProps> = ({
  questions,
  answers,
  onAnswerChange,
  isLoading,
  onBack,
  onSubmit
}) => {
  const updateAnswer = (index: number, value: string) => {
    onAnswerChange({
      ...answers,
      [index]: value
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-8 h-8 text-amber-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">A few questions to help me understand better</h3>
        <p className="text-slate-600">This will help generate more relevant and strategic ideas for your project</p>
      </div>

      {questions.map((question, index) => (
        <div key={index} className="space-y-3">
          <div>
            <label htmlFor={`question-${index}`} className="block text-sm font-medium text-slate-700 mb-1">
              {question.question}
            </label>
            <p className="text-xs text-slate-500 mb-2">{question.context}</p>
            <textarea
              id={`question-${index}`}
              value={answers[index] || ''}
              onChange={(e) => updateAnswer(index, e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Your answer..."
            />
          </div>
        </div>
      ))}

      <div className="flex space-x-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onSubmit}
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
}

export default ClarifyingQuestionsStep