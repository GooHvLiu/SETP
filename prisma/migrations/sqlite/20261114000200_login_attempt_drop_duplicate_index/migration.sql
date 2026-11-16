-- 删除 login_attempts.username 的重复普通索引
-- 唯一索引 login_attempts_username_key 已覆盖等值查询，普通索引会造成 schema 漂移
DROP INDEX "login_attempts_username_idx";
