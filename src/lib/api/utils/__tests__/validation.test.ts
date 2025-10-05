import { describe, it, expect, beforeEach } from 'vitest'
import { InputValidator, commonRules, securityValidation, ValidationRule } from '../validation'

describe('validation.ts', () => {
  describe('InputValidator.validate', () => {
    describe('required field validation', () => {
      it('should pass when required field is present', () => {
        const rules: ValidationRule[] = [
          { field: 'name', type: 'string', required: true }
        ]
        const result = InputValidator.validate({ name: 'John' }, rules)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should fail when required field is undefined', () => {
        const rules: ValidationRule[] = [
          { field: 'name', type: 'string', required: true }
        ]
        const result = InputValidator.validate({}, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'name' is required")
      })

      it('should fail when required field is null', () => {
        const rules: ValidationRule[] = [
          { field: 'name', type: 'string', required: true }
        ]
        const result = InputValidator.validate({ name: null }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'name' is required")
      })

      it('should fail when required field is empty string', () => {
        const rules: ValidationRule[] = [
          { field: 'name', type: 'string', required: true }
        ]
        const result = InputValidator.validate({ name: '' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'name' is required")
      })

      it('should pass when optional field is missing', () => {
        const rules: ValidationRule[] = [
          { field: 'nickname', type: 'string', required: false }
        ]
        const result = InputValidator.validate({}, rules)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    describe('string type validation', () => {
      it('should pass for valid string', () => {
        const rules: ValidationRule[] = [
          { field: 'text', type: 'string', required: true }
        ]
        const result = InputValidator.validate({ text: 'hello' }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail for non-string value', () => {
        const rules: ValidationRule[] = [
          { field: 'text', type: 'string', required: true }
        ]
        const result = InputValidator.validate({ text: 123 }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'text' must be a string")
      })

      it('should sanitize string by escaping HTML', () => {
        const rules: ValidationRule[] = [
          { field: 'text', type: 'string', required: true }
        ]
        const result = InputValidator.validate({ text: '<script>alert("xss")</script>' }, rules)
        expect(result.sanitizedData.text).toContain('&lt;')
        expect(result.sanitizedData.text).toContain('&gt;')
      })

      it('should trim whitespace from strings', () => {
        const rules: ValidationRule[] = [
          { field: 'text', type: 'string', required: true }
        ]
        const result = InputValidator.validate({ text: '  hello  ' }, rules)
        expect(result.sanitizedData.text).toBe('hello')
      })
    })

    describe('number type validation', () => {
      it('should pass for valid number', () => {
        const rules: ValidationRule[] = [
          { field: 'age', type: 'number', required: true }
        ]
        const result = InputValidator.validate({ age: 25 }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should pass for numeric string', () => {
        const rules: ValidationRule[] = [
          { field: 'age', type: 'number', required: true }
        ]
        const result = InputValidator.validate({ age: '25' }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail for non-numeric value', () => {
        const rules: ValidationRule[] = [
          { field: 'age', type: 'number', required: true }
        ]
        const result = InputValidator.validate({ age: 'abc' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'age' must be a number")
      })

      it('should convert numeric string to number in sanitized data', () => {
        const rules: ValidationRule[] = [
          { field: 'age', type: 'number', required: true }
        ]
        const result = InputValidator.validate({ age: '25' }, rules)
        expect(result.sanitizedData.age).toBe(25)
        expect(typeof result.sanitizedData.age).toBe('number')
      })
    })

    describe('boolean type validation', () => {
      it('should pass for true', () => {
        const rules: ValidationRule[] = [
          { field: 'active', type: 'boolean', required: true }
        ]
        const result = InputValidator.validate({ active: true }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should pass for false', () => {
        const rules: ValidationRule[] = [
          { field: 'active', type: 'boolean', required: true }
        ]
        const result = InputValidator.validate({ active: false }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail for non-boolean value', () => {
        const rules: ValidationRule[] = [
          { field: 'active', type: 'boolean', required: true }
        ]
        const result = InputValidator.validate({ active: 'yes' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'active' must be a boolean")
      })
    })

    describe('email type validation', () => {
      it('should pass for valid email', () => {
        const rules: ValidationRule[] = [
          { field: 'email', type: 'email', required: true }
        ]
        const result = InputValidator.validate({ email: 'user@example.com' }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail for invalid email', () => {
        const rules: ValidationRule[] = [
          { field: 'email', type: 'email', required: true }
        ]
        const result = InputValidator.validate({ email: 'not-an-email' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'email' must be a valid email")
      })

      it('should normalize email addresses', () => {
        const rules: ValidationRule[] = [
          { field: 'email', type: 'email', required: true }
        ]
        const result = InputValidator.validate({ email: 'User@EXAMPLE.COM' }, rules)
        expect(result.sanitizedData.email).toBe('user@example.com')
      })
    })

    describe('url type validation', () => {
      it('should pass for valid URL', () => {
        const rules: ValidationRule[] = [
          { field: 'website', type: 'url', required: true }
        ]
        const result = InputValidator.validate({ website: 'https://example.com' }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail for invalid URL', () => {
        const rules: ValidationRule[] = [
          { field: 'website', type: 'url', required: true }
        ]
        const result = InputValidator.validate({ website: 'not-a-url' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'website' must be a valid URL")
      })

      it('should trim whitespace from URLs', () => {
        const rules: ValidationRule[] = [
          { field: 'website', type: 'url', required: true }
        ]
        const result = InputValidator.validate({ website: '  https://example.com  ' }, rules)
        expect(result.sanitizedData.website).toBe('https://example.com')
      })
    })

    describe('json type validation', () => {
      it('should pass for valid JSON string', () => {
        const rules: ValidationRule[] = [
          { field: 'data', type: 'json', required: true }
        ]
        const result = InputValidator.validate({ data: '{"key":"value"}' }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail for invalid JSON', () => {
        const rules: ValidationRule[] = [
          { field: 'data', type: 'json', required: true }
        ]
        const result = InputValidator.validate({ data: '{invalid}' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'data' must be valid JSON")
      })

      it('should parse JSON in sanitized data', () => {
        const rules: ValidationRule[] = [
          { field: 'data', type: 'json', required: true }
        ]
        const result = InputValidator.validate({ data: '{"key":"value"}' }, rules)
        expect(result.sanitizedData.data).toEqual({ key: 'value' })
      })
    })

    describe('array type validation', () => {
      it('should pass for valid array', () => {
        const rules: ValidationRule[] = [
          { field: 'items', type: 'array', required: true }
        ]
        const result = InputValidator.validate({ items: [1, 2, 3] }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail for non-array value', () => {
        const rules: ValidationRule[] = [
          { field: 'items', type: 'array', required: true }
        ]
        const result = InputValidator.validate({ items: 'not-an-array' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'items' must be an array")
      })

      it('should return empty array for non-array in sanitized data', () => {
        const rules: ValidationRule[] = [
          { field: 'items', type: 'array', required: false }
        ]
        const result = InputValidator.validate({ items: null }, rules)
        expect(result.isValid).toBe(true)
      })
    })

    describe('string length validation', () => {
      it('should pass when string meets minLength', () => {
        const rules: ValidationRule[] = [
          { field: 'name', type: 'string', required: true, minLength: 3 }
        ]
        const result = InputValidator.validate({ name: 'abc' }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail when string is too short', () => {
        const rules: ValidationRule[] = [
          { field: 'name', type: 'string', required: true, minLength: 5 }
        ]
        const result = InputValidator.validate({ name: 'abc' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'name' must be at least 5 characters long")
      })

      it('should pass when string meets maxLength', () => {
        const rules: ValidationRule[] = [
          { field: 'name', type: 'string', required: true, maxLength: 10 }
        ]
        const result = InputValidator.validate({ name: 'short' }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail when string is too long', () => {
        const rules: ValidationRule[] = [
          { field: 'name', type: 'string', required: true, maxLength: 5 }
        ]
        const result = InputValidator.validate({ name: 'toolong' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'name' cannot exceed 5 characters")
      })
    })

    describe('number range validation', () => {
      it('should pass when number meets min', () => {
        const rules: ValidationRule[] = [
          { field: 'age', type: 'number', required: true, min: 18 }
        ]
        const result = InputValidator.validate({ age: 20 }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail when number is below min', () => {
        const rules: ValidationRule[] = [
          { field: 'age', type: 'number', required: true, min: 18 }
        ]
        const result = InputValidator.validate({ age: 15 }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'age' must be at least 18")
      })

      it('should pass when number meets max', () => {
        const rules: ValidationRule[] = [
          { field: 'score', type: 'number', required: true, max: 100 }
        ]
        const result = InputValidator.validate({ score: 95 }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail when number exceeds max', () => {
        const rules: ValidationRule[] = [
          { field: 'score', type: 'number', required: true, max: 100 }
        ]
        const result = InputValidator.validate({ score: 105 }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'score' cannot exceed 100")
      })
    })

    describe('pattern validation', () => {
      it('should pass when value matches pattern', () => {
        const rules: ValidationRule[] = [
          { field: 'code', type: 'string', required: true, pattern: /^[A-Z]{3}$/ }
        ]
        const result = InputValidator.validate({ code: 'ABC' }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail when value does not match pattern', () => {
        const rules: ValidationRule[] = [
          { field: 'code', type: 'string', required: true, pattern: /^[A-Z]{3}$/ }
        ]
        const result = InputValidator.validate({ code: 'abc' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'code' format is invalid")
      })
    })

    describe('allowed values validation', () => {
      it('should pass when value is in allowed list', () => {
        const rules: ValidationRule[] = [
          { field: 'status', type: 'string', required: true, allowedValues: ['active', 'inactive', 'pending'] }
        ]
        const result = InputValidator.validate({ status: 'active' }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail when value is not in allowed list', () => {
        const rules: ValidationRule[] = [
          { field: 'status', type: 'string', required: true, allowedValues: ['active', 'inactive'] }
        ]
        const result = InputValidator.validate({ status: 'deleted' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'status' must be one of: active, inactive")
      })
    })

    describe('custom validator', () => {
      it('should pass when custom validator returns true', () => {
        const rules: ValidationRule[] = [
          {
            field: 'password',
            type: 'string',
            required: true,
            customValidator: (value) => value.length >= 8
          }
        ]
        const result = InputValidator.validate({ password: 'password123' }, rules)
        expect(result.isValid).toBe(true)
      })

      it('should fail when custom validator returns false', () => {
        const rules: ValidationRule[] = [
          {
            field: 'password',
            type: 'string',
            required: true,
            customValidator: (value) => value.length >= 8
          }
        ]
        const result = InputValidator.validate({ password: 'short' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain("Field 'password' is invalid")
      })

      it('should use custom error message when validator returns string', () => {
        const rules: ValidationRule[] = [
          {
            field: 'password',
            type: 'string',
            required: true,
            customValidator: (value) => value.length >= 8 ? true : 'Password must be at least 8 characters'
          }
        ]
        const result = InputValidator.validate({ password: 'short' }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Password must be at least 8 characters')
      })
    })

    describe('multiple field validation', () => {
      it('should validate multiple fields successfully', () => {
        const rules: ValidationRule[] = [
          { field: 'name', type: 'string', required: true },
          { field: 'email', type: 'email', required: true },
          { field: 'age', type: 'number', required: true, min: 18 }
        ]
        const result = InputValidator.validate({
          name: 'John',
          email: 'john@example.com',
          age: 25
        }, rules)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should collect all validation errors', () => {
        const rules: ValidationRule[] = [
          { field: 'name', type: 'string', required: true },
          { field: 'email', type: 'email', required: true },
          { field: 'age', type: 'number', required: true, min: 18 }
        ]
        const result = InputValidator.validate({
          name: '',
          email: 'invalid',
          age: 15
        }, rules)
        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThanOrEqual(3)
      })
    })
  })

  describe('commonRules', () => {
    it('should have title rule', () => {
      expect(commonRules.title).toBeDefined()
      expect(commonRules.title.type).toBe('string')
      expect(commonRules.title.required).toBe(true)
      expect(commonRules.title.minLength).toBe(1)
      expect(commonRules.title.maxLength).toBe(200)
    })

    it('should have description rule', () => {
      expect(commonRules.description).toBeDefined()
      expect(commonRules.description.type).toBe('string')
      expect(commonRules.description.maxLength).toBe(5000)
    })

    it('should have email rule', () => {
      expect(commonRules.email).toBeDefined()
      expect(commonRules.email.type).toBe('email')
      expect(commonRules.email.required).toBe(true)
    })

    it('should have projectType rule with allowed values', () => {
      expect(commonRules.projectType).toBeDefined()
      expect(commonRules.projectType.allowedValues).toContain('software')
      expect(commonRules.projectType.allowedValues).toContain('marketing')
    })

    it('should have count rule with range', () => {
      expect(commonRules.count).toBeDefined()
      expect(commonRules.count.min).toBe(1)
      expect(commonRules.count.max).toBe(20)
    })

    it('should have id rule with pattern', () => {
      expect(commonRules.id).toBeDefined()
      expect(commonRules.id.pattern).toBeDefined()
    })
  })

  describe('securityValidation.preventSQLInjection', () => {
    it('should pass for safe input', () => {
      expect(securityValidation.preventSQLInjection('normal text')).toBe(true)
    })

    it('should detect single quote', () => {
      expect(securityValidation.preventSQLInjection("'; DROP TABLE users--")).toBe(false)
    })

    it('should detect SQL keywords', () => {
      expect(securityValidation.preventSQLInjection('SELECT * FROM users')).toBe(false)
      expect(securityValidation.preventSQLInjection('DELETE FROM table')).toBe(false)
      expect(securityValidation.preventSQLInjection('INSERT INTO users')).toBe(false)
    })

    it('should detect comment patterns', () => {
      expect(securityValidation.preventSQLInjection('text --comment')).toBe(false)
      expect(securityValidation.preventSQLInjection('text /* comment */')).toBe(false)
    })

    it('should detect OR/AND injection attempts', () => {
      expect(securityValidation.preventSQLInjection("1' OR '1'='1")).toBe(false)
      expect(securityValidation.preventSQLInjection("1' AND '1'='1")).toBe(false)
    })
  })

  describe('securityValidation.preventXSS', () => {
    it('should pass for safe input', () => {
      expect(securityValidation.preventXSS('normal text')).toBe(true)
    })

    it('should detect script tags', () => {
      expect(securityValidation.preventXSS('<script>alert("xss")</script>')).toBe(false)
    })

    it('should detect javascript protocol', () => {
      expect(securityValidation.preventXSS('javascript:alert(1)')).toBe(false)
    })

    it('should detect event handlers', () => {
      expect(securityValidation.preventXSS('<img onerror="alert(1)">')).toBe(false)
      expect(securityValidation.preventXSS('<div onclick="alert(1)">')).toBe(false)
    })

    it('should detect iframe tags', () => {
      expect(securityValidation.preventXSS('<iframe src="malicious.com"></iframe>')).toBe(false)
    })

    it('should detect object tags', () => {
      expect(securityValidation.preventXSS('<object data="malicious.swf"></object>')).toBe(false)
    })

    it('should detect embed tags', () => {
      expect(securityValidation.preventXSS('<embed src="malicious.swf">')).toBe(false)
    })
  })

  describe('securityValidation.isValidFileType', () => {
    it('should pass for allowed file types', () => {
      expect(securityValidation.isValidFileType('document.pdf', ['pdf', 'doc'])).toBe(true)
      expect(securityValidation.isValidFileType('image.jpg', ['jpg', 'png'])).toBe(true)
    })

    it('should fail for disallowed file types', () => {
      expect(securityValidation.isValidFileType('script.exe', ['pdf', 'doc'])).toBe(false)
      expect(securityValidation.isValidFileType('file.bat', ['jpg', 'png'])).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(securityValidation.isValidFileType('document.PDF', ['pdf'])).toBe(true)
      expect(securityValidation.isValidFileType('IMAGE.JPG', ['jpg'])).toBe(true)
    })

    it('should handle files with multiple dots', () => {
      expect(securityValidation.isValidFileType('my.document.pdf', ['pdf'])).toBe(true)
    })

    it('should return false for files without extension', () => {
      expect(securityValidation.isValidFileType('noextension', ['pdf'])).toBe(false)
    })
  })

  describe('securityValidation.sanitizeFilename', () => {
    it('should allow alphanumeric characters', () => {
      expect(securityValidation.sanitizeFilename('file123.txt')).toBe('file123.txt')
    })

    it('should allow dots, dashes, and underscores', () => {
      expect(securityValidation.sanitizeFilename('my-file_name.txt')).toBe('my-file_name.txt')
    })

    it('should remove special characters', () => {
      expect(securityValidation.sanitizeFilename('file@#$.txt')).toBe('file.txt')
    })

    it('should remove spaces', () => {
      expect(securityValidation.sanitizeFilename('my file.txt')).toBe('myfile.txt')
    })

    it('should remove path traversal attempts', () => {
      expect(securityValidation.sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd')
    })

    it('should handle empty result', () => {
      expect(securityValidation.sanitizeFilename('!@#$%^&*()')).toBe('')
    })
  })
})
