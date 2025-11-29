# weather-dress/Dockerfile

# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
# If you have a package-lock.json, you can optimize by using: RUN npm ci
RUN npm install

# Copy the rest of the app source
COPY . .

# Build the Next.js app
RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only what we need to run the built app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

# "start" should be "next start" in package.json
CMD ["npm", "start"]
