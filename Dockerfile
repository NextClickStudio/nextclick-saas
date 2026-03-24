FROM node:20-alpine

RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

COPY . .

RUN cd backend && npm install --production

RUN cd backend && npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 3001

CMD ["sh", "-c", "cd /app/backend && npx prisma db push --accept-data-loss --schema=./prisma/schema.prisma && node src/index.js"]
