import { createClient } from 'redis';

// A password only you know, for freeing up a device slot when a customer
// asks (e.g. they got a new phone). Set this in Vercel env vars too —
// pick your own value, it doesn't come from Payhip.
const ADMIN_SECRET = process.env.MTO_ADMIN_SECRET;

const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.REDIS_CONNECTION_STRING ||
  process.env.KV_URL;

let clientPromise;
function getClient() {
  if (!clientPromise) {
    const client = createClient({ url: REDIS_URL });
    client.on('error', (err) => console.error('Redis Client Error', err));
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

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

    const redis = await getClient();
    const regKey = `mto:devices:${licenseKey.trim()}`;

    if (!deviceId) {
      // No specific device given — clear every device on this key
      await redis.del(regKey);
      return res.status(200).json({ ok: true, message: 'All devices cleared for this key.', remaining: [] });
    }

    const existingRaw = await redis.get(regKey);
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    const updated = existing.filter(d => d !== deviceId);
    await redis.set(regKey, JSON.stringify(updated));

    return res.status(200).json({ ok: true, message: 'Device removed.', remaining: updated });
  } catch (err) {
    console.error('Release-device error:', err);
    return res.status(500).json({ ok: false, message: 'Something went wrong.' });
  }
}
