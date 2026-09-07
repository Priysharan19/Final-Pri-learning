# ─────────────────────────────────────────────────────────────────────────────
# Pri Learning · marking gateway
#
# The gateway has no third-party dependencies — only node: builtins and fetch —
# so there is nothing to install and no lockfile to honour. That is worth
# keeping: this is the one process in the product that holds an API key, and
# every package it does not have is a supply chain it cannot be attacked
# through. If a dependency is ever added here, add `npm ci` and a build stage
# with it, and say why in the commit.
#
# Distroless, non-root, and only the four files the gateway actually runs.
# ─────────────────────────────────────────────────────────────────────────────

FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /app

# server/cloud only. The rest of server/ is the legacy Express app and the
# engine re-exports; none of it is reachable from the gateway, and shipping it
# would put the question bank in a container that faces the internet.
COPY server/cloud/handwritingGateway.mjs  ./server/cloud/handwritingGateway.mjs
COPY server/cloud/openaiHandwriting.mjs   ./server/cloud/openaiHandwriting.mjs
COPY server/cloud/markWorking.mjs         ./server/cloud/markWorking.mjs

ENV NODE_ENV=production

# Cloud Run injects PORT and the gateway prefers it. EXPOSE is documentation
# only — Cloud Run routes to whatever PORT says.
EXPOSE 8080

USER nonroot

CMD ["server/cloud/handwritingGateway.mjs"]
