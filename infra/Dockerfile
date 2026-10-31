FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY prisma ./prisma
RUN npm ci && npx prisma generate
COPY . .
RUN npm run build
FROM build AS api
ENV NODE_ENV=production PORT=4000
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
FROM build AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/web", "--hostname", "0.0.0.0"]
