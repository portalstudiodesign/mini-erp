# Build în două etape: imaginea finală are doar codul compilat și dependențele de producție.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/api --include-workspace-root --ignore-scripts
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN DATABASE_URL=postgres://build npx prisma generate && npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# `prisma` e dependență de producție: imaginea rulează `prisma migrate deploy` la pornire.
# --ignore-scripts sare și peste descărcarea motorului de migrări, așa că o facem explicit, ca root.
RUN npm ci -w apps/api --omit=dev --ignore-scripts \
  && node node_modules/@prisma/engines/scripts/postinstall.js
WORKDIR /app/apps/api
COPY --from=build /app/apps/api/dist ./dist
COPY apps/api/prisma ./prisma
COPY apps/api/prisma.config.ts ./
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
