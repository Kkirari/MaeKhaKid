# MaeKhaKid POS

A **local-first PWA** point-of-sale system for a small grocery store — designed to run fast on an old tablet and be simple enough for non-tech users.

## Features

- **Barcode scanning** — instant product lookup (supports HID/Bluetooth scanners that send digits + Enter)
- **No-barcode products** — tap from the product grid or search by name
- **Cart** — adjust quantities, remove items, auto-calculated totals
- **Cash payment** — change calculator with quick-amount buttons
- **PromptPay QR** — generates a QR code client-side from your PromptPay ID
- **Auto stock deduction** — recorded atomically with each sale
- **Void sales** — restore stock and exclude from daily totals
- **Daily summary** — revenue, bill count, payment breakdown, profit + CSV export
- **Product management** — full CRUD with low-stock alerts
- **Cloud sync** — background push to Supabase (optional; works fully offline without it)
- **PWA** — installable ("Add to Home Screen"), works offline after first load

## Tech Stack

SvelteKit (adapter-static) · Tailwind CSS · Dexie.js (IndexedDB) · Supabase · promptpay-qr · qrcode

## Getting Started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output → build/
npm run check    # type check
```

On first run, sample products are seeded automatically for testing.

## PromptPay Setup

Go to **Products → ⚙️ Settings** and enter your PromptPay phone number or national ID.

> Payment confirmation is manual — check your banking app then tap Confirm. No payment gateway is involved.

## Cloud Sync (optional)

1. Create a Supabase project and run `supabase/schema.sql` in the SQL Editor
2. Copy `.env.example` → `.env` and fill in `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`
3. Restart the dev server — sales will sync to the cloud every 60 seconds (status visible on the Summary page)

Without the env vars the app runs in local-only mode with no errors.

## Deploy (Vercel)

The app builds to a static site (`build/`). Deploy to Vercel directly — the service worker caches everything after the first load for offline use.

## Recommended Hardware

A wireless 1D Bluetooth barcode scanner (Netum / Tera / Eyoyo) — set to HID Keyboard mode with auto-Enter suffix.
