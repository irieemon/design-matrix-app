/**
 * Input Component Tests
 *
 * Comprehensive tests for the enhanced Input component covering:
 * - Value binding and onChange handlers
 * - Placeholder display and text input
 * - Disabled states (component, loading, explicit)
 * - Error states and validation integration
 * - Success states and messages
 * - Required field indicators
 * - Label associations and accessibility
 * - Focus management and keyboard interaction
 * - AutoComplete attributes
 * - Max length handling
 * - Icon rendering (before/after)
 * - Helper text display
 * - Error auto-dismiss functionality
 * - State management and imperative API
 * - Edge cases (long input, special characters, rapid changes)
 *
 * Business Impact: Form input reliability, data validation, user experience
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input, InputRef } from '../Input'
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

describe('Input Component', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic Rendering', () => {
    it('should render input with default props', () => {
      renderWithProvider(<Input id="test-input" />)

      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveClass('input')
    })

    it('should render with custom className', () => {
      renderWithProvider(<Input id="test-input" className="custom-class" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-class')
    })

    it('should render with containerClassName', () => {
      const { container } = renderWithProvider(
        <Input id="test-input" containerClassName="custom-container" />
      )

      const containerDiv = container.querySelector('.custom-container')
      expect(containerDiv).toBeInTheDocument()
    })

    it('should render full width input', () => {
      renderWithProvider(<Input id="test-input" fullWidth />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('input--full-width')
    })

    it('should apply variant classes', () => {
      renderWithProvider(<Input id="test-input" variant="secondary" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('data-variant', 'secondary')
    })

    it('should apply size classes', () => {
      renderWithProvider(<Input id="test-input" size="lg" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('data-size', 'lg')
    })

    it('should apply state data attribute', () => {
      renderWithProvider(<Input id="test-input" state="success" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('data-state', 'success')
    })
  })

  describe('Label and Required Field Indicators', () => {
    it('should render label when provided', () => {
      renderWithProvider(<Input id="test-input" label="Username" />)

      expect(screen.getByText('Username')).toBeInTheDocument()
    })

    it('should associate label with input', () => {
      renderWithProvider(<Input id="test-input" label="Username" />)

      const label = screen.getByText('Username')
      expect(label).toHaveAttribute('for', 'test-input')
    })

    it('should show required indicator when required', () => {
      renderWithProvider(<Input id="test-input" label="Username" required />)

      const requiredIndicator = screen.getByText('*')
      expect(requiredIndicator).toBeInTheDocument()
      expect(requiredIndicator).toHaveClass('input-label__required')
    })

    it('should not show required indicator when not required', () => {
      renderWithProvider(<Input id="test-input" label="Username" />)

      expect(screen.queryByText('*')).not.toBeInTheDocument()
    })

    it('should work without label', () => {
      renderWithProvider(<Input id="test-input" aria-label="Username" />)

      const input = screen.getByLabelText('Username')
      expect(input).toBeInTheDocument()
    })
  })

  describe('Value Binding and onChange', () => {
    it('should bind value prop', () => {
      renderWithProvider(<Input id="test-input" value="test value" onChange={vi.fn()} />)

      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.value).toBe('test value')
    })

    it('should call onChange when value changes', async () => {
      const handleChange = vi.fn()
      renderWithProvider(<Input id="test-input" onChange={handleChange} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')

      expect(handleChange).toHaveBeenCalledTimes(4) // Once per character
    })

    it('should update value on user input', async () => {
      const handleChange = vi.fn()
      renderWithProvider(<Input id="test-input" onChange={handleChange} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'hello')

      expect(handleChange).toHaveBeenCalled()
      const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0]
      expect(lastCall.target.value).toBe('hello')
    })

    it('should handle controlled input updates', () => {
      const { rerender } = renderWithProvider(
        <Input id="test-input" value="initial" onChange={vi.fn()} />
      )

      let input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.value).toBe('initial')

      rerender(
        <ComponentStateProvider>
          <Input id="test-input" value="updated" onChange={vi.fn()} />
        </ComponentStateProvider>
      )

      input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.value).toBe('updated')
    })

    it('should work as uncontrolled input with defaultValue', () => {
      renderWithProvider(<Input id="test-input" defaultValue="default" />)

      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.value).toBe('default')
    })
  })

  describe('Placeholder Display', () => {
    it('should display placeholder text', () => {
      renderWithProvider(<Input id="test-input" placeholder="Enter your name" />)

      const input = screen.getByPlaceholderText('Enter your name')
      expect(input).toBeInTheDocument()
    })

    it('should hide placeholder when value exists', async () => {
      renderWithProvider(<Input id="test-input" placeholder="Enter text" />)

      const input = screen.getByPlaceholderText('Enter text')
      await user.type(input, 'test')

      expect(input).toHaveValue('test')
    })
  })

  describe('Disabled States', () => {
    it('should be disabled when disabled prop is true', () => {
      renderWithProvider(<Input id="test-input" disabled />)

      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    it('should be disabled when state is disabled', () => {
      renderWithProvider(<Input id="test-input" state="disabled" />)

      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    it('should be disabled when state is loading', () => {
      renderWithProvider(<Input id="test-input" state="loading" />)

      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    it('should not call onChange when disabled', async () => {
      const handleChange = vi.fn()
      renderWithProvider(<Input id="test-input" disabled onChange={handleChange} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')

      expect(handleChange).not.toHaveBeenCalled()
    })

    it('should show loading spinner when loading', () => {
      const { container } = renderWithProvider(<Input id="test-input" state="loading" />)

      const spinner = container.querySelector('.loading-spinner')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Error States and Validation', () => {
    it('should display error message', () => {
      renderWithProvider(
        <Input id="test-input" state="error" errorMessage="Invalid input" />
      )

      expect(screen.getByText('Invalid input')).toBeInTheDocument()
    })

    it('should apply error styling', () => {
      renderWithProvider(
        <Input id="test-input" state="error" errorMessage="Error" />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('data-state', 'error')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('should associate error message with input', () => {
      renderWithProvider(
        <Input id="test-input" state="error" errorMessage="Error message" />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'test-input-error')
    })

    it('should clear error on typing', async () => {
      const { rerender } = renderWithProvider(
        <Input id="test-input" state="error" errorMessage="Error" />
      )

      let input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('data-state', 'error')

      await user.type(input, 'text')

      // Error should be cleared
      await waitFor(() => {
        input = screen.getByRole('textbox')
        expect(input).toHaveAttribute('data-state', 'idle')
      })
    })

    it('should clear error on focus', async () => {
      renderWithProvider(
        <Input id="test-input" state="error" errorMessage="Error" />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('data-state', 'error')

      await user.click(input)

      await waitFor(() => {
        expect(input).toHaveAttribute('data-state', 'idle')
      })
    })

    it('should validate on blur', async () => {
      const handleValidate = vi.fn((value: string) => ({
        isValid: value.length >= 3,
        error: value.length < 3 ? 'Minimum 3 characters' : undefined
      }))

      renderWithProvider(
        <Input id="test-input" onValidate={handleValidate} />
      )

      const input = screen.getByRole('textbox')
      await user.type(input, 'ab')
      await user.tab()

      expect(handleValidate).toHaveBeenCalledWith('ab')
      await waitFor(() => {
        expect(screen.getByText('Minimum 3 characters')).toBeInTheDocument()
      })
    })

    it('should pass validation on blur with valid input', async () => {
      const handleValidate = vi.fn((value: string) => ({
        isValid: value.length >= 3,
        error: value.length < 3 ? 'Minimum 3 characters' : undefined
      }))

      renderWithProvider(
        <Input id="test-input" onValidate={handleValidate} />
      )

      const input = screen.getByRole('textbox')
      await user.type(input, 'abc')
      await user.tab()

      expect(handleValidate).toHaveBeenCalledWith('abc')
      expect(screen.queryByText('Minimum 3 characters')).not.toBeInTheDocument()
    })

    it('should auto-dismiss error after timeout', async () => {
      renderWithProvider(
        <Input
          id="test-input"
          state="error"
          errorMessage="Error"
          errorDismissAfter={1000}
        />
      )

      expect(screen.getByText('Error')).toBeInTheDocument()

      vi.advanceTimersByTime(1000)

      await waitFor(() => {
        const input = screen.getByRole('textbox')
        expect(input).toHaveAttribute('data-state', 'idle')
      })
    })

    it('should call onStateChange when error occurs', () => {
      const handleStateChange = vi.fn()

      renderWithProvider(
        <Input
          id="test-input"
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
        <Input id="test-input" state="success" successMessage="Valid input" />
      )

      expect(screen.getByText('Valid input')).toBeInTheDocument()
    })

    it('should apply success styling', () => {
      renderWithProvider(
        <Input id="test-input" state="success" successMessage="Success" />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('data-state', 'success')
    })

    it('should associate success message with input', () => {
      renderWithProvider(
        <Input id="test-input" state="success" successMessage="Success" />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'test-input-success')
    })
  })

  describe('Helper Text', () => {
    it('should display helper text', () => {
      renderWithProvider(
        <Input id="test-input" helperText="Enter at least 3 characters" />
      )

      expect(screen.getByText('Enter at least 3 characters')).toBeInTheDocument()
    })

    it('should hide helper text when error message is shown', () => {
      renderWithProvider(
        <Input
          id="test-input"
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
        <Input
          id="test-input"
          helperText="Helper text"
          state="success"
          successMessage="Success message"
        />
      )

      expect(screen.getByText('Success message')).toBeInTheDocument()
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument()
    })

    it('should associate helper text with input', () => {
      renderWithProvider(
        <Input id="test-input" helperText="Helper text" />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'test-input-helper')
    })
  })

  describe('Icon Rendering', () => {
    it('should render icon before input', () => {
      const icon = <span data-testid="icon-before">📧</span>
      const { container } = renderWithProvider(
        <Input id="test-input" icon={icon} />
      )

      expect(screen.getByTestId('icon-before')).toBeInTheDocument()
      expect(container.querySelector('.input-icon--before')).toBeInTheDocument()
    })

    it('should render icon after input', () => {
      const icon = <span data-testid="icon-after">🔍</span>
      const { container } = renderWithProvider(
        <Input id="test-input" iconAfter={icon} />
      )

      expect(screen.getByTestId('icon-after')).toBeInTheDocument()
      expect(container.querySelector('.input-icon--after')).toBeInTheDocument()
    })

    it('should render both icons', () => {
      const iconBefore = <span data-testid="icon-before">📧</span>
      const iconAfter = <span data-testid="icon-after">🔍</span>

      renderWithProvider(
        <Input id="test-input" icon={iconBefore} iconAfter={iconAfter} />
      )

      expect(screen.getByTestId('icon-before')).toBeInTheDocument()
      expect(screen.getByTestId('icon-after')).toBeInTheDocument()
    })

    it('should apply icon classes to input', () => {
      const icon = <span>📧</span>
      renderWithProvider(<Input id="test-input" icon={icon} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('input--with-icon')
    })
  })

  describe('Focus Management', () => {
    it('should handle onFocus event', async () => {
      const handleFocus = vi.fn()
      renderWithProvider(<Input id="test-input" onFocus={handleFocus} />)

      const input = screen.getByRole('textbox')
      await user.click(input)

      expect(handleFocus).toHaveBeenCalled()
    })

    it('should handle onBlur event', async () => {
      const handleBlur = vi.fn()
      renderWithProvider(<Input id="test-input" onBlur={handleBlur} />)

      const input = screen.getByRole('textbox')
      await user.click(input)
      await user.tab()

      expect(handleBlur).toHaveBeenCalled()
    })

    it('should be focusable', async () => {
      renderWithProvider(<Input id="test-input" />)

      const input = screen.getByRole('textbox')
      await user.click(input)

      expect(input).toHaveFocus()
    })
  })

  describe('Keyboard Input', () => {
    it('should accept keyboard input', async () => {
      renderWithProvider(<Input id="test-input" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Hello World')

      expect(input).toHaveValue('Hello World')
    })

    it('should handle special characters', async () => {
      renderWithProvider(<Input id="test-input" />)

      const input = screen.getByRole('textbox')
      await user.type(input, '!@#$%^&*()')

      expect(input).toHaveValue('!@#$%^&*()')
    })

    it('should handle numbers', async () => {
      renderWithProvider(<Input id="test-input" type="number" />)

      const input = screen.getByRole('spinbutton')
      await user.type(input, '12345')

      expect(input).toHaveValue(12345)
    })

    it('should handle backspace', async () => {
      renderWithProvider(<Input id="test-input" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test{Backspace}')

      expect(input).toHaveValue('tes')
    })
  })

  describe('AutoComplete Attributes', () => {
    it('should apply autoComplete attribute', () => {
      renderWithProvider(<Input id="test-input" autoComplete="email" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('autocomplete', 'email')
    })

    it('should support off autoComplete', () => {
      renderWithProvider(<Input id="test-input" autoComplete="off" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('autocomplete', 'off')
    })

    it('should support name autocomplete', () => {
      renderWithProvider(<Input id="test-input" autoComplete="name" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('autocomplete', 'name')
    })
  })

  describe('Max Length Handling', () => {
    it('should apply maxLength attribute', () => {
      renderWithProvider(<Input id="test-input" maxLength={10} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('maxlength', '10')
    })

    it('should enforce maxLength', async () => {
      renderWithProvider(<Input id="test-input" maxLength={5} />)

      const input = screen.getByRole('textbox')
      await user.type(input, '123456789')

      expect(input).toHaveValue('12345')
    })
  })

  describe('Imperative API', () => {
    it('should expose getState method', () => {
      const ref = React.createRef<InputRef>()
      renderWithProvider(<Input ref={ref} id="test-input" state="success" />)

      expect(ref.current?.getState()).toBe('success')
    })

    it('should expose setState method', () => {
      const ref = React.createRef<InputRef>()
      renderWithProvider(<Input ref={ref} id="test-input" />)

      ref.current?.setState('error')

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('data-state', 'error')
    })

    it('should expose setSuccess method', () => {
      const ref = React.createRef<InputRef>()
      renderWithProvider(<Input ref={ref} id="test-input" />)

      ref.current?.setSuccess('Success!')

      expect(screen.getByText('Success!')).toBeInTheDocument()
    })

    it('should expose setError method', () => {
      const ref = React.createRef<InputRef>()
      renderWithProvider(<Input ref={ref} id="test-input" />)

      ref.current?.setError('Error!')

      expect(screen.getByText('Error!')).toBeInTheDocument()
    })

    it('should expose reset method', () => {
      const ref = React.createRef<InputRef>()
      renderWithProvider(<Input ref={ref} id="test-input" state="error" />)

      ref.current?.reset()

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('data-state', 'idle')
    })

    it('should expose focus method', () => {
      const ref = React.createRef<InputRef>()
      renderWithProvider(<Input ref={ref} id="test-input" />)

      ref.current?.focus()

      const input = screen.getByRole('textbox')
      expect(input).toHaveFocus()
    })

    it('should expose getValue method', async () => {
      const ref = React.createRef<InputRef>()
      renderWithProvider(<Input ref={ref} id="test-input" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test value')

      expect(ref.current?.getValue()).toBe('test value')
    })

    it('should expose setValue method', () => {
      const ref = React.createRef<InputRef>()
      renderWithProvider(<Input ref={ref} id="test-input" />)

      ref.current?.setValue('new value')

      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.value).toBe('new value')
    })

    it('should expose validate method', () => {
      const handleValidate = vi.fn((value: string) => ({
        isValid: value.length >= 3,
        error: 'Too short'
      }))

      const ref = React.createRef<InputRef>()
      renderWithProvider(<Input ref={ref} id="test-input" onValidate={handleValidate} />)

      ref.current?.setValue('ab')
      const isValid = ref.current?.validate()

      expect(isValid).toBe(false)
      expect(handleValidate).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible name from label', () => {
      renderWithProvider(<Input id="test-input" label="Username" />)

      const input = screen.getByLabelText('Username')
      expect(input).toBeInTheDocument()
    })

    it('should have accessible name from aria-label', () => {
      renderWithProvider(<Input id="test-input" aria-label="Search" />)

      const input = screen.getByLabelText('Search')
      expect(input).toBeInTheDocument()
    })

    it('should use label as default aria-label', () => {
      renderWithProvider(<Input id="test-input" label="Email" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-label', 'Email')
    })

    it('should have aria-invalid when in error state', () => {
      renderWithProvider(<Input id="test-input" state="error" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('should have aria-describedby for error message', () => {
      renderWithProvider(
        <Input id="test-input" state="error" errorMessage="Error" />
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'test-input-error')
    })

    it('should announce error messages to screen readers', () => {
      renderWithProvider(
        <Input id="test-input" state="error" errorMessage="Invalid email" />
      )

      const errorMessage = screen.getByText('Invalid email')
      expect(errorMessage).toHaveAttribute('role', 'alert')
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long input', async () => {
      renderWithProvider(<Input id="test-input" />)

      const longText = 'a'.repeat(1000)
      const input = screen.getByRole('textbox')
      await user.type(input, longText)

      expect(input).toHaveValue(longText)
    })

    it('should handle rapid typing', async () => {
      const handleChange = vi.fn()
      renderWithProvider(<Input id="test-input" onChange={handleChange} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'quicktyping', { delay: 1 })

      expect(handleChange).toHaveBeenCalledTimes('quicktyping'.length)
    })

    it('should handle empty value', () => {
      renderWithProvider(<Input id="test-input" value="" onChange={vi.fn()} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('')
    })

    it('should handle null value gracefully', () => {
      renderWithProvider(<Input id="test-input" value={undefined} />)

      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('should handle multiple state changes rapidly', () => {
      const ref = React.createRef<InputRef>()
      renderWithProvider(<Input ref={ref} id="test-input" />)

      ref.current?.setState('loading')
      ref.current?.setState('success')
      ref.current?.setState('error')
      ref.current?.setState('idle')

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('data-state', 'idle')
    })

    it('should clean up timeouts on unmount', () => {
      const { unmount } = renderWithProvider(
        <Input id="test-input" state="error" errorDismissAfter={5000} />
      )

      unmount()
      vi.advanceTimersByTime(5000)
      // Test passes if no errors thrown
    })

    it('should handle validation without onValidate prop', async () => {
      renderWithProvider(<Input id="test-input" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      await user.tab()

      // Should not crash
      expect(input).toBeInTheDocument()
    })
  })

  describe('Type Attributes', () => {
    it('should support text type', () => {
      renderWithProvider(<Input id="test-input" type="text" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'text')
    })

    it('should support email type', () => {
      renderWithProvider(<Input id="test-input" type="email" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'email')
    })

    it('should support password type', () => {
      const { container } = renderWithProvider(<Input id="test-input" type="password" />)

      const input = container.querySelector('input[type="password"]')
      expect(input).toBeInTheDocument()
    })

    it('should support number type', () => {
      renderWithProvider(<Input id="test-input" type="number" />)

      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('type', 'number')
    })

    it('should support tel type', () => {
      renderWithProvider(<Input id="test-input" type="tel" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'tel')
    })

    it('should support url type', () => {
      renderWithProvider(<Input id="test-input" type="url" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'url')
    })

    it('should support search type', () => {
      renderWithProvider(<Input id="test-input" type="search" />)

      const input = screen.getByRole('searchbox')
      expect(input).toHaveAttribute('type', 'search')
    })
  })

  describe('Name Attribute', () => {
    it('should apply name attribute', () => {
      renderWithProvider(<Input id="test-input" name="username" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('name', 'username')
    })

    it('should work with forms', () => {
      renderWithProvider(
        <form data-testid="test-form">
          <Input id="test-input" name="email" />
        </form>
      )

      const form = screen.getByTestId('test-form')
      const input = screen.getByRole('textbox')

      expect(form).toContainElement(input)
      expect(input).toHaveAttribute('name', 'email')
    })
  })
})