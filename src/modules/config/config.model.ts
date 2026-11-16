/**
 * ============================================================
 * 系统配置模块类型定义（modules/config/config.model.ts）
 * ------------------------------------------------------------
 * 返回体统一 camelCase；configValue 为最终生效值，
 * source 表示它来自 DB、env 兜底还是代码默认值。
 * ============================================================
 */

/** 参数来源 */
export type ConfigValueSource = "db" | "env" | "default";

/** 系统配置记录 */
export interface ConfigDto {
  id: number;
  configKey: string;
  configValue: string;
  description: string | null;
  editable: number;
  configScope: "system" | "super";
  configGroup: string;
  readScope: "all" | "super";
  valueType: "string" | "number" | "boolean" | "enum" | "json";
  defaultValue: string | null;
  validation: Record<string, unknown> | null;
  /** 敏感参数：configValue 已掩码，前端提交掩码表示不修改 */
  sensitive: boolean;
  envKey: string | null;
  restartRequired: number;
  sort: number;
  status: number;
  source: ConfigValueSource;
  createdAt: Date;
  updatedAt: Date;
}

/** 批量保存单项 */
export interface UpdateConfigItem {
  key: string;
  value: string;
}

/** 批量保存请求体 */
export interface BatchUpdateConfigBody {
  items: UpdateConfigItem[];
}
