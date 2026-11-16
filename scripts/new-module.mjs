/**
 * 模块脚手架（无依赖、幂等）
 * 用法：node scripts/new-module.mjs demo
 * 生成：src/modules/demo/{demo.controller.ts,demo.service.ts,demo.model.ts,demo.schema.ts}
 * 约定：controller 使用 TSOA 装饰器，service 只依赖 Prisma，schema 使用 Joi。
 */
import fs from "node:fs";
import path from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9]*$/.test(name)) {
  console.error("用法：node scripts/new-module.mjs <camelCaseName>（仅小写字母与数字，不能带连字符）");
  process.exit(1);
}

const dir = path.resolve(process.cwd(), "src/modules", name);
const pascal = name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

const files = {
  [`src/modules/${name}/${name}.model.ts`]: `/**
 * ${pascal} 模块 DTO。
 * TSOA 会把这些类型写入 OpenAPI；不要把 Prisma 实体直接暴露给前端。
 */
export interface ${pascal}Item {
  id: string;
  name: string;
}

export interface ${pascal}ListResult {
  list: ${pascal}Item[];
  total: number;
}
`,
  [`src/modules/${name}/${name}.schema.ts`]: `import Joi from "joi";

export const ${name}ListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});
`,
  [`src/modules/${name}/${name}.service.ts`]: `import type { PrismaClient } from "@prisma/client";

/**
 * ${pascal} 业务服务。
 * 只在这里访问数据层；controller 不直接碰 Prisma。
 * 接入真实查询时把 db 参数替换为共享 prisma 实例。
 */
export class ${pascal}Service {
  async list(page = 1, pageSize = 20, db?: PrismaClient) {
    // TODO: 按实际模型实现分页查询
    void db;
    return { list: [], total: 0, page, pageSize };
  }
}

export const ${name}Service = new ${pascal}Service();
`,
  [`src/modules/${name}/${name}.controller.ts`]: `import { Get, Query, Route, Security, Tags } from "tsoa";

import { BaseController } from "@src/base/BaseController";
import { MESSAGE_CODE } from "@src/constants/messageCode";
import type { ApiResponse } from "@src/types";
import { ${name}Service } from "./${name}.service";
import type { ${pascal}ListResult } from "./${name}.model";

@Route("api/v1/${name}")
@Tags("${pascal}")
export class ${pascal}Controller extends BaseController {
  /**
   * 分页查询 ${name}
   * @summary 分页查询
   */
  @Get("list")
  @Security("bearerAuth")
  public async list(@Query() page = 1, @Query() pageSize = 20): Promise<ApiResponse<${pascal}ListResult>> {
    const data = await ${name}Service.list(page, pageSize);
    return this.ok(data, MESSAGE_CODE.SUCCESS);
  }
}
`,
};

/** 生成的模块自带一条 service 单测，避免新模块成为覆盖率空洞 */
files[`test/unit/${name}.test.ts`] = `import { describe, expect, it } from "vitest";

import { ${name}Service } from "../../src/modules/${name}/${name}.service";

describe("${pascal} 服务骨架", () => {
  it("list 返回分页空列表", async () => {
    const result = await ${name}Service.list(2, 10);
    expect(result).toEqual({ list: [], total: 0, page: 2, pageSize: 10 });
  });
});
`;

if (fs.existsSync(dir)) {
  console.error(`[new-module] 目录已存在：${dir}`);
  process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });
for (const [file, content] of Object.entries(files)) {
  const target = path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

console.log(`[new-module] 已生成 src/modules/${name}/ 与 test/unit/${name}.test.ts`);
console.log("[new-module] 下一步：1) 补 Prisma model 2) 执行 npm run db:sync-schema 3) 补真实 service 查询 4) npm run tsoa");
