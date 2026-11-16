-- 多实例共享限流计数表
CREATE TABLE `rate_limit_hits` (
  `rate_key` VARCHAR(191) NOT NULL,
  `total_hits` INT NOT NULL DEFAULT 0,
  `reset_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`rate_key`),
  INDEX `rate_limit_hits_reset_at_idx`(`reset_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
