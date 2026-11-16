/**
 * ============================================================
 * 全量 API 冒烟测试（api-full-test.cjs）
 * ------------------------------------------------------------
 * 覆盖 prisma-tsoa 模板全部 22 个接口路径：
 *   auth / captcha / user / upload / operate-log /
 *   notification / dict / config
 *
 * 运行前提：
 *   1. 服务已启动（npm run dev）
 *   2. 数据库已 seed（npm run db:seed，默认 admin/123456）
 *
 * 说明：
 *   - 登录接口需要图形验证码（无法自动化识别），
 *     故用 JWT 直接签发 admin access token 测试鉴权接口
 *   - 登录接口本身测试"参数校验错误"与"验证码错误"两条分支
 *   - RBAC 权限拦截也纳入断言（admin 全量含隐藏权限点；operator/viewer 仅业务菜单，管理接口被拒）
 *   - 测试创建的 user / dict / notification 数据自动清理
 *
 * 用法：在项目根目录 运行  node .\test\api-full-test.cjs
 * ============================================================
 */

require("dotenv").config();

const BASE = `http://localhost:${process.env.APP_PORT || 3000}/api/v1`;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

// ---------- 工具 ----------
let passed = 0;
let failed = 0;
const failures = [];

/** 发起请求；formData 传 FormData 对象时自动 multipart */
async function req(method, path, { token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { http: res.status, ...json };
}

/**
 * 执行一个测试用例
 * @param {string} name 用例名
 * @param {() => Promise<{code:number,msg?:string,data?:any}>} fn 请求函数
 * @param {number|number[]} expectCode 预期业务码（单个或数组，命中其一即过）
 * @param {string} [desc] 附加说明（如 RBAC 拦截）
 */
async function test(name, fn, expectCode, desc = "") {
  try {
    const r = await fn();
    const expects = Array.isArray(expectCode) ? expectCode : [expectCode];
    if (expects.includes(r.code)) {
      passed++;
      console.log(`  ✅ PASS  ${name}${desc ? `（${desc}）` : ""} → code=${r.code} msg=${r.msg}`);
    } else {
      failed++;
      failures.push(name);
      console.log(`  ❌ FAIL  ${name}${desc ? `（${desc}）` : ""} → 预期 ${expects.join("/")}，实际 code=${r.code} msg=${r.msg}`);
      if (r.data) console.log(`          data=${JSON.stringify(r.data).slice(0, 200)}`);
    }
  } catch (e) {
    failed++;
    failures.push(name);
    console.log(`  ❌ FAIL  ${name} → 请求异常: ${e.message}`);
  }
}

// ---------- 真实登录（拿到带 sid / v 的 access token，避免直签令牌被会话校验拦截） ----------
async function loginAs(username, password) {
  const cap = await req("GET", "/captcha");
  const r = await req("POST", "/auth/login", {
    body: { username, password, captchaId: cap.data?.captchaId, captchaCode: cap.data?.devCode },
  });
  if (r.code !== 200 || !r.data?.token) {
    throw new Error(`登录失败：${username} code=${r.code} msg=${r.msg}`);
  }
  return r.data.token;
}

// ---------- 唯一后缀 ----------
const TS = Date.now().toString().slice(-8);
let T = "";
let S = "";
let opToken = "";
let vwToken = "";
// 生产环境标记：NODE_ENV=production 时 Swagger 关闭、captcha 不返回 devCode，
// 登录闭环无法自动化 → 组 13 改为直签鉴权，另跑组 15 生产专属断言
const IS_PROD = process.env.NODE_ENV === "production";

// ---------- 分组执行 ----------
async function main() {
  console.log(`\n========== 全量 API 冒烟测试 ==========`);
  console.log(`Base: ${BASE}`);
  console.log(`Token: admin（JWT 签发，userId=1）\n`);

  // ================= 0. 健康检查 =================
  console.log("── 0. 健康检查 ──");
  await test("GET / 健康检查", async () => {
    const r = await fetch(`http://localhost:${process.env.APP_PORT || 3000}/`, { method: "GET" });
    return r.json();
  }, 200);

  // ================= 1. 验证码（公开） =================
  console.log("\n── 1. 验证码（公开） ──");
  let captchaId = "";
  await test("GET /api/v1/captcha 生成验证码", async () => {
    const r = await req("GET", "/captcha");
    captchaId = r.data?.captchaId || "";
    return r;
  }, 200);

  // ================= 2. 登录（公开，验证码无法自动识别） =================
  console.log("\n── 2. 登录接口（公开） ──");
  await test("POST /auth/login 缺字段 → 参数校验错误", async () => {
    return req("POST", "/auth/login", { body: { username: ADMIN_USERNAME } });
  }, 10003, "TSOA 层 PARAM_INVALID");
  await test("POST /auth/login 验证码错误", async () => {
    return req("POST", "/auth/login", {
      body: { username: ADMIN_USERNAME, password: "123456", captchaId, captchaCode: "0000" },
    });
  }, [10201, 10202], "验证码校验拦截");
  await test("POST /auth/login 用户不存在", async () => {
    // 用正确格式验证码 + 不存在的用户，验证业务链路（验证码校验失败则停在 102xx）
    return req("POST", "/auth/login", {
      body: { username: "no_such_user_xx", password: "123456", captchaId, captchaCode: "0000" },
    });
  }, [10201, 10202, 20001], "验证码或用户链路");

  // ================= 3. 注册（公开） =================
  console.log("\n── 3. 注册（公开） ──");
  const regUsername = `tester_${TS}`;
  await test("POST /auth/register 注册新用户", async () => {
    return req("POST", "/auth/register", {
      body: { username: regUsername, password: "Test@123456", email: `${regUsername}@test.com`, realName: "测试用户" },
    });
  }, [200, 20013], "注册成功或模板默认关闭注册");
  await test("POST /auth/register 重复注册 → 用户已存在", async () => {
    return req("POST", "/auth/register", {
      body: { username: regUsername, password: "Test@123456", email: `${regUsername}@test.com` },
    });
  }, [20002, 20013], "USER_ALREADY_EXIST 或注册关闭");
  await test("POST /auth/register 弱密码 → 拒绝", async () => {
    return req("POST", "/auth/register", {
      body: { username: `weak_${TS}`, password: "123456", email: `weak_${TS}@test.com` },
    });
  }, [10003, 20005, 20013], "Joi、强度校验或注册关闭");

  // ================= 4. 鉴权拦截（无 token / 假 token） =================
  T = await loginAs(ADMIN_USERNAME, ADMIN_PASSWORD);
  console.log("\n── 4. 鉴权拦截 ──");
  await test("GET /user/list 无 token → 未登录", async () => {
    return req("GET", "/user/list");
  }, 10101, "UNAUTHORIZED");
  await test("GET /user/list 假 token → 无效", async () => {
    return req("GET", "/user/list", { token: "fake.token.here" });
  }, 10103, "TOKEN_INVALID");
  await test("POST /auth/profile 无 token → 未登录", async () => {
    return req("POST", "/auth/profile");
  }, 10101, "UNAUTHORIZED");

  // ================= 5. auth（需登录） =================
  console.log("\n── 5. Auth（需登录） ──");
  await test("POST /auth/profile 获取当前用户+权限", async () => {
    return req("POST", "/auth/profile", { token: T });
  }, 200);
  await test("POST /auth/refresh 无效 refreshToken → 拒绝", async () => {
    return req("POST", "/auth/refresh", { body: { refreshToken: "invalid_token_for_test" } });
  }, [10103, 10500], "TOKEN_INVALID");
  await test("POST /auth/logout 登出", async () => {
    return req("POST", "/auth/logout", { token: T });
  }, 200);
  // 登出会吊销该用户全部会话，后续用例重新登录拿新令牌
  T = await loginAs(ADMIN_USERNAME, ADMIN_PASSWORD);

  // ================= 6. 用户模块 =================
  console.log("\n── 6. 用户模块 ──");
  const newUser = `user_${TS}`;
  let userId = 0;
  await test("POST /user 创建用户", async () => {
    const r = await req("POST", "/user", {
      token: T,
      body: { username: newUser, password: "Test@123456", realName: "新增用户", email: `${newUser}@test.com` },
    });
    userId = r.data?.id || 0;
    return r;
  }, 200);
  await test("POST /user 用户名重复 → 已存在", async () => {
    return req("POST", "/user", { token: T, body: { username: newUser, password: "Test@123456", email: `${newUser}@test.com` } });
  }, 20002, "USER_ALREADY_EXIST");
  await test("GET /user/list 列表（按新用户过滤）", async () => {
    return req("GET", `/user/list?username=${newUser}`, { token: T });
  }, 200);
  await test("GET /user/{id} 详情", async () => {
    return req("GET", `/user/${userId || 1}`, { token: T });
  }, 200);
  await test("PUT /user/{id} 更新", async () => {
    return req("PUT", `/user/${userId || 1}`, { token: T, body: { realName: "更新后的姓名" } });
  }, 200);
  await test("GET /user/{id} 不存在 → 用户不存在", async () => {
    return req("GET", "/user/999999", { token: T });
  }, 20001, "USER_NOT_EXIST");
  await test("DELETE /user/{id} 删除（清理测试数据）", async () => {
    return req("DELETE", `/user/${userId || 1}`, { token: T });
  }, 200);

  // ================= 7. 文件上传 =================
  console.log("\n── 7. 文件上传 ──");
  await test("POST /upload/file 上传 png 文件", async () => {
    const fd = new FormData();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3Q6wAAAABJRU5ErkJggg==",
      "base64",
    );
    fd.append("file", new Blob([png], { type: "image/png" }), "test.png");
    return req("POST", "/upload/file", { token: T, formData: fd });
  }, 200);
  await test("POST /upload/file 类型拒收 text/plain", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["hello prisma-tsoa"], { type: "text/plain" }), "test.txt");
    return req("POST", "/upload/file", { token: T, formData: fd });
  }, 70003, "FILE_TYPE_NOT_ALLOWED");
  await test("POST /upload/file 大小超限（11MB > 10MB）", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(11 * 1024 * 1024)], { type: "image/png" }), "big.png");
    return req("POST", "/upload/file", { token: T, formData: fd });
  }, 70002, "FILE_TOO_LARGE");

  // ================= 8. 操作日志 =================
  console.log("\n── 8. 操作日志（RBAC 拦截验证） ──");
  await test("GET /operate-log/list admin 有 adminCenter:log:list 可访问", async () => {
    return req("GET", "/operate-log/list", { token: T });
  }, 200, "admin 全量权限（含隐藏权限点）");

  // ================= 9. 通知模块 =================
  console.log("\n── 9. 通知模块 ──");
  let notiId = 0;
  await test("POST /notification/admin/send 创建通知", async () => {
    const r = await req("POST", "/notification/admin/send", {
      token: T,
      body: {
        title: "测试通知",
        content: "全量测试自动创建",
        category: "system",
        type: "info",
        audience: { type: "user", userIds: [1] },
        sendEmail: false,
      },
    });
    notiId = r.data?.list?.[0]?.id || r.data?.id || 0;
    return r;
  }, 200);
  await test("GET /notification/list 列表", async () => {
    const r = await req("GET", "/notification/list", { token: T });
    if (!notiId) notiId = r.data?.list?.[0]?.id || 0;
    return r;
  }, 200);
  await test("GET /notification/unread-count 未读数", async () => {
    return req("GET", "/notification/unread-count", { token: T });
  }, 200);
  await test("POST /notification/read/{id} 标记已读", async () => {
    return req("POST", `/notification/read/${notiId || 1}`, { token: T });
  }, 200);
  await test("POST /notification/read-all 全部已读", async () => {
    return req("POST", "/notification/read-all", { token: T });
  }, 200);

  // ================= 10. 数据字典 =================
  console.log("\n── 10. 数据字典 ──");
  // 字典管理端为 superAdmin 专属（superAdmin:dictCenter / superAdmin:dict），用超管令牌验证
  S = await loginAs("superAdmin", "superAdmin123456@");
  const typeCode = `t_${TS}`;
  let dictTypeId = 0;
  let dictDataId = 0;
  await test("GET /dict/all 全部字典（公开）", async () => {
    return req("GET", "/dict/all");
  }, 200);
  await test("POST /dict/type 创建字典类型", async () => {
    const r = await req("POST", "/dict/type", {
      token: S,
      body: { typeCode, typeName: "测试字典", remark: "全量测试" },
    });
    dictTypeId = r.data?.id || 0;
    return r;
  }, 200);
  await test("GET /dict/type/{typeCode} 按类型查（公开）", async () => {
    return req("GET", `/dict/type/${typeCode}`);
  }, 200);
  await test("GET /dict/admin/types 管理端类型列表（含停用）", async () => {
    return req("GET", "/dict/admin/types?page=1&pageSize=10", { token: S });
  }, 200);
  await test("POST /dict/data 创建字典项", async () => {
    const r = await req("POST", "/dict/data", {
      token: S,
      body: { dictTypeId, label: "选项一", value: "opt1", sort: 1 },
    });
    dictDataId = r.data?.id || 0;
    return r;
  }, 200);
  await test("PUT /dict/type/{id} 更新类型", async () => {
    return req("PUT", `/dict/type/${dictTypeId || 1}`, { token: S, body: { typeName: "测试字典-改" } });
  }, 200);
  await test("PUT /dict/data/{id} 更新字典项", async () => {
    return req("PUT", `/dict/data/${dictDataId || 1}`, { token: S, body: { label: "选项一-改" } });
  }, 200);
  await test("GET /dict/admin/data 管理端字典项列表（含停用）", async () => {
    return req("GET", `/dict/admin/data?typeId=${dictTypeId || 1}&page=1&pageSize=10`, { token: S });
  }, 200);
  await test("DELETE /dict/data/{id} 删除字典项（清理）", async () => {
    return req("DELETE", `/dict/data/${dictDataId || 1}`, { token: S });
  }, 200);
  await test("DELETE /dict/type/{id} 删除字典类型（清理）", async () => {
    return req("DELETE", `/dict/type/${dictTypeId || 1}`, { token: S });
  }, 200);

  // ================= 12. 系统配置（RBAC 拦截验证） =================
  console.log("\n── 12. 系统配置（RBAC 拦截验证） ──");
  await test("GET /config/all admin 有 systemSettings:config:list 可访问", async () => {
    return req("GET", "/config/all", { token: T });
  }, 200, "admin 全量权限（含隐藏权限点）");

  // ================= 13. 真实登录闭环 + refresh 成功 =================
  // dev 环境验证码接口返回明文答案（devCode），可走完整 captcha→login 链路
  if (!IS_PROD) {
    console.log("\n── 13. 登录闭环（验证码→登录→刷新） ──");
    let loginRefreshToken = "";
    await test("POST /auth/login 完整链路（正确验证码+密码）", async () => {
      const cap = await req("GET", "/captcha");
      const r = await req("POST", "/auth/login", {
        body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD, captchaId: cap.data?.captchaId, captchaCode: cap.data?.devCode },
      });
      loginRefreshToken = r.data?.refreshToken || "";
      // 登录会吊销同一用户的旧会话，后续用例改用本次登录的 access token
      T = r.data?.token || T;
      return r;
    }, 200, "CAPTCHA→LOGIN→双令牌");
    let refreshedAccessToken = "";
    await test("POST /auth/refresh 真实 refreshToken 续期", async () => {
      const r = await req("POST", "/auth/refresh", { body: { refreshToken: loginRefreshToken } });
      refreshedAccessToken = r.data?.token || "";
      return r;
    }, 200, "刷新成功返回新 access token");
    await test("POST /auth/profile 用刷新后的新 token 获取用户", async () => {
      return req("POST", "/auth/profile", { token: refreshedAccessToken });
    }, 200, "新 token 可用");
    // 刷新会轮换 refresh token 并吊销旧 access token，后续用例统一使用新令牌
    T = refreshedAccessToken || T;
  } else {
    // 生产环境：captcha 不返回 devCode → 登录闭环无法自动化，改为验证直签鉴权链路可用
    console.log("\n── 13. 生产环境：登录闭环跳过（见组 15），直签鉴权冒烟 ──");
    await test("POST /auth/profile 生产环境 JWT 直签鉴权可用", async () => {
      return req("POST", "/auth/profile", { token: T });
    }, 200, "access token 在生产环境校验通过");
  }

  // ================= 14. 多角色 RBAC 差异 =================
  // operator/viewer 由 admin 创建并绑定角色，验证不同权限集合下的行为差异
  console.log("\n── 14. 多角色 RBAC（operator/viewer） ──");
  const opUser = `op_${TS}`;
  const vwUser = `viewer_${TS}`;
  let opId = 0;
  let vwId = 0;
  await test("POST /user 创建 operator 角色用户", async () => {
    const r = await req("POST", "/user", {
      token: T,
      body: { username: opUser, password: "Test@123456", realName: "操作员", email: `${opUser}@test.com`, roleCodes: ["operator"] },
    });
    opId = r.data?.id || 0;
    return r;
  }, 200);
  await test("POST /user 创建 viewer 角色用户", async () => {
    const r = await req("POST", "/user", {
      token: T,
      body: { username: vwUser, password: "Test@123456", realName: "只读", email: `${vwUser}@test.com`, roleCodes: ["viewer"] },
    });
    vwId = r.data?.id || 0;
    return r;
  }, 200);
  if (opId > 0) {
    opToken = await loginAs(opUser, "Test@123456");
    await req("POST", "/auth/password/change", {
      token: opToken,
      body: { oldPassword: "Test@123456", newPassword: "Test@654321" },
    });
    opToken = await loginAs(opUser, "Test@654321");
  }
  if (vwId > 0) {
    vwToken = await loginAs(vwUser, "Test@123456");
    await req("POST", "/auth/password/change", {
      token: vwToken,
      body: { oldPassword: "Test@123456", newPassword: "Test@654321" },
    });
    vwToken = await loginAs(vwUser, "Test@654321");
  }
  await test("GET /user/list operator 无 adminCenter:user:list 被拒", async () => {
    return req("GET", "/user/list", { token: opToken });
  }, 10104, "operator 仅业务菜单，管理接口被拒");
  await test("POST /user viewer 无 adminCenter:user:create 被拒", async () => {
    return req("POST", "/user", {
      token: vwToken,
      body: { username: `vw_try_${TS}`, password: "Test@123456", email: `vw_try_${TS}@test.com` },
    });
  }, 10104, "viewer 仅业务菜单，管理接口被拒");
  await test("PUT /dict/type/1 viewer 无 superAdmin:dict:update 被拒", async () => {
    return req("PUT", "/dict/type/1", { token: vwToken, body: { typeName: "越权尝试" } });
  }, 10104, "viewer 仅业务菜单，管理接口被拒");
  await test("DELETE /user/{id} 清理 operator/viewer 测试用户", async () => {
    // 仅删除创建成功的用户（id>0），避免回退值误删真实数据
    const ids = [opId, vwId].filter((x) => x > 0);
    if (ids.length === 0) return { code: 200 };
    const results = await Promise.all(ids.map((id) => req("DELETE", `/user/${id}`, { token: T })));
    return { code: results.every((r) => r.code === 200) ? 200 : 10500 };
  }, 200, "数据清理");

  // ================= 15. 生产环境专属断言（仅 NODE_ENV=production） =================
  if (IS_PROD) {
    console.log("\n── 15. 生产环境专属（Swagger / devCode / 堆栈） ──");
    await test("GET /api-docs 生产环境返回 404", async () => {
      const r = await fetch(`http://localhost:${process.env.APP_PORT || 3000}/api-docs`, { method: "GET" });
      const json = await r.json().catch(() => ({}));
      return { code: json.code ?? (r.status === 404 ? 10404 : 10500) };
    }, 10404, "Swagger 仅开发环境挂载");
    await test("GET /captcha 生产环境不返回 devCode", async () => {
      const r = await req("GET", "/captcha");
      return { code: r.code === 200 && r.data && r.data.devCode === undefined ? 200 : (r.code || 10500) };
    }, 200, "明文验证码仅限 dev 环境");
    await test("错误响应不携带堆栈", async () => {
      const r = await req("GET", "/user/999999", { token: T });
      const leakFree = r.code === 10002 && !("stack" in r) && !("stackTrace" in r);
      return { code: leakFree ? 200 : 10500 };
    }, 200, "生产环境不泄露调用栈");
  }

  // ================= 16. 帮助中心（登录即可，无权限码） =================
  console.log("\n── 16. 帮助中心（登录即可，无权限码） ──");
  await test("GET /help/mode 当前模式（默认 static）", async () => {
    return req("GET", "/help/mode", { token: T });
  }, 200, "模式由 system_configs.help_mode 控制");
  await test("GET /help/tree 文档树（登录即可）", async () => {
    return req("GET", "/help/tree?locale=zh-CN", { token: T });
  }, 200, "未投喂文档时返回空树不报错");
  await test("GET /help/article 文章不存在 → HELP_ARTICLE_NOT_FOUND", async () => {
    return req("GET", "/help/article?locale=zh-CN&path=no_such_doc", { token: T });
  }, 30004, "30004 帮助文档不存在");
  await test("POST /help/admin/reindex 重建索引（superAdmin 专属）", async () => {
    return req("POST", "/help/admin/reindex", { token: S });
  }, 200, "幂等重建：无文档时 count=0 不报错");
  await test("GET /help/ai-health AI 服务健康状态（登录即可）", async () => {
    return req("GET", "/help/ai-health", { token: T });
  }, 200, "Ollama 连通性 + modelExists 布尔值");
  await test("POST /help/chat 缺 question → 参数错误", async () => {
    return req("POST", "/help/chat", { token: T, body: {} });
  }, 10003, "Joi 必填校验");
  await test("POST /help/chat 检索未命中（strict 策略直接不答）", async () => {
    return req("POST", "/help/chat", { token: T, body: { question: "ZZZ__NOT__IN__KB" } });
  }, 200, "未检索到相关文档");

  // ================= 汇总 =================
  console.log(`\n========== 结果汇总 ==========`);
  console.log(`✅ PASS: ${passed}   ❌ FAIL: ${failed}`);
  if (failures.length) {
    console.log(`失败用例：`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log("================================");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("测试程序异常：", e.message);
  process.exit(1);
});
