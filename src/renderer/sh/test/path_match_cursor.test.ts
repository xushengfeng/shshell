import { describe, it, expect } from "vitest";
import { pathMatchCursor } from "../path_match_cursor";

describe("pathMatchCursor", () => {
    it("应该正确处理绝对路径并聚焦于目录", () => {
        // 场景: /home/user/project (光标在 'user' 内部)
        // 假设: /home/user/project
        // 长度: 5 (/home) + 1 (/) + 4 (user) + 1 (/) + 7 (project)
        // 光标位置: 10 (即 'user' 字符串内部的任意位置)
        const cur = "/home/user/project";
        const curOffset = 10;

        const result = pathMatchCursor(cur, curOffset);

        expect(result.focusPart).toBe("user");
        // 基础路径应该是 /home/ (包含当前聚焦部分之前的路径)
        expect(result.basePath).toBe("/home/");
    });

    it("应该正确处理绝对路径并聚焦于文件名", () => {
        // 场景: /home/user/project.txt (光标在 'project.txt' 内部)
        const cur = "/home/user/project.txt";
        // 'project' 开始位置: /home/user/ (12) -> 假设光标在 16
        const curOffset = 16;

        const result = pathMatchCursor(cur, curOffset);

        expect(result.focusPart).toBe("project.txt");
        // 基础路径应包含 user 目录
        expect(result.basePath).toBe("/home/user/");
    });

    it("应该正确处理相对路径并结合 cwd", () => {
        // 场景: ./src/utils (光标在 'src' 内部)
        // 假设输入: ./src/utils
        // 光标在 2 (./s 的位置)
        const cur = "./src/utils";
        const curOffset = 2;

        const result = pathMatchCursor(cur, curOffset);

        expect(result.focusPart).toBe("src");
        // 相对路径的 basePath 保持相对
        expect(result.basePath).toBe("./");
    });

    it("相对路径，无前导提示", () => {
        expect(pathMatchCursor("src/utils", 2)).toEqual({
            focusPart: "src",
            basePath: "",
        });
    });

    it("应该处理根路径的情况 (光标在根)", () => {
        // 场景: /user (光标在 'user')
        const cur = "/user";
        const curOffset = 1; // 索引1，在 user 内

        const result = pathMatchCursor(cur, curOffset);

        expect(result.focusPart).toBe("user");
        expect(result.basePath).toBe("/");
    });

    it("应该处理空路径或光标在最开头的情况", () => {
        const cur = "";
        const curOffset = 0;

        const result = pathMatchCursor(cur, curOffset);

        expect(result.focusPart).toBe("");
        expect(result.basePath).toBe("");
    });
    it("/", () => {
        expect(pathMatchCursor("/", 0)).toEqual({
            basePath: "",
            focusPart: "",
        });
        expect(pathMatchCursor("/", 1)).toEqual({
            basePath: "/",
            focusPart: "",
        });
    });
    it("///", () => {
        expect(pathMatchCursor("///", 3)).toEqual({
            basePath: "///",
            focusPart: "",
        });
        expect(pathMatchCursor(".//./", 5)).toEqual({
            basePath: ".//./",
            focusPart: "",
        });
    });
});
