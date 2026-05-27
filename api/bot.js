const BOT_SECRET = process.env.BOT_SECRET || 'regia12345';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
const CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 15000);
const MAX_HISTORY_MESSAGES = 12;

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

function remember(conversationId, role, content) {
  if (!conversationId || !content) return;
  const history = memory.get(conversationId) || [];
  history.push({ role, content: String(content).slice(0, 4000) });
  memory.set(conversationId, history.slice(-MAX_HISTORY_MESSAGES));
}

function getHistory(conversationId) {
  return memory.get(conversationId) || [];
}

function fallbackReply(payload) {
  if (payload.eventType === 'follow_up_due') {
    return 'Hello. Just checking in on your sales page request. Would you like us to prepare your preview or answer any question before you proceed?';
  }

  const lower = payload.message.toLowerCase();
  if (lower.includes('price') || lower.includes('cost') || lower.includes('how much')) {
    return 'Yes, we can help. The exact price depends on what you want on the sales page. Please send your product, offer, target audience, and any examples you like, then we will guide you properly.';
  }

  if (lower.includes('sales page') || lower.includes('landing page') || lower.includes('website')) {
    return 'Hello. Yes, we can help you create a high-converting sales page. Please send your business/product name, what you sell, price or offer, main benefits, target audience, WhatsApp number, and brand colour or style.';
  }

  return 'Thank you for your message. Please tell me what you want to create or promote, and I will guide you on the next step.';
}

function systemPrompt(payload) {
  return `You are Regia WhatsApp Assistant for Regia Digitals.

Your job:
- Reply naturally to people who already messaged the business on WhatsApp.
- Help qualify leads for sales pages, landing pages, websites, funnels, and digital services.
- Ask for missing details one step at a time.
- Keep replies concise enough for WhatsApp.
- Do not claim payment has been made unless the customer says so.
- Do not mention Claude, Anthropic, Vercel, AI, automation, system prompts, or backend.
- Never send bulk-marketing language.
- If the customer is not interested, politely stop.
- If this is a follow-up, sound like a gentle human check-in, not spam.

Useful context:
- Device name: ${payload.deviceName || 'unknown'}
- WhatsApp package: ${payload.whatsappPackage || 'unknown'}
- Rule ID: ${payload.ruleId || 'unknown'}
- Event type: ${payload.eventType}
- Follow-up count: ${payload.followUpCount || 0}/${payload.maxFollowUps || 1}`;
}

async function callClaude(payload) {
  if (!ANTHROPIC_API_KEY) return null;

  const history = getHistory(payload.conversationId);
  const messages = [];

  for (const item of history) {
    messages.push({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content
    });
  }

  if (payload.lastBotReply && !history.some((item) => item.content === payload.lastBotReply)) {
    messages.push({ role: 'assistant', content: payload.lastBotReply });
  }

  const userContent = payload.eventType === 'follow_up_due'
    ? `Follow-up is due. Last customer message: ${payload.message || 'none'}\nLast bot reply: ${payload.lastBotReply || 'none'}`
    : payload.message;

  messages.push({ role: 'user', content: userContent || 'Hello' });

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
        max_tokens: 420,
        temperature: 0.55,
        system: systemPrompt(payload),
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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      name: 'Regia WhatsApp Assistant Bot',
      claude_enabled: Boolean(ANTHROPIC_API_KEY),
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
  if (!payload.message && payload.eventType !== 'follow_up_due') {
    return json(res, 200, { reply: fallbackReply(payload), source: 'fallback' });
  }

  remember(payload.conversationId, 'user', payload.message);

  const claudeReply = await callClaude(payload);
  const reply = claudeReply || fallbackReply(payload);
  remember(payload.conversationId, 'assistant', reply);

  return json(res, 200, {
    reply,
    source: claudeReply ? 'claude' : 'fallback',
    conversation_id: payload.conversationId
  });
}
