/**
 * Accessibility utility functions and constants
 *
 * Provides helper functions for WCAG 2.1 AA compliance
 * including color contrast, semantic HTML, and ARIA support.
 */

/**
 * WCAG 2.1 AA color contrast ratios
 */
export const CONTRAST_RATIOS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5
} as const

/**
 * Calculate relative luminance for color contrast
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const sRGB = c / 255
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  if (!rgb1 || !rgb2) return 1

  const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b)
  const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b)

  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)

  return (brightest + 0.05) / (darkest + 0.05)
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * Check if color combination meets WCAG AA standards
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background)

  if (level === 'AAA') {
    return ratio >= (isLargeText ? CONTRAST_RATIOS.AAA_LARGE : CONTRAST_RATIOS.AAA_NORMAL)
  }

  return ratio >= (isLargeText ? CONTRAST_RATIOS.AA_LARGE : CONTRAST_RATIOS.AA_NORMAL)
}

/**
 * Semantic HTML element mappings for accessibility
 */
export const SEMANTIC_ELEMENTS = {
  navigation: 'nav',
  main: 'main',
  complementary: 'aside',
  contentinfo: 'footer',
  banner: 'header',
  region: 'section',
  article: 'article',
  search: 'search'
} as const

/**
 * ARIA roles for complex UI components
 */
export const ARIA_ROLES = {
  button: 'button',
  checkbox: 'checkbox',
  radio: 'radio',
  textbox: 'textbox',
  combobox: 'combobox',
  listbox: 'listbox',
  option: 'option',
  menu: 'menu',
  menuitem: 'menuitem',
  tab: 'tab',
  tabpanel: 'tabpanel',
  dialog: 'dialog',
  alertdialog: 'alertdialog',
  alert: 'alert',
  status: 'status',
  progressbar: 'progressbar',
  slider: 'slider',
  grid: 'grid',
  gridcell: 'gridcell',
  tree: 'tree',
  treeitem: 'treeitem'
} as const

/**
 * Generate accessible form field properties
 */
export function getAccessibleFieldProps(
  id: string,
  label: string,
  options: {
    required?: boolean
    invalid?: boolean
    disabled?: boolean
    readonly?: boolean
    describedBy?: string
    errorId?: string
  } = {}
) {
  const {
    required = false,
    invalid = false,
    disabled = false,
    readonly = false,
    describedBy,
    errorId
  } = options

  const props: Record<string, any> = {
    id,
    'aria-label': label,
    'aria-required': required,
    'aria-invalid': invalid,
    'aria-disabled': disabled,
    'aria-readonly': readonly
  }

  if (describedBy) {
    props['aria-describedby'] = describedBy
  }

  if (invalid && errorId) {
    props['aria-describedby'] = errorId
  }

  return props
}

/**
 * Generate accessible button properties
 */
export function getAccessibleButtonProps(
  label: string,
  options: {
    pressed?: boolean
    expanded?: boolean
    disabled?: boolean
    describedBy?: string
    controls?: string
  } = {}
) {
  const {
    pressed,
    expanded,
    disabled = false,
    describedBy,
    controls
  } = options

  const props: Record<string, any> = {
    'aria-label': label,
    'aria-disabled': disabled,
    type: 'button'
  }

  if (pressed !== undefined) {
    props['aria-pressed'] = pressed
  }

  if (expanded !== undefined) {
    props['aria-expanded'] = expanded
  }

  if (describedBy) {
    props['aria-describedby'] = describedBy
  }

  if (controls) {
    props['aria-controls'] = controls
  }

  return props
}

/**
 * Generate accessible modal/dialog properties
 */
export function getAccessibleModalProps(
  labelledBy?: string,
  describedBy?: string,
  modal: boolean = true
) {
  const props: Record<string, any> = {
    role: 'dialog',
    'aria-modal': modal,
    tabIndex: -1
  }

  if (labelledBy) {
    props['aria-labelledby'] = labelledBy
  }

  if (describedBy) {
    props['aria-describedby'] = describedBy
  }

  return props
}

/**
 * Generate accessible list properties
 */
export function getAccessibleListProps(
  itemCount: number,
  options: {
    multiSelectable?: boolean
    orientation?: 'horizontal' | 'vertical'
    label?: string
  } = {}
) {
  const {
    multiSelectable = false,
    orientation = 'vertical',
    label
  } = options

  const props: Record<string, any> = {
    role: 'list',
    'aria-setsize': itemCount,
    'aria-orientation': orientation
  }

  if (multiSelectable) {
    props['aria-multiselectable'] = true
  }

  if (label) {
    props['aria-label'] = label
  }

  return props
}

/**
 * Generate accessible drag and drop properties
 */
export function getAccessibleDragProps(
  item: {
    id: string
    label: string
    position?: { x: number; y: number }
    isDragging?: boolean
  }
) {
  const { id, label, position, isDragging = false } = item

  const props: Record<string, any> = {
    'aria-label': label,
    'aria-grabbed': isDragging,
    'aria-describedby': `${id}-instructions`,
    role: 'button',
    tabIndex: 0
  }

  if (position) {
    props['aria-roledescription'] = `Draggable item at position ${Math.round(position.x)}, ${Math.round(position.y)}`
  }

  return props
}

/**
 * Generate accessible landmark properties
 */
export function getAccessibleLandmarkProps(
  landmark: keyof typeof SEMANTIC_ELEMENTS,
  label?: string
) {
  const props: Record<string, any> = {
    role: landmark
  }

  if (label) {
    props['aria-label'] = label
  }

  return props
}

/**
 * Screen reader text utilities
 */
export const srUtils = {
  /**
   * Classes for screen reader only text
   */
  srOnlyClass: 'sr-only absolute -m-px w-px h-px p-0 overflow-hidden whitespace-nowrap border-0',

  /**
   * Classes for focusable screen reader text
   */
  srOnlyFocusableClass: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded',

  /**
   * Generate screen reader announcement text for actions
   */
  getActionAnnouncement: (action: string, item: string, result?: string) => {
    const base = `${action} ${item}`
    return result ? `${base}. ${result}` : base
  },

  /**
   * Generate status announcements
   */
  getStatusAnnouncement: (status: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const prefix = {
      success: 'Success:',
      error: 'Error:',
      warning: 'Warning:',
      info: 'Information:'
    }[status]

    return `${prefix} ${message}`
  }
}

/**
 * Keyboard event utilities
 */
export const keyboardUtils = {
  /**
   * Check if key event should trigger action
   */
  isActionKey: (e: KeyboardEvent | React.KeyboardEvent) => {
    return e.key === 'Enter' || e.key === ' '
  },

  /**
   * Check if key event is navigation
   */
  isNavigationKey: (e: KeyboardEvent | React.KeyboardEvent) => {
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)
  },

  /**
   * Check if key event should close modal/overlay
   */
  isEscapeKey: (e: KeyboardEvent | React.KeyboardEvent) => {
    return e.key === 'Escape'
  },

  /**
   * Get arrow key direction
   */
  getArrowDirection: (e: KeyboardEvent | React.KeyboardEvent): 'up' | 'down' | 'left' | 'right' | null => {
    switch (e.key) {
      case 'ArrowUp': return 'up'
      case 'ArrowDown': return 'down'
      case 'ArrowLeft': return 'left'
      case 'ArrowRight': return 'right'
      default: return null
    }
  }
}

/**
 * ARIA utilities
 */
export const ariaUtils = {
  /**
   * Generate unique IDs for ARIA relationships
   */
  generateId: (prefix: string = 'aria') => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },

  /**
   * Create ARIA description element
   */
  createDescription: (id: string, text: string) => {
    const element = document.createElement('div')
    element.id = id
    element.className = 'sr-only'
    element.textContent = text
    document.body.appendChild(element)
    return element
  },

  /**
   * Remove ARIA description element
   */
  removeDescription: (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.remove()
    }
  }
}

/**
 * Focus management utilities
 */
export const focusUtils = {
  /**
   * Get all focusable elements within a container
   */
  getFocusableElements: (container: HTMLElement): HTMLElement[] => {
    const selector = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"]):not([disabled])',
      'details[open] summary'
    ].join(', ')

    return Array.from(container.querySelectorAll(selector))
  },

  /**
   * Focus the first focusable element in container
   */
  focusFirst: (container: HTMLElement): boolean => {
    const focusable = focusUtils.getFocusableElements(container)
    if (focusable.length > 0) {
      focusable[0].focus()
      return true
    }
    return false
  },

  /**
   * Focus the last focusable element in container
   */
  focusLast: (container: HTMLElement): boolean => {
    const focusable = focusUtils.getFocusableElements(container)
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus()
      return true
    }
    return false
  },

  /**
   * Check if element is currently focused
   */
  isFocused: (element: HTMLElement): boolean => {
    return document.activeElement === element
  },

  /**
   * Create focus trap within container
   */
  trapFocus: (container: HTMLElement, e: KeyboardEvent | React.KeyboardEvent) => {
    if (e.key !== 'Tab') return

    const focusable = focusUtils.getFocusableElements(container)
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }
}