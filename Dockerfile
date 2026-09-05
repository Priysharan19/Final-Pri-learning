FROM node:24-bookworm-slim AS client-build
WORKDIR /app
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client
COPY client ./client
RUN npm run build --prefix client

FROM node:24-bookworm-slim AS server-deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
# Only the production runtime enters the image: the process entry, the /v1
# control plane, the operator tools and the built client. The legacy /api
# Express stack (server/routes, auth.js, db.js, badges.js, seed.js) and the
# engine shims it needed are deliberately absent.
COPY server/package.json server/index.js server/app.js ./server/
COPY server/platform ./server/platform
COPY server/tools ./server/tools
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY --from=client-build /app/client/dist ./client/dist
# Default mount point for PRI_PLATFORM_DB; the process runs unprivileged as
# the image's `node` user (uid 1000), so a bind-mounted volume must be
# writable by that uid.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
