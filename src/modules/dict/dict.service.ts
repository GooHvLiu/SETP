/**
 * ============================================================
 * 数据字典业务逻辑（modules/dict/dict.service.ts）
 * ------------------------------------------------------------
 * 职责：
 *   1. 按 typeCode 查询字典项列表（带内存缓存）
 *   2. 字典类型与字典项的维护（增删改查）
 *
 * 缓存策略：
 *   - 内存 Map<typeCode, { data, expire }>，过期时间读 dict_cache_ttl_minutes
 *   - 字典变更（新增/修改/删除）时主动失效对应类型缓存
 *   - 生产多实例可换 Redis（结构不变）
 * ============================================================
 */

import { prisma } from "@src/db/prisma";
import { getConfigNumber } from "@src/config/runtimeConfig";
import { ERROR_CODE } from "@src/constants/errorCode";
import { BusinessError } from "@src/errors/BusinessError";

/** 缓存项 */
interface CacheItem {
  data: any[];
  expire: number;
}

/** 字典缓存：typeCode -> 字典项列表 */
const dictCache = new Map<string, CacheItem>();

class DictService {
  /**
   * 按类型编码查询字典项（带缓存）
   * @param typeCode 字典类型编码，如 order_status
   */
  async getDictByType(typeCode: string) {
    // 命中缓存且未过期则直接返回
    const cached = dictCache.get(typeCode);
    if (cached && cached.expire > Date.now()) {
      return cached.data;
    }

    // 查库：类型 + 启用的字典项（按 sort 排序）
    const dictType = await prisma.dictType.findUnique({
      where: { typeCode },
      include: {
        data: {
          where: { status: 1 },
          orderBy: { sort: "asc" },
        },
      },
    });

    if (!dictType) {
      throw new Error("DICT_TYPE_NOT_FOUND");
    }

    // 组装返回结构（去掉内部字段）
    const data = dictType.data.map((d) => ({
      label: d.label,
      value: d.value,
    }));

    // 写入缓存（TTL 页面可配，按分钟换算）
    dictCache.set(typeCode, {
      data,
      expire: Date.now() + getConfigNumber("dict_cache_ttl_minutes") * 60 * 1000,
    });
    return data;
  }

  /**
   * 获取全部字典（前端启动时一次性拉取）
   */
  async getAllDict() {
    const types = await prisma.dictType.findMany({
      where: { status: 1 },
      include: {
        data: {
          where: { status: 1 },
          orderBy: { sort: "asc" },
        },
      },
    });

    return types.map((t) => ({
      typeCode: t.typeCode,
      typeName: t.typeName,
      items: t.data.map((d) => ({ label: d.label, value: d.value })),
    }));
  }

  /**
   * 管理端字典类型列表（分页 + 关键字 + 状态过滤，含停用项）
   * @param keyword 模糊匹配 typeCode / typeName
   * @param status 不传则返回全部状态
   */
  async getAdminTypes(params: { page?: number; pageSize?: number; keyword?: string; status?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 10), 100);
    const offset = (page - 1) * pageSize;

    // 组装查询条件（关键字模糊匹配类型编码/名称 + 状态过滤）
    const where: any = {};
    if (params.keyword) {
      where.OR = [{ typeCode: { contains: params.keyword } }, { typeName: { contains: params.keyword } }];
    }
    if (params.status !== undefined) {
      where.status = params.status;
    }

    // 总数 + 列表（并行查询，附字典项数量）
    const [total, rows] = await Promise.all([
      prisma.dictType.count({ where }),
      prisma.dictType.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: pageSize,
        include: { _count: { select: { data: true } } },
      }),
    ]);

    // 组装返回结构（含停用项，附 dataCount）
    const list = rows.map((t) => ({
      id: t.id,
      typeCode: t.typeCode,
      typeName: t.typeName,
      status: t.status,
      remark: t.remark,
      dataCount: t._count.data,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 管理端字典项列表（分页 + 关键字 + 状态过滤，含停用项）
   * @param typeId 字典类型 id（必填）
   * @param keyword 模糊匹配 label / value
   * @param status 不传则返回全部状态
   */
  async getAdminData(params: { typeId: number; page?: number; pageSize?: number; keyword?: string; status?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 10), 100);
    const offset = (page - 1) * pageSize;

    // 组装查询条件（字典类型 + 关键字模糊匹配标签/值 + 状态过滤）
    const where: any = { dictTypeId: params.typeId };
    if (params.keyword) {
      where.OR = [{ label: { contains: params.keyword } }, { value: { contains: params.keyword } }];
    }
    if (params.status !== undefined) {
      where.status = params.status;
    }

    // 总数 + 列表（并行查询）
    const [total, rows] = await Promise.all([
      prisma.dictData.count({ where }),
      prisma.dictData.findMany({
        where,
        orderBy: [{ sort: "asc" }, { id: "asc" }],
        skip: offset,
        take: pageSize,
      }),
    ]);

    return { list: rows, total, page, pageSize };
  }

  /**
   * 新增字典类型
   */
  async createType(data: { typeCode: string; typeName: string; remark?: string }) {
    const exist = await prisma.dictType.findUnique({ where: { typeCode: data.typeCode } });
    if (exist) {
      throw new Error("DICT_TYPE_EXIST");
    }

    return prisma.dictType.create({
      data: {
        typeCode: data.typeCode,
        typeName: data.typeName,
        remark: data.remark || "",
      },
    });
  }

  /**
   * 更新字典类型（更新后失效缓存）
   */
  async updateType(id: number, data: { typeName?: string; remark?: string; status?: number }) {
    const updated = await prisma.dictType.update({
      where: { id },
      data,
    });
    dictCache.delete(updated.typeCode);
    return updated;
  }

  /**
   * 删除字典类型（级联删除字典项，更新后失效缓存）
   */
  async deleteType(id: number) {
    const type = await prisma.dictType.findUnique({ where: { id } });
    if (!type) {
      throw new Error("DICT_TYPE_NOT_FOUND");
    }
    await prisma.dictType.delete({ where: { id } }); // onDelete: Cascade 级联删字典项
    dictCache.delete(type.typeCode);
  }

  /**
   * 新增字典项
   */
  async createData(data: { dictTypeId: number; label: string; value: string; sort?: number }) {
    const type = await prisma.dictType.findUnique({ where: { id: data.dictTypeId } });
    if (!type) {
      throw new BusinessError(ERROR_CODE.DICT_TYPE_NOT_FOUND, "DICT_TYPE_NOT_FOUND", { field: "dictTypeId" });
    }
    const exist = await prisma.dictData.findFirst({
      where: { dictTypeId: data.dictTypeId, value: data.value },
    });
    if (exist) {
      throw new BusinessError(ERROR_CODE.DICT_VALUE_EXIST, "DICT_VALUE_EXIST", { field: "value" });
    }

    const created = await prisma.dictData.create({
      data: {
        dictTypeId: data.dictTypeId,
        label: data.label,
        value: data.value,
        sort: data.sort || 0,
      },
    });

    // 失效所属类型缓存
    dictCache.delete(type.typeCode);
    return created;
  }

  /**
   * 更新字典项（更新后失效缓存）
   */
  async updateData(id: number, data: { label?: string; value?: string; sort?: number; status?: number }) {
    const item = await prisma.dictData.findUnique({ where: { id } });
    if (!item) {
      throw new Error("DICT_DATA_NOT_FOUND");
    }
    if (data.value !== undefined) {
      const exist = await prisma.dictData.findFirst({
        where: { dictTypeId: item.dictTypeId, value: data.value, id: { not: id } },
      });
      if (exist) {
        throw new BusinessError(ERROR_CODE.DICT_VALUE_EXIST, "DICT_VALUE_EXIST", { field: "value" });
      }
    }

    const updated = await prisma.dictData.update({ where: { id }, data });

    const type = await prisma.dictType.findUnique({ where: { id: item.dictTypeId } });
    if (type) dictCache.delete(type.typeCode);
    return updated;
  }

  /**
   * 删除字典项（更新后失效缓存）
   */
  async deleteData(id: number) {
    const item = await prisma.dictData.findUnique({ where: { id } });
    if (!item) {
      throw new Error("DICT_DATA_NOT_FOUND");
    }
    await prisma.dictData.delete({ where: { id } });

    const type = await prisma.dictType.findUnique({ where: { id: item.dictTypeId } });
    if (type) dictCache.delete(type.typeCode);
  }
}

export default new DictService();
