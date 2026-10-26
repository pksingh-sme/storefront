# Boutique storefront

A production-ready boutique e-commerce site for pashmina shawls, curtains, earrings, clothing and accessories, with a secure admin dashboard. Categories, branding, banners and policies are all editable by the store admin.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · PostgreSQL + Prisma 7 · Better Auth · S3-compatible storage (local driver for development) · sharp image renditions · Zod · Stripe Checkout (optional) · Vitest + Playwright.

Deployment, object storage, Stripe, backups and operations are covered in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Features

**Storefront**
- Home page with hero/promo banners, featured categories, new arrivals, best sellers and newsletter sign-up (with explicit consent and a honeypot).
- Shop and category pages with search, category/colour/price/in-stock filters, sorting and pagination. Filters live in the URL, so they are shareable and work without JavaScript.
- Product page with colour variants. Each colour has its own images, SKU, price, sale price, stock and active flag.
  - The gallery shows only the selected colour's images, followed by images marked "shared by all colours". It never shows another colour's photos.
  - The carousel has thumbnails, previous/next buttons, swipe, keyboard support (arrows, Home, End) and a zoom dialog. It resets to the first image when the colour changes.
  - `?color=emerald-green` deep-links a colour. Sold-out colours stay visible but cannot be added to the bag.
- Bag with live stock validation; prices are always re-read from the database.
- Checkout through Stripe (test mode first). Orders are marked paid only by a verified webhook.
- SEO: per-page metadata, canonical URLs, Open Graph, `sitemap.xml`, `robots.txt`, and Product/Breadcrumb JSON-LD.
- Accessibility: skip link, landmarks, labelled controls, radio-group colour swatches and visible focus. axe checks run in the e2e suite.

**Admin (`/admin`)**
- Admin-only sign-in, with server-side authorization on every page, server action and upload endpoint.
- Products: create, edit, duplicate, publish/unpublish, archive and delete. Publishing is blocked until the product has an active colour with an image.
- Colours: add, edit, reorder and deactivate each colour with its own SKU, price override, sale price and stock.
- Images:
  - Multi-file upload with previews and progress; type, size and content are validated.
  - Images upload directly to storage through short-lived presigned URLs and are then converted to responsive WebP sizes.
  - You can assign each image to a colour or mark it shared, reorder it (drag or buttons), set the main image, edit its alt text and delete it. Storage is cleaned up when images are deleted.
- Categories: two-level tree, ordering, featured flag, images and SEO fields. Deleting a category that still has products requires choosing where those products move.
- Settings: store name, logo, contact details, social links, currency, announcement bar, shipping/tax and policy pages.
- Banners: hero and promo banners with scheduling.
- Orders list with status updates, and an activity log of admin changes.

---

## Local development

Requirements: Node.js 22+, PostgreSQL 14+.

```bash
npm install                      # also generates the Prisma client
cp .env.example .env             # then fill in the values (see below)
npm run db:deploy                # apply migrations (use db:migrate when changing the schema)
npm run db:seed                  # optional sample catalog, clearly labelled as sample data
npm run admin:create -- --email you@example.com --name "Your Name"
npm run dev                      # http://localhost:3000, admin at /admin
```

Minimum `.env` for development:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/storefront"
BETTER_AUTH_SECRET="$(openssl rand -base64 48)"   # paste the generated value
SITE_URL="http://localhost:3000"
BETTER_AUTH_URL="http://localhost:3000"
STORAGE_DRIVER="local"
UPLOAD_SIGNING_SECRET="$(openssl rand -base64 48)"
```

If you don't have Postgres installed:

```bash
docker run -d --name storefront-db -p 5432:5432 \
  -e POSTGRES_USER=storefront -e POSTGRES_PASSWORD=storefront -e POSTGRES_DB=storefront postgres:16-alpine
```

To wipe the catalog and reseed, run `SEED_RESET=true npm run db:seed`. The seed refuses to reset when `NODE_ENV=production`.

### Creating the first admin

There is no default admin account and public sign-up is disabled. Create admins from the command line:

```bash
npm run admin:create -- --email owner@example.com --name "Store Owner"
# prompts for a password (hidden, min 12 characters)

npm run admin:create -- --email owner@example.com --reset-password   # reset a forgotten password
```

For non-interactive use (CI, containers), pass the password through the environment: `ADMIN_PASSWORD=... npm run admin:create -- --email ...`. Running the script against an existing user promotes them to admin.

### Adding a product with several colours

1. Go to **Admin → Products → New product**. Enter a name and category, then press **Create**. The product starts as a draft.
2. Fill in the description, price (the default for every colour), materials, care, dimensions and SEO fields, then **Save**.
3. Under **Colours**, add each colour with a name, swatch colour, SKU and stock. Leave the price blank to use the product price, or set a price or sale price for that colour only.
4. Under **Images**, choose a colour in "Upload for" and select several files. Repeat for each colour. Choose **Shared by all colours** for detail shots that apply to every colour.
5. Drag images (or use the arrows) to order each colour's gallery, and click **Make main** to choose the first image. Add alt text to every image.
6. Use **Customer preview** to check each colour's gallery, then **Publish**.

The seeded "Classic Pashmina Shawl" is a worked example. It has four colours: one with a price override, one with low stock and one sold out. Each colour has three images, plus one shared detail image.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build and serve |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:migrate` | Create and apply a migration after editing `prisma/schema.prisma` (development) |
| `npm run db:deploy` | Apply pending migrations (CI and production) |
| `npm run db:seed` | Load sample data |
| `npm run admin:create` | Create, promote or reset an admin |
| `npm run storage:cleanup` | Remove abandoned uploads and expired carts (schedule daily) |
| `npm test` | Unit, integration and component tests (Vitest) |
| `npm run test:e2e` | Playwright end-to-end tests (desktop + mobile) |

## Tests

Integration and e2e tests use their own databases and never touch development data. Create them once:

```sql
CREATE DATABASE storefront_test;
CREATE DATABASE storefront_e2e;
```

By default the tests connect as `storefront:storefront@localhost:5432`. Override this with `TEST_DATABASE_URL` and `E2E_DATABASE_URL`. Migrations are applied automatically.

```bash
npm test                        # unit, integration, component
npx vitest run --project unit   # one project: unit | integration | components
npm run test:e2e                # builds into .next-e2e, seeds the e2e DB, runs on port 3100
E2E_SKIP_BUILD=1 npm run test:e2e   # reuse the previous e2e build
```

Coverage:
- **Unit:** pricing, gallery selection, and validation.
- **Integration:** product/variant/image services, category reassignment, cart and checkout, order payment idempotency, and admin authorization (anonymous, non-admin and forged sessions).
- **Component:** the colour/gallery experience.
- **End-to-end:** browsing, colour switching, carousel controls, the cart, the admin product workflow with uploads, and accessibility checks on desktop and mobile.

## Project layout

```
prisma/              schema, migrations (incl. CHECK constraints), seed + placeholder image generator
scripts/             admin bootstrap, cleanup job
src/proxy.ts         CSP header, optimistic /admin redirect
src/app/(store)/     storefront routes + public server actions
src/app/admin/       login, dashboard and admin pages; admin server actions (all guarded)
src/app/api/         auth, local upload endpoint, Stripe webhook, health check
src/server/          services: catalog queries, products, variants, images, cart, checkout
src/lib/             env, auth, authorization, storage drivers, validation schemas, pricing, gallery
src/components/      ui primitives, storefront, product experience, admin widgets
tests/               unit, integration, components, e2e
```

Notes:
- Money is stored as integer cents.
- `Product.minPriceCents` and `Product.totalStock` are recomputed whenever variants change, so listings can filter and sort without joins.
- Storefront data is cached with tags; admin writes invalidate the affected tags immediately.
