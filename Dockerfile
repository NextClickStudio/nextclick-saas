FROM node:18-alpine

RUN apk add --no-cache openssl openssl-dev python3 make g++

WORKDIR /app

# ── Frontend build ──────────────────────────────────────────────────
COPY frontend/package.json frontend/package-lock.json* ./frontend/
WORKDIR /app/frontend

RUN npm install --legacy-peer-deps

# Nuke the broken nested ajv inside fork-ts-checker-webpack-plugin
# and replace it with the correct ajv version
RUN rm -rf node_modules/fork-ts-checker-webpack-plugin/node_modules/ajv \
    && rm -rf node_modules/fork-ts-checker-webpack-plugin/node_modules/ajv-keywords \
    && rm -rf node_modules/fork-ts-checker-webpack-plugin/node_modules/schema-utils

COPY frontend/ ./

ARG REACT_APP_SHOPIFY_API_KEY
ENV REACT_APP_SHOPIFY_API_KEY=$REACT_APP_SHOPIFY_API_KEY
ENV NODE_OPTIONS=--max_old_space_size=1536
ENV GENERATE_SOURCEMAP=false
ENV CI=false
ENV DISABLE_ESLINT_PLUGIN=true
ENV TSC_COMPILE_ON_ERROR=true

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
