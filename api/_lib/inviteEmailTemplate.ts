/**
 * Invite Email Template
 *
 * Pure builder for the collaborator-invitation email body. No env reads,
 * no I/O, no third-party deps. Consumed by api/invitations/create.ts which
 * passes the result to the Resend SDK.
 *
 * Per Phase 05.2 decisions: hand-written inline-styled HTML + plain-text
 * alternative, sapphire CTA button, project + role + inviter shown,
 * "ignore if unexpected" footer.
 */

export interface InviteEmailInput {
  projectName: string
  inviterName?: string | null
  inviterEmail: string
  role: 'viewer' | 'editor'
  inviteUrl: string
}

export interface InviteEmail {
  subject: string
  html: string
  text: string
}

/** Escape the five HTML-significant characters. No new dependency. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildInviteEmail(input: InviteEmailInput): InviteEmail {
  const { projectName, inviterName, inviterEmail, role, inviteUrl } = input

  const inviterDisplay = inviterName && inviterName.trim().length > 0
    ? inviterName
    : inviterEmail

  const subject = `You've been invited to ${projectName} on Prioritas`

  // Escaped fragments for HTML body
  const projectNameHtml = escapeHtml(projectName)
  const inviterHtml = escapeHtml(inviterDisplay)
  const roleHtml = escapeHtml(role)
  // inviteUrl is generated server-side from a UUID + origin; safe to embed
  // as href, but escape quotes defensively.
  const hrefSafe = inviteUrl.replace(/"/g, '&quot;')

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,0.08);overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 8px 40px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;color:#0f172a;">You've been invited to ${projectNameHtml}</h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#374151;">
                <strong>${inviterHtml}</strong> invited you to collaborate on
                <strong>${projectNameHtml}</strong> in Prioritas as a <strong>${roleHtml}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 40px 24px 40px;">
              <a href="${hrefSafe}"
                 style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;">
                Accept invitation
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#6b7280;">
                Or paste this link into your browser:
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#0369a1;word-break:break-all;">
                ${hrefSafe}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 32px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `You've been invited to ${projectName} on Prioritas`,
    ``,
    `${inviterDisplay} invited you to collaborate on ${projectName} as a ${role}.`,
    ``,
    `Accept the invitation:`,
    inviteUrl,
    ``,
    `If you didn't expect this invitation, you can safely ignore this email.`,
  ].join('\n')

  return { subject, html, text }
}
