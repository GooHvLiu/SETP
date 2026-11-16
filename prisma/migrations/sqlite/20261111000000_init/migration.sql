-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "real_name" TEXT DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "status" INTEGER NOT NULL DEFAULT 1,
    "is_super" INTEGER NOT NULL DEFAULT 0,
    "must_change_password" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" DATETIME,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "roles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "menus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parent_id" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MENU',
    "path" TEXT DEFAULT '',
    "component" TEXT DEFAULT '',
    "icon" TEXT DEFAULT '',
    "menu_group" TEXT DEFAULT '',
    "permission" TEXT DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "visible" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,

    PRIMARY KEY ("user_id", "role_id"),
    CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "role_menus" (
    "role_id" INTEGER NOT NULL,
    "menu_id" INTEGER NOT NULL,

    PRIMARY KEY ("role_id", "menu_id"),
    CONSTRAINT "role_menus_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_menus_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "config_key" TEXT NOT NULL,
    "config_value" TEXT,
    "description" TEXT DEFAULT '',
    "editable" INTEGER NOT NULL DEFAULT 1,
    "config_scope" TEXT NOT NULL DEFAULT 'system',
    "config_group" TEXT NOT NULL DEFAULT '',
    "read_scope" TEXT NOT NULL DEFAULT 'all',
    "value_type" TEXT NOT NULL DEFAULT 'string',
    "default_value" TEXT,
    "validation_json" TEXT DEFAULT '',
    "env_key" TEXT DEFAULT '',
    "restart_required" INTEGER NOT NULL DEFAULT 0,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL DEFAULT 'operation',
    "user_id" INTEGER,
    "username" TEXT DEFAULT '',
    "module" TEXT DEFAULT '',
    "action" TEXT DEFAULT '',
    "result" TEXT NOT NULL DEFAULT 'success',
    "reason" TEXT DEFAULT '',
    "target" TEXT DEFAULT '',
    "description" TEXT DEFAULT '',
    "ip" TEXT DEFAULT '',
    "user_agent" TEXT DEFAULT '',
    "request_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'system',
    "type" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "title_key" TEXT,
    "content_key" TEXT,
    "data" TEXT NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "sender_id" INTEGER,
    "batch_id" TEXT,
    "template_key" TEXT,
    "email_status" TEXT NOT NULL DEFAULT 'none',
    "email_error" TEXT,
    "is_read" INTEGER NOT NULL DEFAULT 0,
    "read_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" DATETIME,
    "last_attempt_at" DATETIME,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "dict_types" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type_code" TEXT NOT NULL,
    "type_name" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "remark" TEXT DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "dict_data" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dict_type_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dict_data_dict_type_id_fkey" FOREIGN KEY ("dict_type_id") REFERENCES "dict_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mail_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'mail_test',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "test_id" TEXT,
    "message_id" TEXT,
    "error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" DATETIME,
    "received_at" DATETIME
);

-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" DATETIME NOT NULL,
    "used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_config_key_key" ON "system_configs"("config_key");

-- CreateIndex
CREATE INDEX "operation_logs_category_id_idx" ON "operation_logs"("category", "id");

-- CreateIndex
CREATE INDEX "operation_logs_username_id_idx" ON "operation_logs"("username", "id");

-- CreateIndex
CREATE INDEX "operation_logs_created_at_idx" ON "operation_logs"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_id_idx" ON "notifications"("user_id", "is_read", "id");

-- CreateIndex
CREATE INDEX "notifications_batch_id_id_idx" ON "notifications"("batch_id", "id");

-- CreateIndex
CREATE INDEX "notifications_category_id_idx" ON "notifications"("category", "id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "login_attempts_username_idx" ON "login_attempts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "dict_types_type_code_key" ON "dict_types"("type_code");

-- CreateIndex
CREATE INDEX "dict_data_dict_type_id_idx" ON "dict_data"("dict_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "dict_data_dict_type_id_value_key" ON "dict_data"("dict_type_id", "value");

-- CreateIndex
CREATE INDEX "mail_logs_template_id_idx" ON "mail_logs"("template", "id");

-- CreateIndex
CREATE INDEX "mail_logs_test_id_idx" ON "mail_logs"("test_id");

-- CreateIndex
CREATE INDEX "password_reset_codes_user_id_used_at_idx" ON "password_reset_codes"("user_id", "used_at");

-- CreateIndex
CREATE INDEX "password_reset_codes_email_idx" ON "password_reset_codes"("email");
