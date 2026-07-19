import { kv } from '@vercel/kv';

// Set this in Vercel → Project Settings → Environment Variables.
// Find it on your Payhip product's edit page, in the license key section
// (only appears once "Generate unique license keys for each sale" is on).
const PAYHIP_SECRET_KEY = process.env.PAYHIP_PRODUCT_SECRET_KEY;

// How many devices a single license key is allowed to activate on.
const MAX_DEVICES = 2;

// Restrict which site is allowed to call this proxy. Update to your real domain
// once it's live (e.g. 'https://app.jonyjjtravelandtours.com'). Using '*' works
// but lets any website call your proxy, which just wastes your Payhip API quota
// rather than being a real security hole (the secret key never leaves the server).
const ALLOWED_ORIGIN = '*';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ allowed: false, message: 'Method not allowed.' });
  }

  try {
    const { licenseKey, deviceId } = req.body || {};
    if (!licenseKey || typeof licenseKey !== 'string' || !deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ allowed: false, message: 'Missing license key or device ID.' });
    }
    const key = licenseKey.trim();

    // 1) Confirm the key is real and still enabled on Payhip's side
    //    (catches typos, refunded/disabled keys, keys from a different product, etc.)
    const verifyRes = await fetch(
      `https://payhip.com/api/v2/license/verify?license_key=${encodeURIComponent(key)}`,
      { headers: { 'product-secret-key': PAYHIP_SECRET_KEY } }
    );
    const verifyData = await verifyRes.json().catch(() => null);

    if (!verifyData || !verifyData.data || verifyData.data.enabled !== true) {
      return res.status(200).json({
        allowed: false,
        message: 'This license key is not valid, or has been disabled. Please check the key and try again, or contact support.',
      });
    }

    // 2) Check our own device registry for this key (Payhip only tracks a use
    //    count, not which specific devices — so we keep that list ourselves)
    const regKey = `mto:devices:${key}`;
    const existing = (await kv.get(regKey)) || [];

    if (existing.includes(deviceId)) {
      return res.status(200).json({ allowed: true, message: 'Welcome back.' });
    }

    if (existing.length >= MAX_DEVICES) {
      return res.status(200).json({
        allowed: false,
        message: `This license key is already active on ${MAX_DEVICES} devices. Contact support if you need to move it to a new device.`,
      });
    }

    existing.push(deviceId);
    await kv.set(regKey, existing);

    return res.status(200).json({ allowed: true, message: 'Activated successfully.' });
  } catch (err) {
    return res.status(500).json({
      allowed: false,
      message: 'Activation service is temporarily unavailable. Please try again in a moment.',
    });
  }
}
