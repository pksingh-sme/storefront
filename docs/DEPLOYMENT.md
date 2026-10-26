# Deployment and operations

## External services

| Service | Required | Used for |
| --- | --- | --- |
| PostgreSQL 14+ | Yes | All data (catalog, carts, orders, admin sessions) |
| S3-compatible object storage (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO, …) | Yes in production | Product, category, banner and logo images |
| Stripe | Optional | Card payments through Stripe Checkout. Without keys, checkout shows "Online payment is not enabled" and nothing is charged |
| Reverse proxy / CDN with TLS | Recommended | HTTPS termination, caching of `/_next/static` and image hosts |
| Email provider | Not integrated | Order confirmations and password reset are **not** sent (see limitations) |

All configuration is through environment variables. The variables are documented in [`.env.example`](../.env.example), and the app validates them at startup, failing with a clear message when one is invalid.

## Option A: Docker

The `Dockerfile` has three useful targets:

- `runner` (default): a minimal Node 22 image with the Next.js standalone server. It runs as the `node` user and has a health check on `/api/health`.
- `tools`: the full source and dev dependencies, for migrations, seed, admin bootstrap and cleanup.
- `build`: an intermediate stage.

The image builds without a database or secrets; everything is read at runtime.

```bash
docker build -t storefront .                      # runtime image
docker build -t storefront-tools --target tools .  # migrations/admin tooling
```

### Local production-like stack (Postgres + MinIO + app)

```bash
cp .env.docker.example .env.docker     # fill in POSTGRES_PASSWORD, BETTER_AUTH_SECRET, MINIO_ROOT_PASSWORD
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker run --rm tools npm run admin:create -- --email you@example.com
docker compose --env-file .env.docker run --rm tools npm run db:seed        # optional sample data
```

Compose runs the following:

- Postgres.
- MinIO, with a bucket that is publicly readable for images, a CORS origin for the site, and a lifecycle rule for abandoned `uploads/`.
- A one-shot `migrate` service (`prisma migrate deploy`).
- The app on http://localhost:3000.

The server reaches MinIO at `http://minio:9000`, while browsers upload to `http://localhost:9000`. That is what `S3_UPLOAD_ENDPOINT` is for.

> The compose file was validated with `docker compose config`, but it has not been run end to end here, because image pulls from Docker Hub were rate-limited in the build environment. MinIO's community images are pinned by release tag. If MinIO is unavailable to you, any S3-compatible service works with the same variables.

### Production with containers

Run the `runner` image behind TLS, with:

```bash
NODE_ENV=production            # set by the image
SITE_URL=https://shop.example.com
BETTER_AUTH_URL=https://shop.example.com
BETTER_AUTH_SECRET=<48+ random bytes, base64>
DATABASE_URL=postgresql://...?sslmode=require
STORAGE_DRIVER=s3
S3_BUCKET=... S3_REGION=... S3_PUBLIC_BASE_URL=https://cdn.example.com
TRUST_PROXY=true               # only if your proxy sets X-Forwarded-For and strips client-supplied values
```

Deploy order: run `npx prisma migrate deploy` with the tools image (or as a release step), then roll out the new runner. Migrations are additive-first; never run `migrate dev` or `migrate reset` against production.

## Option B: Node host / PaaS

```bash
npm ci
NEXT_OUTPUT=standalone npm run build    # or plain `npm run build` and `npm start`
npx prisma migrate deploy
node .next/standalone/server.js         # copy .next/static and public next to it first
```

When using the standalone server, use an absolute `LOCAL_STORAGE_DIR` if you ever use the local driver, because the server changes its working directory. The local driver is meant for development only: it stores files on the app server's disk, which does not work with several instances or ephemeral filesystems.

## Object storage

### Bucket layout

- `uploads/…`: originals uploaded directly by the browser. They are deleted once processed; abandoned ones are removed by the cleanup job or a lifecycle rule.
- `products/<productId>/<imageId>/w{320,640,960,1280,1600}.webp`: product renditions.
- `media/<assetId>/w….webp`: category, banner and logo renditions.

Renditions are written with `Cache-Control: public, max-age=31536000, immutable`. Keys are never reused, so long caching is safe.

### Public read access

Images must be readable by browsers. Use one of these options:

- Put a CDN (CloudFront with Origin Access Control, or R2 public bucket/custom domain) in front of the bucket, and set `S3_PUBLIC_BASE_URL` to the CDN URL. This is recommended.
- Use a bucket policy that allows `s3:GetObject` on `products/*` and `media/*` only. Do not make `uploads/*` public.

The Content-Security-Policy automatically allows `S3_PUBLIC_BASE_URL` for images, and the S3 endpoint for uploads.

### CORS for presigned uploads

Browsers POST directly to the bucket, so allow your site origin:

```json
[
  {
    "AllowedOrigins": ["https://shop.example.com"],
    "AllowedMethods": ["POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

### Least-privilege IAM policy for the app

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::YOUR_BUCKET"
    }
  ]
}
```

Prefer an IAM role (ECS task role, instance profile, IRSA) and leave `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` empty. The SDK then uses the default credential chain.

### Lifecycle rule

Add a rule that expires objects under `uploads/` after 1–2 days, as a backstop for the cleanup job. Enable bucket versioning if you want point-in-time recovery of images (see Backups).

### How uploads are secured

1. An admin requests an upload. The server checks admin rights, type (JPEG/PNG/WebP/AVIF) and size, then returns a presigned POST. The POST is valid for 5 minutes, for exactly one key and content type, with a size limit of `MAX_UPLOAD_MB`.
2. The browser uploads the file directly to storage.
3. The admin finalizes the upload. The server downloads the original, checks the file signature (magic bytes) and decodes it with sharp, then rejects anything that isn't a real image. It strips metadata, auto-rotates, writes the WebP renditions, and deletes the original.

SVG is not accepted, to prevent script injection.

## Stripe

1. Create a Stripe account and stay in **test mode**.
2. Set `STRIPE_SECRET_KEY=sk_test_…`.
3. Add a webhook endpoint `https://shop.example.com/api/webhooks/stripe` with these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
   - `checkout.session.async_payment_failed`
4. Set `STRIPE_WEBHOOK_SECRET=whsec_…` from that endpoint.
5. For local testing, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use the `whsec_` it prints.

How payment is handled:

- Prices and stock are re-validated on the server when checkout starts.
- A pending order is created, and the customer pays on Stripe's hosted page. Card details never touch this server.
- The order is marked paid only by the signature-verified webhook. That handler is idempotent, so retries are safe.
- Stock is decremented at payment time. If two customers buy the last unit at once, the order is still accepted and the oversold line is recorded in the admin activity log so you can follow up.

Configure shipping and tax rates in Admin → Settings. They are flat-rate; use Stripe Tax or a tax provider for real tax rules. Switch to live keys only after a full test purchase, including refunds handled in the Stripe dashboard.

The payment provider is behind an interface (`src/server/checkout/types.ts`), so another provider can be added without touching the cart.

## Security checklist

- HTTPS only. HSTS is sent in production, and cookies are `Secure` and `HttpOnly`.
- Generate `BETTER_AUTH_SECRET` and `UPLOAD_SIGNING_SECRET` with `openssl rand -base64 48`. Never reuse them across environments.
- Create admins with `npm run admin:create`. Public sign-up is disabled, and sign-in is rate-limited (5 per minute per IP).
- Rate limits for sign-in, newsletter, cart, checkout and uploads are **in memory per instance**. When running more than one instance, move them to a shared store (Redis/Upstash) in `src/lib/rate-limit.ts`, or enforce limits at the proxy/WAF.
- Set `TRUST_PROXY=true` only behind a proxy you control. Otherwise clients can spoof their IP.
- The `/admin` area is `noindex`, `no-store`, and checked on the server in every page, action and API route. The proxy redirect is only a convenience.

## Scheduled jobs

Run daily:

```bash
npm run storage:cleanup    # removes uploads abandoned for 24h and expired carts
```

With Docker, use `docker compose run --rm tools npm run storage:cleanup` from cron, or a scheduled task in your platform.

## Backups and restore

**Database:** take nightly logical backups, plus point-in-time recovery if your host offers it.

```bash
pg_dump --format=custom --no-owner "$DATABASE_URL" > storefront-$(date +%F).dump
# restore into an empty database:
pg_restore --clean --if-exists --no-owner --dbname "$TARGET_DATABASE_URL" storefront-2026-10-26.dump
npx prisma migrate deploy   # brings an older dump up to the current schema
```

**Images:** enable bucket versioning, and/or sync the bucket to a second location (`aws s3 sync s3://bucket s3://backup-bucket`, or `rclone sync`). Database rows reference storage keys, so restore the database and bucket from about the same point in time.

Test a restore into a staging environment at least once before launch.

## Monitoring

- `GET /api/health` returns 200 when the app can reach the database, and 503 otherwise.
- Server errors are logged to stdout/stderr. Forward them to your log platform and alert on Stripe webhook failures (`Stripe webhook processing failed`).
- The admin dashboard shows low-stock and out-of-stock colours, and draft products that aren't ready to publish.
