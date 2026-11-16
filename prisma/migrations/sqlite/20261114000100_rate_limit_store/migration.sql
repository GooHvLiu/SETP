-- 多实例共享限流计数表
CREATE TABLE "rate_limit_hits" (
  "rate_key" TEXT NOT NULL PRIMARY KEY,
  "total_hits" INTEGER NOT NULL DEFAULT 0,
  "reset_at" DATETIME NOT NULL,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "rate_limit_hits_reset_at_idx" ON "rate_limit_hits"("reset_at");
