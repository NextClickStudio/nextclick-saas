# react-scripts 5.x is not compatible with Node 20 — use Node 18
FROM node:18-alpine

RUN apk add --no-cache openssl openssl-dev python3 make g++

WORKDIR /app

# ── Frontend build ──────────────────────────────────────────────────
COPY frontend/package.json frontend/package-lock.json* ./frontend/
WORKDIR /app/frontend
RUN npm install --legacy-peer-deps

COPY frontend/ ./

ARG REACT_APP_SHOPIFY_API_KEY
ENV REACT_APP_SHOPIFY_API_KEY=$REACT_APP_SHOPIFY_API_KEY
ENV NODE_OPTIONS=--max_old_space_size=1536
ENV GENERATE_SOURCEMAP=false
ENV CI=false

RUN npm run build

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
