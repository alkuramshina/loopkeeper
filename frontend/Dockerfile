FROM node:24.21.0-bookworm-slim AS builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=/api
RUN npm run build

FROM caddy:2.10.2-alpine AS production
COPY deploy/Caddyfile.frontend /etc/caddy/Caddyfile
COPY --from=builder /app/dist /srv
EXPOSE 8080
