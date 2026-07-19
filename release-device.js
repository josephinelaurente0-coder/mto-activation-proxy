import { kv } from '@vercel/kv';

// A password only you know, for freeing up a device slot when a customer
// asks (e.g. they got a new phone). Set this in Vercel env vars too —
// pick your own value, it doesn't come from Payhip.
const ADMIN_SECRET = process.env.MTO_ADMIN_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  try {
    const { adminSecret, licenseKey, deviceId } = req.body || {};
    if (!adminSecret || adminSecret !== ADMIN_SECRET) {
      return res.status(401).json({ ok: false, message: 'Not authorized.' });
    }
    if (!licenseKey) {
      return res.status(400).json({ ok: false, message: 'Missing license key.' });
    }

    const regKey = `mto:devices:${licenseKey.trim()}`;
    const existing = (await kv.get(regKey)) || [];

    if (!deviceId) {
      // No specific device given — clear every device on this key
      await kv.del(regKey);
      return res.status(200).json({ ok: true, message: 'All devices cleared for this key.', remaining: [] });
    }

    const updated = existing.filter(d => d !== deviceId);
    await kv.set(regKey, updated);
    return res.status(200).json({ ok: true, message: 'Device removed.', remaining: updated });
  } catch (err) {
    return res.status(500).json({ ok: false, message: 'Something went wrong.' });
  }
}
