# Cinq Portal

Private client portal for Studio Cinq. Built with Next.js, Supabase, and Stripe.

---

## Stack

- **Next.js 14** — React framework with App Router
- **Supabase** — Auth (magic link OTP), database (Postgres), file storage
- **Stripe** — Invoice payments and webhooks
- **Framer Motion** — Animations (available for use in client components)
- **Vercel** — Deployment

---

## Getting started

### 1. Clone and install

```bash
git clone <your-repo>
cd cinq-portal
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** → **New query**
3. Paste the entire contents of `supabase-schema.sql` and click **Run**
4. Go to **Storage** and create two buckets:
   - `deliverables` — private
   - `brand-assets` — private
5. Copy your project URL and keys from **Settings → API**

### 3. Set up Stripe

1. Go to [stripe.com](https://stripe.com) and create an account
2. Copy your publishable and secret keys from the Dashboard
3. Set up a webhook endpoint pointing to `https://your-domain.com/api/webhook`
   - Event to listen for: `checkout.session.completed`
4. Copy the webhook signing secret

### 4. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in all values in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

NEXT_PUBLIC_APP_URL=https://clients.studiocinq.com
ADMIN_EMAIL=kacie@studiocinq.com
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment (Vercel)

1. Push to GitHub
2. Connect repo to Vercel
3. Add all environment variables in Vercel project settings
4. Deploy — Vercel handles everything else

For the custom domain `clients.studiocinq.com`, add it in Vercel → Settings → Domains.

---

## How it works

### Client flow
1. Client visits `clients.studiocinq.com/login`
2. Enters their email — receives a 6-digit OTP code
3. Enters code → lands on their dashboard
4. Can view projects, review deliverables, pay invoices, download files

### Your admin flow
1. Visit `clients.studiocinq.com/admin/studio`
2. Create a new client record with their name and email
3. Add a project with deliverables and scope
4. Update deliverable statuses as work progresses
5. Upload presentation slides for review
6. Log decisions
7. Create and send invoices
8. Mark the final invoice as `unlocks_files: true` — files unlock automatically on payment

### File delivery
Brand assets stored in Supabase Storage are gated by Row Level Security. A client can only access their brand library files after their `unlocks_files` invoice is paid. This is enforced at the database level — not just the UI.

---

## Project structure

```
app/
  login/              Client login (OTP)
  dashboard/          Client dashboard
  projects/[id]/      Project detail
    review/[id]/      Deliverable review screen
  invoices/           Invoice list + payment
  library/            Brand library
  admin/
    studio/           Admin dashboard (Kacie only)
    clients/          Client list + individual workspaces
    proposals/        Proposal builder
    invoices/         Invoice management
  api/
    checkout/         Stripe checkout session
    webhook/          Stripe payment confirmation

components/
  CinqLogo.tsx        Shared CINQ wordmark SVG
  portal/             Client-facing components
  admin/              Admin-only components

lib/
  supabase.ts         Supabase client instances

types/
  database.ts         Full TypeScript types for all tables

supabase-schema.sql   Complete database schema — paste into Supabase SQL editor
```

---

## Adding a new client

1. Go to `/admin/studio`
2. Click **+ New client**
3. Enter their name, contact name, and email
4. Create a project and add deliverables
5. Send them the portal URL — they'll receive an OTP on first login

---

## Design tokens

All colors, spacing, and typography follow the Cinq system:

```css
--ink:        #0F0F0E
--cream:      #EDE8E0
--cream-dark: #DDD4C6
--sage:       #6B8F71   /* active / complete */
--amber:      #B07D3A   /* awaiting review / due */
--font-sans:  'Jost', sans-serif
--font-mono:  'DM Mono', monospace
--font-serif: 'PP Writer', 'Cormorant Garamond', Georgia, serif
```
