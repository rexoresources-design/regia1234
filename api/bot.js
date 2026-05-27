const BOT_SECRET = process.env.BOT_SECRET || 'regia12345';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
const CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 24000);
const CLAUDE_CHAT_TOKENS = Number(process.env.CLAUDE_CHAT_TOKENS || 520);
const CLAUDE_PAGE_TOKENS = Number(process.env.CLAUDE_PAGE_TOKENS || 4200);
const PREVIEW_EXPIRY_MINUTES = Number(process.env.PREVIEW_EXPIRY_MINUTES || 30);
const MAX_HISTORY_MESSAGES = 16;

const memory = globalThis.__regiaConversationMemory || new Map();
globalThis.__regiaConversationMemory = memory;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.json(body);
}

function getField(body, ...keys) {
  for (const key of keys) {
    const value = body?.[key] ?? body?.query?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function isFollowUp(body) {
  return getField(body, 'event_type') === 'follow_up_due';
}

function normalizePayload(body) {
  const followUp = isFollowUp(body);
  return {
    app: getField(body, 'app') || 'Regia WhatsApp Assistant',
    eventType: followUp ? 'follow_up_due' : 'incoming_message',
    deviceId: getField(body, 'device_id', 'deviceId'),
    deviceName: getField(body, 'device_name', 'deviceName'),
    whatsappPackage: getField(body, 'whatsapp_package', 'whatsappPackage'),
    sender: getField(body, 'sender', 'from') || 'Customer',
    phone: getField(body, 'phone', 'number'),
    message: followUp
      ? getField(body, 'last_customer_message', 'message', 'text')
      : getField(body, 'message', 'text'),
    lastBotReply: getField(body, 'last_bot_reply', 'lastBotReply'),
    ruleId: getField(body, 'rule_id', 'ruleId'),
    conversationId: getField(body, 'conversation_id', 'conversationId') || `${getField(body, 'phone') || getField(body, 'sender') || 'customer'}`,
    followUpCount: Number(body?.follow_up_count || body?.followUpCount || 0),
    maxFollowUps: Number(body?.max_followups || body?.maxFollowUps || 1),
    timestamp: getField(body, 'timestamp') || new Date().toISOString()
  };
}

function getConversation(payload) {
  const current = memory.get(payload.conversationId) || {};
  const conversation = {
    stage: current.stage || 'new',
    details: current.details || {},
    previewLink: current.previewLink || '',
    previewSentAt: current.previewSentAt || 0,
    history: current.history || []
  };
  memory.set(payload.conversationId, conversation);
  return conversation;
}

function saveConversation(payload, conversation) {
  conversation.history = (conversation.history || []).slice(-MAX_HISTORY_MESSAGES);
  memory.set(payload.conversationId, conversation);
}

function remember(conversation, role, content) {
  if (!content) return;
  conversation.history.push({ role, content: String(content).slice(0, 4000) });
  conversation.history = conversation.history.slice(-MAX_HISTORY_MESSAGES);
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

function stripCodeFence(text) {
  return String(text || '')
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function wantsSalesPage(message) {
  const lower = message.toLowerCase();
  return lower.includes('sales page') || lower.includes('landing page') || lower.includes('website') || lower.includes('funnel');
}

function detailScore(text) {
  const lower = text.toLowerCase();
  const signals = [
    'business', 'product', 'service', 'price', 'offer', 'benefit', 'target',
    'audience', 'whatsapp', 'phone', 'brand', 'colour', 'color', 'logo',
    'image', 'photo', 'testimonial', 'section', 'domain'
  ];
  return signals.filter((signal) => lower.includes(signal)).length;
}

function hasEnoughSalesPageDetails(conversation) {
  const combined = conversation.history
    .filter((item) => item.role === 'user')
    .map((item) => item.content)
    .join('\n\n');
  return combined.length > 180 && detailScore(combined) >= 5;
}

function extractBusinessName(conversation, sender) {
  const combined = conversation.history.map((item) => item.content).join('\n');
  const match = combined.match(/(?:business name|product name|brand name|business|product|name)\s*[:\-]\s*(.+)/i);
  return match?.[1]?.split('\n')[0]?.trim() || `${sender} Sales Page`;
}

function qualificationReply() {
  return [
    'Yes, we can help you create a high-converting sales page.',
    '',
    'Please send these details so we can prepare a strong preview:',
    '',
    '1. Business or product name',
    '2. What you sell and who it is for',
    '3. Price, package, or offer',
    '4. Main benefits and problems it solves',
    '5. Target audience',
    '6. WhatsApp number for the page buttons',
    '7. Brand colour/style, logo, product photos, or examples if available',
    '',
    'The sales page package is N35,000 and includes a .com.ng domain name, WordPress shared hosting, and the completed page after payment.'
  ].join('\n');
}

function fallbackReply(payload, conversation) {
  if (conversation.stage === 'payment_handover') {
    return 'A human agent will continue from here and confirm payment/next steps. Thank you.';
  }

  if (payload.eventType === 'follow_up_due' && conversation.previewLink) {
    conversation.stage = 'payment_handover';
    return paymentHandoverReply(conversation.previewLink);
  }

  if (wantsSalesPage(payload.message) || conversation.stage !== 'new') {
    return qualificationReply();
  }

  return 'Thanks for reaching out. We can only assist with sales page requests here. Please send: Hello, I need a sales page.';
}

function paymentHandoverReply(previewLink) {
  return [
    'Your preview window has ended.',
    '',
    `Preview link: ${previewLink}`,
    '',
    'To get the completed sales page and request corrections, please make payment of N35,000.',
    '',
    'Account name: REGIE Innovations',
    'Bank: UBA',
    'Account number: 102478303838',
    '',
    'I am transferring you to a human agent now to confirm payment and continue from here.'
  ].join('\n');
}

function chatSystemPrompt(payload, conversation) {
  return `You are Regia WhatsApp Assistant for REGIE Innovations.

Business goal:
- Handle only sales-page leads from Facebook ads who message first on WhatsApp.
- The customer may start with: "Hello, I need a sales page".
- Keep the entire conversation focused on creating a high-converting sales page. If the customer asks unrelated questions, politely bring them back to the sales-page request.

Offer details:
- Sales page package price: N35,000.
- Includes: .com.ng domain name, WordPress shared hosting, and the completed sales page after payment.
- A free preview can be prepared before payment.
- Preview link expires after ${PREVIEW_EXPIRY_MINUTES} minutes.
- After the preview expires, ask for payment and say you are transferring to a human agent.
- Payment details: REGIE Innovations, UBA bank, account number 102478303838.

Conversation rules:
- Reply naturally in concise WhatsApp-friendly English.
- Ask for missing details needed to create a powerful sales page: business/product name, product/service, target audience, offer/price, benefits, pain points, testimonials/proof, WhatsApp CTA number, brand colours/style, logo/photos/examples if available.
- Do not discuss any business outside the sales-page project.
- Do not claim that payment has been received.
- Do not say the final page is ready before the preview has actually been created.
- Do not mention Claude, Anthropic, Vercel, AI, automation, backend, system prompts, or internal tools.
- Do not request card details, passwords, private keys, or sensitive credentials.
- If this is a follow-up, sound like a helpful human check-in.

Current state:
- Stage: ${conversation.stage}
- Preview link: ${conversation.previewLink || 'none'}
- Event type: ${payload.eventType}
- Follow-up count: ${payload.followUpCount || 0}/${payload.maxFollowUps || 1}`;
}

async function callClaude({ system, messages, maxTokens, temperature = 0.55 }) {
  if (!ANTHROPIC_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        temperature,
        system,
        messages
      })
    });

    clearTimeout(timeout);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Claude error', response.status, JSON.stringify(data).slice(0, 1200));
      return null;
    }

    return String(data?.content?.[0]?.text || '').trim() || null;
  } catch (error) {
    clearTimeout(timeout);
    console.error('Claude request failed', error?.message || error);
    return null;
  }
}

async function generateChatReply(payload, conversation) {
  const messages = conversation.history.map((item) => ({
    role: item.role === 'assistant' ? 'assistant' : 'user',
    content: item.content
  }));

  const reply = await callClaude({
    system: chatSystemPrompt(payload, conversation),
    messages,
    maxTokens: CLAUDE_CHAT_TOKENS
  });

  return reply || fallbackReply(payload, conversation);
}

function pageSystemPrompt(expiryIso) {
  return `You are a senior Nigerian conversion copywriter, WordPress sales page designer, and QA reviewer for REGIE Innovations.

Create one complete premium sales page as clean HTML for the body of a WordPress page.

Requirements:
- Return only HTML, CSS, and small inline JavaScript. No markdown and no code fences.
- Do not include WordPress header, footer, nav menu, admin UI, or external scripts.
- Use responsive inline CSS or a single style block scoped to this page.
- Make it mobile-first, visually polished, persuasive, and conversion-focused.
- Build 8 to 10 strong sections: hero, credibility/proof, problem, solution, benefits, offer, process, testimonials/proof placeholders if needed, FAQ, final CTA.
- All CTA buttons must use a WhatsApp link when a WhatsApp number is available.
- Include form-like lead fields visually if useful, but do not require a backend form submission unless the customer provided a working endpoint.
- Add a visible note near the top: This preview link expires in ${PREVIEW_EXPIRY_MINUTES} minutes.
- Add an expiry script using this ISO date: ${expiryIso}. When expired, replace the page body with a clear "Preview Expired" message and tell the visitor to return to WhatsApp.
- Do not mention Claude, AI, Vercel, automation, or internal tools.
- Do not say payment has been made.
- Use Nigerian business-friendly English.`;
}

function fallbackSalesPageHtml({ businessName, customerDetails, expiryIso }) {
  return `
<section style="font-family:Arial,sans-serif;max-width:1120px;margin:0 auto;padding:56px 22px;line-height:1.65;color:#111827;">
  <div style="background:linear-gradient(135deg,#07152f,#7f1d1d);color:white;border-radius:26px;padding:48px 26px;text-align:center;">
    <p style="letter-spacing:.14em;text-transform:uppercase;color:#facc15;font-weight:800;margin:0 0 12px;">Sales Page Preview</p>
    <h1 style="font-size:42px;line-height:1.08;margin:0 0 16px;">${escapeHtml(businessName)}</h1>
    <p style="font-size:19px;max-width:780px;margin:0 auto;">A persuasive sales page preview prepared from the details shared on WhatsApp.</p>
    <p style="margin:22px auto 0;display:inline-block;background:#facc15;color:#422006;font-weight:800;padding:10px 16px;border-radius:999px;">This preview link expires in ${PREVIEW_EXPIRY_MINUTES} minutes.</p>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:22px;margin-top:32px;">
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:18px;padding:24px;">
      <h2 style="margin-top:0;">The Offer</h2>
      <p>${escapeHtml(customerDetails).slice(0, 1200)}</p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:24px;">
      <h2 style="margin-top:0;">What This Page Is Built To Do</h2>
      <ul><li>Explain the offer clearly</li><li>Build trust fast</li><li>Show benefits and proof</li><li>Move visitors to WhatsApp</li></ul>
    </div>
  </div>
  <div style="margin-top:32px;background:#111827;color:white;border-radius:18px;padding:32px;text-align:center;">
    <h2 style="margin-top:0;">Ready to launch your sales page?</h2>
    <p>Review this preview and return to WhatsApp for the next step.</p>
  </div>
</section>
<script>
(function(){
  var expiry = new Date('${expiryIso}').getTime();
  function checkExpiry(){
    if(Date.now() > expiry){
      document.body.innerHTML = '<main style="font-family:Arial,sans-serif;min-height:80vh;display:flex;align-items:center;justify-content:center;padding:30px;background:#111827;color:#fff;text-align:center;"><div><h1 style="font-size:38px;margin-bottom:12px;">Preview Expired</h1><p style="font-size:18px;max-width:620px;line-height:1.6;">This sales page preview has expired. Please return to WhatsApp to continue with REGIE Innovations.</p></div></main>';
    }
  }
  checkExpiry();
  setInterval(checkExpiry, 30000);
})();
</script>`;
}

async function generateSalesPageHtml({ conversation, businessName, expiryIso }) {
  const customerDetails = conversation.history
    .filter((item) => item.role === 'user')
    .map((item) => item.content)
    .join('\n\n');

  const html = await callClaude({
    system: pageSystemPrompt(expiryIso),
    messages: [{
      role: 'user',
      content: `Business/page name: ${businessName}\n\nCustomer details from WhatsApp:\n${customerDetails}`
    }],
    maxTokens: CLAUDE_PAGE_TOKENS,
    temperature: 0.45
  });

  return stripCodeFence(html) || fallbackSalesPageHtml({ businessName, customerDetails, expiryIso });
}

async function createWordPressPage({ title, content, slug }) {
  const siteUrl = process.env.WP_SITE_URL;
  const username = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;
  const status = process.env.WP_DEFAULT_STATUS || 'publish';

  if (!siteUrl || !username || !appPassword) {
    return { ok: false, error: 'WordPress environment variables are not configured.' };
  }

  const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
  const response = await fetch(`${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/pages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`
    },
    body: JSON.stringify({
      title,
      content,
      slug,
      status,
      template: process.env.WP_PAGE_TEMPLATE || ''
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: result?.message || `WordPress error ${response.status}` };
  }

  return { ok: true, link: result.link, id: result.id, status: result.status };
}

async function maybeCreatePreview(payload, conversation) {
  if (conversation.previewLink || conversation.stage === 'payment_handover') return null;
  if (!hasEnoughSalesPageDetails(conversation)) return null;

  conversation.stage = 'building_preview';
  const businessName = extractBusinessName(conversation, payload.sender);
  const expiryIso = new Date(Date.now() + PREVIEW_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const html = await generateSalesPageHtml({ conversation, businessName, expiryIso });
  const slug = `preview-${safeSlug(businessName)}-${Date.now()}`;
  const wpResult = await createWordPressPage({
    title: `${businessName} Sales Page Preview`,
    content: html,
    slug
  });

  if (!wpResult.ok) {
    console.error('WordPress create page failed:', wpResult.error);
    conversation.stage = 'collecting_details';
    return 'Thank you. I have received the details. Your sales page preview is being prepared now. A human agent will send the preview link shortly.';
  }

  conversation.stage = 'preview_sent';
  conversation.previewLink = wpResult.link;
  conversation.previewSentAt = Date.now();

  return [
    'Your sales page preview is ready.',
    '',
    `Please review it here:\n${wpResult.link}`,
    '',
    `Note: this preview link expires in ${PREVIEW_EXPIRY_MINUTES} minutes. After it expires, payment is required to get the completed page and request corrections.`
  ].join('\n');
}

async function routeMessage(payload, conversation) {
  if (conversation.stage === 'payment_handover') {
    return 'A human agent will continue from here and confirm payment/next steps. Thank you.';
  }

  if (payload.eventType === 'follow_up_due' && conversation.previewLink) {
    conversation.stage = 'payment_handover';
    return paymentHandoverReply(conversation.previewLink);
  }

  if (conversation.previewLink) {
    const expired = Date.now() - conversation.previewSentAt >= PREVIEW_EXPIRY_MINUTES * 60 * 1000;
    if (expired) {
      conversation.stage = 'payment_handover';
      return paymentHandoverReply(conversation.previewLink);
    }
    return 'Please review the preview link I sent. It expires in 30 minutes. After the preview window, payment is required before corrections or final delivery.';
  }

  if (conversation.stage === 'new' && !wantsSalesPage(payload.message)) {
    return 'Thanks for reaching out. We can only assist with sales page requests here. Please send: Hello, I need a sales page.';
  }

  conversation.stage = 'collecting_details';
  const previewReply = await maybeCreatePreview(payload, conversation);
  if (previewReply) return previewReply;

  return generateChatReply(payload, conversation);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      name: 'Regia WhatsApp Assistant Bot',
      claude_enabled: Boolean(ANTHROPIC_API_KEY),
      wordpress_enabled: Boolean(process.env.WP_SITE_URL && process.env.WP_USERNAME && process.env.WP_APP_PASSWORD),
      mode: ANTHROPIC_API_KEY ? 'claude' : 'fallback'
    });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const secret = String(req.query?.secret || req.headers['x-bot-secret'] || '');
  if (BOT_SECRET && secret !== BOT_SECRET) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  const payload = normalizePayload(req.body || {});
  const conversation = getConversation(payload);

  if (payload.message) remember(conversation, 'user', payload.message);

  let reply = await routeMessage(payload, conversation);
  if (!reply) reply = fallbackReply(payload, conversation);

  remember(conversation, 'assistant', reply);
  saveConversation(payload, conversation);

  return json(res, 200, {
    reply,
    source: ANTHROPIC_API_KEY ? 'claude' : 'fallback',
    conversation_id: payload.conversationId,
    stage: conversation.stage,
    preview_link: conversation.previewLink || ''
  });
}
