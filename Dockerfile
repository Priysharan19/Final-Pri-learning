FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS client-build
# Every variable release/release-identity.mjs (DEPLOYMENT_IDENTITY_ENV) reads
# must be declared here: Docker and Railway expose a build-time variable only
# to a stage that declares it as an ARG. Without RAILWAY_GIT_COMMIT_SHA the
# client would bake a different SHA from the one the server reports at run
# time, and /v1/health would fail closed on the mismatch.
ARG RAILWAY_GIT_COMMIT_SHA
ARG PRI_RELEASE_SHA
ARG GITHUB_SHA
ARG VERCEL_GIT_COMMIT_SHA
ARG PRI_BUILD_TIMESTAMP
ARG SOURCE_DATE_EPOCH
# Build-time product flags (client/src/platform/features.js). Unset = OFF.
# Set a Railway build variable to "1" to ship the surface in production.
ARG PRI_FEATURE_PLACEMENT
ARG PRI_FEATURE_TUTOR
ARG PRI_FEATURE_EXTENDED_TRACKS
ENV PRI_FEATURE_PLACEMENT=${PRI_FEATURE_PLACEMENT} \
    PRI_FEATURE_TUTOR=${PRI_FEATURE_TUTOR} \
    PRI_FEATURE_EXTENDED_TRACKS=${PRI_FEATURE_EXTENDED_TRACKS}
WORKDIR /app
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client
COPY client ./client
COPY release ./release
# The four legal documents are imported by the client build (client/src/pages/
# Legal.jsx renders docs/legal/*.md), so they are part of the build context.
# Without them the image's client build fails with "Module not found".
COPY docs/legal ./docs/legal
# Precedence (RAILWAY_GIT_COMMIT_SHA > PRI_RELEASE_SHA) and build stamping are
# applied in one place, shared with the server's run-time resolver.
RUN node release/docker-build-identity.mjs

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS server-deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --omit=dev

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS runtime
ARG PRI_RELEASE_SHA
ARG PRI_BUILD_TIMESTAMP
ENV NODE_ENV=production \
    PORT=4000 \
    PRI_RELEASE_SHA=${PRI_RELEASE_SHA} \
    PRI_BUILD_TIMESTAMP=${PRI_BUILD_TIMESTAMP}
WORKDIR /app
# Only the production runtime enters the image: the process entry, the /v1
# control plane, the operator tools and the built client. The legacy /api
# Express stack (server/routes, auth.js, db.js, badges.js, seed.js) and the
# engine shims it needed are deliberately absent.
COPY server/package.json server/index.js server/app.js ./server/
COPY server/platform ./server/platform
COPY server/tools ./server/tools
# Server-only canonical mathematics implementation. The platform grading
# router imports these ESM files at runtime; the built web assets alone cannot
# satisfy those imports. Never copy the whole client/src tree into runtime.
COPY client/src/engine ./client/src/engine
COPY client/package.json ./client/package.json
COPY release ./release
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
