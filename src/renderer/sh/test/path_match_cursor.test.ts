import { describe, it, expect } from "vitest";
import path from "node:path";
import { pathMatchCursor } from "../path_match_cursor";

describe("pathMatchCursor", () => {
    // 配置测试环境，确保 path.sep 行为符合预期 (虽然 Node 环境通常是当前系统的，但这里我们测试逻辑)
    const sep = path.sep;

    it("应该正确处理绝对路径并聚焦于目录", () => {
        // 场景: /home/user/project (光标在 'user' 内部)
        // 假设: /home/user/project
        // 长度: 5 (/home) + 1 (/) + 4 (user) + 1 (/) + 7 (project)
        // 光标位置: 10 (即 'user' 字符串内部的任意位置)
        const cur = `${sep}home${sep}user${sep}project`;
        const curOffset = 10;
        const cwd = "/tmp";

        const result = pathMatchCursor(cur, curOffset, cwd);

        expect(result.focusPart).toBe("user");
        // 基础路径应该是 /home/ (包含当前聚焦部分之前的路径)
        expect(result.basePath).toBe(`${sep}home${sep}`);
        // p 应该是完整的绝对 basePath
        expect(result.p).toBe(`${sep}home${sep}`);
    });

    it("应该正确处理绝对路径并聚焦于文件名", () => {
        // 场景: /home/user/project.txt (光标在 'project.txt' 内部)
        const cur = `${sep}home${sep}user${sep}project.txt`;
        // 'project' 开始位置: /home/user/ (12) -> 假设光标在 16
        const curOffset = 16;
        const cwd = "/tmp";

        const result = pathMatchCursor(cur, curOffset, cwd);

        expect(result.focusPart).toBe("project.txt");
        // 基础路径应包含 user 目录
        expect(result.basePath).toBe(`${sep}home${sep}user${sep}`);
        expect(result.p).toBe(`${sep}home${sep}user${sep}`);
    });

    it("应该正确处理相对路径并结合 cwd", () => {
        // 场景: ./src/utils (光标在 'src' 内部)
        // 假设输入: ./src/utils
        // 光标在 2 (./s 的位置)
        const cur = `.${sep}src${sep}utils`;
        const curOffset = 2;
        const cwd = "/project/root";

        const result = pathMatchCursor(cur, curOffset, cwd);

        expect(result.focusPart).toBe("src");
        // 相对路径的 basePath 保持相对
        expect(result.basePath).toBe(`.${sep}`);
        // p 应该合并 cwd
        expect(result.p).toBe(path.join("/project/root", `.${sep}`));
    });

    it("应该处理根路径的情况 (光标在根)", () => {
        // 场景: /user (光标在 'user')
        const cur = `${sep}user`;
        const curOffset = 1; // 索引1，在 user 内
        const cwd = "/tmp";

        const result = pathMatchCursor(cur, curOffset, cwd);

        expect(result.focusPart).toBe("user");
        expect(result.basePath).toBe(`${sep}`);
        expect(result.p).toBe(`${sep}`);
    });

    it("应该处理空路径或光标在最开头的情况", () => {
        const cur = "";
        const curOffset = 0;
        const cwd = "/tmp";

        const result = pathMatchCursor(cur, curOffset, cwd);

        expect(result.focusPart).toBe("");
        expect(result.basePath).toBe(`${sep}`);
        // 路径 join 后通常规范化，这里取决于 path.join 的行为
        expect(result.p).toBe(path.join("/tmp", `${sep}`));
    });
    // todo .///.///.
});
