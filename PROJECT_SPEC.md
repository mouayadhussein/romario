# Restaurant Menu & Ordering System — Project Spec

You are the senior developer on a paid client project. Build it complete, clean, and production-ready. Follow this spec exactly. Work in the phases below, one at a time; finish and test a phase before starting the next. Ask before deviating.

## Stack
- Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- Supabase: Postgres, Auth (admin login), Storage (images), Realtime (new orders)
- Deploy: Vercel
- UI language: Arabic, RTL by default (use i18n-ready structure so another language can be added later)
- Currency is a single config value in `lib/config.ts`

## Core concept
Branch → Categories → Items. Customers browse a branch menu, fill a cart, and submit an order. Payment is **cash on delivery only**.

## Database schema (Postgres)
- `branches`: id, name, slug (unique), address, phone, whatsapp_number, map_url, working_hours, is_active, sort_order
- `categories`: id, branch_id (FK, cascade), name, image_url, is_active, sort_order
- `items`: id, category_id (FK, cascade), name, description, price (numeric), image_url, is_available, sort_order
- `orders`: id, order_number (human-readable, sequential per branch), branch_id, customer_name, customer_phone, customer_address, order_type (delivery | pickup | dine_in), table_number (nullable), general_note, total, status (new | preparing | delivered | cancelled), created_at
- `order_items`: id, order_id (FK, cascade), item_id (nullable), name_snapshot, price_snapshot, quantity, note (per-item customer note)

Rules:
- Always store name and price snapshots in `order_items`; later menu edits must never change old orders.
- Add indexes on foreign keys and `orders(branch_id, created_at)`.
- Provide SQL migrations in `/supabase/migrations`.

## Security (mandatory)
- Enable RLS on every table.
- Public: read-only access to active branches, categories, and available items.
- Writes to branches/categories/items/orders-status: authenticated admin only.
- Orders are created ONLY through a server route (`POST /api/orders`) using the service role key. Never expose the service role key to the client.
- In that route: validate input with zod, re-fetch item prices from the DB (never trust client prices), reject unavailable items, add basic rate limiting, and sanitize notes.
- Admin routes protected by middleware; unauthenticated users redirect to `/admin/login`.
- Secrets only in environment variables; provide `.env.example`.

## Customer site
Routes:
- `/` → list of active branches
- `/[branchSlug]` → branch info (address, hours, map link, WhatsApp) + category tabs + items
- `/[branchSlug]/cart` → cart and checkout

Features:
- Search within a branch menu.
- Item card: image, name, description, price, add button. Unavailable items are shown disabled.
- Cart (client state, persisted in localStorage per branch): quantity +/-, remove, and **a separate note field for each item** (e.g. "extra ketchup", "well done").
- Checkout form: name, phone, order type, address (for delivery), table number (for dine-in), optional general note. Show total and a "Cash on delivery" label.
- On submit: (1) POST to `/api/orders` which saves the order, (2) then open WhatsApp with `https://wa.me/<branch whatsapp>?text=<encoded message>` containing order number, customer details, each item with quantity, note, price, and total. The order must be saved even if the customer never completes the WhatsApp step.
- Confirmation page showing the order number.
- Mobile-first, fast, optimized images (next/image), good loading and error states.

## Admin dashboard (`/admin`)
- Login via Supabase Auth (email + password).
- **Orders** (home page): live list via Supabase Realtime, filter by branch and status, order details with per-item notes, change status, sound/visual alert for new orders, print-friendly order view.
- **Branches**: add, edit, delete (with confirmation), activate/deactivate, reorder.
- **Categories** (inside a branch): add, edit, delete (with confirmation), reorder, image upload.
- **Items** (inside a category): add, edit, delete (with confirmation), price, image upload, toggle availability, reorder.
- Option to duplicate a category or whole menu from one branch to another.
- Forms with validation and clear error/success toasts. Image upload with client-side compression to Supabase Storage.

## Project structure
```
app/
  (site)/ ...            customer pages
  admin/ ...             dashboard pages
  api/orders/route.ts    order creation
components/ lib/ supabase/ types/
```
Use server actions or route handlers for admin mutations. Keep components small and typed. No `any`.

## Phases
1. Project setup, Supabase schema + RLS, seed data (2 branches, 3 categories, several items).
2. Admin auth + CRUD for branches, categories, items (with image upload).
3. Customer site: branches, menu, search.
4. Cart with per-item notes + checkout + `/api/orders` + WhatsApp message.
5. Admin orders dashboard (realtime, status, print).
6. Polish: RTL review, SEO/meta, loading/empty/error states, accessibility, QR code per branch in admin, README with setup and deploy steps.

## Definition of done
- `npm run build` and `npm run lint` pass with no errors.
- Every flow tested manually: create branch → category → item → customer order → appears in dashboard and WhatsApp opens.
- README explains env vars, Supabase setup, and Vercel deployment.