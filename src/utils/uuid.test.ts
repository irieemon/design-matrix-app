import { describe, test, expect } from 'vitest'
import {
  generateUUID,
  isValidUUID,
  generateDemoUUID,
  isDemoUUID,
  sanitizeUserId,
  legacyIdToUUID,
  ensureUUID
} from './uuid'

describe('UUID Utilities', () => {
  test('generateUUID creates some kind of UUID (mocked in tests)', () => {
    const uuid = generateUUID()
    expect(typeof uuid).toBe('string')
    expect(uuid.length).toBeGreaterThan(0)
    // In test environment, crypto.randomUUID is mocked to return 'test-uuid-...'
    expect(uuid).toMatch(/^test-uuid-/)
  })

  test('isValidUUID validates UUID format correctly', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(isValidUUID('invalid-uuid')).toBe(false)
    expect(isValidUUID('test-user-id')).toBe(false)
    expect(isValidUUID('')).toBe(false)
    expect(isValidUUID('00000000-0000-0000-0000-000000000001')).toBe(true)
  })

  test('generateDemoUUID creates valid demo UUID', () => {
    const demoUuid = generateDemoUUID('1')
    expect(demoUuid).toBe('00000000-0000-0000-0000-000000000001')
    expect(isValidUUID(demoUuid)).toBe(true)
    expect(isDemoUUID(demoUuid)).toBe(true)
  })

  test('isDemoUUID identifies demo UUIDs', () => {
    expect(isDemoUUID('00000000-0000-0000-0000-000000000001')).toBe(true)
    expect(isDemoUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(false)
    expect(isDemoUUID('test-user-id')).toBe(false)
  })

  test('sanitizeUserId handles valid and invalid IDs', () => {
    expect(sanitizeUserId('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(sanitizeUserId('test-user-id')).toBe('00000000-0000-0000-0000-000000000001')
    expect(sanitizeUserId('')).toBe(null)
    expect(sanitizeUserId(null)).toBe(null)
    expect(sanitizeUserId(undefined)).toBe(null)
  })

  test('legacyIdToUUID converts legacy IDs consistently', () => {
    const testId = legacyIdToUUID('test-user-id')
    const testId2 = legacyIdToUUID('test-user-id')

    expect(testId).toBe(testId2) // Should be consistent
    expect(isValidUUID(testId)).toBe(true)
    expect(testId).toBe('00000000-0000-0000-0000-000000000001') // Should map to demo UUID
  })

  test('ensureUUID always returns some UUID string', () => {
    expect(isValidUUID(ensureUUID('550e8400-e29b-41d4-a716-446655440000'))).toBe(true)
    expect(isValidUUID(ensureUUID('test-user-id'))).toBe(true)

    // In test environment, generateUUID returns a mocked string, so these will be test strings
    const emptyResult = ensureUUID('')
    const nullResult = ensureUUID(null)
    const undefinedResult = ensureUUID(undefined)

    expect(typeof emptyResult).toBe('string')
    expect(typeof nullResult).toBe('string')
    expect(typeof undefinedResult).toBe('string')
  })

  test('handles edge cases gracefully', () => {
    expect(sanitizeUserId('   ')).toBe(null) // Whitespace only
    expect(sanitizeUserId('test-')).toBe('00000000-0000-0000-0000-000000000001') // Starts with test-
    expect(isDemoUUID('00000000-0000-0000-0000-000000000000')).toBe(true) // Base demo UUID
  })
})