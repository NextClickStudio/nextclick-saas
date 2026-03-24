FROM node:20-alpine

WORKDIR /app

# Copy everything
COPY . .

# Install backend dependencies
WORKDIR /app/backend
RUN npm install --production

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3001

# On start: push DB schema + start server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/index.js"]
