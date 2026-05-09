import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

export class EmailService {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  async sendFormInvitation(params: {
    to: string[];
    senderName: string;
    formUrl: string;
    personalMessage?: string;
  }): Promise<void> {
    const { to, senderName, formUrl, personalMessage } = params;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Profile Invitation</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #1f1f1f;border-radius:12px;overflow:hidden;max-width:560px;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f2417 0%,#111 100%);padding:32px 40px;border-bottom:1px solid #1f1f1f;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:32px;height:32px;background:#10b981;border-radius:6px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-weight:900;font-size:16px;line-height:32px;">G</span>
                  </td>
                  <td style="padding-left:10px;">
                    <span style="color:#fff;font-weight:700;font-size:18px;letter-spacing:-0.5px;">Graphite</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                You've been invited to share your profile
              </h1>
              <p style="margin:0 0 24px;color:#888;font-size:14px;line-height:1.6;">
                <strong style="color:#ccc;">${senderName}</strong> wants to learn more about your background and skills.
              </p>
              ${personalMessage ? `
              <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #10b981;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0;color:#aaa;font-size:13px;line-height:1.6;font-style:italic;">"${personalMessage}"</p>
              </div>` : ''}
              <p style="margin:0 0 24px;color:#666;font-size:13px;line-height:1.6;">
                The form takes just a few minutes. You can share your LinkedIn, GitHub, Twitter, resume, hackathons, and project links — whatever you're comfortable sharing.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#10b981;border-radius:8px;">
                    <a href="${formUrl}" style="display:inline-block;padding:14px 28px;color:#fff;font-weight:600;font-size:14px;text-decoration:none;letter-spacing:0.2px;">
                      Share Your Profile →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#444;font-size:11px;line-height:1.5;">
                Or copy this link: <a href="${formUrl}" style="color:#10b981;text-decoration:none;">${formUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1a1a1a;">
              <p style="margin:0;color:#333;font-size:11px;">
                Sent via Graphite · AI-powered Builder Reputation Graph
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: `"${env.FROM_NAME}" <${env.SMTP_USER}>`,
        to: to.join(', '),
        subject: `${senderName} invited you to share your profile on Graphite`,
        html,
      });
      logger.info({ to, senderName }, 'Form invitation email sent');
    } catch (err: any) {
      logger.error({ err, to }, 'SMTP email delivery failed');
      throw new AppError(
        err?.message ?? 'Email delivery failed',
        502,
        'EMAIL_DELIVERY_FAILED'
      );
    }
  }
}
