/**
 * Select Component Tests
 *
 * Comprehensive tests for the enhanced Select component covering:
 * - Value binding and onChange handlers
 * - Placeholder display
 * - Disabled states (component, loading, explicit)
 * - Error states and validation integration
 * - Success states and messages
 * - Required field indicators
 * - Label associations and accessibility
 * - Focus management
 * - Option rendering (single and grouped)
 * - Value selection
 * - Empty state handling
 * - Native vs Custom select modes
 * - Multi-select functionality
 * - Searchable select with filtering
 * - Clearable select
 * - Icon support in options
 * - Helper text display
 * - Error auto-dismiss functionality
 * - State management and imperative API
 * - Edge cases (max selections, rapid changes, keyboard navigation)
 *
 * Business Impact: Form select reliability, option management, user experience
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select, SelectRef, SelectOption, SelectOptionGroup } from '../Select'
import { ComponentStateProvider } from '../../../contexts/ComponentStateProvider'
import React from 'react'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <svg data-testid="chevron-down" className={className}>chevron-down</svg>
  ),
  ChevronUp: ({ className }: { className?: string }) => (
    <svg data-testid="chevron-up" className={className}>chevron-up</svg>
  ),
  Check: ({ className }: { className?: string }) => (
    <svg data-testid="check-icon" className={className}>check</svg>
  )
}))

// Wrapper for context provider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <ComponentStateProvider>
      {ui}
    </ComponentStateProvider>
  )
}

// Sample options
const simpleOptions: SelectOption[] = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' }
]

const groupedOptions: SelectOptionGroup[] = [
  {
    label: 'Group 1',
    options: [
      { value: 'g1-opt1', label: 'Group 1 Option 1' },
      { value: 'g1-opt2', label: 'Group 1 Option 2' }
    ]
  },
  {
    label: 'Group 2',
    options: [
      { value: 'g2-opt1', label: 'Group 2 Option 1' },
      { value: 'g2-opt2', label: 'Group 2 Option 2' }
    ]
  }
]

describe('Select Component', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic Rendering - Native Select', () => {
    it('should render native select with default props', () => {
      renderWithProvider(<Select id="test-select" options={simpleOptions} />)

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      expect(select).toHaveClass('select')
    })

    it('should render with custom className', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} className="custom-class" />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveClass('custom-class')
    })

    it('should render with containerClassName', () => {
      const { container } = renderWithProvider(
        <Select id="test-select" options={simpleOptions} containerClassName="custom-container" />
      )

      const containerDiv = container.querySelector('.custom-container')
      expect(containerDiv).toBeInTheDocument()
    })

    it('should render full width select', () => {
      renderWithProvider(<Select id="test-select" options={simpleOptions} fullWidth />)

      const select = screen.getByRole('combobox')
      expect(select).toHaveClass('select--full-width')
    })

    it('should apply variant classes', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} variant="secondary" />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('data-variant', 'secondary')
    })

    it('should apply size classes', () => {
      renderWithProvider(<Select id="test-select" options={simpleOptions} size="lg" />)

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('data-size', 'lg')
    })

    it('should apply state data attribute', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} state="success" />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('data-state', 'success')
    })

    it('should render chevron icon', () => {
      renderWithProvider(<Select id="test-select" options={simpleOptions} />)

      expect(screen.getByTestId('chevron-down')).toBeInTheDocument()
    })
  })

  describe('Label and Required Field Indicators', () => {
    it('should render label when provided', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} label="Select Option" />
      )

      expect(screen.getByText('Select Option')).toBeInTheDocument()
    })

    it('should associate label with select', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} label="Select Option" />
      )

      const label = screen.getByText('Select Option')
      expect(label).toHaveAttribute('for', 'test-select')
    })

    it('should show required indicator when required', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} label="Select Option" required />
      )

      const requiredIndicator = screen.getByText('*')
      expect(requiredIndicator).toBeInTheDocument()
      expect(requiredIndicator).toHaveClass('select-label__required')
    })

    it('should not show required indicator when not required', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} label="Select Option" />
      )

      expect(screen.queryByText('*')).not.toBeInTheDocument()
    })
  })

  describe('Placeholder Display', () => {
    it('should display default placeholder', () => {
      renderWithProvider(<Select id="test-select" options={simpleOptions} />)

      expect(screen.getByText('Select an option...')).toBeInTheDocument()
    })

    it('should display custom placeholder', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} placeholder="Choose one" />
      )

      expect(screen.getByText('Choose one')).toBeInTheDocument()
    })

    it('should hide placeholder when value is selected', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          value="option1"
          onChange={vi.fn()}
        />
      )

      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('option1')
    })
  })

  describe('Option Rendering - Native Select', () => {
    it('should render all options', () => {
      renderWithProvider(<Select id="test-select" options={simpleOptions} />)

      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })

    it('should render grouped options', () => {
      renderWithProvider(<Select id="test-select" options={groupedOptions} />)

      expect(screen.getByText('Group 1 Option 1')).toBeInTheDocument()
      expect(screen.getByText('Group 1 Option 2')).toBeInTheDocument()
      expect(screen.getByText('Group 2 Option 1')).toBeInTheDocument()
      expect(screen.getByText('Group 2 Option 2')).toBeInTheDocument()
    })

    it('should render disabled options', () => {
      const optionsWithDisabled: SelectOption[] = [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2', disabled: true },
        { value: 'option3', label: 'Option 3' }
      ]

      const { container } = renderWithProvider(
        <Select id="test-select" options={optionsWithDisabled} />
      )

      const option2 = container.querySelector('option[value="option2"]')
      expect(option2).toHaveAttribute('disabled')
    })

    it('should render placeholder as first option', () => {
      const { container } = renderWithProvider(
        <Select id="test-select" options={simpleOptions} placeholder="Select" />
      )

      const firstOption = container.querySelector('option[value=""]')
      expect(firstOption).toHaveTextContent('Select')
    })
  })

  describe('Value Selection and onChange - Native Select', () => {
    it('should bind value prop', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          value="option2"
          onChange={vi.fn()}
        />
      )

      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('option2')
    })

    it('should call onChange when value changes', async () => {
      const handleChange = vi.fn()
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} onChange={handleChange} />
      )

      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'option2')

      expect(handleChange).toHaveBeenCalled()
      expect(handleChange.mock.calls[0][0].target.value).toBe('option2')
    })

    it('should work as uncontrolled select with defaultValue', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} defaultValue="option1" />
      )

      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('option1')
    })
  })

  describe('Disabled States', () => {
    it('should be disabled when disabled prop is true', () => {
      renderWithProvider(<Select id="test-select" options={simpleOptions} disabled />)

      const select = screen.getByRole('combobox')
      expect(select).toBeDisabled()
    })

    it('should be disabled when state is disabled', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} state="disabled" />
      )

      const select = screen.getByRole('combobox')
      expect(select).toBeDisabled()
    })

    it('should be disabled when state is loading', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} state="loading" />
      )

      const select = screen.getByRole('combobox')
      expect(select).toBeDisabled()
    })

    it('should be disabled when loading prop is true', () => {
      renderWithProvider(<Select id="test-select" options={simpleOptions} loading />)

      const select = screen.getByRole('combobox')
      expect(select).toBeDisabled()
    })

    it('should show loading spinner when loading', () => {
      const { container } = renderWithProvider(
        <Select id="test-select" options={simpleOptions} state="loading" />
      )

      const spinner = container.querySelector('.loading-spinner')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Error States and Validation', () => {
    it('should display error message', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="error"
          errorMessage="Invalid selection"
        />
      )

      expect(screen.getByText('Invalid selection')).toBeInTheDocument()
    })

    it('should apply error styling', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="error"
          errorMessage="Error"
        />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('data-state', 'error')
      expect(select).toHaveAttribute('aria-invalid', 'true')
    })

    it('should associate error message with select', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="error"
          errorMessage="Error message"
        />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('aria-describedby', 'test-select-error')
    })

    it('should validate on blur', async () => {
      const handleValidate = vi.fn((value: string) => ({
        isValid: value !== '',
        error: value === '' ? 'Selection required' : undefined
      }))

      renderWithProvider(
        <Select id="test-select" options={simpleOptions} onValidate={handleValidate} />
      )

      const select = screen.getByRole('combobox')
      await user.click(select)
      await user.tab()

      expect(handleValidate).toHaveBeenCalledWith('')
      await waitFor(() => {
        expect(screen.getByText('Selection required')).toBeInTheDocument()
      })
    })

    it('should auto-dismiss error after timeout', async () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="error"
          errorMessage="Error"
          errorDismissAfter={1000}
        />
      )

      expect(screen.getByText('Error')).toBeInTheDocument()

      vi.advanceTimersByTime(1000)

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        expect(select).toHaveAttribute('data-state', 'idle')
      })
    })

    it('should call onStateChange when error occurs', () => {
      const handleStateChange = vi.fn()

      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="error"
          errorMessage="Error"
          onStateChange={handleStateChange}
        />
      )

      expect(handleStateChange).toHaveBeenCalledWith('error')
    })
  })

  describe('Success States', () => {
    it('should display success message', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="success"
          successMessage="Valid selection"
        />
      )

      expect(screen.getByText('Valid selection')).toBeInTheDocument()
    })

    it('should apply success styling', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="success"
          successMessage="Success"
        />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('data-state', 'success')
    })

    it('should associate success message with select', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="success"
          successMessage="Success"
        />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('aria-describedby', 'test-select-success')
    })
  })

  describe('Helper Text', () => {
    it('should display helper text', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          helperText="Choose an option from the list"
        />
      )

      expect(screen.getByText('Choose an option from the list')).toBeInTheDocument()
    })

    it('should hide helper text when error message is shown', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          helperText="Helper text"
          state="error"
          errorMessage="Error message"
        />
      )

      expect(screen.getByText('Error message')).toBeInTheDocument()
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument()
    })

    it('should hide helper text when success message is shown', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          helperText="Helper text"
          state="success"
          successMessage="Success message"
        />
      )

      expect(screen.getByText('Success message')).toBeInTheDocument()
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument()
    })
  })

  describe('Focus Management', () => {
    it('should handle onFocus event', async () => {
      const handleFocus = vi.fn()
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} onFocus={handleFocus} />
      )

      const select = screen.getByRole('combobox')
      await user.click(select)

      expect(handleFocus).toHaveBeenCalled()
    })

    it('should handle onBlur event', async () => {
      const handleBlur = vi.fn()
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} onBlur={handleBlur} />
      )

      const select = screen.getByRole('combobox')
      await user.click(select)
      await user.tab()

      expect(handleBlur).toHaveBeenCalled()
    })

    it('should be focusable', async () => {
      renderWithProvider(<Select id="test-select" options={simpleOptions} />)

      const select = screen.getByRole('combobox')
      await user.click(select)

      expect(select).toHaveFocus()
    })

    it('should clear error on focus', async () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="error"
          errorMessage="Error"
        />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('data-state', 'error')

      await user.click(select)

      await waitFor(() => {
        expect(select).toHaveAttribute('data-state', 'idle')
      })
    })
  })

  describe('Empty State', () => {
    it('should handle empty options array', () => {
      renderWithProvider(<Select id="test-select" options={[]} />)

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    it('should show empty message in custom select', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={[]}
          customSelect
          emptyMessage="No options available"
        />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      expect(screen.getByText('No options available')).toBeInTheDocument()
    })
  })

  describe('Custom Select Mode', () => {
    it('should render custom select when customSelect is true', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} customSelect />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveClass('select--custom')
    })

    it('should open dropdown on click', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} customSelect />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      expect(trigger).toHaveClass('select--open')
    })

    it('should render options in dropdown', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} customSelect />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })

    it('should select option on click', () => {
      const handleChange = vi.fn()
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          onChange={handleChange}
        />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      const option = screen.getByText('Option 2')
      fireEvent.click(option)

      expect(handleChange).toHaveBeenCalled()
    })

    it('should close dropdown after selection', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} customSelect />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      const option = screen.getByText('Option 2')
      fireEvent.click(option)

      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('should close dropdown on outside click', () => {
      renderWithProvider(
        <div data-testid="outside">
          <Select id="test-select" options={simpleOptions} customSelect />
        </div>
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      expect(trigger).toHaveAttribute('aria-expanded', 'true')

      const outside = screen.getByTestId('outside')
      fireEvent.mouseDown(outside)

      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('should show selected value in trigger', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          value="option2"
          onChange={vi.fn()}
        />
      )

      expect(screen.getByText('Option 2')).toBeInTheDocument()
    })

    it('should render icons in options', () => {
      const optionsWithIcons: SelectOption[] = [
        { value: 'option1', label: 'Option 1', icon: <span data-testid="icon1">📧</span> },
        { value: 'option2', label: 'Option 2', icon: <span data-testid="icon2">📱</span> }
      ]

      renderWithProvider(
        <Select id="test-select" options={optionsWithIcons} customSelect />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      expect(screen.getByTestId('icon1')).toBeInTheDocument()
      expect(screen.getByTestId('icon2')).toBeInTheDocument()
    })

    it('should render option descriptions', () => {
      const optionsWithDesc: SelectOption[] = [
        { value: 'option1', label: 'Option 1', description: 'Description 1' },
        { value: 'option2', label: 'Option 2', description: 'Description 2' }
      ]

      renderWithProvider(
        <Select id="test-select" options={optionsWithDesc} customSelect />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      expect(screen.getByText('Description 1')).toBeInTheDocument()
      expect(screen.getByText('Description 2')).toBeInTheDocument()
    })
  })

  describe('Searchable Select', () => {
    it('should render search input when searchable', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} customSelect searchable />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      const searchInput = screen.getByPlaceholderText('Search options...')
      expect(searchInput).toBeInTheDocument()
    })

    it('should filter options based on search query', async () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} customSelect searchable />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      const searchInput = screen.getByPlaceholderText('Search options...')
      await user.type(searchInput, 'Option 2')

      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Option 3')).not.toBeInTheDocument()
    })

    it('should use custom search placeholder', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          searchable
          searchPlaceholder="Find option..."
        />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      expect(screen.getByPlaceholderText('Find option...')).toBeInTheDocument()
    })
  })

  describe('Multi-Select', () => {
    it('should allow multiple selections', () => {
      const handleChange = vi.fn()
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          multiple
          onChange={handleChange}
        />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      const option1 = screen.getByText('Option 1')
      const option2 = screen.getByText('Option 2')

      fireEvent.click(option1)
      fireEvent.click(option2)

      expect(handleChange).toHaveBeenCalledTimes(2)
    })

    it('should show check icon for selected options', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          multiple
          value={['option1']}
          onChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      const checkIcons = screen.getAllByTestId('check-icon')
      expect(checkIcons.length).toBeGreaterThan(0)
    })

    it('should show selected count in trigger', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          multiple
          value={['option1', 'option2']}
          onChange={vi.fn()}
        />
      )

      expect(screen.getByText('2 selected')).toBeInTheDocument()
    })

    it('should respect maxSelections limit', () => {
      const handleChange = vi.fn()
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          multiple
          maxSelections={2}
          onChange={handleChange}
        />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      const option1 = screen.getByText('Option 1')
      const option2 = screen.getByText('Option 2')
      const option3 = screen.getByText('Option 3')

      fireEvent.click(option1)
      fireEvent.click(option2)
      fireEvent.click(option3) // Should not trigger

      expect(handleChange).toHaveBeenCalledTimes(2)
    })

    it('should deselect option on second click', () => {
      const handleChange = vi.fn()
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          multiple
          onChange={handleChange}
        />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      const option1 = screen.getByText('Option 1')

      fireEvent.click(option1) // Select
      fireEvent.click(option1) // Deselect

      expect(handleChange).toHaveBeenCalledTimes(2)
    })
  })

  describe('Clearable Select', () => {
    it('should show clear button when clearable and has value', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          clearable
          value="option1"
          onChange={vi.fn()}
        />
      )

      const clearButton = screen.getByLabelText('Clear selection')
      expect(clearButton).toBeInTheDocument()
    })

    it('should not show clear button when no value', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          clearable
        />
      )

      expect(screen.queryByLabelText('Clear selection')).not.toBeInTheDocument()
    })

    it('should clear selection on clear button click', () => {
      const handleChange = vi.fn()
      const { rerender } = renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          clearable
          value="option1"
          onChange={handleChange}
        />
      )

      const clearButton = screen.getByLabelText('Clear selection')
      fireEvent.click(clearButton)

      // The component internally sets selectedValues to []
      // We need to verify the behavior by checking if onChange was called
      expect(screen.queryByLabelText('Clear selection')).not.toBeInTheDocument()
    })
  })

  describe('Imperative API', () => {
    it('should expose getState method', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select
          ref={ref}
          id="test-select"
          options={simpleOptions}
          state="success"
        />
      )

      expect(ref.current?.getState()).toBe('success')
    })

    it('should expose setState method', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select ref={ref} id="test-select" options={simpleOptions} />
      )

      ref.current?.setState('error')

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('data-state', 'error')
    })

    it('should expose setSuccess method', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select ref={ref} id="test-select" options={simpleOptions} />
      )

      ref.current?.setSuccess('Success!')

      expect(screen.getByText('Success!')).toBeInTheDocument()
    })

    it('should expose setError method', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select ref={ref} id="test-select" options={simpleOptions} />
      )

      ref.current?.setError('Error!')

      expect(screen.getByText('Error!')).toBeInTheDocument()
    })

    it('should expose reset method', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select ref={ref} id="test-select" options={simpleOptions} state="error" />
      )

      ref.current?.reset()

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('data-state', 'idle')
    })

    it('should expose focus method', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select ref={ref} id="test-select" options={simpleOptions} />
      )

      ref.current?.focus()

      const select = screen.getByRole('combobox')
      expect(select).toHaveFocus()
    })

    it('should expose getValue method', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select
          ref={ref}
          id="test-select"
          options={simpleOptions}
          value="option2"
          onChange={vi.fn()}
        />
      )

      expect(ref.current?.getValue()).toBe('option2')
    })

    it('should expose setValue method', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select ref={ref} id="test-select" options={simpleOptions} />
      )

      ref.current?.setValue('option3')

      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('option3')
    })

    it('should expose validate method', () => {
      const handleValidate = vi.fn((value: string) => ({
        isValid: value !== '',
        error: 'Required'
      }))

      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select
          ref={ref}
          id="test-select"
          options={simpleOptions}
          onValidate={handleValidate}
        />
      )

      ref.current?.setValue('')
      const isValid = ref.current?.validate()

      expect(isValid).toBe(false)
      expect(handleValidate).toHaveBeenCalled()
    })

    it('should expose open method for custom select', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select ref={ref} id="test-select" options={simpleOptions} customSelect />
      )

      ref.current?.open()

      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
    })

    it('should expose close method for custom select', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select ref={ref} id="test-select" options={simpleOptions} customSelect />
      )

      ref.current?.open()
      ref.current?.close()

      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('should expose clear method', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select
          ref={ref}
          id="test-select"
          options={simpleOptions}
          value="option1"
          onChange={vi.fn()}
        />
      )

      ref.current?.clear()

      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('')
    })
  })

  describe('Accessibility', () => {
    it('should have accessible name from label', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} label="Choose Option" />
      )

      const select = screen.getByLabelText('Choose Option')
      expect(select).toBeInTheDocument()
    })

    it('should have accessible name from aria-label', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} aria-label="Select" />
      )

      const select = screen.getByLabelText('Select')
      expect(select).toBeInTheDocument()
    })

    it('should have aria-invalid when in error state', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} state="error" />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('aria-invalid', 'true')
    })

    it('should have aria-describedby for error message', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="error"
          errorMessage="Error"
        />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('aria-describedby', 'test-select-error')
    })

    it('should announce error messages to screen readers', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="error"
          errorMessage="Invalid selection"
        />
      )

      const errorMessage = screen.getByText('Invalid selection')
      expect(errorMessage).toHaveAttribute('role', 'alert')
    })

    it('should have proper ARIA attributes for custom select', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} customSelect />
      )

      const trigger = screen.getByRole('combobox')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    })

    it('should mark options with aria-selected', () => {
      renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          customSelect
          value="option1"
          onChange={vi.fn()}
        />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      const selectedOption = screen.getByText('Option 1').closest('[role="option"]')
      expect(selectedOption).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty options array gracefully', () => {
      renderWithProvider(<Select id="test-select" options={[]} />)

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    it('should handle rapid state changes', () => {
      const ref = React.createRef<SelectRef>()
      renderWithProvider(
        <Select ref={ref} id="test-select" options={simpleOptions} />
      )

      ref.current?.setState('loading')
      ref.current?.setState('success')
      ref.current?.setState('error')
      ref.current?.setState('idle')

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('data-state', 'idle')
    })

    it('should clean up timeouts on unmount', () => {
      const { unmount } = renderWithProvider(
        <Select
          id="test-select"
          options={simpleOptions}
          state="error"
          errorDismissAfter={5000}
        />
      )

      unmount()
      vi.advanceTimersByTime(5000)
      // Test passes if no errors thrown
    })

    it('should handle validation without onValidate prop', async () => {
      renderWithProvider(<Select id="test-select" options={simpleOptions} />)

      const select = screen.getByRole('combobox')
      await user.click(select)
      await user.tab()

      // Should not crash
      expect(select).toBeInTheDocument()
    })

    it('should handle disabled options in custom select', () => {
      const optionsWithDisabled: SelectOption[] = [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2', disabled: true },
        { value: 'option3', label: 'Option 3' }
      ]

      const handleChange = vi.fn()
      renderWithProvider(
        <Select
          id="test-select"
          options={optionsWithDisabled}
          customSelect
          onChange={handleChange}
        />
      )

      const trigger = screen.getByRole('combobox')
      fireEvent.click(trigger)

      const disabledOption = screen.getByText('Option 2')
      fireEvent.click(disabledOption)

      // Should not trigger onChange for disabled option
      expect(handleChange).not.toHaveBeenCalled()
    })
  })

  describe('Name Attribute', () => {
    it('should apply name attribute', () => {
      renderWithProvider(
        <Select id="test-select" options={simpleOptions} name="category" />
      )

      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('name', 'category')
    })

    it('should work with forms', () => {
      renderWithProvider(
        <form data-testid="test-form">
          <Select id="test-select" options={simpleOptions} name="choice" />
        </form>
      )

      const form = screen.getByTestId('test-form')
      const select = screen.getByRole('combobox')

      expect(form).toContainElement(select)
      expect(select).toHaveAttribute('name', 'choice')
    })
  })
})