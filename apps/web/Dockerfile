FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web --include-workspace-root --ignore-scripts
COPY apps/web apps/web
WORKDIR /app/apps/web
# Destinația din rewrites() e scrisă în build, nu citită la pornire, deci adresa API-ului trebuie dată aici.
ARG API_URL=http://api:4000
ENV API_URL=$API_URL
# În Linux binarele native merg, deci folosim Turbopack (scriptul `build` forțează webpack pentru Windows).
RUN npx next build

# output: "standalone" produce un server Node minimal, fără node_modules complet.
FROM node:24-alpine
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
