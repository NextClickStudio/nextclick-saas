FROM node:20-alpine

RUN apk add --no-cache openssl openssl-dev

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install --production

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ ./
COPY widget/ ../widget/

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/index.js"]
