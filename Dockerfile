# ─── Stage 1: Build Dashboard ─────────────────────────────
FROM node:20-alpine AS dashboard-builder
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ ./
RUN npm run build

# ─── Stage 2: Build Backend ───────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# ─── Stage 3: Production Runner ───────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled backend
COPY --from=backend-builder /app/dist ./dist

# Copy dashboard build
COPY --from=dashboard-builder /app/dashboard/dist ./dashboard/dist

# Create required directories
RUN mkdir -p logs auth

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
