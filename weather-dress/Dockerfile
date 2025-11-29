# weather-dress/Dockerfile

# ---------- Build stage ----------
FROM node:20-alpine AS builder

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install deps (works whether or not you have package-lock.json)
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

# Copy only what we need from the build stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# Copy Next config if present
COPY --from=builder /app/next.config.* ./ 2>/dev/null || true
COPY --from=builder /app/tsconfig.json ./tsconfig.json 2>/dev/null || true

EXPOSE 3000

# `npm start` should run `next start` in your package.json
CMD ["npm", "start"]
