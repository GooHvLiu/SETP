/**
 * ============================================================
 * 字典模块类型定义（modules/dict/dict.model.ts）
 * ============================================================
 */

/** 字典项（下拉框选项） */
export interface DictItemDto {
  label: string; // 显示文案，如 已发货
  value: string; // 存储值，如 2
}

/** 字典分组（getAll 返回：类型 + 其下字典项） */
export interface DictGroupDto {
  typeCode: string; // 如 order_status
  typeName: string; // 如 订单状态
  items: DictItemDto[];
}

/** 字典类型记录（维护接口返回，不含字典项） */
export interface DictTypeRecordDto {
  id: number;
  typeCode: string;
  typeName: string;
  status: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 字典项记录（维护接口返回） */
export interface DictDataRecordDto {
  id: number;
  dictTypeId: number;
  label: string;
  value: string;
  sort: number;
  status: number;
  createdAt: Date;
}

/** 管理端字典类型列表行（含停用项，附字典项数量） */
export interface DictTypeListRow {
  id: number;
  typeCode: string;
  typeName: string;
  status: number;
  remark: string | null;
  dataCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 管理端字典类型列表结果（分页） */
export interface DictTypeListResult {
  list: DictTypeListRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** 管理端字典项列表结果（分页） */
export interface DictDataListResult {
  list: DictDataRecordDto[];
  total: number;
  page: number;
  pageSize: number;
}
