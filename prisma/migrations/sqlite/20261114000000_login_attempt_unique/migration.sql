-- LoginAttempt.username 唯一化：先保留每个用户名最新一条，再建唯一索引
DELETE FROM "login_attempts"
WHERE "id" NOT IN (
  SELECT MAX("id") FROM "login_attempts" GROUP BY "username"
);

CREATE UNIQUE INDEX "login_attempts_username_key" ON "login_attempts"("username");
