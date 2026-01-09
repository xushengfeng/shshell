import { describe, expect, it } from "vitest";
import { VirtualLinux } from "./vr_fs/vr_fs";
import { getTip, matchItem } from "../input_complete";
import { parseIn, parseIn2, type ShInputItem2 } from "../parser_in";
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

describe("光标定位", () => {
    it("空", () => {
        expect(matchItem([], 0)).toEqual({ d: [] });
    });
    it("开头", () => {
        expect(matchItem(parse("echo"), 0)).toEqual({ d: [{ list: [parse("echo")[0]], raw: parse("echo") }] });
    });
    it("结尾", () => {
        expect(matchItem(parse("echo"), 4)).toEqual({ d: [{ list: [parse("echo")[0]], raw: parse("echo") }] });
    });
    it("中间", () => {
        expect(matchItem(parse("ec ho"), 2)).toEqual({
            d: [{ list: parse("ec ho").slice(0, 2), raw: parse("ec ho") }],
        });
    });
    it("嵌套", () => {
        expect(matchItem(parse("echo (ab)"), 7)).toEqual({
            d: [
                { list: parse("echo (ab)").slice(2, 3), raw: parse("echo (ab)") },
                {
                    list: [
                        {
                            type: "main",
                            input: "ab",
                            value: "ab",
                            start: 6,
                            end: 8,
                        },
                    ],
                    // @ts-expect-error
                    raw: parse("echo (ab)")[2].chindren,
                },
            ],
        });
    });
    it("嵌套2", () => {
        expect(matchItem(parse("echo (a)"), 7)).toEqual({
            d: [
                { list: parse("echo (a)").slice(2, 3), raw: parse("echo (a)") },
                {
                    list: [
                        {
                            type: "main",
                            input: "a",
                            value: "a",
                            start: 6,
                            end: 7,
                        },
                        { type: "other", input: ")", value: ")", start: 7, end: 8 },
                    ],
                    // @ts-expect-error
                    raw: parse("echo (a)")[2].chindren,
                },
            ],
        });
    });
    it("嵌套3", () => {
        const p = parse("echo ((a))");
        const r = [
            { type: "main", input: "echo", value: "echo", start: 0, end: 4 },
            { type: "blank", input: " ", value: " ", start: 4, end: 5 },
            {
                type: "arg",
                input: "((a))",
                value: "",
                start: 5,
                end: 10,
                chindren: [
                    { type: "other", input: "(", value: "(", start: 5, end: 6 },
                    {
                        type: "arg",
                        input: "(a)",
                        value: "",
                        start: 6,
                        end: 9,
                        chindren: [
                            { type: "other", input: "(", value: "(", start: 6, end: 7 },
                            { type: "main", input: "a", value: "a", start: 7, end: 8 },
                            { type: "other", input: ")", value: ")", start: 8, end: 9 },
                        ],
                    },
                    { type: "other", input: ")", value: ")", start: 9, end: 10 },
                ],
            },
        ] satisfies ShInputItem2[];
        expect(matchItem(p, 5)).toEqual({
            d: [
                { list: [p[1], p[2]], raw: r },
                { list: [{ type: "other", input: "(", value: "(", start: 5, end: 6 }], raw: r[2].chindren },
            ],
        });
        expect(matchItem(p, 6)).toEqual({
            d: [
                { list: [p[2]], raw: r },
                {
                    list: [
                        { type: "other", input: "(", value: "(", start: 5, end: 6 },
                        {
                            type: "arg",
                            input: "(a)",
                            value: "",
                            start: 6,
                            end: 9,
                            chindren: [
                                { type: "other", input: "(", value: "(", start: 6, end: 7 },
                                { type: "main", input: "a", value: "a", start: 7, end: 8 },
                                { type: "other", input: ")", value: ")", start: 8, end: 9 },
                            ],
                        },
                    ],
                    raw: r[2].chindren,
                },
                {
                    list: [{ type: "other", input: "(", value: "(", start: 6, end: 7 }],
                    // @ts-expect-error
                    raw: r[2].chindren[1].chindren,
                },
            ],
        });
        expect(matchItem(p, 7)).toEqual({
            d: [
                { list: [p[2]], raw: r },
                {
                    list: [
                        {
                            type: "arg",
                            input: "(a)",
                            value: "",
                            start: 6,
                            end: 9,
                            chindren: [
                                { type: "other", input: "(", value: "(", start: 6, end: 7 },
                                { type: "main", input: "a", value: "a", start: 7, end: 8 },
                                { type: "other", input: ")", value: ")", start: 8, end: 9 },
                            ],
                        },
                    ],
                    raw: r[2].chindren,
                },
                {
                    list: [
                        { type: "other", input: "(", value: "(", start: 6, end: 7 },
                        { type: "main", input: "a", value: "a", start: 7, end: 8 },
                    ],
                    // @ts-expect-error
                    raw: r[2].chindren[1].chindren,
                },
            ],
        });
    });
});

describe("仅路径补全，基本命令补全", () => {
    describe("空", () => {
        it("空", () => {
            const res = getTip(parse(""), 0, 0, sysObj);
            expect(res).toEqual({
                list: sysObj.allCommands().map((x) => ({ x, des: "", show: x })),
                pre: "",
                last: "",
            });
        });
        it("空2", () => {
            const res = getTip(parse(" "), 1, 1, sysObj);
            expect(res).toEqual({
                list: sysObj.allCommands().map((x) => ({ x, des: "", show: x })),
                pre: " ",
                last: "",
            });
        });
        it("空3", () => {
            const res = getTip(parse(" "), 0, 0, sysObj);
            expect(res).toEqual({
                list: sysObj.allCommands().map((x) => ({ x, des: "", show: x })),
                pre: "",
                last: " ",
            });
        });
    });
    describe("命令补全", () => {
        it("命令", () => {
            const res = getTip(parse("c"), 1, 1, sysObj);
            expect(res).toEqual({
                list: [
                    { x: "cat", show: "cat", des: "" },
                    { x: "cd", show: "cd", des: "" },
                ],
                pre: "",
                last: "",
            });
        });
        it("命令2", () => {
            const res = getTip(parse("e"), 0, 0, sysObj);
            expect(res).toEqual({
                list: [
                    { x: "echo", show: "echo", des: "" },
                    { x: "exit", show: "exit", des: "" },
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
                list: [{ x: '"/usr/bin"', show: "bin", des: "dir", cursorOffset: -1 }],
                pre: "",
                last: "",
            });
        });
        it("可执行文件，相对目录，引号", () => {
            const res = getTip(parse('"./bi"'), 5, 5, { ...sysObj, cwd: "/usr" });
            expect(res).toEqual({
                list: [{ x: '"./bin"', show: "bin", des: "dir", cursorOffset: -1 }],
                pre: "",
                last: "",
            });
        });
        // todo /补充
    });
    describe("路径补全", () => {
        describe("默认", () => {
            it("空", () => {
                const res = getTip(parse("cd "), 3, 3, sysObj);
                expect(res).toEqual({
                    list: [
                        { x: "documents", show: "documents", des: "dir" },
                        { x: "downloads", show: "downloads", des: "dir" },
                        { x: ".bashrc", show: ".bashrc", des: "file" },
                        { x: "profile", show: "profile", des: "file" },
                    ],
                    pre: "cd ",
                    last: "",
                });
            });
            it("目录补全带斜杠", () => {
                const res = getTip(parse("cd downloads"), 12, 12, sysObj);
                expect(res).toEqual({
                    list: [{ x: "downloads/", show: "downloads/", des: "" }],
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
                const res = getTip(parse("cd ../../home/al"), 14, 14, sysObj);
                expect(res).toEqual({
                    list: [{ x: "../../home/alice", show: "alice", des: "dir" }],
                    pre: "cd ",
                    last: "",
                });
            });
            it("点点点相对2", () => {
                const res = getTip(parse("cd ../.."), 8, 8, sysObj);
                expect(res).toEqual({
                    list: [{ x: "../../", show: "../../", des: "" }],
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
            it("点文件2", () => {
                const res = getTip(parse("cat ."), 5, 5, sysObj);
                expect(res).toEqual({
                    list: [
                        { x: "./", show: "./", des: "" },
                        { x: ".bashrc", show: ".bashrc", des: "file" },
                    ],
                    pre: "cat ",
                    last: "",
                });
            });
        });
        describe("转义判断", () => {
            describe("引号转义", () => {
                it("常规", () => {
                    const res = getTip(parse('cd "/home/al'), 11, 11, sysObj);
                    expect(res).toEqual({
                        list: [{ x: '"/home/alice"', show: "alice", des: "dir", cursorOffset: -1 }],
                        pre: "cd ",
                        last: "",
                    });
                });
                it("常规2", () => {
                    const res = getTip(parse('cd "'), 11, 11, sysObj);
                    expect(res).toEqual({
                        list: [
                            { x: '"documents"', show: "documents", des: "dir", cursorOffset: -1 },
                            { x: '"downloads"', show: "downloads", des: "dir", cursorOffset: -1 },
                            { x: '".bashrc"', show: ".bashrc", des: "file" },
                            { x: '"profile"', show: "profile", des: "file" },
                        ],
                        pre: "cd ",
                        last: "",
                    });
                });
                it("/补全", () => {
                    const res = getTip(parse('cd "/home'), 9, 9, sysObj);
                    expect(res).toEqual({
                        list: [{ x: '"/home/"', show: "/home/", des: "", cursorOffset: -1 }],
                        pre: "cd ",
                        last: "",
                    });
                });
                it("/补全2", () => {
                    const res = getTip(parse('cd "/home"'), 9, 9, sysObj);
                    expect(res).toEqual({
                        list: [{ x: '"/home/"', show: "/home/", des: "", cursorOffset: -1 }],
                        pre: "cd ",
                        last: "",
                    });
                });
                it("/补全3", () => {
                    const res = getTip(parse('cd ".'), 9, 9, sysObj);
                    expect(res).toEqual({
                        list: [
                            { x: '"./"', des: "", show: "./", cursorOffset: -1 },
                            {
                                des: "file",
                                show: ".bashrc",
                                x: '".bashrc"',
                            },
                        ],
                        pre: "cd ",
                        last: "",
                    });
                });
                it("/补全4", () => {
                    const res = getTip(parse('cat "/usr/"'), 10, 10, sysObj);
                    expect(res).toEqual({
                        list: [
                            {
                                des: "dir",
                                show: "local",
                                x: '"/usr/local"',
                                cursorOffset: -1,
                            },
                            { x: '"/usr/bin"', des: "dir", show: "bin", cursorOffset: -1 },
                        ],
                        pre: "cat ",
                        last: "",
                    });
                });
            });
            it("其他转义", () => {
                // todo 更多转义测试
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
