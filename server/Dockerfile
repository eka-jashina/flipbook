FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

EXPOSE 4000

# Run migrations then start the dev server
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
