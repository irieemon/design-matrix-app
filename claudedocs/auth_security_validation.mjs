#!/usr/bin/env node

/**
 * Authentication Security Validation Script
 *
 * This script validates the critical security issues identified in the authentication system.
 * It performs automated tests to verify vulnerabilities and security implementations.
 */

import fs from 'fs'
import path from 'path'

// ANSI color codes for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

function log(level, message, details = '') {
  const timestamp = new Date().toISOString()
  const levelColors = {
    'CRITICAL': colors.red,
    'HIGH': colors.yellow,
    'MEDIUM': colors.blue,
    'LOW': colors.green,
    'INFO': colors.cyan
  }

  console.log(`${levelColors[level] || colors.reset}[${level}]${colors.reset} ${message}`)
  if (details) {
    console.log(`${colors.cyan}  └─${colors.reset} ${details}`)
  }
}

class SecurityValidator {
  constructor() {
    this.issues = []
    this.totalTests = 0
    this.passedTests = 0
  }

  addIssue(severity, category, description, location, recommendation) {
    this.issues.push({
      severity,
      category,
      description,
      location,
      recommendation,
      timestamp: new Date().toISOString()
    })
  }

  test(description, testFunction) {
    this.totalTests++
    try {
      const result = testFunction()
      if (result) {
        this.passedTests++
        log('INFO', `✅ ${description}`)
        return true
      } else {
        log('HIGH', `❌ ${description}`)
        return false
      }
    } catch (error) {
      log('CRITICAL', `💥 ${description}`, `Error: ${error.message}`)
      return false
    }
  }

  // Test 1: Environment Variable Consistency
  validateEnvironmentVariables() {
    log('INFO', '🔍 Testing Environment Variable Security...')

    const middlewarePath = 'api/auth/middleware.ts'
    const supabasePath = 'src/lib/supabase.ts'

    if (fs.existsSync(middlewarePath)) {
      const middlewareContent = fs.readFileSync(middlewarePath, 'utf8')

      // Check for inconsistent environment variable usage
      const hasVitePrefix = middlewareContent.includes('VITE_SUPABASE')
      const hasServerPrefix = middlewareContent.includes('process.env.SUPABASE_ANON_KEY')

      if (hasVitePrefix && hasServerPrefix) {
        this.addIssue(
          'CRITICAL',
          'Environment Variables',
          'Server-side code using client-side environment variables (VITE_*)',
          middlewarePath,
          'Separate client and server environment variables'
        )

        this.test('Environment variable consistency', () => false)
      } else {
        this.test('Environment variable consistency', () => true)
      }
    }

    if (fs.existsSync(supabasePath)) {
      const supabaseContent = fs.readFileSync(supabasePath, 'utf8')

      // Check for proper client-side variable usage
      const usesVitePrefix = supabaseContent.includes('import.meta.env.VITE_')
      this.test('Client-side uses VITE_ prefix', () => usesVitePrefix)
    }
  }

  // Test 2: Token Caching Security
  validateTokenCaching() {
    log('INFO', '🔍 Testing Token Caching Security...')

    const middlewarePath = 'api/auth/middleware.ts'

    if (fs.existsSync(middlewarePath)) {
      const content = fs.readFileSync(middlewarePath, 'utf8')

      // Check for insecure token caching
      const hasTokenCache = content.includes('tokenCache = new Map')
      const hasProperInvalidation = content.includes('tokenCache.delete') || content.includes('tokenCache.clear')
      const hasCacheEncryption = content.includes('encrypt') || content.includes('crypto')

      if (hasTokenCache && !hasCacheEncryption) {
        this.addIssue(
          'HIGH',
          'Token Security',
          'Token cache stores sensitive data without encryption',
          middlewarePath,
          'Implement encrypted token storage or use secure session management'
        )

        this.test('Token cache encryption', () => false)
      } else if (!hasTokenCache) {
        this.test('Token cache encryption', () => true)
      }

      this.test('Token cache invalidation mechanism', () => hasProperInvalidation)
    }
  }

  // Test 3: CSRF Protection
  validateCSRFProtection() {
    log('INFO', '🔍 Testing CSRF Protection...')

    const middlewarePath = 'api/auth/middleware.ts'

    if (fs.existsSync(middlewarePath)) {
      const content = fs.readFileSync(middlewarePath, 'utf8')

      // Check for CSRF protection mechanisms
      const hasCSRFToken = content.includes('csrf') || content.includes('CSRF')
      const hasDoubleSubmitCookie = content.includes('double-submit') || content.includes('csrf-token')
      const hasStateSameSite = content.includes('SameSite')

      if (!hasCSRFToken && !hasDoubleSubmitCookie) {
        this.addIssue(
          'HIGH',
          'CSRF Protection',
          'No CSRF protection mechanisms implemented',
          middlewarePath,
          'Implement CSRF tokens or double-submit cookie pattern'
        )

        this.test('CSRF protection implemented', () => false)
      } else {
        this.test('CSRF protection implemented', () => true)
      }
    }
  }

  // Test 4: Rate Limiting Security
  validateRateLimiting() {
    log('INFO', '🔍 Testing Rate Limiting Security...')

    const middlewarePath = 'api/auth/middleware.ts'

    if (fs.existsSync(middlewarePath)) {
      const content = fs.readFileSync(middlewarePath, 'utf8')

      // Check rate limiting implementation
      const hasRateLimit = content.includes('checkUserRateLimit')
      const hasIPRateLimit = content.includes('remoteAddress') || content.includes('x-forwarded-for')
      const hasProgressiveDelay = content.includes('delay') || content.includes('backoff')

      this.test('User-based rate limiting', () => hasRateLimit)

      if (hasRateLimit && !hasIPRateLimit) {
        this.addIssue(
          'MEDIUM',
          'Rate Limiting',
          'Rate limiting only by user ID, missing IP-based protection',
          middlewarePath,
          'Implement IP-based rate limiting to prevent brute force attacks'
        )

        this.test('IP-based rate limiting', () => false)
      } else {
        this.test('IP-based rate limiting', () => hasIPRateLimit)
      }

      this.test('Progressive delay on failures', () => hasProgressiveDelay)
    }
  }

  // Test 5: Role-Based Access Control
  validateRBAC() {
    log('INFO', '🔍 Testing Role-Based Access Control...')

    const rolesPath = 'api/auth/roles.ts'
    const useAuthPath = 'src/hooks/useAuth.ts'

    if (fs.existsSync(rolesPath)) {
      const content = fs.readFileSync(rolesPath, 'utf8')

      // Check for hardcoded admin lists
      const hasHardcodedAdmins = content.includes('ADMIN_EMAILS') && content.includes('new Set([')
      const hasDatabaseRoles = content.includes('supabase.from(') && content.includes('roles')

      if (hasHardcodedAdmins) {
        this.addIssue(
          'HIGH',
          'Access Control',
          'Admin roles hardcoded in source code',
          rolesPath,
          'Move role management to database with proper audit trail'
        )

        this.test('Database-driven role management', () => false)
      } else {
        this.test('Database-driven role management', () => true)
      }
    }

    if (fs.existsSync(useAuthPath)) {
      const content = fs.readFileSync(useAuthPath, 'utf8')

      // Check for client-side role assignment
      const hasClientRoleAssignment = content.includes('userRole = ') && content.includes('super_admin')

      if (hasClientRoleAssignment) {
        this.addIssue(
          'HIGH',
          'Access Control',
          'Role assignment logic present in client-side code',
          useAuthPath,
          'Move all role assignment to server-side only'
        )

        this.test('Server-side role assignment only', () => false)
      } else {
        this.test('Server-side role assignment only', () => true)
      }
    }
  }

  // Test 6: Input Validation and Injection Prevention
  validateInputSecurity() {
    log('INFO', '🔍 Testing Input Validation Security...')

    const middlewarePath = 'api/auth/middleware.ts'

    if (fs.existsSync(middlewarePath)) {
      const content = fs.readFileSync(middlewarePath, 'utf8')

      // Check input validation
      const hasTokenValidation = content.includes('token.length') && content.includes('test(token)')
      const hasSanitization = content.includes('validator.escape') || content.includes('sanitize')
      const hasXSSProtection = content.includes('replace') && content.includes('<script')

      this.test('Token format validation', () => hasTokenValidation)
      this.test('Input sanitization', () => hasSanitization)
      this.test('XSS protection', () => hasXSSProtection)
    }
  }

  // Test 7: Security Headers
  validateSecurityHeaders() {
    log('INFO', '🔍 Testing Security Headers...')

    const middlewarePath = 'api/auth/middleware.ts'

    if (fs.existsSync(middlewarePath)) {
      const content = fs.readFileSync(middlewarePath, 'utf8')

      // Check security headers
      const hasContentTypeOptions = content.includes('X-Content-Type-Options')
      const hasFrameOptions = content.includes('X-Frame-Options')
      const hasXSSProtection = content.includes('X-XSS-Protection')
      const hasReferrerPolicy = content.includes('Referrer-Policy')
      const hasCSP = content.includes('Content-Security-Policy')

      this.test('X-Content-Type-Options header', () => hasContentTypeOptions)
      this.test('X-Frame-Options header', () => hasFrameOptions)
      this.test('X-XSS-Protection header', () => hasXSSProtection)
      this.test('Referrer-Policy header', () => hasReferrerPolicy)
      this.test('Content-Security-Policy header', () => hasCSP)
    }
  }

  // Test 8: Error Handling Security
  validateErrorHandling() {
    log('INFO', '🔍 Testing Error Handling Security...')

    const middlewarePath = 'api/auth/middleware.ts'

    if (fs.existsSync(middlewarePath)) {
      const content = fs.readFileSync(middlewarePath, 'utf8')

      // Check for information disclosure
      const hasGenericErrors = content.includes('Authentication failed') || content.includes('Invalid or expired token')
      const hasSpecificErrors = content.includes('User not found') || content.includes('Password incorrect')
      const hasStackTraceHandling = content.includes('error.stack') || content.includes('production')

      this.test('Generic error messages', () => hasGenericErrors)
      this.test('No specific error details', () => !hasSpecificErrors)
      this.test('Stack trace handling', () => hasStackTraceHandling)
    }
  }

  // Generate security report
  generateReport() {
    log('INFO', '📊 Generating Security Assessment Report...')

    const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL')
    const highIssues = this.issues.filter(i => i.severity === 'HIGH')
    const mediumIssues = this.issues.filter(i => i.severity === 'MEDIUM')

    const report = {
      summary: {
        totalTests: this.totalTests,
        passedTests: this.passedTests,
        failedTests: this.totalTests - this.passedTests,
        successRate: `${Math.round((this.passedTests / this.totalTests) * 100)}%`
      },
      securityScore: this.calculateSecurityScore(),
      issues: {
        critical: criticalIssues.length,
        high: highIssues.length,
        medium: mediumIssues.length
      },
      details: this.issues,
      recommendations: this.generateRecommendations()
    }

    // Save report to file
    const reportPath = 'claudedocs/security_validation_report.json'
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

    this.printSummary(report)

    return report
  }

  calculateSecurityScore() {
    const baseScore = 100
    const criticalPenalty = this.issues.filter(i => i.severity === 'CRITICAL').length * 20
    const highPenalty = this.issues.filter(i => i.severity === 'HIGH').length * 10
    const mediumPenalty = this.issues.filter(i => i.severity === 'MEDIUM').length * 5

    const score = Math.max(0, baseScore - criticalPenalty - highPenalty - mediumPenalty)
    return score
  }

  generateRecommendations() {
    const recommendations = []

    if (this.issues.some(i => i.category === 'Environment Variables')) {
      recommendations.push({
        priority: 'IMMEDIATE',
        action: 'Fix environment variable inconsistencies',
        timeline: '1-2 days',
        impact: 'Prevents authentication failures in production'
      })
    }

    if (this.issues.some(i => i.category === 'Token Security')) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Implement secure token caching',
        timeline: '3-7 days',
        impact: 'Prevents session fixation and token reuse attacks'
      })
    }

    if (this.issues.some(i => i.category === 'CSRF Protection')) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Add CSRF protection mechanisms',
        timeline: '5-10 days',
        impact: 'Prevents cross-site request forgery attacks'
      })
    }

    if (this.issues.some(i => i.category === 'Access Control')) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Migrate role management to database',
        timeline: '1-2 weeks',
        impact: 'Prevents privilege escalation and improves maintainability'
      })
    }

    return recommendations
  }

  printSummary(report) {
    console.log(`\n${colors.bold}${colors.cyan}🔒 AUTHENTICATION SECURITY ASSESSMENT SUMMARY${colors.reset}`)
    console.log(`${colors.cyan}═══════════════════════════════════════════════${colors.reset}\n`)

    // Test Results
    console.log(`${colors.bold}📊 Test Results:${colors.reset}`)
    console.log(`   Total Tests: ${report.summary.totalTests}`)
    console.log(`   Passed: ${colors.green}${report.summary.passedTests}${colors.reset}`)
    console.log(`   Failed: ${colors.red}${report.summary.failedTests}${colors.reset}`)
    console.log(`   Success Rate: ${report.summary.successRate}\n`)

    // Security Score
    const scoreColor = report.securityScore >= 80 ? colors.green :
                      report.securityScore >= 60 ? colors.yellow : colors.red
    console.log(`${colors.bold}🏆 Security Score: ${scoreColor}${report.securityScore}/100${colors.reset}\n`)

    // Issues Summary
    console.log(`${colors.bold}🚨 Security Issues Found:${colors.reset}`)
    if (report.issues.critical > 0) {
      console.log(`   ${colors.red}CRITICAL: ${report.issues.critical}${colors.reset}`)
    }
    if (report.issues.high > 0) {
      console.log(`   ${colors.yellow}HIGH: ${report.issues.high}${colors.reset}`)
    }
    if (report.issues.medium > 0) {
      console.log(`   ${colors.blue}MEDIUM: ${report.issues.medium}${colors.reset}`)
    }

    if (report.issues.critical === 0 && report.issues.high === 0 && report.issues.medium === 0) {
      console.log(`   ${colors.green}No security issues found!${colors.reset}`)
    }

    // Top Recommendations
    if (report.recommendations.length > 0) {
      console.log(`\n${colors.bold}📋 Top Recommendations:${colors.reset}`)
      report.recommendations.slice(0, 3).forEach((rec, index) => {
        const priorityColor = rec.priority === 'IMMEDIATE' ? colors.red :
                             rec.priority === 'HIGH' ? colors.yellow : colors.blue
        console.log(`   ${index + 1}. ${priorityColor}[${rec.priority}]${colors.reset} ${rec.action}`)
        console.log(`      └─ Timeline: ${rec.timeline}`)
      })
    }

    console.log(`\n${colors.cyan}Full report saved to: claudedocs/security_validation_report.json${colors.reset}`)
    console.log(`${colors.cyan}Detailed assessment: claudedocs/AUTHENTICATION_SECURITY_ASSESSMENT.md${colors.reset}`)
  }

  // Run all tests
  async runAllTests() {
    console.log(`${colors.bold}${colors.magenta}🔒 AUTHENTICATION SECURITY VALIDATION${colors.reset}`)
    console.log(`${colors.magenta}═══════════════════════════════════════${colors.reset}\n`)

    log('INFO', '🚀 Starting security validation...')

    // Run all validation tests
    this.validateEnvironmentVariables()
    this.validateTokenCaching()
    this.validateCSRFProtection()
    this.validateRateLimiting()
    this.validateRBAC()
    this.validateInputSecurity()
    this.validateSecurityHeaders()
    this.validateErrorHandling()

    // Generate and return report
    return this.generateReport()
  }
}

// Main execution
async function main() {
  try {
    const validator = new SecurityValidator()
    const report = await validator.runAllTests()

    // Exit with appropriate code based on security issues
    const exitCode = report.issues.critical > 0 ? 2 :
                    report.issues.high > 0 ? 1 : 0

    process.exit(exitCode)
  } catch (error) {
    console.error(`${colors.red}Fatal error during security validation:${colors.reset}`, error)
    process.exit(3)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { SecurityValidator }