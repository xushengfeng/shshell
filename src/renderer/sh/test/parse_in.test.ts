import { describe, it, expect } from "vitest";
import { parseIn, parseInFlat, type ShInputItem } from "../parser_in";

describe("基本语句", () => {
    // --- 边界条件和空值/空白处理 ---
    it("空", () => {
        expect(parseIn("")).toEqual([]);
    });

    it("空格", () => {
        const expected: ShInputItem[] = [{ type: "blank", input: "   ", value: "   ", start: 0, end: 3 }];
        expect(parseIn("   ")).toEqual(expected);
    });

    it("制表符", () => {
        const expected: ShInputItem[] = [{ type: "blank", input: "\t\t", value: "  ", start: 0, end: 2 }];
        expect(parseIn("\t\t")).toEqual(expected);
    });

    it("简单语句 无歧义", () => {
        const input = "  my command  ";
        const expected: ShInputItem[] = [
            { type: "blank", input: "  ", value: "  ", start: 0, end: 2 },
            { type: "item", input: "my", value: "my", start: 2, end: 4 },
            { type: "blank", input: " ", value: " ", start: 4, end: 5 },
            { type: "item", input: "command", value: "command", start: 5, end: 12 },
            { type: "blank", input: "  ", value: "  ", start: 12, end: 14 },
        ];
        expect(parseIn(input)).toEqual(expected);
    });

    it("单个命令 无参数（无尾随空格）", () => {
        const input = "pwd";
        const expected: ShInputItem[] = [{ type: "item", input: "pwd", value: "pwd", start: 0, end: 3 }];
        expect(parseIn(input)).toEqual(expected);
    });

    it("should handle a single command with trailing spaces", () => {
        const input = "pwd  ";
        const expected: ShInputItem[] = [
            { type: "item", input: "pwd", value: "pwd", start: 0, end: 3 },
            { type: "blank", input: "  ", value: "  ", start: 3, end: 5 },
        ];
        expect(parseIn(input)).toEqual(expected);
    });
});

describe("引号处理", () => {
    it("单引号", () => {
        const input = "echo 'Hello'";
        const expected: ShInputItem[] = [
            { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
            { type: "blank", input: " ", value: " ", start: 4, end: 5 },
            { type: "item", input: "'Hello'", value: "Hello", start: 5, end: 12, protected: true },
        ];
        expect(parseIn(input)).toEqual(expected);
    });
    it("双引号", () => {
        const input = 'echo "Hello"';
        const expected: ShInputItem[] = [
            { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
            { type: "blank", input: " ", value: " ", start: 4, end: 5 },
            { type: "item", input: '"Hello"', value: "Hello", start: 5, end: 12, protected: true },
        ];
        expect(parseIn(input)).toEqual(expected);
    });
    describe("单类型引号，空格", () => {
        it("包含空格", () => {
            const input = "echo 'Hello World'";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "item", input: "'Hello World'", value: "Hello World", start: 5, end: 18, protected: true },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
        it("多含义空格", () => {
            const input = "echo '  Hello   World  '";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                {
                    type: "item",
                    input: "'  Hello   World  '",
                    value: "  Hello   World  ",
                    start: 5,
                    end: 24,
                    protected: true,
                },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
    });
    describe("单类型引号，包含特殊字符", () => {
        it("包含其他", () => {
            const input = "echo 'Special $PATH & * # \\( )'";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                {
                    type: "item",
                    input: "'Special $PATH & * # \\( )'",
                    value: "Special $PATH & * # \\( )",
                    start: 5,
                    end: 31,
                    protected: true,
                },
            ];
            expect(parseIn(input)).toEqual(expected);
        });

        it("包含单引号，自动判断", () => {
            const input = "echo 'It's a test'";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "item", input: "'It's a test'", value: "It's a test", start: 5, end: 18, protected: true },
            ];
            expect(parseIn(input)).toEqual(expected);
        });

        it("包含转义单引号", () => {
            const input = "echo 'It\\' s a test'";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "item", input: "'It\\' s a test'", value: "It' s a test", start: 5, end: 20, protected: true },
            ];
            expect(parseIn(input)).toEqual(expected);
        });

        it("包含转义单引号2", () => {
            // 不管中间的引号是否为智能判断，书写时为了稳妥或者不知情或者减少判断，都输入了\，应该去掉
            const input = "echo 'It\\'s a test'";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "item", input: "'It\\'s a test'", value: "It's a test", start: 5, end: 19, protected: true },
            ];
            expect(parseIn(input)).toEqual(expected);
        });

        it("包含转义单引号2", () => {
            // 总而言之，在同类型引号前打\是必须要转义的
            const input = "echo 'It\\\\'s a test'";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                {
                    type: "item",
                    input: "'It\\\\'s a test'",
                    value: "It\\'s a test",
                    start: 5,
                    end: 20,
                    protected: true,
                },
            ];
            expect(parseIn(input)).toEqual(expected);
        });

        it("包含转义单引号4", () => {
            const input = "echo 'It's a test\\\\'";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                {
                    type: "item",
                    input: "'It's a test\\\\'",
                    value: "It's a test\\",
                    start: 5,
                    end: 20,
                    protected: true,
                },
            ];
            expect(parseIn(input)).toEqual(expected);
        });

        it("包含换行符", () => {
            const input = "echo 'Line1\nLine2'";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "item", input: "'Line1\nLine2'", value: "Line1\nLine2", start: 5, end: 18, protected: true },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
    });
    describe("单类型引号，不闭合", () => {
        it("不闭合", () => {
            const input = "echo 'Hello World";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "item", input: "'Hello World", value: "Hello World", start: 5, end: 17, protected: true },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
        it("不闭合2", () => {
            const input = "echo Hello World'";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "item", input: "Hello", value: "Hello", start: 5, end: 10 },
                { type: "blank", input: " ", value: " ", start: 10, end: 11 },
                { type: "item", input: "World'", value: "World'", start: 11, end: 17 },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
        it("不闭合3", () => {
            const input = `"/usr`;
            const expected: ShInputItem[] = [
                { type: "item", input: `"/usr`, value: "/usr", start: 0, end: 5, protected: true },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
    });
    // 假设两种引号是等价的，单引号通过那纯双引号也没问题
    describe("混合引号", () => {
        it("单引号内含双引号", () => {
            const input = `echo 'He said "Hello"'`;
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                {
                    type: "item",
                    input: `'He said "Hello"'`,
                    value: 'He said "Hello"',
                    start: 5,
                    end: 22,
                    protected: true,
                },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
        it("不完全闭合引号", () => {
            const input = `echo "He said 'Hello"`;
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                {
                    type: "item",
                    input: `"He said 'Hello"`,
                    value: "He said 'Hello",
                    start: 5,
                    end: 21,
                    protected: true,
                },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
        it("不完全闭合引号2", () => {
            const input = `echo "He said 'Hello" i'`;
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                {
                    type: "item",
                    input: `"He said 'Hello"`,
                    value: "He said 'Hello",
                    start: 5,
                    end: 21,
                    protected: true,
                },
                { type: "blank", input: " ", value: " ", start: 21, end: 22 },
                { type: "item", input: "i'", value: "i'", start: 22, end: 24 },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
    });
});

describe("转义字符处理", () => {
    it("转义空格", () => {
        const input = "echo Hello\\ World";
        const expected: ShInputItem[] = [
            { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
            { type: "blank", input: " ", value: " ", start: 4, end: 5 },
            { type: "item", input: "Hello\\ World", value: "Hello World", start: 5, end: 17 },
        ];
        expect(parseIn(input)).toEqual(expected);
    });
});

describe("注释", () => {
    it("基本注释", () => {
        const input = "echo Hello # This is a comment";
        const expected: ShInputItem[] = [
            { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
            { type: "blank", input: " ", value: " ", start: 4, end: 5 },
            { type: "item", input: "Hello", value: "Hello", start: 5, end: 10 },
            { type: "blank", input: " ", value: " ", start: 10, end: 11 },
            { type: "ignore", input: "# This is a comment", value: "", start: 11, end: 30 },
        ];
        expect(parseIn(input)).toEqual(expected);
    });
    it("注释转义", () => {
        const input = "echo Hello \\# This is";
        const expected: ShInputItem[] = [
            { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
            { type: "blank", input: " ", value: " ", start: 4, end: 5 },
            { type: "item", input: "Hello", value: "Hello", start: 5, end: 10 },
            { type: "blank", input: " ", value: " ", start: 10, end: 11 },
            { type: "item", input: "\\#", value: "#", start: 11, end: 13 },
            { type: "blank", input: " ", value: " ", start: 13, end: 14 },
            { type: "item", input: "This", value: "This", start: 14, end: 18 },
            { type: "blank", input: " ", value: " ", start: 18, end: 19 },
            { type: "item", input: "is", value: "is", start: 19, end: 21 },
        ];
        expect(parseIn(input)).toEqual(expected);
    });
    it("注释换行", () => {
        const input = "echo Hello # This is a comment\necho World";
        const expected: ShInputItem[] = [
            { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
            { type: "blank", input: " ", value: " ", start: 4, end: 5 },
            { type: "item", input: "Hello", value: "Hello", start: 5, end: 10 },
            { type: "blank", input: " ", value: " ", start: 10, end: 11 },
            { type: "ignore", input: "# This is a comment", value: "", start: 11, end: 30 },
            { type: "blank", input: "\n", value: " ", start: 30, end: 31 },
            { type: "item", input: "echo", value: "echo", start: 31, end: 35 },
            { type: "blank", input: " ", value: " ", start: 35, end: 36 },
            { type: "item", input: "World", value: "World", start: 36, end: 41 },
        ];
        expect(parseIn(input)).toEqual(expected);
    });
});

describe("括号处理", () => {
    describe("扁平解析", () => {
        it("简单括号", () => {
            const input = "echo (Hello World)";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "()", input: "(", value: "(", start: 5, end: 6 },
                { type: "item", input: "Hello", value: "Hello", start: 6, end: 11 },
                { type: "blank", input: " ", value: " ", start: 11, end: 12 },
                { type: "item", input: "World", value: "World", start: 12, end: 17 },
                { type: "()", input: ")", value: ")", start: 17, end: 18 },
            ];
            expect(parseInFlat(input)).toEqual(expected);
        });
        it("嵌套括号", () => {
            const input = "echo (Hello (Nested) World)";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "()", input: "(", value: "(", start: 5, end: 6 },
                { type: "item", input: "Hello", value: "Hello", start: 6, end: 11 },
                { type: "blank", input: " ", value: " ", start: 11, end: 12 },
                { type: "()", input: "(", value: "(", start: 12, end: 13 },
                { type: "item", input: "Nested", value: "Nested", start: 13, end: 19 },
                { type: "()", input: ")", value: ")", start: 19, end: 20 },
                { type: "blank", input: " ", value: " ", start: 20, end: 21 },
                { type: "item", input: "World", value: "World", start: 21, end: 26 },
                { type: "()", input: ")", value: ")", start: 26, end: 27 },
            ];
            expect(parseInFlat(input)).toEqual(expected);
        });
        it("空格干扰", () => {
            const input = " echo  (  Hello  )  ";
            const expected: ShInputItem[] = [
                { type: "blank", input: " ", value: " ", start: 0, end: 1 },
                { type: "item", input: "echo", value: "echo", start: 1, end: 5 },
                { type: "blank", input: "  ", value: "  ", start: 5, end: 7 },
                { type: "()", input: "(", value: "(", start: 7, end: 8 },
                { type: "blank", input: "  ", value: "  ", start: 8, end: 10 },
                { type: "item", input: "Hello", value: "Hello", start: 10, end: 15 },
                { type: "blank", input: "  ", value: "  ", start: 15, end: 17 },
                { type: "()", input: ")", value: ")", start: 17, end: 18 },
                { type: "blank", input: "  ", value: "  ", start: 18, end: 20 },
            ];
            expect(parseInFlat(input)).toEqual(expected);
        });
        it("不正常闭合括号", () => {
            const input = "echo (unclosed";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "()", input: "(", value: "(", start: 5, end: 6 },
                { type: "item", input: "unclosed", value: "unclosed", start: 6, end: 14 },
            ];
            expect(parseInFlat(input)).toEqual(expected);
            const input2 = "echo extra)";
            const expected2: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "item", input: "extra", value: "extra", start: 5, end: 10 },
                { type: "()", input: ")", value: ")", start: 10, end: 11 },
            ];
            expect(parseInFlat(input2)).toEqual(expected2);
            const input3 = "aaaa ((";
            const expected3: ShInputItem[] = [
                { type: "item", input: "aaaa", value: "aaaa", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "()", input: "(", value: "(", start: 5, end: 6 },
                { type: "()", input: "(", value: "(", start: 6, end: 7 },
            ];
            expect(parseInFlat(input3)).toEqual(expected3);
        });
        it("转义", () => {
            const input = "echo a\\ b (c\\)d)";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "item", input: "a\\ b", value: "a b", start: 5, end: 9 },
                { type: "blank", input: " ", value: " ", start: 9, end: 10 },
                { type: "()", input: "(", value: "(", start: 10, end: 11 },
                { type: "item", input: "c\\)d", value: "c)d", start: 11, end: 15 },
                { type: "()", input: ")", value: ")", start: 15, end: 16 },
            ];
            expect(parseInFlat(input)).toEqual(expected);
        });
        it("引号", () => {
            const input = `echo (Hello "(World))"`;
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                { type: "()", input: "(", value: "(", start: 5, end: 6 },
                { type: "item", input: "Hello", value: "Hello", start: 6, end: 11 },
                { type: "blank", input: " ", value: " ", start: 11, end: 12 },
                { type: "item", input: `"(World))"`, value: "(World))", start: 12, end: 22, protected: true },
            ];
            expect(parseInFlat(input)).toEqual(expected);
        });
    });
    describe("嵌套", () => {
        it("基本嵌套", () => {
            const input = "echo (Hello World)";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                {
                    type: "sub",
                    input: "(Hello World)",
                    value: "Hello World",
                    start: 5,
                    end: 18,
                    chindren: [
                        { type: "()", input: "(", value: "(", start: 5, end: 6 },
                        { type: "item", input: "Hello", value: "Hello", start: 6, end: 11 },
                        { type: "blank", input: " ", value: " ", start: 11, end: 12 },
                        { type: "item", input: "World", value: "World", start: 12, end: 17 },
                        { type: "()", input: ")", value: ")", start: 17, end: 18 },
                    ],
                },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
        it("嵌套2", () => {
            const input = "echo ((Hello World))";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                {
                    type: "sub",
                    input: "((Hello World))",
                    value: "(Hello World)",
                    start: 5,
                    end: 20,
                    chindren: [
                        { type: "()", input: "(", value: "(", start: 5, end: 6 },
                        {
                            type: "sub",
                            input: "(Hello World)",
                            value: "Hello World",
                            start: 6,
                            end: 19,
                            chindren: [
                                { type: "()", input: "(", value: "(", start: 6, end: 7 },
                                { type: "item", input: "Hello", value: "Hello", start: 7, end: 12 },
                                { type: "blank", input: " ", value: " ", start: 12, end: 13 },
                                { type: "item", input: "World", value: "World", start: 13, end: 18 },
                                { type: "()", input: ")", value: ")", start: 18, end: 19 },
                            ],
                        },
                        { type: "()", input: ")", value: ")", start: 19, end: 20 },
                    ],
                },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
        it("不完整", () => {
            const input = "echo (Hello (Nested) World";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                {
                    type: "sub",
                    input: "(Hello (Nested) World",
                    value: "Hello (Nested) World",
                    start: 5,
                    end: 26,
                    chindren: [
                        { type: "()", input: "(", value: "(", start: 5, end: 6 },
                        { type: "item", input: "Hello", value: "Hello", start: 6, end: 11 },
                        { type: "blank", input: " ", value: " ", start: 11, end: 12 },
                        {
                            type: "sub",
                            input: "(Nested)",
                            value: "Nested",
                            start: 12,
                            end: 20,
                            chindren: [
                                { type: "()", input: "(", value: "(", start: 12, end: 13 },
                                { type: "item", input: "Nested", value: "Nested", start: 13, end: 19 },
                                { type: "()", input: ")", value: ")", start: 19, end: 20 },
                            ],
                        },
                        { type: "blank", input: " ", value: " ", start: 20, end: 21 },
                        { type: "item", input: "World", value: "World", start: 21, end: 26 },
                    ],
                },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
        it("空", () => {
            const input = "echo ()";
            const expected: ShInputItem[] = [
                { type: "item", input: "echo", value: "echo", start: 0, end: 4 },
                { type: "blank", input: " ", value: " ", start: 4, end: 5 },
                {
                    type: "sub",
                    input: "()",
                    value: "",
                    start: 5,
                    end: 7,
                    chindren: [
                        { type: "()", input: "(", value: "(", start: 5, end: 6 },
                        { type: "()", input: ")", value: ")", start: 6, end: 7 },
                    ],
                },
            ];
            expect(parseIn(input)).toEqual(expected);
        });
    });
});
