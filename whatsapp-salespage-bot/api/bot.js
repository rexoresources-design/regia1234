const RESPONSE_MODE = process.env.RESPONSE_MODE || 'whatsauto';
const BOT_SECRET = process.env.BOT_SECRET || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
const PREVIEW_EXPIRY_MINUTES = Number(process.env.PREVIEW_EXPIRY_MINUTES || 30);

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

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function hasEnoughSalesPageDetails(message) {
  const lower = message.toLowerCase();
  const signals = [
    'business name',
    'product',
    'service',
    'price',
    'benefit',
    'target audience',
    'whatsapp',
    'offer',
    'selling',
    'brand'
  ];
  const matched = signals.filter((signal) => lower.includes(signal)).length;
  return message.length > 120 && matched >= 3;
}

function extractBusinessName(message, sender) {
  const match = message.match(/(?:business name|product name|brand name|business|product|name)\s*[:\-]\s*(.+)/i);
  return match?.[1]?.split('\n')[0]?.trim() || `${sender} Sales Page`;
}

function introReply() {
  return `Hello 👋 Yes, we can help you create a high-converting sales page.\n\nPlease send these details:\n\n1. Business or product name\n2. What you are selling\n3. Price or offer\n4. Main benefits\n5. Target audience\n6. WhatsApp number for the page\n7. Product images, logo, or brand colour if available\n\nOnce I have the details, I’ll prepare your preview.`;
}

function needMoreDetailsReply() {
  return `Thank you. Please send the full sales page details in one message so I can prepare your preview properly:\n\nBusiness/product name:\nWhat you sell:\nPrice/offer:\nMain benefits:\nTarget audience:\nWhatsApp number:\nBrand colour or style:\n\nAfter that, I’ll prepare the preview link.`;
}

async function generateSalesPageWithClaude({ businessName, customerMessage, expiryIso }) {
  if (!ANTHROPIC_API_KEY) {
    return fallbackSalesPageHtml({ businessName, customerMessage, expiryIso });
  }

  const prompt = `You are a senior Nigerian conversion copywriter and web designer for Regia Digitals. Create a premium high-converting one-page sales page in clean HTML only.\n\nRules:\n- Return only the HTML that should be placed inside a WordPress page.\n- No markdown. No code fences.\n- Use inline CSS only.\n- Make it mobile-friendly, clean, premium, persuasive, and business-ready.\n- Do not mention WordPress, Claude, AI, Vercel, or automation.\n- Use Nigerian business-friendly English.\n- Include hero, pain/problem, solution, benefits, offer, why choose us, FAQ, and CTA sections.\n- Use the client details below.\n- Add a visible note near the top: This preview link expires in ${PREVIEW_EXPIRY_MINUTES} minutes.\n- Include this exact expiry wrapper script at the end of the HTML, replacing nothing:\n<script>\n(function(){\n  var expiry = new Date('${expiryIso}').getTime();\n  function checkExpiry(){\n    if(Date.now() > expiry){\n      document.body.innerHTML = '<main style="font-family:Arial,sans-serif;min-height:80vh;display:flex;align-items:center;justify-content:center;padding:30px;background:#111827;color:#fff;text-align:center;"><div><h1 style="font-size:38px;margin-bottom:12px;">Preview Expired</h1><p style="font-size:18px;max-width:620px;line-height:1.6;">This sales page preview has expired. Please return to WhatsApp to request a fresh preview or speak with Regia Digitals.</p></div></main>';\n    }\n  }\n  checkExpiry();\n  setInterval(checkExpiry, 30000);\n})();\n</script>\n\nClient/business name: ${businessName}\nClient WhatsApp message/details:\n${customerMessage}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        temperature: 0.6,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Claude error:', data);
      return fallbackSalesPageHtml({ businessName, customerMessage, expiryIso });
    }

    const html = data?.content?.[0]?.text?.trim();
    return html || fallbackSalesPageHtml({ businessName, customerMessage, expiryIso });
  } catch (error) {
    console.error('Claude request failed:', error);
    return fallbackSalesPageHtml({ businessName, customerMessage, expiryIso });
  }
}

function fallbackSalesPageHtml({ businessName, customerMessage, expiryIso }) {
  const whatsapp = process.env.BUSINESS_WHATSAPP || '';
  return `
<section style="font-family:Arial,sans-serif;max-width:1120px;margin:0 auto;padding:56px 22px;line-height:1.65;color:#111827;">
  <div style="background:linear-gradient(135deg,#111827,#7f1d1d);color:white;border-radius:30px;padding:48px 26px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.18);">
    <p style="letter-spacing:.16em;text-transform:uppercase;color:#facc15;font-weight:800;margin:0 0 14px;">Sales Page Preview</p>
    <h1 style="font-size:42px;line-height:1.05;margin:0 0 16px;">${escapeHtml(businessName)}</h1>
    <p style="font-size:19px;max-width:760px;margin:0 auto;">A clean, persuasive preview prepared from the details shared on WhatsApp.</p>
    <p style="margin:22px auto 0;display:inline-block;background:#facc15;color:#422006;font-weight:800;padding:10px 16px;border-radius:999px;">This preview expires in ${PREVIEW_EXPIRY_MINUTES} minutes.</p>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:22px;margin-top:32px;">
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:22px;padding:24px;">
      <h2 style="margin-top:0;">Your Offer</h2>
      <p>${escapeHtml(customerMessage)}</p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:22px;padding:24px;">
      <h2 style="margin-top:0;">What This Page Will Do</h2>
      <ul><li>Explain the offer clearly</li><li>Show the benefits</li><li>Build trust</li><li>Push visitors to WhatsApp</li></ul>
    </div>
  </div>
  <div style="margin-top:32px;background:#111827;color:white;border-radius:22px;padding:32px;text-align:center;">
    <h2 style="margin-top:0;">Ready to continue?</h2>
    <p>Review this preview and reply on WhatsApp with approval or corrections.</p>
    ${whatsapp ? `<a href="https://wa.me/${escapeHtml(whatsapp.replace(/\D/g,''))}" style="display:inline-block;background:#22c55e;color:#052e16;text-decoration:none;font-weight:900;padding:14px 24px;border-radius:999px;">Chat on WhatsApp</a>` : ''}
  </div>
</section>
<script>
(function(){
  var expiry = new Date('${expiryIso}').getTime();
  function checkExpiry(){
    if(Date.now() > expiry){
      document.body.innerHTML = '<main style="font-family:Arial,sans-serif;min-height:80vh;display:flex;align-items:center;justify-content:center;padding:30px;background:#111827;color:#fff;text-align:center;"><div><h1 style="font-size:38px;margin-bottom:12px;">Preview Expired</h1><p style="font-size:18px;max-width:620px;line-height:1.6;">This sales page preview has expired. Please return to WhatsApp to request a fresh preview or speak with Regia Digitals.</p></div></main>';
    }
  }
  checkExpiry();
  setInterval(checkExpiry, 30000);
})();
</script>`;
}

async function createWordPressPage({ title, content, slug }) {
  const siteUrl = process.env.WP_SITE_URL;
  const username = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;
  const status = process.env.WP_DEFAULT_STATUS || 'publish';

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
    return sendBotResponse(res, introReply());
  }

  const wantsSalesPage = lower.includes('sales page') || lower.includes('landing page') || lower.includes('funnel') || lower.includes('website');
  const readyToGenerate = hasEnoughSalesPageDetails(message);

  if (wantsSalesPage && !readyToGenerate) {
    return sendBotResponse(res, introReply());
  }

  if (!readyToGenerate) {
    return sendBotResponse(res, needMoreDetailsReply());
  }

  const businessName = extractBusinessName(message, sender);
  const title = `${businessName} Sales Page Preview`;
  const slug = `preview-${safeSlug(businessName)}-${Date.now()}`;
  const expiryIso = new Date(Date.now() + PREVIEW_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const html = await generateSalesPageWithClaude({ businessName, customerMessage: message, expiryIso });
  const wpResult = await createWordPressPage({ title, content: html, slug });

  if (!wpResult.ok) {
    return sendBotResponse(res, 'Thank you. I’ve received the details. Your sales page preview is being prepared now. A team member will send your preview link shortly.');
  }

  return sendBotResponse(res, `Your sales page preview is ready ✅\n\nPlease review it here:\n${wpResult.link}\n\nNote: This preview link expires in ${PREVIEW_EXPIRY_MINUTES} minutes.`);
}
