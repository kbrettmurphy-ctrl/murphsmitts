# Architecture

## Overview

This repository is a Jekyll-based marketing and service website for Murph’s Mitt Maintenance, with a lightweight administrative dashboard and Cloudflare Functions backend. The site serves static content for customers while using Cloudflare Functions to process service requests, manage order workflow, expose inventory, and support a store of gloves for sale.

## Runtime model

### Static site layer
- Jekyll builds the public-facing pages from the repository’s HTML templates, includes, and layouts.
- The main layout is [
_layouts/default.html](_layouts/default.html), and the home page is [index.html](index.html).
- The homepage and gallery page load gallery photos from the Cloudflare Functions gallery endpoint backed by Supabase Storage.

### Client-side behavior
- Public pages use [assets/js/main.js](assets/js/main.js) for gallery lightbox interactions, mobile navigation, and other UI enhancements.
- The contact form on [contact/index.html](contact/index.html) submits to the intake endpoint.
- The services page on [services/index.html](services/index.html) fetches lace inventory from the public inventory API.
- The admin UI in [admin/index.html](admin/index.html) is a standalone single-page app backed by [admin/admin.js](admin/admin.js).

### API layer
- Cloudflare Functions are defined under [functions/api](functions/api).
- The Functions runtime is configured by [wrangler.jsonc](wrangler.jsonc), which sets the app name, compatibility settings, and static asset directory.
- The serverless endpoints are:
  - [functions/api/intake.js](functions/api/intake.js): accepts new service requests, validates inputs, creates an order in Supabase, and sends email/text notifications.
  - [functions/api/orders.js](functions/api/orders.js): handles admin operations for orders, inventory adjustments, gallery uploads, and sale-glove management.
  - [functions/api/lace-inventory.js](functions/api/lace-inventory.js): exposes active lace inventory from Supabase.
  - [functions/api/gloves-for-sale.js](functions/api/gloves-for-sale.js): exposes gloves-for-sale listings and associated photos.
  - [functions/api/sms-reply.js](functions/api/sms-reply.js): handles Twilio inbound SMS replies and updates order records.

## Data storage

The application relies on Supabase for its primary data store:
- Orders are stored in the public orders table.
- Lace inventory is stored in the public lace_inventory table.
- Gloves for sale are stored in the public gloves_for_sale table.
- Related sale photos are stored in the public glove_sale_photos table.
- Gallery images and sale-glove images are uploaded to Supabase Storage buckets.

The backend uses the Supabase REST API with the service role key and the Supabase URL from environment variables.

### Notes on order media storage
- Order rows include an `orders.glove_photos` field that is stored as serialized JSON text containing an array of image URLs.
- SMS and admin handlers parse `glove_photos` when reading the row and append new media URLs when photos are received.

## Authentication and authorization

### Admin auth
- The admin UI authenticates via a PIN entered in the browser.
- The PIN is validated by [functions/api/orders.js](functions/api/orders.js), which issues a signed, expiring session token.
- Subsequent admin actions must include that token in the request body.

### Environment variables
The code expects the following environment variables at runtime:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ADMIN_PIN
- ADMIN_SESSION_SECRET
- RESEND_API_KEY
- RESEND_FROM (optional, defaults in code)
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID (needed for SMS updates)
- PUSHOVER_APP_TOKEN, PUSHOVER_USER_KEY (optional notifications)

If any required values are missing, the relevant API returns an error response.

## Request flow examples

### New service request
1. The customer submits the contact form in [contact/index.html](contact/index.html).
2. The browser posts JSON to /api/intake.
3. [functions/api/intake.js](functions/api/intake.js) validates the request, generates the next order number, inserts the order into Supabase, and sends notifications.
4. The response returns the created order payload to the client.

### Admin order management
1. The admin app in [admin/admin.js](admin/admin.js) logs in and stores a token in localStorage.
2. The app sends POST requests to /api/orders.
3. [functions/api/orders.js](functions/api/orders.js) authenticates the token, performs the requested action, and updates Supabase.
4. The admin UI re-renders the order list or detail view with the returned data.

### Public inventory display
1. The services page fetches /api/lace-inventory.
2. [functions/api/lace-inventory.js](functions/api/lace-inventory.js) queries the active lace inventory rows.
3. The page updates the in-stock/out-of-stock UI based on the returned data.

## Main modules and responsibilities

- [index.html](index.html): public marketing home page.
- [contact/index.html](contact/index.html): service request form and submission logic.
- [services/index.html](services/index.html): service overview and lace inventory status UI.
- [admin/index.html](admin/index.html): admin application shell.
- [admin/admin.js](admin/admin.js): admin UI logic, order rendering, inventory management, and sale-glove management.
- [admin/config.js](admin/config.js): admin API base URL configuration.
- [assets/js/main.js](assets/js/main.js): common frontend interactions.
- [functions/api/intake.js](functions/api/intake.js): intake workflow and notifications.
- [functions/api/orders.js](functions/api/orders.js): admin API and business logic.
- [functions/api/lace-inventory.js](functions/api/lace-inventory.js): public inventory endpoint.
- [functions/api/gloves-for-sale.js](functions/api/gloves-for-sale.js): public gloves-for-sale endpoint.
- [functions/api/sms-reply.js](functions/api/sms-reply.js): inbound SMS handling.

## Deployment notes

- The site is designed to be deployed as a static site with Cloudflare Functions.
- Jekyll is the build engine for the static content.
- Wrangler manages the deploy configuration and asset serving.
