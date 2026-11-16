#!/bin/sh
set -eu

# 容器启动前先补齐运行目录与数据库结构，再执行一次空库种子检查
node scripts/db/ensure-dirs.cjs

if [ -x ./node_modules/.bin/prisma ]; then
  ./node_modules/.bin/prisma migrate deploy
else
  npx prisma migrate deploy
fi

node dist/src/db/helpMigrations.js
node scripts/db/ensure-seed.cjs

exec node dist/app.js
