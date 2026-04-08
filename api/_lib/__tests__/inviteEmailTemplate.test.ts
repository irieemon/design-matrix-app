/**
 * Tests for buildInviteEmail — pure template function.
 */

import { describe, it, expect } from 'vitest'
import { buildInviteEmail } from '../inviteEmailTemplate'

const base = {
  projectName: 'Acme',
  inviterName: 'Alice',
  inviterEmail: 'alice@example.com',
  role: 'editor' as const,
  inviteUrl: 'https://prioritas.ai/invite#tok_abc123',
}

describe('buildInviteEmail', () => {
  it('returns the canonical subject line for the project name', () => {
    const { subject } = buildInviteEmail({ ...base, projectName: 'Acme' })
    expect(subject).toBe("You've been invited to Acme on Prioritas")
  })

  it('embeds inviteUrl as an href and includes the role label in html', () => {
    const { html } = buildInviteEmail(base)
    expect(html).toContain(`href="${base.inviteUrl}"`)
    expect(html).toContain('editor')
  })

  it('includes inviteUrl as plain text and the project name in text alternative', () => {
    const { text } = buildInviteEmail(base)
    expect(text).toContain(base.inviteUrl)
    expect(text).toContain('Acme')
  })

  it('falls back to inviterEmail when inviterName is empty', () => {
    const { html } = buildInviteEmail({ ...base, inviterName: '' })
    expect(html).toContain('alice@example.com')
  })

  it('html contains project name and an "ignore" footer phrase', () => {
    const { html } = buildInviteEmail(base)
    expect(html).toContain('Acme')
    expect(html.toLowerCase()).toContain('ignore')
  })

  it('escapes HTML-unsafe characters in projectName', () => {
    const { html } = buildInviteEmail({ ...base, projectName: '<script>&"' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
