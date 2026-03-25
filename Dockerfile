FROM node:18-alpine

RUN apk add --no-cache openssl openssl-dev python3 make g++

WORKDIR /app

# ── Frontend (Vite) ─────────────────────────────────────────────────
COPY frontend/package.json ./frontend/
WORKDIR /app/frontend
RUN npm install

COPY frontend/ ./

ARG VITE_SHOPIFY_API_KEY=""
ENV VITE_SHOPIFY_API_KEY=$VITE_SHOPIFY_API_KEY

ARG VITE_HOST=""
ENV VITE_HOST=$VITE_HOST

RUN npm run build
RUN test -f build/index.html && echo "✓ Frontend build OK" || (echo "✗ Frontend build FAILED" && exit 1)

# ── Backend ─────────────────────────────────────────────────────────
COPY backend/package.json /app/backend/
WORKDIR /app/backend
RUN npm install --legacy-peer-deps

COPY backend/ ./
RUN npx prisma generate

# ── Widget ──────────────────────────────────────────────────────────
COPY widget/ /app/widget/

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/index.js"]
