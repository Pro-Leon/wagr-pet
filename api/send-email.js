// Vercel API route for sending transactional emails via Brevo
// POST /api/send-email
// Types: sitter_invite, location_alert, support_reply, welcome, subscription

export const config = { api: { bodyParser: false } };

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API = 'https://api.brevo.com/v3/smtp/email';
const SENDER = { name: 'Pup File', email: 'hello@pupfile.com' };

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const origin = req.headers.origin;
  const allowedOrigins = ['https://pupfile.com', 'http://localhost:3000', 'http://localhost:5173'];
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  const body = JSON.parse(rawBody);

  if (!BREVO_API_KEY) {
    return res.status(500).json({ error: 'Brevo API key not configured' });
  }

  try {
    const result = await handleEmail(body);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Email error:', err);
    return res.status(200).json({ status: 'error', message: err.message });
  }
}

async function handleEmail({ type, to, toName, petName, link, message, ownerName, sitterName, tier, plan, report, note }) {
  let subject, htmlContent;

  switch (type) {
    case 'sitter_invite':
      subject = `${ownerName || 'Your friend'} invited you to care for ${petName || 'their pet'} on Pup File`;
      htmlContent = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#ea580c">Pup File</h2>
          <p>Hi ${toName || 'there'},</p>
          <p><strong>${ownerName || 'Someone'}</strong> has invited you to help care for <strong>${petName || 'their pet'}</strong> on Pup File.</p>
          <p>Click the button below to view their pet's profile and log care activities — no account needed.</p>
          <a href="${link}" style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0">View Pet &amp; Log Care</a>
          <p style="color:#666;font-size:0.85rem">This link is unique and expires when a new one is generated.</p>
        </div>`;
      break;

    case 'location_alert':
      subject = `📍 Location alert for ${petName || 'your pet'}`;
      htmlContent = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#ea580c">Pup File</h2>
          <p>Hi ${toName || 'there'},</p>
          <p>Someone scanned your pet <strong>${petName || 'unknown'}</strong>'s QR tag and shared their location.</p>
          <p><a href="${link}" style="color:#ea580c">View location on map</a></p>
          ${message ? `<p style="background:#f5f5f5;padding:12px;border-radius:8px;font-size:0.9rem">${message}</p>` : ''}
        </div>`;
      break;

    case 'support_reply':
      subject = `Pup File Support: ${escapeHtml(message) || 'We responded to your ticket'}`;
      htmlContent = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#ea580c">Pup File Support</h2>
          <p>Hi ${escapeHtml(toName) || 'there'},</p>
          <p>We've responded to your support ticket:</p>
          <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:12px 0;font-size:0.9rem">${escapeHtml(message || '').replace(/\n/g, '<br>')}</div>
          <p style="color:#666;font-size:0.85rem">You can view the full conversation in your dashboard.</p>
        </div>`;
      break;

    case 'welcome':
      subject = 'Welcome to Pup File — your pet care dashboard is ready';
      htmlContent = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#ea580c">Pup File</h2>
          <p>Hi ${toName || 'there'},</p>
          <p>Welcome to Pup File! Your smart dog care dashboard is ready to go.</p>
          <p>Here's what you can do:</p>
          <ul>
            <li>Log meals, medications, and bathroom breaks</li>
            <li>Track symptoms and grooming appointments</li>
            <li>Generate QR emergency tags for your pet's collar</li>
            <li>Share sitter magic links</li>
            <li>Use free toxicity and calorie calculators</li>
          </ul>
          <a href="${link || 'https://pupfile.com/dashboard'}" style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0">Go to Dashboard</a>
          <p style="color:#666;font-size:0.85rem">Start with the Starter plan — free forever, no credit card needed.</p>
        </div>`;
      break;

    case 'subscription':
      subject = `Pup File — you're now on the ${tier || 'paid'} plan!`;
      htmlContent = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#ea580c">Pup File</h2>
          <p>Hi ${toName || 'there'},</p>
          <p>Your subscription to <strong>${tier || 'a paid'}</strong> plan is now active on Pup File.</p>
          ${plan === 'yearly' ? '<p>You chose the yearly plan — great savings!</p>' : ''}
          <p>You now have access to all features in your tier. <a href="https://pupfile.com/dashboard" style="color:#ea580c">Go to your dashboard</a> to start using them.</p>
          <p style="color:#666;font-size:0.85rem">Need help? Reply to this email or contact support from your dashboard.</p>
        </div>`;
      break;

    case 'ai_report':
      subject = `AI Health Report — ${petName || 'Your Pet'} (Pup File)`;
      htmlContent = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#ea580c">Pup File — AI Health Report</h2>
          <p style="color:#666;font-size:0.85rem">Prepared for: <strong>${petName || 'Unknown Pet'}</strong></p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
          <div style="font-size:0.9rem;line-height:1.7;white-space:pre-wrap;font-family:monospace;background:#f9f9f9;padding:16px;border-radius:8px;margin:12px 0">${(report || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          ${note ? `<hr style="border:none;border-top:1px solid #eee;margin:16px 0"><p style="font-size:0.88rem;color:#333"><strong>Note from owner:</strong><br>${escapeHtml(note).replace(/\n/g, '<br>')}</p>` : ''}
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
          <p style="color:#999;font-size:0.75rem">Generated by Pup File — <a href="https://pupfile.com" style="color:#ea580c">pupfile.com</a></p>
        </div>`;
      break;

    default:
      subject = body.subject || 'Pup File notification';
      htmlContent = body.htmlContent || `<p>${body.message || ''}</p>`;
  }

  return sendBrevoEmail(to, toName, subject, htmlContent);
}

async function sendBrevoEmail(to, toName, subject, htmlContent) {
  const payload = {
    sender: SENDER,
    to: [{ email: to, name: toName || to.split('@')[0] }],
    subject,
    htmlContent,
  };

  const res = await fetch(BREVO_API, {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Brevo error ${res.status}: ${data.message || JSON.stringify(data)}`);
  }
  return { status: 'sent', messageId: data.messageId };
}
