# syntax=docker/dockerfile:1.7

# ---------- base ----------
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- dependencies (also generates the Prisma client via postinstall) ----------
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# ---------- tools: migrations, seed data, admin bootstrap ----------
# docker compose run --rm tools npm run admin:create -- --email you@example.com
FROM deps AS tools
COPY . .
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------- build ----------
FROM deps AS build
COPY . .
ENV NEXT_OUTPUT=standalone
RUN npm run build

# ---------- runtime ----------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
