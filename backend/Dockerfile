# ============================================================
# CampusOS API - production image
#
#   docker build -t campusos-api ./backend
#   docker run --env-file backend/.env -p 5000:5000 campusos-api
#
# Two stages: dependencies are installed (bcrypt compiles a native addon)
# in a full image, then only runtime files are copied into a slim one that
# runs as an unprivileged user.
# ============================================================

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node src ./src

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
