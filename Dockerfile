FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts nest-cli.json tsconfig.build.json tsconfig.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

FROM node:22-bookworm-slim AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
