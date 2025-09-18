import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AIStarterModal from '../AIStarterModal'

// Mock dependencies
vi.mock('../../lib/aiService', () => ({
  aiService: {
    generateProjectIdeas: vi.fn()
  }
}))

vi.mock('../../lib/database', () => ({
  DatabaseService: {
    createProject: vi.fn(),
    createIdea: vi.fn()
  }
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}))

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User'
}

const defaultProps = {
  currentUser: mockUser,
  onClose: vi.fn(),
  onProjectCreated: vi.fn()
}

describe('AIStarterModal - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render without crashing', () => {
    render(<AIStarterModal {...defaultProps} />)
    expect(screen.getByText(/Project Name/)).toBeInTheDocument()
  })

  it('should show modal header', () => {
    render(<AIStarterModal {...defaultProps} />)
    const headers = screen.getAllByText('AI Project Starter')
    expect(headers.length).toBeGreaterThan(0)
  })

  it('should show project name input', () => {
    render(<AIStarterModal {...defaultProps} />)
    expect(screen.getByPlaceholderText(/e.g., Mobile App Launch/)).toBeInTheDocument()
  })

  it('should show project description input', () => {
    render(<AIStarterModal {...defaultProps} />)
    expect(screen.getByPlaceholderText(/Describe your project goals/)).toBeInTheDocument()
  })

  it('should show cancel button', () => {
    render(<AIStarterModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('should show start analysis button', () => {
    render(<AIStarterModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Start AI Analysis/ })).toBeInTheDocument()
  })

  it('should have start button disabled initially', () => {
    render(<AIStarterModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Start AI Analysis/ })).toBeDisabled()
  })
})