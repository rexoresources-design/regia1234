const RESPONSE_MODE = process.env.RESPONSE_MODE || 'whatsauto'; // whatsauto returns { reply }, autoresponder returns { replies: [{ message }] }
const BOT_SECRET = process.env.BOT_SECRET || '';

function sendBotResponse(res, message) {
  if (RESPONSE_MODE === 'autoresponder') {
    return res.status(200).json({ replies: [{ message }] });
  }
  return res.status(200).json({ reply: message });
}

function getMessageAndSender(body) {
  const query = body?.query || body || {};
  return {
    message: String(query.message || query.text || body?.message || '').trim(),
    sender: String(query.sender || query.from || body?.sender || body?.from || 'customer').trim(),
    phone: String(query.phone || query.number || query.senderNumber || body?.phone || '').trim()
  };
}

function safeSlug(input) {
  return String(input || 'sales-page')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 70) || `sales-page-${Date.now()}`;
}

function basicSalesPageHtml(data) {
  const name = data.businessName || data.productName || 'Your Offer';
  const offer = data.offer || data.message || '';
  const whatsapp = process.env.BUSINESS_WHATSAPP || '';
  return `
<section style="font-family:Arial,sans-serif;max-width:1100px;margin:0 auto;padding:60px 24px;line-height:1.6;color:#111827;">
  <div style="background:linear-gradient(135deg,#111827,#7f1d1d);color:white;border-radius:28px;padding:48px 28px;text-align:center;">
    <p style="letter-spacing:.18em;text-transform:uppercase;color:#facc15;font-weight:700;margin:0 0 12px;">Premium Sales Page Preview</p>
    <h1 style="font-size:44px;line-height:1.05;margin:0 0 18px;">${escapeHtml(name)}</h1>
    <p style="font-size:20px;max-width:760px;margin:0 auto;">A clear, persuasive sales page draft prepared from the details shared on WhatsApp.</p>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:32px;">
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:20px;padding:24px;">
      <h2 style="margin-top:0;">The Offer</h2>
      <p>${escapeHtml(offer || 'Offer details will appear here after client information is collected.')}</p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;padding:24px;">
      <h2 style="margin-top:0;">Why It Works</h2>
      <ul><li>Clear headline</li><li>Strong benefits</li><li>Trust-building sections</li><li>Direct WhatsApp call-to-action</li></ul>
    </div>
  </div>

  <div style="margin-top:32px;background:#111827;color:white;border-radius:22px;padding:32px;text-align:center;">
    <h2 style="margin-top:0;">Ready to proceed?</h2>
    <p>Review this draft and reply on WhatsApp with your corrections or approval.</p>
    ${whatsapp ? `<a href="https://wa.me/${escapeHtml(whatsapp.replace(/\D/g,''))}" style="display:inline-block;background:#22c55e;color:#052e16;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px;">Chat on WhatsApp</a>` : ''}
  </div>
</section>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function createWordPressPage({ title, content, slug }) {
  const siteUrl = process.env.WP_SITE_URL;
  const username = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;
  const status = process.env.WP_DEFAULT_STATUS || 'draft';

  if (!siteUrl || !username || !appPassword) {
    return { ok: false, error: 'WordPress environment variables are not configured yet.' };
  }

  const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
  const response = await fetch(`${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/pages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`
    },
    body: JSON.stringify({ title, content, slug, status })
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: json?.message || `WordPress error ${response.status}` };
  }

  return { ok: true, link: json.link, id: json.id, status: json.status };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Send POST requests to this endpoint from WhatsAuto/AutoResponder.' });
  }

  const secret = req.headers['x-bot-secret'] || req.query?.secret;
  if (BOT_SECRET && secret !== BOT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { message, sender } = getMessageAndSender(req.body);
  const lower = message.toLowerCase();

  if (!message) {
    return sendBotResponse(res, 'Please send your sales page details so I can assist you.');
  }

  const wantsSalesPage = lower.includes('sales page') || lower.includes('landing page') || lower.includes('funnel') || lower.includes('website');
  const hasDetails = lower.includes('business') || lower.includes('product') || lower.length > 80;

  if (!wantsSalesPage && !hasDetails) {
    return sendBotResponse(res, 'Hello 👋 Please send the product/business details for the sales page: business name, what you sell, price, benefits, target audience, and WhatsApp number.');
  }

  const productMatch = message.match(/(?:product|business|name)\s*[:\-]\s*(.+)/i);
  const businessName = productMatch?.[1]?.split('\n')[0]?.trim() || `${sender} Sales Page`;
  const title = `${businessName} Sales Page Preview`;
  const slug = `preview-${safeSlug(businessName)}-${Date.now()}`;
  const html = basicSalesPageHtml({ businessName, message, offer: message });

  const wpResult = await createWordPressPage({ title, content: html, slug });

  if (!wpResult.ok) {
    return sendBotResponse(res, `Thank you. I have received your sales page details. Your preview is being prepared now. ${wpResult.error.includes('environment') ? 'Setup is not fully connected yet, so a team member will complete it and send your preview link shortly.' : 'A team member will send your preview link shortly.'}`);
  }

  return sendBotResponse(res, `Thank you. Your sales page preview has been created. Please review it here: ${wpResult.link}`);
}
