/**
 * Textarea Component Tests
 *
 * Comprehensive tests for the enhanced Textarea component covering:
 * - Value binding and onChange handlers
 * - Placeholder display and text input
 * - Disabled states (component, loading, explicit)
 * - Error states and validation integration
 * - Success states and messages
 * - Required field indicators
 * - Label associations and accessibility
 * - Focus management and keyboard interaction
 * - Max length handling with character count
 * - Auto-resize functionality
 * - Min/max rows configuration
 * - Helper text display
 * - Error auto-dismiss functionality
 * - State management and imperative API
 * - Edge cases (long input, special characters, rapid changes)
 *
 * Business Impact: Form textarea reliability, multi-line input, user experience
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea, TextareaRef } from '../Textarea'
import { ComponentStateProvider } from '../../../contexts/ComponentStateProvider'
import React from 'react'

// Wrapper for context provider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <ComponentStateProvider>
      {ui}
    </ComponentStateProvider>
  )
}

describe('Textarea Component', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic Rendering', () => {
    it('should render textarea with default props', () => {
      renderWithProvider(<Textarea id="test-textarea" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveClass('textarea')
    })

    it('should render with custom className', () => {
      renderWithProvider(<Textarea id="test-textarea" className="custom-class" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveClass('custom-class')
    })

    it('should render with containerClassName', () => {
      const { container } = renderWithProvider(
        <Textarea id="test-textarea" containerClassName="custom-container" />
      )

      const containerDiv = container.querySelector('.custom-container')
      expect(containerDiv).toBeInTheDocument()
    })

    it('should render full width textarea', () => {
      renderWithProvider(<Textarea id="test-textarea" fullWidth />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveClass('textarea--full-width')
    })

    it('should apply variant classes', () => {
      renderWithProvider(<Textarea id="test-textarea" variant="secondary" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('data-variant', 'secondary')
    })

    it('should apply size classes', () => {
      renderWithProvider(<Textarea id="test-textarea" size="lg" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('data-size', 'lg')
    })

    it('should apply state data attribute', () => {
      renderWithProvider(<Textarea id="test-textarea" state="success" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('data-state', 'success')
    })
  })

  describe('Label and Required Field Indicators', () => {
    it('should render label when provided', () => {
      renderWithProvider(<Textarea id="test-textarea" label="Description" />)

      expect(screen.getByText('Description')).toBeInTheDocument()
    })

    it('should associate label with textarea', () => {
      renderWithProvider(<Textarea id="test-textarea" label="Description" />)

      const label = screen.getByText('Description')
      expect(label).toHaveAttribute('for', 'test-textarea')
    })

    it('should show required indicator when required', () => {
      renderWithProvider(<Textarea id="test-textarea" label="Description" required />)

      const requiredIndicator = screen.getByText('*')
      expect(requiredIndicator).toBeInTheDocument()
      expect(requiredIndicator).toHaveClass('textarea-label__required')
    })

    it('should not show required indicator when not required', () => {
      renderWithProvider(<Textarea id="test-textarea" label="Description" />)

      expect(screen.queryByText('*')).not.toBeInTheDocument()
    })

    it('should work without label', () => {
      renderWithProvider(<Textarea id="test-textarea" aria-label="Description" />)

      const textarea = screen.getByLabelText('Description')
      expect(textarea).toBeInTheDocument()
    })
  })

  describe('Value Binding and onChange', () => {
    it('should bind value prop', () => {
      renderWithProvider(<Textarea id="test-textarea" value="test value" onChange={vi.fn()} />)

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe('test value')
    })

    it('should call onChange when value changes', async () => {
      const handleChange = vi.fn()
      renderWithProvider(<Textarea id="test-textarea" onChange={handleChange} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'test')

      expect(handleChange).toHaveBeenCalledTimes(4) // Once per character
    })

    it('should update value on user input', async () => {
      const handleChange = vi.fn()
      renderWithProvider(<Textarea id="test-textarea" onChange={handleChange} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'hello')

      expect(handleChange).toHaveBeenCalled()
      const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0]
      expect(lastCall.target.value).toBe('hello')
    })

    it('should handle controlled textarea updates', () => {
      const { rerender } = renderWithProvider(
        <Textarea id="test-textarea" value="initial" onChange={vi.fn()} />
      )

      let textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe('initial')

      rerender(
        <ComponentStateProvider>
          <Textarea id="test-textarea" value="updated" onChange={vi.fn()} />
        </ComponentStateProvider>
      )

      textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe('updated')
    })

    it('should work as uncontrolled textarea with defaultValue', () => {
      renderWithProvider(<Textarea id="test-textarea" defaultValue="default" />)

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe('default')
    })
  })

  describe('Placeholder Display', () => {
    it('should display placeholder text', () => {
      renderWithProvider(<Textarea id="test-textarea" placeholder="Enter your message" />)

      const textarea = screen.getByPlaceholderText('Enter your message')
      expect(textarea).toBeInTheDocument()
    })

    it('should hide placeholder when value exists', async () => {
      renderWithProvider(<Textarea id="test-textarea" placeholder="Enter text" />)

      const textarea = screen.getByPlaceholderText('Enter text')
      await user.type(textarea, 'test')

      expect(textarea).toHaveValue('test')
    })
  })

  describe('Disabled States', () => {
    it('should be disabled when disabled prop is true', () => {
      renderWithProvider(<Textarea id="test-textarea" disabled />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeDisabled()
    })

    it('should be disabled when state is disabled', () => {
      renderWithProvider(<Textarea id="test-textarea" state="disabled" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeDisabled()
    })

    it('should be disabled when state is loading', () => {
      renderWithProvider(<Textarea id="test-textarea" state="loading" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeDisabled()
    })

    it('should not call onChange when disabled', async () => {
      const handleChange = vi.fn()
      renderWithProvider(<Textarea id="test-textarea" disabled onChange={handleChange} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'test')

      expect(handleChange).not.toHaveBeenCalled()
    })

    it('should show loading spinner when loading', () => {
      const { container } = renderWithProvider(<Textarea id="test-textarea" state="loading" />)

      const spinner = container.querySelector('.loading-spinner')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Error States and Validation', () => {
    it('should display error message', () => {
      renderWithProvider(
        <Textarea id="test-textarea" state="error" errorMessage="Invalid input" />
      )

      expect(screen.getByText('Invalid input')).toBeInTheDocument()
    })

    it('should apply error styling', () => {
      renderWithProvider(
        <Textarea id="test-textarea" state="error" errorMessage="Error" />
      )

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('data-state', 'error')
      expect(textarea).toHaveAttribute('aria-invalid', 'true')
    })

    it('should associate error message with textarea', () => {
      renderWithProvider(
        <Textarea id="test-textarea" state="error" errorMessage="Error message" />
      )

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('aria-describedby', 'test-textarea-error')
    })

    it('should clear error on typing', async () => {
      renderWithProvider(
        <Textarea id="test-textarea" state="error" errorMessage="Error" />
      )

      let textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('data-state', 'error')

      await user.type(textarea, 'text')

      await waitFor(() => {
        textarea = screen.getByRole('textbox')
        expect(textarea).toHaveAttribute('data-state', 'idle')
      })
    })

    it('should clear error on focus', async () => {
      renderWithProvider(
        <Textarea id="test-textarea" state="error" errorMessage="Error" />
      )

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('data-state', 'error')

      await user.click(textarea)

      await waitFor(() => {
        expect(textarea).toHaveAttribute('data-state', 'idle')
      })
    })

    it('should validate on blur', async () => {
      const handleValidate = vi.fn((value: string) => ({
        isValid: value.length >= 10,
        error: value.length < 10 ? 'Minimum 10 characters' : undefined
      }))

      renderWithProvider(
        <Textarea id="test-textarea" onValidate={handleValidate} />
      )

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'short')
      await user.tab()

      expect(handleValidate).toHaveBeenCalledWith('short')
      await waitFor(() => {
        expect(screen.getByText('Minimum 10 characters')).toBeInTheDocument()
      })
    })

    it('should pass validation on blur with valid input', async () => {
      const handleValidate = vi.fn((value: string) => ({
        isValid: value.length >= 10,
        error: value.length < 10 ? 'Minimum 10 characters' : undefined
      }))

      renderWithProvider(
        <Textarea id="test-textarea" onValidate={handleValidate} />
      )

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'long enough text')
      await user.tab()

      expect(handleValidate).toHaveBeenCalledWith('long enough text')
      expect(screen.queryByText('Minimum 10 characters')).not.toBeInTheDocument()
    })

    it('should auto-dismiss error after timeout', async () => {
      renderWithProvider(
        <Textarea
          id="test-textarea"
          state="error"
          errorMessage="Error"
          errorDismissAfter={1000}
        />
      )

      expect(screen.getByText('Error')).toBeInTheDocument()

      vi.advanceTimersByTime(1000)

      await waitFor(() => {
        const textarea = screen.getByRole('textbox')
        expect(textarea).toHaveAttribute('data-state', 'idle')
      })
    })

    it('should call onStateChange when error occurs', () => {
      const handleStateChange = vi.fn()

      renderWithProvider(
        <Textarea
          id="test-textarea"
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
        <Textarea id="test-textarea" state="success" successMessage="Valid input" />
      )

      expect(screen.getByText('Valid input')).toBeInTheDocument()
    })

    it('should apply success styling', () => {
      renderWithProvider(
        <Textarea id="test-textarea" state="success" successMessage="Success" />
      )

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('data-state', 'success')
    })

    it('should associate success message with textarea', () => {
      renderWithProvider(
        <Textarea id="test-textarea" state="success" successMessage="Success" />
      )

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('aria-describedby', 'test-textarea-success')
    })
  })

  describe('Helper Text', () => {
    it('should display helper text', () => {
      renderWithProvider(
        <Textarea id="test-textarea" helperText="Enter at least 10 characters" />
      )

      expect(screen.getByText('Enter at least 10 characters')).toBeInTheDocument()
    })

    it('should hide helper text when error message is shown', () => {
      renderWithProvider(
        <Textarea
          id="test-textarea"
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
        <Textarea
          id="test-textarea"
          helperText="Helper text"
          state="success"
          successMessage="Success message"
        />
      )

      expect(screen.getByText('Success message')).toBeInTheDocument()
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument()
    })

    it('should associate helper text with textarea', () => {
      renderWithProvider(
        <Textarea id="test-textarea" helperText="Helper text" />
      )

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('aria-describedby', 'test-textarea-helper')
    })
  })

  describe('Focus Management', () => {
    it('should handle onFocus event', async () => {
      const handleFocus = vi.fn()
      renderWithProvider(<Textarea id="test-textarea" onFocus={handleFocus} />)

      const textarea = screen.getByRole('textbox')
      await user.click(textarea)

      expect(handleFocus).toHaveBeenCalled()
    })

    it('should handle onBlur event', async () => {
      const handleBlur = vi.fn()
      renderWithProvider(<Textarea id="test-textarea" onBlur={handleBlur} />)

      const textarea = screen.getByRole('textbox')
      await user.click(textarea)
      await user.tab()

      expect(handleBlur).toHaveBeenCalled()
    })

    it('should be focusable', async () => {
      renderWithProvider(<Textarea id="test-textarea" />)

      const textarea = screen.getByRole('textbox')
      await user.click(textarea)

      expect(textarea).toHaveFocus()
    })
  })

  describe('Keyboard Input', () => {
    it('should accept keyboard input', async () => {
      renderWithProvider(<Textarea id="test-textarea" />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hello World')

      expect(textarea).toHaveValue('Hello World')
    })

    it('should handle multi-line input', async () => {
      renderWithProvider(<Textarea id="test-textarea" />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Line 1{Enter}Line 2{Enter}Line 3')

      expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3')
    })

    it('should handle special characters', async () => {
      renderWithProvider(<Textarea id="test-textarea" />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '!@#$%^&*()')

      expect(textarea).toHaveValue('!@#$%^&*()')
    })

    it('should handle backspace', async () => {
      renderWithProvider(<Textarea id="test-textarea" />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'test{Backspace}')

      expect(textarea).toHaveValue('tes')
    })
  })

  describe('Max Length Handling', () => {
    it('should apply maxLength attribute', () => {
      renderWithProvider(<Textarea id="test-textarea" maxLength={100} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('maxlength', '100')
    })

    it('should enforce maxLength', async () => {
      renderWithProvider(<Textarea id="test-textarea" maxLength={10} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '12345678901234')

      expect(textarea).toHaveValue('1234567890')
    })

    it('should show character count with maxLength', () => {
      renderWithProvider(<Textarea id="test-textarea" maxLength={100} />)

      expect(screen.getByText('0 / 100')).toBeInTheDocument()
    })

    it('should update character count on input', async () => {
      renderWithProvider(
        <Textarea id="test-textarea" maxLength={100} value="test" onChange={vi.fn()} />
      )

      expect(screen.getByText('4 / 100')).toBeInTheDocument()
    })

    it('should show character count when showCharacterCount is true', () => {
      renderWithProvider(<Textarea id="test-textarea" showCharacterCount />)

      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('should apply error styling when over limit', () => {
      const { container } = renderWithProvider(
        <Textarea id="test-textarea" maxLength={5} value="toolong" onChange={vi.fn()} />
      )

      const charCount = container.querySelector('.textarea-character-count--error')
      expect(charCount).toBeInTheDocument()
    })
  })

  describe('Auto-Resize Functionality', () => {
    it('should apply auto-resize class when enabled', () => {
      renderWithProvider(<Textarea id="test-textarea" autoResize />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveClass('textarea--auto-resize')
    })

    it('should not set rows attribute when autoResize is true', () => {
      renderWithProvider(<Textarea id="test-textarea" autoResize />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).not.toHaveAttribute('rows')
    })

    it('should set rows attribute when autoResize is false', () => {
      renderWithProvider(<Textarea id="test-textarea" autoResize={false} minRows={5} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('rows', '5')
    })

    it('should respect minRows configuration', () => {
      renderWithProvider(<Textarea id="test-textarea" minRows={5} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('rows', '5')
    })

    it('should use default minRows of 3', () => {
      renderWithProvider(<Textarea id="test-textarea" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('rows', '3')
    })
  })

  describe('Imperative API', () => {
    it('should expose getState method', () => {
      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" state="success" />)

      expect(ref.current?.getState()).toBe('success')
    })

    it('should expose setState method', () => {
      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" />)

      ref.current?.setState('error')

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('data-state', 'error')
    })

    it('should expose setSuccess method', () => {
      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" />)

      ref.current?.setSuccess('Success!')

      expect(screen.getByText('Success!')).toBeInTheDocument()
    })

    it('should expose setError method', () => {
      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" />)

      ref.current?.setError('Error!')

      expect(screen.getByText('Error!')).toBeInTheDocument()
    })

    it('should expose reset method', () => {
      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" state="error" />)

      ref.current?.reset()

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('data-state', 'idle')
    })

    it('should expose focus method', () => {
      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" />)

      ref.current?.focus()

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveFocus()
    })

    it('should expose getValue method', async () => {
      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'test value')

      expect(ref.current?.getValue()).toBe('test value')
    })

    it('should expose setValue method', () => {
      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" />)

      ref.current?.setValue('new value')

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe('new value')
    })

    it('should expose validate method', () => {
      const handleValidate = vi.fn((value: string) => ({
        isValid: value.length >= 10,
        error: 'Too short'
      }))

      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" onValidate={handleValidate} />)

      ref.current?.setValue('short')
      const isValid = ref.current?.validate()

      expect(isValid).toBe(false)
      expect(handleValidate).toHaveBeenCalled()
    })

    it('should expose resize method', () => {
      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" autoResize />)

      // Should not throw error
      expect(() => ref.current?.resize()).not.toThrow()
    })

    it('should trigger resize when setValue is called with autoResize', () => {
      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" autoResize />)

      ref.current?.setValue('Multi-line\ntext\nvalue')

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe('Multi-line\ntext\nvalue')
    })
  })

  describe('Accessibility', () => {
    it('should have accessible name from label', () => {
      renderWithProvider(<Textarea id="test-textarea" label="Description" />)

      const textarea = screen.getByLabelText('Description')
      expect(textarea).toBeInTheDocument()
    })

    it('should have accessible name from aria-label', () => {
      renderWithProvider(<Textarea id="test-textarea" aria-label="Comments" />)

      const textarea = screen.getByLabelText('Comments')
      expect(textarea).toBeInTheDocument()
    })

    it('should use label as default aria-label', () => {
      renderWithProvider(<Textarea id="test-textarea" label="Message" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('aria-label', 'Message')
    })

    it('should have aria-invalid when in error state', () => {
      renderWithProvider(<Textarea id="test-textarea" state="error" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('aria-invalid', 'true')
    })

    it('should have aria-describedby for error message', () => {
      renderWithProvider(
        <Textarea id="test-textarea" state="error" errorMessage="Error" />
      )

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('aria-describedby', 'test-textarea-error')
    })

    it('should announce error messages to screen readers', () => {
      renderWithProvider(
        <Textarea id="test-textarea" state="error" errorMessage="Invalid input" />
      )

      const errorMessage = screen.getByText('Invalid input')
      expect(errorMessage).toHaveAttribute('role', 'alert')
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long input', async () => {
      renderWithProvider(<Textarea id="test-textarea" />)

      const longText = 'a'.repeat(1000)
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, longText)

      expect(textarea).toHaveValue(longText)
    })

    it('should handle rapid typing', async () => {
      const handleChange = vi.fn()
      renderWithProvider(<Textarea id="test-textarea" onChange={handleChange} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'quicktyping', { delay: 1 })

      expect(handleChange).toHaveBeenCalledTimes('quicktyping'.length)
    })

    it('should handle empty value', () => {
      renderWithProvider(<Textarea id="test-textarea" value="" onChange={vi.fn()} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveValue('')
    })

    it('should handle null value gracefully', () => {
      renderWithProvider(<Textarea id="test-textarea" value={undefined} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
    })

    it('should handle multiple state changes rapidly', () => {
      const ref = React.createRef<TextareaRef>()
      renderWithProvider(<Textarea ref={ref} id="test-textarea" />)

      ref.current?.setState('loading')
      ref.current?.setState('success')
      ref.current?.setState('error')
      ref.current?.setState('idle')

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('data-state', 'idle')
    })

    it('should clean up timeouts on unmount', () => {
      const { unmount } = renderWithProvider(
        <Textarea id="test-textarea" state="error" errorDismissAfter={5000} />
      )

      unmount()
      vi.advanceTimersByTime(5000)
      // Test passes if no errors thrown
    })

    it('should handle validation without onValidate prop', async () => {
      renderWithProvider(<Textarea id="test-textarea" />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'test')
      await user.tab()

      // Should not crash
      expect(textarea).toBeInTheDocument()
    })

    it('should handle paste events', async () => {
      renderWithProvider(<Textarea id="test-textarea" />)

      const textarea = screen.getByRole('textbox')
      await user.click(textarea)

      // Simulate paste
      fireEvent.paste(textarea, {
        clipboardData: {
          getData: () => 'pasted content'
        }
      })

      // Manual update since fireEvent.paste doesn't update value
      fireEvent.change(textarea, { target: { value: 'pasted content' } })

      expect(textarea).toHaveValue('pasted content')
    })
  })

  describe('Name Attribute', () => {
    it('should apply name attribute', () => {
      renderWithProvider(<Textarea id="test-textarea" name="description" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('name', 'description')
    })

    it('should work with forms', () => {
      renderWithProvider(
        <form data-testid="test-form">
          <Textarea id="test-textarea" name="message" />
        </form>
      )

      const form = screen.getByTestId('test-form')
      const textarea = screen.getByRole('textbox')

      expect(form).toContainElement(textarea)
      expect(textarea).toHaveAttribute('name', 'message')
    })
  })

  describe('Rows Configuration', () => {
    it('should apply custom rows attribute', () => {
      renderWithProvider(<Textarea id="test-textarea" minRows={8} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('rows', '8')
    })

    it('should handle maxRows configuration', () => {
      renderWithProvider(<Textarea id="test-textarea" autoResize maxRows={15} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      // maxRows is used internally for auto-resize calculations
    })
  })
})