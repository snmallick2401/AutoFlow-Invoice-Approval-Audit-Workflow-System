// backend/src/utils/emailService.js
const nodemailer = require('nodemailer');

// Configuration
const DEFAULT_FROM = process.env.EMAIL_FROM || 'AutoFlow <no-reply@autoflow.local>';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'; // Strict boolean check
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let transporterPromise = null;

/**
 * Singleton Transporter Factory
 * - Uses SMTP if configured
 * - Falls back to Ethereal (fake SMTP) if variables are missing
 */
async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    try {
      if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        // Option A: Production SMTP (Gmail, SendGrid, etc.)
        const t = nodemailer.createTransport({
          host: SMTP_HOST,
          port: SMTP_PORT,
          secure: SMTP_SECURE, // true for 465, false for other ports
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
          tls: {
            // Check for self-signed cert issues in dev environments
            rejectUnauthorized: process.env.NODE_ENV === 'production', 
          },
          connectionTimeout: 10000,
        });

        try {
          await t.verify();
          console.info(`✅ Email Service Ready (${SMTP_HOST})`);
        } catch (verifyErr) {
          console.error('❌ SMTP Connection Failed:', verifyErr.message);
          // Don't crash, just let it fail on send attempts
        }
        return t;

      } else {
        // Option B: Ethereal Fallback (Development)
        console.warn('⚠️ SMTP not configured — using Ethereal (Dev Mode)');
        const testAccount = await nodemailer.createTestAccount();
        const t = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        return t;
      }
    } catch (err) {
      console.error('❌ Failed to initialize email transporter:', err.message);
      // Return a dummy transporter to prevent server crashes
      return {
        sendMail: async () => ({ accepted: [], rejected: [], info: 'dummy-fail' }),
      };
    }
  })();

  return transporterPromise;
}

/**
 * Helper: Format Currency
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Helper: Generate Email Body (HTML & Text)
 */
function generateEmailContent({ title, invoice, actor, reason, color }) {
  const amountStr = invoice.amount ? formatCurrency(invoice.amount) : '0.00';
  const dateStr = invoice.invoiceDate 
    ? new Date(invoice.invoiceDate).toISOString().split('T')[0] 
    : 'N/A';
  
  // 1. Plain Text Version
  const text = [
    `AutoFlow Notification: ${title}`,
    `================================`,
    `Invoice ID: ${invoice.invoiceId}`,
    `Vendor:     ${invoice.vendorName}`,
    `Amount:     ${amountStr}`,
    `Date:       ${dateStr}`,
    `Status:     ${invoice.status}`,
    actor ? `Action by:  ${actor.name} (${actor.role})` : '',
    reason ? `Reason:     ${reason}` : '',
    `--------------------------------`,
    `Log in to AutoFlow to view details.`
  ].filter(Boolean).join('\n');

  // 2. HTML Version
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: ${color || '#4f46e5'}; padding: 20px; color: white;">
        <h2 style="margin: 0;">${title}</h2>
      </div>
      <div style="padding: 20px; background-color: #ffffff;">
        <p><strong>Invoice ID:</strong> ${invoice.invoiceId}</p>
        <p><strong>Vendor:</strong> ${invoice.vendorName}</p>
        <p><strong>Amount:</strong> <span style="font-family: monospace; font-size: 1.1em;">${amountStr}</span></p>
        <p><strong>Date:</strong> ${dateStr}</p>
        <p>
          <strong>Status:</strong> 
          <span style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${invoice.status}</span>
        </p>
        ${actor ? `<p><strong>Action by:</strong> ${actor.name} <span style="color: #6b7280;">(${actor.role})</span></p>` : ''}
        ${reason ? `<div style="margin-top: 15px; padding: 10px; background-color: #fee2e2; border-left: 4px solid #ef4444; color: #b91c1c;"><strong>Reason:</strong> ${reason}</div>` : ''}
      </div>
      <div style="padding: 15px; background-color: #f9fafb; font-size: 0.85em; color: #6b7280; text-align: center;">
        This is an automated message from <strong>AutoFlow</strong>.
      </div>
    </div>
  `;

  return { text, html };
}

/**
 * Generic Send Function with Retry Logic
 */
async function sendMail(opts) {
  if (!opts || !opts.to || !opts.subject) {
    return { ok: false, error: 'Missing required email fields' };
  }

  const transporter = await getTransporter();

  const mailOptions = {
    from: DEFAULT_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  };

  // Retry up to 2 times
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      
      const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
      if (previewUrl) {
        console.log(`📨 Ethereal Preview: ${previewUrl}`);
      }

      return { ok: true, info };
    } catch (err) {
      console.warn(`⚠️ Email attempt ${attempt} failed: ${err.message}`);
      if (attempt === 2) {
        return { ok: false, error: err.message };
      }
      // Wait 500ms before retry
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/* =================================================
   Public API Methods
================================================= */

async function sendInvoiceSubmittedEmail({ invoice, to, actor }) {
  if (!invoice || !to) return;
  
  const content = generateEmailContent({
    title: 'New Invoice Submitted',
    invoice,
    actor,
    color: '#2563eb' // Blue
  });

  return sendMail({
    to,
    subject: `[AutoFlow] Invoice Submitted: ${invoice.invoiceId}`,
    text: content.text,
    html: content.html,
  });
}

async function sendInvoiceApprovedEmail({ invoice, to, actor }) {
  if (!invoice || !to) return;

  const content = generateEmailContent({
    title: 'Invoice Approved',
    invoice,
    actor,
    color: '#16a34a' // Green
  });

  return sendMail({
    to,
    subject: `[AutoFlow] Approved: ${invoice.invoiceId}`,
    text: content.text,
    html: content.html,
  });
}

async function sendInvoiceRejectedEmail({ invoice, to, actor, reason }) {
  if (!invoice || !to) return;

  const content = generateEmailContent({
    title: 'Invoice Rejected',
    invoice,
    actor,
    reason,
    color: '#dc2626' // Red
  });

  return sendMail({
    to,
    subject: `[AutoFlow] Rejected: ${invoice.invoiceId}`,
    text: content.text,
    html: content.html,
  });
}

module.exports = {
  sendMail,
  sendInvoiceSubmittedEmail,
  sendInvoiceApprovedEmail,
  sendInvoiceRejectedEmail,
};
