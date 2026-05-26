# Regia WhatsApp Sales Page Bot

This folder contains a safe standalone Vercel backend for WhatsAuto / AutoResponder own-server replies.

It does not modify the existing files in the repository.

## Endpoints

- `GET /api/health` — confirms the deployment is online.
- `POST /api/bot` — WhatsAuto / AutoResponder webhook endpoint.

## Vercel setup

When importing this repo into Vercel, set the Root Directory to:

```txt
whatsapp-salespage-bot
```

## Environment variables

Add these in Vercel Project Settings → Environment Variables:

```txt
RESPONSE_MODE=whatsauto
BOT_SECRET=choose-a-private-secret
WP_SITE_URL=https://yourwordpresssite.com
WP_USERNAME=your_wp_admin_username
WP_APP_PASSWORD=your_wordpress_application_password
WP_DEFAULT_STATUS=draft
BUSINESS_WHATSAPP=2348121448856
```

Use `RESPONSE_MODE=autoresponder` only if your app expects:

```json
{"replies":[{"message":"Hi"}]}
```

Use `RESPONSE_MODE=whatsauto` if your app expects:

```json
{"reply":"Hi"}
```

## WhatsAuto / AutoResponder URL

After deployment, connect the app to:

```txt
https://your-vercel-project.vercel.app/api/bot?secret=YOUR_BOT_SECRET
```

## WordPress note

Use a WordPress Application Password, not your normal login password.

The first MVP creates a simple draft WordPress page using the WordPress REST API. Elementor/Claude page-building can be added later after this endpoint is tested.
