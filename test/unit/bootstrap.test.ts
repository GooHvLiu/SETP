import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { bootstrap } from "@src/bootstrap";
import { prisma } from "@src/db/prisma";

describe("服务启动引导", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("启动 HTTP 服务并注册可重复触发的优雅关闭", async () => {
    const handlers: Record<string, () => void> = {};
    const server = new EventEmitter() as EventEmitter & { close: (cb: () => void) => void };
    server.close = (cb: () => void) => cb();

    const app = {
      listen: vi.fn((_port: number, _host: string, cb: () => void) => {
        cb();
        return server;
      }),
    };

    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const disconnect = vi.spyOn(prisma, "$disconnect").mockResolvedValue(undefined);
    const on = vi.spyOn(process, "on").mockImplementation(((event: string, handler: () => void) => {
      handlers[event] = handler;
      return process;
    }) as never);

    const previousLocalIP = process.env.LOCAL_IP;
    process.env.LOCAL_IP = "192.168.1.10";

    await bootstrap(app as never);

    expect(app.listen).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(on).toHaveBeenCalledWith("SIGINT", expect.any(Function));

    handlers.SIGTERM();
    server.emit("close");
    await new Promise((resolve) => setImmediate(resolve));

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);

    if (previousLocalIP === undefined) {
      delete process.env.LOCAL_IP;
    } else {
      process.env.LOCAL_IP = previousLocalIP;
    }
  });
});
