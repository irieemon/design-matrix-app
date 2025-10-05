import validator from 'validator'

export interface ValidationRule {
  field: string
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'json' | 'array'
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  allowedValues?: (string | number)[]
  customValidator?: (value: any) => boolean | string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  sanitizedData: Record<string, any>
}

export class InputValidator {
  static validate(data: any, rules: ValidationRule[]): ValidationResult {
    const errors: string[] = []
    const sanitizedData: Record<string, any> = {}

    // Check for required fields
    for (const rule of rules) {
      if (rule.required && (data[rule.field] === undefined || data[rule.field] === null || data[rule.field] === '')) {
        errors.push(`Field '${rule.field}' is required`)
        continue
      }

      // Skip validation if field is not required and not present
      if (!rule.required && (data[rule.field] === undefined || data[rule.field] === null)) {
        continue
      }

      const value = data[rule.field]
      const fieldErrors = this.validateField(rule.field, value, rule)
      errors.push(...fieldErrors)

      // Sanitize the value if validation passed
      if (fieldErrors.length === 0) {
        sanitizedData[rule.field] = this.sanitizeValue(value, rule.type)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData
    }
  }

  private static validateField(fieldName: string, value: any, rule: ValidationRule): string[] {
    const errors: string[] = []

    // Type validation
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Field '${fieldName}' must be a string`)
          return errors
        }
        break
      case 'number':
        if (typeof value !== 'number' && !validator.isNumeric(String(value))) {
          errors.push(`Field '${fieldName}' must be a number`)
          return errors
        }
        break
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`Field '${fieldName}' must be a boolean`)
          return errors
        }
        break
      case 'email':
        if (!validator.isEmail(String(value))) {
          errors.push(`Field '${fieldName}' must be a valid email`)
          return errors
        }
        break
      case 'url':
        if (!validator.isURL(String(value))) {
          errors.push(`Field '${fieldName}' must be a valid URL`)
          return errors
        }
        break
      case 'json':
        try {
          JSON.parse(String(value))
        } catch {
          errors.push(`Field '${fieldName}' must be valid JSON`)
          return errors
        }
        break
      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`Field '${fieldName}' must be an array`)
          return errors
        }
        break
    }

    // String length validation
    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`Field '${fieldName}' must be at least ${rule.minLength} characters long`)
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`Field '${fieldName}' cannot exceed ${rule.maxLength} characters`)
      }
    }

    // Number range validation
    if (rule.type === 'number') {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value))
      if (rule.min !== undefined && numValue < rule.min) {
        errors.push(`Field '${fieldName}' must be at least ${rule.min}`)
      }
      if (rule.max !== undefined && numValue > rule.max) {
        errors.push(`Field '${fieldName}' cannot exceed ${rule.max}`)
      }
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(String(value))) {
      errors.push(`Field '${fieldName}' format is invalid`)
    }

    // Allowed values validation
    if (rule.allowedValues && !rule.allowedValues.includes(value)) {
      errors.push(`Field '${fieldName}' must be one of: ${rule.allowedValues.join(', ')}`)
    }

    // Custom validation
    if (rule.customValidator) {
      const customResult = rule.customValidator(value)
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `Field '${fieldName}' is invalid`)
      }
    }

    return errors
  }

  private static sanitizeValue(value: any, type: string): any {
    switch (type) {
      case 'string':
        return validator.escape(String(value)).trim()
      case 'number':
        return typeof value === 'number' ? value : parseFloat(String(value))
      case 'boolean':
        return Boolean(value)
      case 'email':
        return validator.normalizeEmail(String(value)) || String(value).toLowerCase().trim()
      case 'url':
        return String(value).trim()
      case 'json':
        return JSON.parse(String(value))
      case 'array':
        return Array.isArray(value) ? value : []
      default:
        return value
    }
  }
}

// Common validation rules
export const commonRules = {
  title: {
    field: 'title',
    type: 'string' as const,
    required: true,
    minLength: 1,
    maxLength: 200
  },
  description: {
    field: 'description',
    type: 'string' as const,
    required: true,
    minLength: 1,
    maxLength: 5000
  },
  email: {
    field: 'email',
    type: 'email' as const,
    required: true
  },
  projectType: {
    field: 'projectType',
    type: 'string' as const,
    required: false,
    allowedValues: ['software', 'marketing', 'event', 'research', 'business', 'other']
  },
  count: {
    field: 'count',
    type: 'number' as const,
    required: false,
    min: 1,
    max: 20
  },
  tolerance: {
    field: 'tolerance',
    type: 'number' as const,
    required: false,
    min: 0,
    max: 100
  },
  id: {
    field: 'id',
    type: 'string' as const,
    required: true,
    pattern: /^[a-zA-Z0-9_-]+$/,
    maxLength: 50
  }
}

// Security validation helpers
export const securityValidation = {
  preventSQLInjection: (value: string): boolean => {
    const sqlPatterns = [
      /('|(\\')|(;)|(--|\/\*|\*\/)|(\bor\b|\band\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b|\balter\b|\bunion\b))/i
    ]
    return !sqlPatterns.some(pattern => pattern.test(value))
  },

  preventXSS: (value: string): boolean => {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi
    ]
    return !xssPatterns.some(pattern => pattern.test(value))
  },

  isValidFileType: (filename: string, allowedTypes: string[]): boolean => {
    const extension = filename.split('.').pop()?.toLowerCase()
    return extension ? allowedTypes.includes(extension) : false
  },

  sanitizeFilename: (filename: string): string => {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '')
  }
}