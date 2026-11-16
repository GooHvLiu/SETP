import { describe, expect, it } from "vitest";
import { parseMysqlUrl } from "../../src/config/db.config";

/** MySQL 连接串解析：协议、主机与库名缺一不可。 */
describe("parseMysqlUrl", () => {
  it("拒绝不可解析的连接串", () => {
    expect(() => parseMysqlUrl("not-a-url")).toThrow("不是合法的 MySQL 连接串");
  });

  it("只接受 mysql / mariadb 协议", () => {
    expect(() => parseMysqlUrl("http://localhost:3306/app")).toThrow("协议必须是 mysql:// 或 mariadb://");
  });

  it("缺少库名与缺少主机分别报错", () => {
    expect(() => parseMysqlUrl("mysql://localhost:3306")).toThrow("缺少 host 或 database");
    expect(() => parseMysqlUrl("mysql:///app")).toThrow("缺少 host 或 database");
  });

  it("省略端口时回退 3306，并解码用户名密码", () => {
    const parsed = parseMysqlUrl("mysql://setp:p%40ssw0rd@db.local/app");
    expect(parsed).toEqual({
      host: "db.local",
      port: 3306,
      user: "setp",
      password: "p@ssw0rd",
      database: "app",
    });
  });

  it("指定端口与百分号编码库名", () => {
    const parsed = parseMysqlUrl("mariadb://root:secret@127.0.0.1:3307/my%20db");
    expect(parsed.port).toBe(3307);
    expect(parsed.database).toBe("my db");
    expect(parsed.user).toBe("root");
  });
});
