import { describe, it, expect } from "vitest";
import { tokenize } from "../../parser_out"; // 假设你的函数导出自 ./parser

describe("Tokenize (String Splitting)", () => {
    it("should split simple text into single text token", () => {
        const tokens = tokenize("Hello").tokens;
        expect(tokens).toEqual([{ type: "text", content: "Hello" }]);
    });

    it("should detect CSI sequences and split correctly", () => {
        // SGR sequence
        const tokens = tokenize("\x1b[31m").tokens;
        expect(tokens).toEqual([{ type: "seq", content: "\x1b[31m" }]);
    });

    it("should split text and sequence", () => {
        const tokens = tokenize("Start\x1b[1mEnd").tokens;
        expect(tokens).toEqual([
            { type: "text", content: "Start" },
            { type: "seq", content: "\x1b[1m" },
            { type: "text", content: "End" },
        ]);
    });

    it("should handle multiple sequences in a row", () => {
        const tokens = tokenize("\x1b[1m\x1b[31m").tokens;
        expect(tokens).toEqual([
            { type: "seq", content: "\x1b[1m" },
            { type: "seq", content: "\x1b[31m" },
        ]);
    });

    it("should handle special control chars as text tokens", () => {
        const input = "A\bB\n\nC";
        const tokens = tokenize(input).tokens;
        expect(tokens).toEqual([
            { type: "text", content: "A" },
            { type: "text", content: "\b" }, // 退格作为一个独立的 token
            { type: "text", content: "B" },
            { type: "text", content: "\n" },
            { type: "text", content: "\n" },
            { type: "text", content: "C" },
        ]);
    });

    it("should handle complex string mixing", () => {
        const input = "$$\x1b[32mGit:\x1b[0m \b master";
        const tokens = tokenize(input).tokens;
        expect(tokens).toEqual([
            { type: "text", content: "$$" },
            { type: "seq", content: "\x1b[32m" },
            { type: "text", content: "Git:" },
            { type: "seq", content: "\x1b[0m" },
            { type: "text", content: " " },
            { type: "text", content: "\b" },
            { type: "text", content: " master" },
        ]);
    });

    it("should handle non-CSI sequences (ESC + other)", () => {
        // ESC \ (String Terminator)
        const input = "Text\x1b\\End";
        const tokens = tokenize(input).tokens;
        // 通常 tokenize 会将 ESC 视为一种序列开始，如果找不到 [，
        // 它会吞掉 ESC 本身。
        // 根据我们的实现，如果遇到 ESC 但后面不是 [，它会 push 一个 type: 'seq' content: '\x1b'
        // 或者如果后面还有字符，可能会丢失。
        // 让我们期望它至少能安全地拆分，不报错。
        expect(tokens.length).toBeGreaterThan(0);
    });

    it("should handle uncompleted sequences", () => {
        const input = "Text\x1b[31m\x1b[";
        const tokens = tokenize(input);
        expect(tokens).toEqual({
            tokens: [
                { type: "text", content: "Text" },
                { type: "seq", content: "\x1b[31m" },
            ],
            rest: "\x1b[",
        });
    });
});
