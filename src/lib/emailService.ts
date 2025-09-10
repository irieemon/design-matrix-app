import emailjs from '@emailjs/browser'
import { logger } from '../utils/logger'

// EmailJS configuration - loads from environment variables
const EMAIL_CONFIG = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || '',
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '',
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || ''
}

interface InvitationEmailData {
  inviterName: string
  inviterEmail: string
  inviteeEmail: string
  projectName: string
  role: string
  invitationUrl: string
}

export class EmailService {
  static async sendCollaborationInvitation(data: InvitationEmailData): Promise<boolean> {
    try {
      logger.debug('📧 EmailService: Preparing to send invitation email...')
      logger.debug('📧 EmailService: Email data:', data)

      // Check if EmailJS is properly configured
      logger.debug('🔧 EmailJS Config Check:', {
        hasServiceId: !!EMAIL_CONFIG.serviceId,
        hasTemplateId: !!EMAIL_CONFIG.templateId,
        hasPublicKey: !!EMAIL_CONFIG.publicKey,
        serviceId: EMAIL_CONFIG.serviceId,
        templateId: EMAIL_CONFIG.templateId
      })

      if (!EMAIL_CONFIG.serviceId || !EMAIL_CONFIG.templateId || !EMAIL_CONFIG.publicKey) {
        logger.warn('⚠️ EmailJS not fully configured - using fallback email method')
        logger.warn('ℹ️ To enable automatic emails, add your EmailJS credentials to .env.local')
        return this.sendEmailFallback(data)
      }

      // EmailJS template parameters
      const templateParams = {
        inviter_name: data.inviterName,
        inviter_email: data.inviterEmail,
        invitee_email: data.inviteeEmail,
        project_name: data.projectName,
        role: data.role,
        invitation_url: data.invitationUrl,
        to_email: data.inviteeEmail
      }

      logger.debug('📧 EmailService: Sending via EmailJS...')
      
      const response = await emailjs.send(
        EMAIL_CONFIG.serviceId,
        EMAIL_CONFIG.templateId,
        templateParams,
        EMAIL_CONFIG.publicKey
      )

      logger.debug('✅ EmailService: Email sent successfully via EmailJS:', response)
      return true

    } catch (error) {
      logger.error('❌ EmailService: Failed to send via EmailJS:', error)
      
      // Fallback to alternative method
      logger.debug('🔄 EmailService: Trying fallback email method...')
      return this.sendEmailFallback(data)
    }
  }

  private static async sendEmailFallback(data: InvitationEmailData): Promise<boolean> {
    try {
      logger.debug('📧 EmailService: Using fallback email method (mailto)')
      
      // Create a professional email template
      const emailSubject = `You're invited to collaborate on "${data.projectName}" - Prioritas`
      
      const emailBody = `Hello!

${data.inviterName} (${data.inviterEmail}) has invited you to collaborate on the project "${data.projectName}" in Prioritas.

Your Role: ${data.role.charAt(0).toUpperCase() + data.role.slice(1)}

Project Access: ${data.invitationUrl}

Role Permissions:
${this.getRolePermissions(data.role)}

To get started:
1. Click the link above to access the project
2. Create an account if you don't have one
3. Start collaborating!

Best regards,
The Prioritas Team

---
This invitation was sent by ${data.inviterName} (${data.inviterEmail})
If you didn't expect this invitation, you can safely ignore this email.`

      // Open mailto link to allow user to send the email manually
      const mailtoLink = `mailto:${data.inviteeEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
      
      // For demo purposes, we'll also show a notification
      this.showEmailPreview(data, emailSubject, emailBody)
      
      // Open the mailto link
      if (typeof window !== 'undefined') {
        window.open(mailtoLink, '_blank')
      }

      logger.debug('✅ EmailService: Fallback email prepared and opened')
      return true

    } catch (error) {
      logger.error('❌ EmailService: Fallback method failed:', error)
      return false
    }
  }

  private static getRolePermissions(role: string): string {
    switch (role) {
      case 'admin':
        return '• Full project management\n• Invite/remove collaborators\n• Edit project settings\n• Create, edit, and delete ideas'
      case 'editor':
        return '• Create and edit ideas\n• Move ideas around the matrix\n• Comment on ideas\n• View all project content'
      case 'viewer':
        return '• View project and ideas\n• View roadmap and analytics\n• Read-only access'
      default:
        return '• Standard collaboration permissions'
    }
  }

  private static showEmailPreview(data: InvitationEmailData, subject: string, body: string): void {
    if (typeof window !== 'undefined') {
      // Create a temporary notification or alert
      const previewWindow = window.open('', '_blank', 'width=600,height=400')
      if (previewWindow) {
        previewWindow.document.write(`
          <html>
            <head>
              <title>Email Preview - Invitation to ${data.inviteeEmail}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                .email-preview { background: #f5f5f5; padding: 20px; border-radius: 8px; }
                .subject { font-weight: bold; margin-bottom: 15px; color: #333; }
                .body { white-space: pre-wrap; background: white; padding: 15px; border-radius: 4px; }
                .footer { margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <h2>📧 Email Invitation Preview</h2>
              <div class="email-preview">
                <div class="subject">Subject: ${subject}</div>
                <div class="body">${body.replace(/\n/g, '<br>')}</div>
                <div class="footer">
                  <strong>Note:</strong> This email has been prepared for you to send. 
                  Check your email client or manually copy this content to send to ${data.inviteeEmail}
                </div>
              </div>
            </body>
          </html>
        `)
      }
    }
  }

  // Method to generate invitation URL (you can customize this)
  static generateInvitationUrl(projectId: string, invitationToken?: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://prioritas.app'
    return `${baseUrl}/?project=${projectId}&invite=${invitationToken || 'demo'}`
  }

  // Method to set up EmailJS (call this once with your credentials)
  static configureEmailJS(serviceId: string, templateId: string, publicKey: string): void {
    EMAIL_CONFIG.serviceId = serviceId
    EMAIL_CONFIG.templateId = templateId  
    EMAIL_CONFIG.publicKey = publicKey
    logger.debug('✅ EmailJS configured successfully')
  }
}