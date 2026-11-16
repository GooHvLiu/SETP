FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache python3 make g++ libstdc++

COPY package*.json ./
# 国内构建可通过 --build-arg NODE_DIST_URL=https://npmmirror.com/mirrors/node 加速头文件下载。
ARG NODE_DIST_URL=https://nodejs.org/download/release
RUN npm_config_disturl=${NODE_DIST_URL} npm ci --no-audit --no-fund

FROM deps AS build
WORKDIR /app
COPY . .
# schema.mysql.prisma 是切库生成物，不随仓库分发；默认按 MySQL 生成 client，保证镜像可迁移
ARG DB_TYPE=mysql
RUN npm run db:sync-schema
RUN DATABASE_URL="mysql://build:build@127.0.0.1:3306/build" DB_TYPE=${DB_TYPE} npx prisma generate
RUN npm run build

FROM build AS prod-deps
WORKDIR /app
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache libstdc++ \
  && addgroup -S setp \
  && adduser -S setp -G setp

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x docker/entrypoint.sh \
  && mkdir -p data uploads logs backups \
  && chown -R setp:setp data uploads logs backups

USER setp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.APP_PORT||3000)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "docker/entrypoint.sh"]
