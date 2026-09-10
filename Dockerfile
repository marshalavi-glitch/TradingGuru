FROM node:20-slim

WORKDIR /app

# Copy package files & install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy source code
COPY . .

# Build frontend production bundle
RUN cd frontend && npm run build

# Hugging Face Spaces default port is 7860
EXPOSE 7860
ENV PORT=7860
ENV NODE_ENV=production

CMD ["node", "backend/server.js"]
