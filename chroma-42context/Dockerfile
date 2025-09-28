# Use Node.js 20 as base image for Vite compatibility
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Accept build arguments for Vite environment variables
ARG VITE_CHROMA_URL=http://localhost:8000
ARG VITE_CHROMA_AUTH_TOKEN=test-token

# Set environment variables for build time
ENV VITE_CHROMA_URL=$VITE_CHROMA_URL
ENV VITE_CHROMA_AUTH_TOKEN=$VITE_CHROMA_AUTH_TOKEN

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application with environment variables
RUN npm run build

# Install serve to serve the built application
RUN npm install -g serve

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 3005

# Start the application
CMD ["serve", "-s", "dist", "-l", "3005"]