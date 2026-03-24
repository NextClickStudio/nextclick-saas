FROM node:20-alpine

RUN apk add --no-cache openssl openssl-dev python3 make g++

WORKDIR /app

# ── Frontend build (Vite — no ajv issues) ──────────────────────────
COPY frontend/package.json frontend/package-lock.json* ./frontend/
WORKDIR /app/frontend
RUN npm install

COPY frontend/ ./

# Vite env vars must be prefixed VITE_
ARG VITE_SHOPIFY_API_KEY
ENV VITE_SHOPIFY_API_KEY=$VITE_SHOPIFY_API_KEY

RUN npm run build
# Verify build succeeded
RUN test -f build/index.html || (echo "ERROR: frontend build failed" && exit 1)

# ── Backend setup ───────────────────────────────────────────────────
COPY backend/package.json backend/package-lock.json* /app/backend/
WORKDIR /app/backend
RUN npm install --legacy-peer-deps

COPY backend/ ./
RUN npx prisma generate

# ── Widget ──────────────────────────────────────────────────────────
COPY widget/ /app/widget/

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/index.js"]
