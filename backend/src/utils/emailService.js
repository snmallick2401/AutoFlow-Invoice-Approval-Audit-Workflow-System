// backend/src/utils/emailService.js
const nodemailer = require('nodemailer');

const DEFAULT_FROM = process.env.EMAIL_FROM || 'AutoFlow <no-reply@autoflow.local>';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || false;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

let transporterPromise = null;

async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    try {
      if (SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_PORT) {
        // Production / Configured SMTP
        const t = nodemailer.createTransport({
          host: SMTP_HOST,
          port: SMTP_PORT,
          secure: SMTP_SECURE,
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
          connectionTimeout: 10_000,
        });

        try {
          await t.verify();
          console.info('Email transporter configured:', SMTP_HOST);
        } catch (verifyErr) {
          console.warn('SMTP verification failed:', verifyErr.message);
        }

        return t;
      } else {
        // Development / Ethereal Fallback
        console.warn('SMTP not configured — falling back to Ethereal');
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
      console.error('Failed to create transporter:', err);
      // Return dummy object to prevent crashes
      return {
        sendMail: async () => ({ accepted: [], rejected: [], info: 'dummy' }),
      };
    }
  })();

  return transporterPromise;
}

async function sendMail(opts) {
  if (!opts || !opts.to || !opts.subject || (!opts.text && !opts.html)) {
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

  // Retry logic (1 retry)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);

      const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
      if (previewUrl) {
        console.info(`Email Preview URL: ${previewUrl}`);
      }

      return { ok: true, info, previewUrl };
    } catch (err) {
      console.warn(`Email send attempt ${attempt} failed:`, err.message);
      if (attempt === 2) {
        return { ok: false, error: err.message || String(err) };
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

function buildInvoiceText({ eventType, invoice, actor }) {
  const lines = [];
  lines.push(`Event: ${eventType}`);
  if (actor && actor.name) lines.push(`Action by: ${actor.name} (${actor.role || 'unknown'})`);
  if (invoice) {
    if (invoice.invoiceId) lines.push(`Invoice ID: ${invoice.invoiceId}`);
    if (invoice.vendorName) lines.push(`Vendor: ${invoice.vendorName}`);
    if (typeof invoice.amount !== 'undefined') lines.push(`Amount: ${invoice.amount}`);
    if (invoice.invoiceDate) lines.push(`Invoice Date: ${new Date(invoice.invoiceDate).toISOString().split('T')[0]}`);
    lines.push(`Status: ${invoice.status}`);
  }
  lines.push('');
  lines.push('This is an automated message from AutoFlow.');
  return lines.join('\n');
}

async function sendInvoiceSubmittedEmail({ invoice, to, actor }) {
  if (!invoice || !to) return { ok: false, error: 'Missing data' };
  const subject = `Invoice Submitted: ${invoice.invoiceId || 'NEW'}`;
  const text = buildInvoiceText({ eventType: 'Invoice Submitted', invoice, actor });
  return sendMail({ to, subject, text });
}

async function sendInvoiceApprovedEmail({ invoice, to, actor }) {
  if (!invoice || !to) return { ok: false, error: 'Missing data' };
  const subject = `Invoice Approved: ${invoice.invoiceId}`;
  const text = buildInvoiceText({ eventType: 'Invoice Approved', invoice, actor });
  return sendMail({ to, subject, text });
}

async function sendInvoiceRejectedEmail({ invoice, to, actor, reason }) {
  if (!invoice || !to) return { ok: false, error: 'Missing data' };
  const subject = `Invoice Rejected: ${invoice.invoiceId}`;
  let text = buildInvoiceText({ eventType: 'Invoice Rejected', invoice, actor });
  if (reason) text += `\n\nReason: ${reason}`;
  return sendMail({ to, subject, text });
}

module.exports = {
  sendMail,
  sendInvoiceSubmittedEmail,
  sendInvoiceApprovedEmail,
  sendInvoiceRejectedEmail,
};
