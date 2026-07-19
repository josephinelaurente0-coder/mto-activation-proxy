# My Travel Organizer — Activation Proxy

This is a small Vercel serverless project. It does two things:

1. Checks a license key against Payhip (safely, from the server — your Payhip
   secret key never appears in the app's public code).
2. Remembers which devices have activated each key, and blocks a 3rd device.

## Deploy steps

1. Push this folder to a new GitHub repo (e.g. `mto-activation-proxy`), the
   same way you did for the app itself.
2. In Vercel, click **Add New → Project**, import that repo, and deploy.
   Vercel will detect the `/api` folder automatically — no build config needed.
3. In the Vercel dashboard, go to your new project → **Storage** tab →
   **Create Database** → choose **KV** → connect it to this project. Vercel
   will automatically add the KV environment variables for you.
4. Go to **Settings → Environment Variables** and add two more:
   - `PAYHIP_PRODUCT_SECRET_KEY` — from your Payhip product's edit page,
     in the license key section (only shows once you've checked
     "Generate unique license keys for each sale" and saved the product).
   - `MTO_ADMIN_SECRET` — any password you make up yourself. This lets you
     manually free up a device slot later if a customer gets a new phone.
5. Redeploy (Vercel usually does this automatically after adding env vars).
6. Copy your project's URL, e.g. `https://mto-activation-proxy.vercel.app`.
   You'll need this for the next step — updating the main app to point at it.

## Testing it

Once deployed, you can test the activation endpoint directly:

```
curl -X POST https://YOUR-PROJECT.vercel.app/api/activate \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"SOME-REAL-KEY-FROM-PAYHIP","deviceId":"test-device-1"}'
```

A valid, unused key should return `{"allowed":true,...}`. Running it again
with a 3rd made-up `deviceId` (after two different ones have succeeded)
should return `{"allowed":false,...}`.

## Freeing a device slot for a customer

```
curl -X POST https://YOUR-PROJECT.vercel.app/api/release-device \
  -H "Content-Type: application/json" \
  -d '{"adminSecret":"YOUR_MTO_ADMIN_SECRET","licenseKey":"THEIR-KEY"}'
```

Leaving out `deviceId` clears *all* devices for that key (simplest for
support requests); including a specific `deviceId` removes just that one.
