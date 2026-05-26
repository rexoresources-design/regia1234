export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'Regia WhatsApp Sales Page Bot',
    timestamp: new Date().toISOString()
  });
}
