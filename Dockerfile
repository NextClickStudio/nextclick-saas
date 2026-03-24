FROM node:20-alpine

RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

COPY . .

WORKDIR /app/backend

RUN npm install

RUN npx prisma generate

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/index.js"]
