import { describe, expect, it } from "vitest";
import { VirtualLinux } from "./vr_fs/vr_fs";
import { getTip } from "../input_complete";
import { parseIn, parseIn2 } from "../parser_in";
import { tryX } from "../../try";

const vrfs = new VirtualLinux({
    type: "dir",
    children: {
        home: {
            type: "dir",
            children: {
                alice: {
                    type: "dir",
                    children: {
                        documents: {
                            type: "dir",
                            children: {
                                "report.txt": { type: "file", content: "Q1 Report data" },
                                "todo.txt": { type: "file", content: "Buy milk" },
                                "read me.md": { type: "file", content: "# Welcome to your documents" },
                            },
                        },
                        downloads: {
                            type: "dir",
                            children: {
                                "image.png": {
                                    type: "file",
                                    content: "[binary image data]",
                                },
                                "setup.exe": {
                                    type: "file",
                                    isExecutable: true,
                                    content: "installer binary",
                                },
                            },
                        },
                        ".bashrc": { type: "file", content: 'alias ll="ls -l"' },
                        profile: {
                            type: "file",
                            isExecutable: false,
                            content: "user settings",
                        },
                    },
                },
                bob: {
                    type: "dir",
                    children: {
                        work: {
                            type: "dir",
                            children: {
                                "project.ts": {
                                    type: "file",
                                    content: 'console.log("ts")',
                                },
                            },
                        },
                    },
                },
            },
        },
        usr: {
            type: "dir",
            children: {
                local: {
                    type: "dir",
                    children: {
                        lib: { type: "dir", children: {} },
                    },
                },
                bin: {
                    type: "dir",
                    children: {
                        ls: { type: "file", isExecutable: true, content: "print list" },
                        cat: { type: "file", isExecutable: true, content: "read file" },
                        top: { type: "file", isExecutable: true, content: "process monitor" },
                    },
                },
            },
        },
    },
});

const sysObj = {
    cwd: "/home/alice",
    allCommands: () => ["ls", "cat", "top", "cd", "echo", "exit"],
    readDirSync: (p: string) => vrfs.readdirSync(p),
    statSync: (p: string) => tryX(() => vrfs.statSync(p))[0] || null,
    isExeSync: (p: string) => vrfs.isExeSync(p),
};

function parse(input: string) {
    return parseIn2(parseIn(input));
}

describe("仅路径补全，基本命令补全", () => {
    describe("空", () => {
        it("空", () => {
            const res = getTip(parse(""), 0, 0, sysObj);
            expect(res).toEqual({ list: sysObj.allCommands().map((x) => ({ x, des: "" })), pre: "", last: "" });
        });
        it("空2", () => {
            const res = getTip(parse(" "), 1, 1, sysObj);
            expect(res).toEqual({ list: sysObj.allCommands().map((x) => ({ x, des: "" })), pre: " ", last: "" });
        });
        it("空3", () => {
            const res = getTip(parse(" "), 0, 0, sysObj);
            expect(res).toEqual({ list: sysObj.allCommands().map((x) => ({ x, des: "" })), pre: "", last: " " });
        });
    });
    describe("命令补全", () => {
        it("命令", () => {
            const res = getTip(parse("c"), 1, 1, sysObj);
            expect(res).toEqual({
                list: [
                    { x: "cat", des: "" },
                    { x: "cd", des: "" },
                ],
                pre: "",
                last: "",
            });
        });
        it("命令2", () => {
            const res = getTip(parse("e"), 0, 0, sysObj);
            expect(res).toEqual({
                list: [
                    { x: "echo", des: "" },
                    { x: "exit", des: "" },
                ],
                pre: "",
                last: "",
            });
        });
    });
    describe("可执行文件补全", () => {
        it("可执行文件", () => {
            const res = getTip(parse("/usr/b"), 6, 6, sysObj);
            expect(res).toEqual({
                list: [{ x: "/usr/bin", show: "bin", des: "dir" }],
                pre: "",
                last: "",
            });
        });
        it("可执行文件，相对目录", () => {
            const res = getTip(parse("./bi"), 4, 4, { ...sysObj, cwd: "/usr" });
            expect(res).toEqual({
                list: [{ x: "./bin", show: "bin", des: "dir" }],
                pre: "",
                last: "",
            });
        });
        it("可执行文件，引号", () => {
            const res = getTip(parse('"/usr/b"'), 7, 7, sysObj);
            expect(res).toEqual({
                list: [{ x: '"/usr/bin"', show: "bin", des: "dir" }],
                pre: "",
                last: "",
            });
        });
        it("可执行文件，相对目录，引号", () => {
            const res = getTip(parse('"./bi"'), 5, 5, { ...sysObj, cwd: "/usr" });
            expect(res).toEqual({
                list: [{ x: '"./bin"', show: "bin", des: "dir" }],
                pre: "",
                last: "",
            });
        });
    });
    describe("路径补全", () => {
        describe("起头", () => {});
        describe("末尾", () => {
            it("目录补全带斜杠", () => {
                const res = getTip(parse("cd downloads"), 12, 12, sysObj);
                expect(res).toEqual({
                    list: [{ x: "downloads/", des: "" }],
                    pre: "cd ",
                    last: "",
                });
            });
            it("绝对", () => {
                const res = getTip(parse("cd /home/al"), 10, 10, sysObj);
                expect(res).toEqual({
                    list: [{ x: "/home/alice", show: "alice", des: "dir" }],
                    pre: "cd ",
                    last: "",
                });
            });
            it("相对", () => {
                const res = getTip(parse("cd do"), 5, 5, sysObj);
                expect(res).toEqual({
                    list: [
                        { x: "documents", show: "documents", des: "dir" },
                        { x: "downloads", show: "downloads", des: "dir" },
                    ],
                    pre: "cd ",
                    last: "",
                });
            });
            it("点相对", () => {
                const res = getTip(parse("cd ./do"), 6, 6, sysObj);
                expect(res).toEqual({
                    list: [
                        { x: "./documents", show: "documents", des: "dir" },
                        { x: "./downloads", show: "downloads", des: "dir" },
                    ],
                    pre: "cd ",
                    last: "",
                });
            });
            it("点点相对", () => {
                const res = getTip(parse("cd ../bo"), 7, 7, sysObj);
                expect(res).toEqual({
                    list: [{ x: "../bob", show: "bob", des: "dir" }],
                    pre: "cd ",
                    last: "",
                });
            });
            it("点点点相对", () => {
                const res = getTip(parse("cd ../../home/al"), 12, 12, sysObj);
                expect(res).toEqual({
                    list: [{ x: "../../home/alice", show: "alice", des: "dir" }],
                    pre: "cd ",
                    last: "",
                });
            });
            it("点文件", () => {
                const res = getTip(parse("cat .ba"), 6, 6, sysObj);
                expect(res).toEqual({
                    list: [{ x: ".bashrc", show: ".bashrc", des: "file" }],
                    pre: "cat ",
                    last: "",
                });
            });
        });
        describe("中间", () => {});
        describe("转义判断", () => {
            it("引号转义", () => {
                const res = getTip(parse('cd "/home/al'), 11, 11, sysObj);
                expect(res).toEqual({
                    list: [{ x: '"/home/alice"', show: "alice", des: "dir" }],
                    pre: "cd ",
                    last: "",
                });
            });
            it("其他转义", () => {
                const res = getTip(parse("cat documents/read"), 18, 18, sysObj);
                expect(res).toEqual({
                    list: [{ x: "documents/read\\ me.md", show: "read me.md", des: "file" }],
                    pre: "cat ",
                    last: "",
                });
            });
        });
    });
});
