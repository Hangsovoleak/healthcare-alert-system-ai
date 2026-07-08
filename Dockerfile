# ==========================================================
# STAGE 1: Build & Compile (Multi-Stage Build)
# ==========================================================
FROM node:20-alpine AS builder

# Install system dependencies needed for native module builds if any
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for compilation)
RUN npm ci

# Copy application source code
COPY . .

# Run production build (Vite static assets compilation + esbuild server bundling)
RUN npm run build

# ==========================================================
# STAGE 2: Production Runner (Lean, Secure Runtime)
# ==========================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Enforce secure production variables
ENV NODE_ENV=production
ENV PORT=3000

# Install curl in runner stage for Docker native Healthcheck support
RUN apk add --no-cache curl

# Copy dependency manifests
COPY package*.json ./

# Install only production dependencies to keep the image minimal
RUN npm ci --only=production

# Copy compiled build outputs and server bundle from the builder stage
COPY --from=builder /app/dist ./dist

# Ensure the non-root 'node' user (pre-configured in alpine image) owns the app directory
RUN chown -R node:node /app

# Switch to the non-root user to mitigate privilege escalation vectors
USER node

# Expose port 3000 to the container network
EXPOSE 3000

# Set up a container healthcheck targeting the web application server
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start the Node.js production server
CMD ["node", "dist/server.cjs"]
