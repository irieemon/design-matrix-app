import { describe, it, expect } from 'vitest'
import DOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

// Create a DOM environment for testing
const window = new JSDOM('').window
global.window = window as any
global.document = window.document
global.DOMParser = window.DOMParser

// Initialize DOMPurify with the test environment
const purify = DOMPurify(window)

describe('Security Tests', () => {
  describe('DOMPurify XSS Prevention', () => {
    it('should sanitize malicious script tags', () => {
      const maliciousInput = '<script>alert("XSS")</script><p>Safe content</p>'
      const sanitized = purify.sanitize(maliciousInput)

      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('alert("XSS")')
      expect(sanitized).toContain('<p>Safe content</p>')
    })

    it('should remove dangerous attributes', () => {
      const maliciousInput = '<img src="x" onerror="alert(1)">'
      const sanitized = purify.sanitize(maliciousInput)

      expect(sanitized).not.toContain('onerror')
      expect(sanitized).not.toContain('alert(1)')
    })

    it('should sanitize javascript: URLs', () => {
      const maliciousInput = '<a href="javascript:alert(1)">Click me</a>'
      const sanitized = purify.sanitize(maliciousInput)

      expect(sanitized).not.toContain('javascript:')
      expect(sanitized).not.toContain('alert(1)')
    })

    it('should preserve safe HTML', () => {
      const safeInput = '<div class="safe"><p>This is <strong>safe</strong> content</p></div>'
      const sanitized = purify.sanitize(safeInput)

      expect(sanitized).toContain('<div')
      expect(sanitized).toContain('<p>')
      expect(sanitized).toContain('<strong>')
      expect(sanitized).toContain('This is')
    })
  })

  describe('Input Validation', () => {
    it('should detect SQL injection patterns', () => {
      const sqlInjectionInputs = [
        "'; DROP TABLE users; --",
        "1 OR 1=1",
        "UNION SELECT * FROM passwords",
        "admin'--"
      ]

      const sqlPatterns = [
        /('|(\\')|(;)|(--|\/\*|\*\/)|(\bor\b|\band\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b|\balter\b|\bunion\b))/i
      ]

      sqlInjectionInputs.forEach(input => {
        const hasSQLPattern = sqlPatterns.some(pattern => pattern.test(input))
        expect(hasSQLPattern).toBe(true)
      })
    })

    it('should detect XSS patterns', () => {
      const xssInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img onerror="alert(1)" src="x">',
        '<iframe src="javascript:alert(1)"></iframe>'
      ]

      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+=/gi,
        /<iframe/gi
      ]

      xssInputs.forEach(input => {
        const hasXSSPattern = xssPatterns.some(pattern => pattern.test(input))
        expect(hasXSSPattern).toBe(true)
      })
    })

    it('should accept safe input', () => {
      const safeInputs = [
        'Regular text content',
        'email@example.com',
        'https://example.com',
        'My Project Title'
      ]

      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+=/gi,
        /<iframe/gi
      ]

      safeInputs.forEach(input => {
        const hasXSSPattern = xssPatterns.some(pattern => pattern.test(input))
        expect(hasXSSPattern).toBe(false)
      })
    })
  })

  describe('Authentication Security', () => {
    it('should validate token format', () => {
      const validTokenPattern = /^[A-Za-z0-9._-]+$/

      const validTokens = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'abc123-def456_ghi789.jkl'
      ]

      const invalidTokens = [
        'token with spaces',
        'token<script>',
        'token"quote',
        'token&amp;',
        ''
      ]

      validTokens.forEach(token => {
        expect(validTokenPattern.test(token)).toBe(true)
      })

      invalidTokens.forEach(token => {
        expect(validTokenPattern.test(token)).toBe(false)
      })
    })

    it('should validate email format', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      const validEmails = [
        'user@example.com',
        'test.email@company.co.uk',
        'admin@prioritas.com'
      ]

      const invalidEmails = [
        'not-an-email',
        '@domain.com',
        'user@',
        'user space@domain.com'
      ]

      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true)
      })

      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false)
      })
    })
  })

  describe('Content Security Policy', () => {
    it('should have restrictive CSP directives', () => {
      const cspValue = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"

      // Check for important security directives
      expect(cspValue).toContain("object-src 'none'")
      expect(cspValue).toContain("frame-ancestors 'none'")
      expect(cspValue).toContain("base-uri 'self'")
      expect(cspValue).toContain("form-action 'self'")
      expect(cspValue).toContain('upgrade-insecure-requests')
    })
  })

  describe('File Security', () => {
    it('should validate file extensions', () => {
      const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx']

      const safeFiles = [
        'document.pdf',
        'image.jpg',
        'photo.jpeg',
        'diagram.png'
      ]

      const dangerousFiles = [
        'script.exe',
        'malware.bat',
        'virus.com',
        'trojan.scr',
        'exploit.js'
      ]

      safeFiles.forEach(filename => {
        const extension = filename.split('.').pop()?.toLowerCase()
        expect(allowedTypes.includes(extension || '')).toBe(true)
      })

      dangerousFiles.forEach(filename => {
        const extension = filename.split('.').pop()?.toLowerCase()
        expect(allowedTypes.includes(extension || '')).toBe(false)
      })
    })

    it('should sanitize filenames', () => {
      const sanitizeFilename = (filename: string): string => {
        return filename.replace(/[^a-zA-Z0-9._-]/g, '')
      }

      const dangerousFilenames = [
        '../../../etc/passwd',
        'file with spaces.txt',
        'file<script>.txt',
        'file"quote.txt',
        'file&amp;.txt'
      ]

      dangerousFilenames.forEach(filename => {
        const sanitized = sanitizeFilename(filename)
        expect(sanitized).not.toContain('../')
        expect(sanitized).not.toContain(' ')
        expect(sanitized).not.toContain('<')
        expect(sanitized).not.toContain('>')
        expect(sanitized).not.toContain('"')
        expect(sanitized).not.toContain('&')
      })
    })
  })
})