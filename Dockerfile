FROM node:20-alpine

RUN apk add --no-cache openssl openssl-dev python3 make g++

WORKDIR /app

# ── Frontend build ──────────────────────────────────────────────────
# Install deps first (better Docker layer caching)
COPY frontend/package.json frontend/package-lock.json* ./frontend/
WORKDIR /app/frontend
RUN npm install --legacy-peer-deps

# Copy frontend source
COPY frontend/ ./

# REACT_APP_ vars must be present at BUILD time for react-scripts.
# Set REACT_APP_SHOPIFY_API_KEY in Railway Variables panel —
# Railway will inject it automatically as a build arg.
ARG REACT_APP_SHOPIFY_API_KEY
ENV REACT_APP_SHOPIFY_API_KEY=$REACT_APP_SHOPIFY_API_KEY

# Increase Node memory for react-scripts, disable sourcemaps to save space
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
