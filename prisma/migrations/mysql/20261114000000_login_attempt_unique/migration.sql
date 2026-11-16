-- LoginAttempt.username 唯一化：先保留每个用户名最新一条，再建唯一索引
DELETE l1 FROM login_attempts l1
INNER JOIN login_attempts l2
  ON l1.username = l2.username AND l1.id < l2.id;

ALTER TABLE login_attempts ADD UNIQUE INDEX login_attempts_username_key (username);
