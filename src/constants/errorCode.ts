/**
 * ============================================================
 * 错误码常量（constants/errorCode.ts）
 * ------------------------------------------------------------
 * 后端只返回 code + 英文标识，前端按 code 映射多语言文案
 * 编码规则：
 *   200    - 成功
 *   10xxx  - 通用错误（参数、鉴权、验证码、系统、数据冲突）
 *   20xxx  - 认证 / 用户模块
 *   30xxx  - 字典 / 帮助 / 配置
 *   40xxx  - 菜单 / 角色（RBAC）
 *   60xxx  - 运维中心
 *   70xxx  - 文件上传
 *   90xxx  - 邮件服务
 *   910xx  - 通知中心
 *   920xx  - 日志中心
 * 使用：error 中间件、controller
 * ============================================================
 */

export const ERROR_CODE = {
  // ==================== 成功 ====================
  SUCCESS: 200,

  // ==================== 通用错误 10xxx ====================
  PARAM_ERROR: 10001, // 参数错误
  PARAM_MISSING: 10002, // 缺少必填参数
  PARAM_INVALID: 10003, // 参数格式非法

  // -------------------- 鉴权错误 --------------------
  UNAUTHORIZED: 10101, // 未登录 / 未授权
  TOKEN_EXPIRED: 10102, // Token 已过期
  TOKEN_INVALID: 10103, // Token 无效
  PERMISSION_DENIED: 10104, // 权限不足
  ACCOUNT_LOCKED: 10105, // 账号已锁定
  TOO_MANY_REQUESTS: 10106, // 请求过于频繁

  // -------------------- 验证码错误 --------------------
  CAPTCHA_EXPIRED: 10201, // 验证码已过期
  CAPTCHA_ERROR: 10202, // 验证码错误

  // -------------------- 资源不存在 --------------------
  NOT_FOUND: 10404, // 接口 / 资源不存在

  // -------------------- 系统错误 --------------------
  SYSTEM_ERROR: 10500, // 服务器内部错误
  DATABASE_ERROR: 10501, // 数据库操作异常
  NETWORK_ERROR: 10502, // 网络异常
  DATA_CONFLICT: 10503, // 数据唯一约束冲突（params.field 指明冲突字段）
  UNKNOWN_ERROR: 10999, // 未知错误

  // ==================== 认证 / 用户模块 20xxx ====================
  USER_NOT_EXIST: 20001, // 用户不存在
  USER_ALREADY_EXIST: 20002, // 用户已存在
  USER_PASSWORD_ERROR: 20003, // 密码错误
  USER_DISABLED: 20004, // 账号已被禁用
  PASSWORD_WEAK: 20005, // 密码强度不足
  USER_SELF_OPERATION_FORBIDDEN: 20006, // 禁止操作自己（删除/禁用）
  ADMIN_LAST_PROTECTED: 20007, // 最后一个管理员不可删除/禁用/降级
  SUPER_ADMIN_PROTECTED: 20008, // 超级管理员账号受保护，禁止操作（隐藏账号）
  PASSWORD_RESET_CODE_INVALID: 20009, // 重置密码验证码错误或已过期
  PASSWORD_RESET_TOO_MANY_ATTEMPTS: 20010, // 重置密码验证码尝试次数过多
  PASSWORD_RESET_TOO_FREQUENT: 20018, // 重置密码验证码请求过于频繁（冷却期未结束）
  USER_ROLE_LEVEL_FORBIDDEN: 20011, // 无权操作同级或更高级别的用户/角色
  PASSWORD_RESET_ACCOUNT_NOT_FOUND: 20012, // 用户名与邮箱不匹配
  REGISTER_DISABLED: 20013, // 自助注册开关已关闭（register_enabled=false）
  PASSWORD_SAME_AS_OLD: 20014, // 新密码不能与旧密码相同
  PASSWORD_CHANGE_REQUIRED: 20015, // 首次登录必须先修改密码
  USER_PENDING_APPROVAL: 20016, // 自助注册账号待管理员审核
  USER_NOT_PENDING_APPROVAL: 20017, // 账号不在待审核状态，无法执行审核操作

  // ==================== 数据字典 30xxx ====================
  DICT_TYPE_NOT_FOUND: 30001, // 字典类型不存在
  DICT_TYPE_EXIST: 30002, // 字典类型已存在
  DICT_DATA_NOT_FOUND: 30003, // 字典项不存在
  DICT_VALUE_EXIST: 30020, // 同类型下字典值已存在
  HELP_ARTICLE_NOT_FOUND: 30004, // 帮助文档不存在
  HELP_MODE_NOT_CONFIGURED: 30005, // 帮助模式未配置（system_configs.help_mode）
  CONFIG_NOT_EDITABLE: 30006, // 系统参数不可修改（editable=0 锁定）
  CONFIG_SCOPE_DENIED: 30007, // 参数不属于当前设置域（系统设置/超级设置互斥）
  CONFIG_VALUE_INVALID: 30008, // 参数值不符合类型/范围/格式
  CONFIG_NOT_FOUND: 30009, // 参数键不存在（不允许任意 key upsert）
  HELP_LOCALE_NOT_FOUND: 30010, // 语言目录或 manifest 不存在
  HELP_SLOT_NOT_FOUND: 30011, // 文档位（docKey）不存在
  HELP_DOC_CONFLICT: 30012, // docKey/文件/路径冲突，或 baseHash 与当前文件不一致
  HELP_PATH_INVALID: 30013, // 文件或文章路径非法
  HELP_MANIFEST_INVALID: 30014, // manifest 结构非法
  HELP_INDEX_BUSY: 30015, // 索引重建进行中或索引写入失败
  HELP_FILE_NOT_FOUND: 30016, // 文档物理文件不存在
  HELP_SLOT_HAS_CHILDREN: 30017, // 文档位仍有子节点，不能删除
  HELP_CONFIRM_REQUIRED: 30018, // 删除类操作缺少 confirm=docKey / locale
  HELP_LOCALE_CONFLICT: 30019, // 目标语言目录已存在

  // ==================== 菜单 / 角色（RBAC）40xxx ====================
  MENU_NOT_FOUND: 40001, // 菜单不存在
  MENU_HAS_CHILDREN: 40002, // 存在子菜单，无法删除
  MENU_EXIST: 40006, // 同级菜单名称已存在
  ROLE_NOT_FOUND: 40003, // 角色不存在
  ROLE_CODE_EXIST: 40004, // 角色编码已存在
  ROLE_IN_USE: 40005, // 角色已被用户占用，无法删除
  ROLE_SYSTEM_PROTECTED: 40007, // 内置角色（admin/operator/viewer）禁止删除/停用
  MENU_PERMISSION_EXIST: 40008, // 菜单权限码已存在
  MENU_PATH_EXIST: 40009, // 菜单路径已存在
  MENU_PARENT_DELETED: 40010, // 父级菜单已删除，无法恢复
  MENU_NOT_DELETED: 40011, // 菜单未被删除，无需恢复

  // ==================== 运维中心 60xxx ====================
  SESSION_NOT_FOUND: 60001, // 会话不存在
  SESSION_ALREADY_REVOKED: 60002, // 会话已失效（已吊销）
  TASK_NOT_FOUND: 60003, // 运维任务不存在
  TASK_RUNNING: 60004, // 任务正在执行
  TASK_CONFIRM_REQUIRED: 60005, // 危险任务缺少二次确认
  TASK_EXEC_FAILED: 60006, // 任务执行失败
  BACKUP_FAILED: 60007, // 数据库备份失败
  TASK_DANGER_ONLY: 60008, // 危险任务必须走专用接口

  // ==================== 文件上传 70xxx ====================
  FILE_NOT_EXIST: 70001, // 文件不存在
  FILE_TOO_LARGE: 70002, // 文件大小超出限制
  FILE_TYPE_NOT_ALLOWED: 70003, // 文件类型不允许
  FILE_UPLOAD_FAIL: 70004, // 文件上传失败

  // ==================== 邮件服务 90xxx ====================
  MAIL_NOT_CONFIGURED: 90001, // 邮件服务未配置（缺少 SMTP 账号/授权码）
  MAIL_DISABLED: 90002, // 邮件服务总开关已关闭
  MAIL_AUTH_FAILED: 90003, // SMTP 登录失败（授权码错误或未开通）
  MAIL_CONNECT_FAILED: 90004, // SMTP 连接失败/超时
  MAIL_TIMEOUT: 90005, // 邮件操作超时
  MAIL_SEND_FAILED: 90006, // 邮件发送失败
  MAIL_RECIPIENT_INVALID: 90007, // 收件人邮箱格式非法
  MAIL_NOT_RECEIVED: 90008, // SMTP 已接受但 IMAP 未回读到测试邮件
  MAIL_IMAP_NOT_CONFIGURED: 90009, // IMAP 参数未配置，无法回读确认
  MAIL_IMAP_FAILED: 90010, // IMAP 连接/搜索失败

  // ==================== 通知中心 910xx ====================
  NOTIFICATION_NOT_FOUND: 91001, // 通知或通知批次不存在
  NOTIFICATION_RECIPIENT_EMPTY: 91002, // 通知收件人为空
  NOTIFICATION_AUDIENCE_INVALID: 91003, // 通知受众参数不合法

  // ==================== 日志中心 920xx ====================
  LOG_CLEANUP_CONFIRM_REQUIRED: 92001, // 日志清理缺少二次确认
} as const;

/** 错误码类型 */
export type ErrorCodeType = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/**
 * 全局错误标识映射表
 * 自动把 ERROR_CODE 的 key 映射成字符串 → 数字码
 * 用于 error.middleware 自动识别 throw new Error("XXX") 里的标识
 */
export const GLOBAL_ERROR_MAP: Record<string, number> = Object.fromEntries(Object.entries(ERROR_CODE).map(([key, code]) => [key, code]));

/**
 * 数字码 → 字符串标识 反向映射（自动从 ERROR_CODE 派生）
 * 用于 BaseController.fail() 未传 msg 时自动补全标识，
 * 保证 code 与 msg 永远一一对应，不会写错
 */
const ERROR_CODE_VALUES = Object.values(ERROR_CODE);
if (new Set(ERROR_CODE_VALUES).size !== ERROR_CODE_VALUES.length) {
  throw new Error("ERROR_CODE 存在重复数字码，请先修正 constants/errorCode.ts");
}

export const CODE_TO_MSG: Record<number, string> = Object.fromEntries(Object.entries(ERROR_CODE).map(([key, code]) => [code, key]));

/**
 * 错误码中文说明（与 ERROR_CODE 一一对应）
 * 供 Swagger 文档第 4 节动态生成表格；
 * 新增错误码时：在 ERROR_CODE 加一行 + 在这里补一行中文说明即可
 */
export const ERROR_DESC: Record<string, string> = {
  SUCCESS: "成功",
  PARAM_ERROR: "参数错误",
  PARAM_MISSING: "缺少必填参数",
  PARAM_INVALID: "参数格式非法",
  UNAUTHORIZED: "未登录 / 未授权",
  TOKEN_EXPIRED: "Token 已过期",
  TOKEN_INVALID: "Token 无效",
  PERMISSION_DENIED: "权限不足",
  ACCOUNT_LOCKED: "账号已锁定",
  TOO_MANY_REQUESTS: "请求过于频繁",
  CAPTCHA_EXPIRED: "验证码已过期",
  CAPTCHA_ERROR: "验证码错误",
  NOT_FOUND: "接口 / 资源不存在",
  SYSTEM_ERROR: "服务器内部错误",
  DATABASE_ERROR: "数据库操作异常",
  NETWORK_ERROR: "网络异常",
  DATA_CONFLICT: "数据字段冲突",
  UNKNOWN_ERROR: "未知错误",
  USER_NOT_EXIST: "用户不存在",
  USER_ALREADY_EXIST: "用户已存在",
  USER_PASSWORD_ERROR: "密码错误",
  USER_DISABLED: "账号已被禁用",
  PASSWORD_WEAK: "密码强度不足",
  USER_SELF_OPERATION_FORBIDDEN: "禁止操作自己",
  ADMIN_LAST_PROTECTED: "最后一个管理员不可删除/禁用/降级",
  SUPER_ADMIN_PROTECTED: "超级管理员账号受保护，禁止操作",
  PASSWORD_RESET_CODE_INVALID: "重置密码验证码错误或已过期",
  PASSWORD_RESET_TOO_MANY_ATTEMPTS: "重置密码验证码尝试次数过多",
  PASSWORD_RESET_TOO_FREQUENT: "重置密码验证码请求过于频繁",
  USER_ROLE_LEVEL_FORBIDDEN: "无权操作同级或更高级别的用户/角色",
  PASSWORD_RESET_ACCOUNT_NOT_FOUND: "用户名与邮箱不匹配",
  REGISTER_DISABLED: "自助注册功能已关闭",
  PASSWORD_SAME_AS_OLD: "新密码不能与旧密码相同",
  PASSWORD_CHANGE_REQUIRED: "请先修改初始密码",
  USER_PENDING_APPROVAL: "账号待管理员审核",
  USER_NOT_PENDING_APPROVAL: "账号不在待审核状态",
  DICT_TYPE_NOT_FOUND: "字典类型不存在",
  DICT_TYPE_EXIST: "字典类型已存在",
  DICT_DATA_NOT_FOUND: "字典项不存在",
  DICT_VALUE_EXIST: "同类型下字典值已存在",
  HELP_ARTICLE_NOT_FOUND: "帮助文档不存在",
  HELP_MODE_NOT_CONFIGURED: "帮助模式未配置（system_configs.help_mode）",
  CONFIG_NOT_EDITABLE: "系统参数不可修改",
  CONFIG_SCOPE_DENIED: "参数不属于当前设置域",
  CONFIG_VALUE_INVALID: "参数值不合法",
  CONFIG_NOT_FOUND: "参数键不存在",
  HELP_LOCALE_NOT_FOUND: "语言目录或 manifest 不存在",
  HELP_SLOT_NOT_FOUND: "文档位不存在",
  HELP_DOC_CONFLICT: "文档位/文件/路径冲突，或基线已变化",
  HELP_PATH_INVALID: "文件或文章路径非法",
  HELP_MANIFEST_INVALID: "manifest 结构非法",
  HELP_INDEX_BUSY: "索引重建进行中或索引写入失败",
  HELP_FILE_NOT_FOUND: "文档文件不存在",
  HELP_SLOT_HAS_CHILDREN: "文档位仍有子节点，无法删除",
  HELP_CONFIRM_REQUIRED: "删除操作缺少二次确认",
  HELP_LOCALE_CONFLICT: "目标语言目录已存在",
  NOTIFICATION_NOT_FOUND: "通知或通知批次不存在",
  NOTIFICATION_RECIPIENT_EMPTY: "通知收件人为空",
  NOTIFICATION_AUDIENCE_INVALID: "通知受众参数不合法",
  LOG_CLEANUP_CONFIRM_REQUIRED: "日志清理缺少二次确认",
  MENU_NOT_FOUND: "菜单不存在",
  MENU_HAS_CHILDREN: "存在子菜单，无法删除",
  MENU_EXIST: "同级菜单名称已存在",
  ROLE_NOT_FOUND: "角色不存在",
  ROLE_CODE_EXIST: "角色编码已存在",
  ROLE_IN_USE: "角色已被用户占用，无法删除",
  ROLE_SYSTEM_PROTECTED: "内置角色禁止删除/停用",
  MENU_PERMISSION_EXIST: "菜单权限码已存在",
  MENU_PATH_EXIST: "菜单路径已存在",
  MENU_PARENT_DELETED: "父级菜单已删除，无法恢复",
  MENU_NOT_DELETED: "菜单未被删除，无需恢复",
  SESSION_NOT_FOUND: "会话不存在",
  SESSION_ALREADY_REVOKED: "会话已失效",
  TASK_NOT_FOUND: "运维任务不存在",
  TASK_RUNNING: "任务正在执行",
  TASK_CONFIRM_REQUIRED: "危险任务缺少二次确认",
  TASK_EXEC_FAILED: "任务执行失败",
  BACKUP_FAILED: "数据库备份失败",
  TASK_DANGER_ONLY: "危险任务必须走专用接口",
  FILE_NOT_EXIST: "文件不存在",
  FILE_TOO_LARGE: "文件大小超出限制",
  FILE_TYPE_NOT_ALLOWED: "文件类型不允许",
  FILE_UPLOAD_FAIL: "文件上传失败",
  MAIL_NOT_CONFIGURED: "邮件服务未配置",
  MAIL_DISABLED: "邮件服务已关闭",
  MAIL_AUTH_FAILED: "SMTP 登录失败，请检查授权码",
  MAIL_CONNECT_FAILED: "SMTP 连接失败，请检查服务器与端口",
  MAIL_TIMEOUT: "邮件操作超时",
  MAIL_SEND_FAILED: "邮件发送失败",
  MAIL_RECIPIENT_INVALID: "收件人邮箱格式非法",
  MAIL_NOT_RECEIVED: "SMTP 已接受，但 IMAP 未回读到测试邮件",
  MAIL_IMAP_NOT_CONFIGURED: "IMAP 未配置，无法确认收到",
  MAIL_IMAP_FAILED: "IMAP 连接或搜索失败",
};
