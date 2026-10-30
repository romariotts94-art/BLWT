FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build:node

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 FILE_STORAGE_PATH=/app/data/uploads
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.nitro ./node_modules/.nitro
COPY --from=build /app/.output ./.output
COPY --from=build /app/scripts/support-delivery.mjs ./scripts/support-delivery.mjs
COPY --from=build /app/scripts/npd-scheduler.mjs ./scripts/npd-scheduler.mjs
COPY --from=build /app/scripts/migrate-postgres.mjs ./scripts/migrate-postgres.mjs
COPY --from=build /app/db/postgres ./db/postgres
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
