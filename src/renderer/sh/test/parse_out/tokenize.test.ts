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
            { type: "seq", content: "\b" },
            { type: "text", content: "B" },
            { type: "seq", content: "\n" },
            { type: "seq", content: "\n" },
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
            { type: "seq", content: "\b" },
            { type: "text", content: " master" },
        ]);
    });

    it("should handle OCS", () => {
        expect(tokenize("\x1b]any\x07").tokens).toEqual([{ type: "seq", content: "\x1b]any\x07" }]);
        expect(tokenize("\x1b]any\x1b\\").tokens).toEqual([{ type: "seq", content: "\x1b]any\x1b\\" }]);
    });

    it("should handle DCS", () => {
        expect(tokenize("\x1bPany\x1b\\").tokens).toEqual([{ type: "seq", content: "\x1bPany\x1b\\" }]);
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

describe("real world cases", () => {
    it("nano", () => {
        expect(tokenize("\x1B[?2004h\x1B)0\x1B7\x1B[?47h\x1B[1;30r\x1B[4l\x1B[?1h\x1B=\x1B[?1h\x1B=").tokens).toEqual([
            { type: "seq", content: "\x1B[?2004h" },
            { type: "seq", content: "\x1B)0" },
            { type: "seq", content: "\x1B7" },
            { type: "seq", content: "\x1B[?47h" },
            { type: "seq", content: "\x1B[1;30r" },
            { type: "seq", content: "\x1B[4l" },
            { type: "seq", content: "\x1B[?1h" },
            { type: "seq", content: "\x1B=" },
            { type: "seq", content: "\x1B[?1h" },
            { type: "seq", content: "\x1B=" },
        ]);
    });
});
