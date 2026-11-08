FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build && mkdir -p /data /app/.wrangler /app/.sites-runtime && chown -R node:node /data /app/.wrangler /app/.sites-runtime /app/dist/server

ENV NODE_ENV=production
USER node
EXPOSE 8080
VOLUME ["/data"]
CMD ["node", "scripts/self-host.mjs", "--host", "0.0.0.0", "--port", "8080", "--state", "/data"]
