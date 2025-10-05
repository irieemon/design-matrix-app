import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  CONTRAST_RATIOS,
  getRelativeLuminance,
  getContrastRatio,
  hexToRgb,
  meetsContrastRequirement,
  SEMANTIC_ELEMENTS,
  ARIA_ROLES,
  getAccessibleFieldProps,
  getAccessibleButtonProps,
  getAccessibleModalProps,
  getAccessibleListProps,
  getAccessibleDragProps,
  getAccessibleLandmarkProps,
  srUtils,
  keyboardUtils,
  ariaUtils,
  focusUtils
} from '../accessibility'

describe('accessibility.ts', () => {
  describe('CONTRAST_RATIOS', () => {
    it('should have correct AA normal contrast ratio', () => {
      expect(CONTRAST_RATIOS.AA_NORMAL).toBe(4.5)
    })

    it('should have correct AA large text contrast ratio', () => {
      expect(CONTRAST_RATIOS.AA_LARGE).toBe(3.0)
    })

    it('should have correct AAA normal contrast ratio', () => {
      expect(CONTRAST_RATIOS.AAA_NORMAL).toBe(7.0)
    })

    it('should have correct AAA large text contrast ratio', () => {
      expect(CONTRAST_RATIOS.AAA_LARGE).toBe(4.5)
    })
  })

  describe('hexToRgb', () => {
    it('should convert hex color to RGB object', () => {
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
    })

    it('should handle hex color without hash prefix', () => {
      expect(hexToRgb('000000')).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('should convert lowercase hex colors', () => {
      expect(hexToRgb('#ff5733')).toEqual({ r: 255, g: 87, b: 51 })
    })

    it('should convert uppercase hex colors', () => {
      expect(hexToRgb('#FF5733')).toEqual({ r: 255, g: 87, b: 51 })
    })

    it('should return null for invalid hex color', () => {
      expect(hexToRgb('invalid')).toBeNull()
    })

    it('should return null for short hex format', () => {
      expect(hexToRgb('#fff')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(hexToRgb('')).toBeNull()
    })
  })

  describe('getRelativeLuminance', () => {
    it('should calculate luminance for white', () => {
      const luminance = getRelativeLuminance(255, 255, 255)
      expect(luminance).toBeCloseTo(1, 5)
    })

    it('should calculate luminance for black', () => {
      const luminance = getRelativeLuminance(0, 0, 0)
      expect(luminance).toBe(0)
    })

    it('should calculate luminance for red', () => {
      const luminance = getRelativeLuminance(255, 0, 0)
      expect(luminance).toBeGreaterThan(0)
      expect(luminance).toBeLessThan(1)
    })

    it('should handle sRGB values below threshold', () => {
      const luminance = getRelativeLuminance(10, 10, 10)
      expect(luminance).toBeGreaterThan(0)
    })

    it('should use gamma correction for values above threshold', () => {
      const luminance = getRelativeLuminance(128, 128, 128)
      expect(luminance).toBeGreaterThan(0)
      expect(luminance).toBeLessThan(1)
    })
  })

  describe('getContrastRatio', () => {
    it('should calculate contrast ratio for black and white', () => {
      const ratio = getContrastRatio('#000000', '#ffffff')
      expect(ratio).toBeCloseTo(21, 0)
    })

    it('should calculate contrast ratio for white and black', () => {
      const ratio = getContrastRatio('#ffffff', '#000000')
      expect(ratio).toBeCloseTo(21, 0)
    })

    it('should return 1 for same colors', () => {
      const ratio = getContrastRatio('#555555', '#555555')
      expect(ratio).toBeCloseTo(1, 0)
    })

    it('should handle invalid color and return 1', () => {
      const ratio = getContrastRatio('invalid', '#ffffff')
      expect(ratio).toBe(1)
    })

    it('should calculate ratio for blue and white', () => {
      const ratio = getContrastRatio('#0000ff', '#ffffff')
      expect(ratio).toBeGreaterThan(7)
    })

    it('should be symmetric regardless of color order', () => {
      const ratio1 = getContrastRatio('#ff0000', '#00ff00')
      const ratio2 = getContrastRatio('#00ff00', '#ff0000')
      expect(ratio1).toBeCloseTo(ratio2, 5)
    })
  })

  describe('meetsContrastRequirement', () => {
    it('should pass AA normal for high contrast', () => {
      expect(meetsContrastRequirement('#000000', '#ffffff', 'AA', false)).toBe(true)
    })

    it('should pass AA large text for medium contrast', () => {
      expect(meetsContrastRequirement('#767676', '#ffffff', 'AA', true)).toBe(true)
    })

    it('should fail AA normal for low contrast', () => {
      expect(meetsContrastRequirement('#cccccc', '#ffffff', 'AA', false)).toBe(false)
    })

    it('should pass AAA for very high contrast', () => {
      expect(meetsContrastRequirement('#000000', '#ffffff', 'AAA', false)).toBe(true)
    })

    it('should fail AAA for medium contrast', () => {
      expect(meetsContrastRequirement('#767676', '#ffffff', 'AAA', false)).toBe(false)
    })

    it('should default to AA level when not specified', () => {
      const result = meetsContrastRequirement('#000000', '#ffffff')
      expect(result).toBe(true)
    })

    it('should default to normal text size when not specified', () => {
      const result = meetsContrastRequirement('#767676', '#ffffff', 'AA')
      expect(result).toBe(false)
    })
  })

  describe('SEMANTIC_ELEMENTS', () => {
    it('should map navigation to nav', () => {
      expect(SEMANTIC_ELEMENTS.navigation).toBe('nav')
    })

    it('should map main to main', () => {
      expect(SEMANTIC_ELEMENTS.main).toBe('main')
    })

    it('should have all required semantic mappings', () => {
      expect(SEMANTIC_ELEMENTS).toHaveProperty('navigation')
      expect(SEMANTIC_ELEMENTS).toHaveProperty('main')
      expect(SEMANTIC_ELEMENTS).toHaveProperty('complementary')
      expect(SEMANTIC_ELEMENTS).toHaveProperty('contentinfo')
      expect(SEMANTIC_ELEMENTS).toHaveProperty('banner')
    })
  })

  describe('ARIA_ROLES', () => {
    it('should have button role', () => {
      expect(ARIA_ROLES.button).toBe('button')
    })

    it('should have dialog role', () => {
      expect(ARIA_ROLES.dialog).toBe('dialog')
    })

    it('should have all common widget roles', () => {
      expect(ARIA_ROLES).toHaveProperty('checkbox')
      expect(ARIA_ROLES).toHaveProperty('radio')
      expect(ARIA_ROLES).toHaveProperty('textbox')
      expect(ARIA_ROLES).toHaveProperty('combobox')
    })
  })

  describe('getAccessibleFieldProps', () => {
    it('should return basic field properties', () => {
      const props = getAccessibleFieldProps('test-id', 'Test Label')
      expect(props.id).toBe('test-id')
      expect(props['aria-label']).toBe('Test Label')
      expect(props['aria-required']).toBe(false)
      expect(props['aria-invalid']).toBe(false)
    })

    it('should set required field', () => {
      const props = getAccessibleFieldProps('test-id', 'Test Label', { required: true })
      expect(props['aria-required']).toBe(true)
    })

    it('should set invalid field', () => {
      const props = getAccessibleFieldProps('test-id', 'Test Label', { invalid: true })
      expect(props['aria-invalid']).toBe(true)
    })

    it('should set disabled field', () => {
      const props = getAccessibleFieldProps('test-id', 'Test Label', { disabled: true })
      expect(props['aria-disabled']).toBe(true)
    })

    it('should set readonly field', () => {
      const props = getAccessibleFieldProps('test-id', 'Test Label', { readonly: true })
      expect(props['aria-readonly']).toBe(true)
    })

    it('should set describedBy', () => {
      const props = getAccessibleFieldProps('test-id', 'Test Label', { describedBy: 'desc-id' })
      expect(props['aria-describedby']).toBe('desc-id')
    })

    it('should use errorId when field is invalid', () => {
      const props = getAccessibleFieldProps('test-id', 'Test Label', { invalid: true, errorId: 'error-id' })
      expect(props['aria-describedby']).toBe('error-id')
    })

    it('should handle multiple options together', () => {
      const props = getAccessibleFieldProps('test-id', 'Test Label', {
        required: true,
        invalid: false,
        disabled: false,
        readonly: true
      })
      expect(props['aria-required']).toBe(true)
      expect(props['aria-readonly']).toBe(true)
    })
  })

  describe('getAccessibleButtonProps', () => {
    it('should return basic button properties', () => {
      const props = getAccessibleButtonProps('Click me')
      expect(props['aria-label']).toBe('Click me')
      expect(props['aria-disabled']).toBe(false)
      expect(props.type).toBe('button')
    })

    it('should set pressed state', () => {
      const props = getAccessibleButtonProps('Toggle', { pressed: true })
      expect(props['aria-pressed']).toBe(true)
    })

    it('should set expanded state', () => {
      const props = getAccessibleButtonProps('Expand', { expanded: false })
      expect(props['aria-expanded']).toBe(false)
    })

    it('should set disabled button', () => {
      const props = getAccessibleButtonProps('Disabled', { disabled: true })
      expect(props['aria-disabled']).toBe(true)
    })

    it('should set describedBy', () => {
      const props = getAccessibleButtonProps('Help', { describedBy: 'help-text' })
      expect(props['aria-describedby']).toBe('help-text')
    })

    it('should set controls', () => {
      const props = getAccessibleButtonProps('Menu', { controls: 'menu-id' })
      expect(props['aria-controls']).toBe('menu-id')
    })

    it('should not set pressed if undefined', () => {
      const props = getAccessibleButtonProps('Button')
      expect(props).not.toHaveProperty('aria-pressed')
    })
  })

  describe('getAccessibleModalProps', () => {
    it('should return basic modal properties', () => {
      const props = getAccessibleModalProps()
      expect(props.role).toBe('dialog')
      expect(props['aria-modal']).toBe(true)
      expect(props.tabIndex).toBe(-1)
    })

    it('should set labelledBy', () => {
      const props = getAccessibleModalProps('title-id')
      expect(props['aria-labelledby']).toBe('title-id')
    })

    it('should set describedBy', () => {
      const props = getAccessibleModalProps('title-id', 'desc-id')
      expect(props['aria-describedby']).toBe('desc-id')
    })

    it('should set modal to false for non-modal dialogs', () => {
      const props = getAccessibleModalProps(undefined, undefined, false)
      expect(props['aria-modal']).toBe(false)
    })

    it('should handle all parameters', () => {
      const props = getAccessibleModalProps('title-id', 'desc-id', true)
      expect(props['aria-labelledby']).toBe('title-id')
      expect(props['aria-describedby']).toBe('desc-id')
      expect(props['aria-modal']).toBe(true)
    })
  })

  describe('getAccessibleListProps', () => {
    it('should return basic list properties', () => {
      const props = getAccessibleListProps(5)
      expect(props.role).toBe('list')
      expect(props['aria-setsize']).toBe(5)
      expect(props['aria-orientation']).toBe('vertical')
    })

    it('should set horizontal orientation', () => {
      const props = getAccessibleListProps(3, { orientation: 'horizontal' })
      expect(props['aria-orientation']).toBe('horizontal')
    })

    it('should set multiSelectable', () => {
      const props = getAccessibleListProps(5, { multiSelectable: true })
      expect(props['aria-multiselectable']).toBe(true)
    })

    it('should set label', () => {
      const props = getAccessibleListProps(5, { label: 'Items list' })
      expect(props['aria-label']).toBe('Items list')
    })

    it('should not include multiSelectable when false', () => {
      const props = getAccessibleListProps(5, { multiSelectable: false })
      expect(props).not.toHaveProperty('aria-multiselectable')
    })
  })

  describe('getAccessibleDragProps', () => {
    it('should return basic drag properties', () => {
      const props = getAccessibleDragProps({ id: 'item-1', label: 'Draggable Item' })
      expect(props['aria-label']).toBe('Draggable Item')
      expect(props['aria-grabbed']).toBe(false)
      expect(props['aria-describedby']).toBe('item-1-instructions')
      expect(props.role).toBe('button')
      expect(props.tabIndex).toBe(0)
    })

    it('should set grabbed state when dragging', () => {
      const props = getAccessibleDragProps({ id: 'item-1', label: 'Item', isDragging: true })
      expect(props['aria-grabbed']).toBe(true)
    })

    it('should include position in role description', () => {
      const props = getAccessibleDragProps({
        id: 'item-1',
        label: 'Item',
        position: { x: 100.7, y: 200.3 }
      })
      expect(props['aria-roledescription']).toContain('101')
      expect(props['aria-roledescription']).toContain('200')
    })

    it('should not include role description without position', () => {
      const props = getAccessibleDragProps({ id: 'item-1', label: 'Item' })
      expect(props).not.toHaveProperty('aria-roledescription')
    })
  })

  describe('getAccessibleLandmarkProps', () => {
    it('should return landmark with role', () => {
      const props = getAccessibleLandmarkProps('navigation')
      expect(props.role).toBe('navigation')
    })

    it('should add label when provided', () => {
      const props = getAccessibleLandmarkProps('navigation', 'Main Navigation')
      expect(props['aria-label']).toBe('Main Navigation')
    })

    it('should work with different landmark types', () => {
      const mainProps = getAccessibleLandmarkProps('main')
      expect(mainProps.role).toBe('main')

      const searchProps = getAccessibleLandmarkProps('search')
      expect(searchProps.role).toBe('search')
    })
  })

  describe('srUtils', () => {
    describe('srOnlyClass', () => {
      it('should contain sr-only class', () => {
        expect(srUtils.srOnlyClass).toContain('sr-only')
      })

      it('should contain accessibility hiding styles', () => {
        expect(srUtils.srOnlyClass).toContain('absolute')
        expect(srUtils.srOnlyClass).toContain('overflow-hidden')
      })
    })

    describe('getActionAnnouncement', () => {
      it('should create basic action announcement', () => {
        const announcement = srUtils.getActionAnnouncement('Delete', 'item')
        expect(announcement).toBe('Delete item')
      })

      it('should include result when provided', () => {
        const announcement = srUtils.getActionAnnouncement('Save', 'document', 'Saved successfully')
        expect(announcement).toBe('Save document. Saved successfully')
      })
    })

    describe('getStatusAnnouncement', () => {
      it('should create success announcement', () => {
        const announcement = srUtils.getStatusAnnouncement('success', 'Operation completed')
        expect(announcement).toBe('Success: Operation completed')
      })

      it('should create error announcement', () => {
        const announcement = srUtils.getStatusAnnouncement('error', 'Failed to load')
        expect(announcement).toBe('Error: Failed to load')
      })

      it('should create warning announcement', () => {
        const announcement = srUtils.getStatusAnnouncement('warning', 'Check your input')
        expect(announcement).toBe('Warning: Check your input')
      })

      it('should create info announcement', () => {
        const announcement = srUtils.getStatusAnnouncement('info', 'New update available')
        expect(announcement).toBe('Information: New update available')
      })
    })
  })

  describe('keyboardUtils', () => {
    describe('isActionKey', () => {
      it('should return true for Enter key', () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' })
        expect(keyboardUtils.isActionKey(event)).toBe(true)
      })

      it('should return true for Space key', () => {
        const event = new KeyboardEvent('keydown', { key: ' ' })
        expect(keyboardUtils.isActionKey(event)).toBe(true)
      })

      it('should return false for other keys', () => {
        const event = new KeyboardEvent('keydown', { key: 'a' })
        expect(keyboardUtils.isActionKey(event)).toBe(false)
      })
    })

    describe('isNavigationKey', () => {
      it('should return true for arrow keys', () => {
        expect(keyboardUtils.isNavigationKey(new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toBe(true)
        expect(keyboardUtils.isNavigationKey(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(true)
        expect(keyboardUtils.isNavigationKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))).toBe(true)
        expect(keyboardUtils.isNavigationKey(new KeyboardEvent('keydown', { key: 'ArrowRight' }))).toBe(true)
      })

      it('should return true for Home and End', () => {
        expect(keyboardUtils.isNavigationKey(new KeyboardEvent('keydown', { key: 'Home' }))).toBe(true)
        expect(keyboardUtils.isNavigationKey(new KeyboardEvent('keydown', { key: 'End' }))).toBe(true)
      })

      it('should return false for non-navigation keys', () => {
        expect(keyboardUtils.isNavigationKey(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false)
      })
    })

    describe('isEscapeKey', () => {
      it('should return true for Escape key', () => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' })
        expect(keyboardUtils.isEscapeKey(event)).toBe(true)
      })

      it('should return false for other keys', () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' })
        expect(keyboardUtils.isEscapeKey(event)).toBe(false)
      })
    })

    describe('getArrowDirection', () => {
      it('should return up for ArrowUp', () => {
        expect(keyboardUtils.getArrowDirection(new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toBe('up')
      })

      it('should return down for ArrowDown', () => {
        expect(keyboardUtils.getArrowDirection(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe('down')
      })

      it('should return left for ArrowLeft', () => {
        expect(keyboardUtils.getArrowDirection(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))).toBe('left')
      })

      it('should return right for ArrowRight', () => {
        expect(keyboardUtils.getArrowDirection(new KeyboardEvent('keydown', { key: 'ArrowRight' }))).toBe('right')
      })

      it('should return null for non-arrow keys', () => {
        expect(keyboardUtils.getArrowDirection(new KeyboardEvent('keydown', { key: 'Enter' }))).toBeNull()
      })
    })
  })

  describe('ariaUtils', () => {
    describe('generateId', () => {
      it('should generate unique IDs', () => {
        const id1 = ariaUtils.generateId()
        const id2 = ariaUtils.generateId()
        expect(id1).not.toBe(id2)
      })

      it('should use default prefix', () => {
        const id = ariaUtils.generateId()
        expect(id).toContain('aria-')
      })

      it('should use custom prefix', () => {
        const id = ariaUtils.generateId('custom')
        expect(id).toContain('custom-')
      })
    })

    describe('createDescription', () => {
      beforeEach(() => {
        document.body.innerHTML = ''
      })

      it('should create description element', () => {
        const element = ariaUtils.createDescription('test-id', 'Test description')
        expect(element.id).toBe('test-id')
        expect(element.textContent).toBe('Test description')
        expect(element.className).toBe('sr-only')
      })

      it('should append element to body', () => {
        ariaUtils.createDescription('test-id', 'Test description')
        const element = document.getElementById('test-id')
        expect(element).toBeTruthy()
        expect(document.body.contains(element)).toBe(true)
      })
    })

    describe('removeDescription', () => {
      beforeEach(() => {
        document.body.innerHTML = ''
      })

      it('should remove existing element', () => {
        ariaUtils.createDescription('test-id', 'Test description')
        expect(document.getElementById('test-id')).toBeTruthy()

        ariaUtils.removeDescription('test-id')
        expect(document.getElementById('test-id')).toBeNull()
      })

      it('should not error when element does not exist', () => {
        expect(() => ariaUtils.removeDescription('non-existent')).not.toThrow()
      })
    })
  })

  describe('focusUtils', () => {
    beforeEach(() => {
      document.body.innerHTML = ''
    })

    describe('getFocusableElements', () => {
      it('should find focusable buttons', () => {
        document.body.innerHTML = `
          <div id="container">
            <button>Button 1</button>
            <button>Button 2</button>
          </div>
        `
        const container = document.getElementById('container') as HTMLElement
        const focusable = focusUtils.getFocusableElements(container)
        expect(focusable).toHaveLength(2)
      })

      it('should exclude disabled elements', () => {
        document.body.innerHTML = `
          <div id="container">
            <button>Enabled</button>
            <button disabled>Disabled</button>
          </div>
        `
        const container = document.getElementById('container') as HTMLElement
        const focusable = focusUtils.getFocusableElements(container)
        expect(focusable).toHaveLength(1)
      })

      it('should find links', () => {
        document.body.innerHTML = `
          <div id="container">
            <a href="#">Link</a>
          </div>
        `
        const container = document.getElementById('container') as HTMLElement
        const focusable = focusUtils.getFocusableElements(container)
        expect(focusable).toHaveLength(1)
      })

      it('should find input fields', () => {
        document.body.innerHTML = `
          <div id="container">
            <input type="text" />
            <textarea></textarea>
            <select><option>Option</option></select>
          </div>
        `
        const container = document.getElementById('container') as HTMLElement
        const focusable = focusUtils.getFocusableElements(container)
        expect(focusable).toHaveLength(3)
      })

      it('should find elements with positive tabindex', () => {
        document.body.innerHTML = `
          <div id="container">
            <div tabindex="0">Focusable div</div>
            <div tabindex="-1">Not focusable</div>
          </div>
        `
        const container = document.getElementById('container') as HTMLElement
        const focusable = focusUtils.getFocusableElements(container)
        expect(focusable).toHaveLength(1)
      })
    })

    describe('focusFirst', () => {
      it('should focus first focusable element', () => {
        document.body.innerHTML = `
          <div id="container">
            <button id="first">First</button>
            <button id="second">Second</button>
          </div>
        `
        const container = document.getElementById('container') as HTMLElement
        const result = focusUtils.focusFirst(container)
        expect(result).toBe(true)
        expect(document.activeElement?.id).toBe('first')
      })

      it('should return false when no focusable elements', () => {
        document.body.innerHTML = `<div id="container"></div>`
        const container = document.getElementById('container') as HTMLElement
        const result = focusUtils.focusFirst(container)
        expect(result).toBe(false)
      })
    })

    describe('focusLast', () => {
      it('should focus last focusable element', () => {
        document.body.innerHTML = `
          <div id="container">
            <button id="first">First</button>
            <button id="last">Last</button>
          </div>
        `
        const container = document.getElementById('container') as HTMLElement
        const result = focusUtils.focusLast(container)
        expect(result).toBe(true)
        expect(document.activeElement?.id).toBe('last')
      })

      it('should return false when no focusable elements', () => {
        document.body.innerHTML = `<div id="container"></div>`
        const container = document.getElementById('container') as HTMLElement
        const result = focusUtils.focusLast(container)
        expect(result).toBe(false)
      })
    })

    describe('isFocused', () => {
      it('should return true for focused element', () => {
        document.body.innerHTML = `<button id="btn">Button</button>`
        const button = document.getElementById('btn') as HTMLElement
        button.focus()
        expect(focusUtils.isFocused(button)).toBe(true)
      })

      it('should return false for non-focused element', () => {
        document.body.innerHTML = `
          <button id="btn1">Button 1</button>
          <button id="btn2">Button 2</button>
        `
        const btn1 = document.getElementById('btn1') as HTMLElement
        const btn2 = document.getElementById('btn2') as HTMLElement
        btn2.focus()
        expect(focusUtils.isFocused(btn1)).toBe(false)
      })
    })

    describe('trapFocus', () => {
      it('should trap focus from last to first on Tab', () => {
        document.body.innerHTML = `
          <div id="container">
            <button id="first">First</button>
            <button id="last">Last</button>
          </div>
        `
        const container = document.getElementById('container') as HTMLElement
        const last = document.getElementById('last') as HTMLElement
        last.focus()

        const event = new KeyboardEvent('keydown', { key: 'Tab' })
        Object.defineProperty(event, 'shiftKey', { value: false, writable: false })
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

        focusUtils.trapFocus(container, event)

        expect(preventDefaultSpy).toHaveBeenCalled()
        expect(document.activeElement?.id).toBe('first')
      })

      it('should trap focus from first to last on Shift+Tab', () => {
        document.body.innerHTML = `
          <div id="container">
            <button id="first">First</button>
            <button id="last">Last</button>
          </div>
        `
        const container = document.getElementById('container') as HTMLElement
        const first = document.getElementById('first') as HTMLElement
        first.focus()

        const event = new KeyboardEvent('keydown', { key: 'Tab' })
        Object.defineProperty(event, 'shiftKey', { value: true, writable: false })
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

        focusUtils.trapFocus(container, event)

        expect(preventDefaultSpy).toHaveBeenCalled()
        expect(document.activeElement?.id).toBe('last')
      })

      it('should not trap focus for non-Tab keys', () => {
        document.body.innerHTML = `
          <div id="container">
            <button id="first">First</button>
            <button id="last">Last</button>
          </div>
        `
        const container = document.getElementById('container') as HTMLElement
        const first = document.getElementById('first') as HTMLElement
        first.focus()

        const event = new KeyboardEvent('keydown', { key: 'Enter' })
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

        focusUtils.trapFocus(container, event)

        expect(preventDefaultSpy).not.toHaveBeenCalled()
        expect(document.activeElement?.id).toBe('first')
      })

      it('should handle containers with no focusable elements', () => {
        document.body.innerHTML = `<div id="container"></div>`
        const container = document.getElementById('container') as HTMLElement
        const event = new KeyboardEvent('keydown', { key: 'Tab' })

        expect(() => focusUtils.trapFocus(container, event)).not.toThrow()
      })
    })
  })
})