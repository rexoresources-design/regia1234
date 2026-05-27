export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'Regia WhatsApp Assistant Backend',
    claude_enabled: Boolean(process.env.ANTHROPIC_API_KEY)
  });
}
