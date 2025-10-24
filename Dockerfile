# Этап 1: сборка TypeScript
FROM node:20-alpine AS builder
WORKDIR /app

# Установим pnpm глобально
RUN npm install -g pnpm

# Скопируем package.json и pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Установим все зависимости (сборка внутри контейнера)
RUN pnpm install --frozen-lockfile

# Скопируем исходники
COPY tsconfig.json ./
COPY src ./src

# Соберём TypeScript в JS
RUN pnpm exec tsc

# Этап 2: финальный runtime
FROM node:20-alpine AS runtime
WORKDIR /app

RUN npm install -g pnpm

# Скопируем только нужное из сборочного контейнера
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Откроем порт
EXPOSE 5000

# Запустим сервер
CMD ["node", "dist/index.js"]
