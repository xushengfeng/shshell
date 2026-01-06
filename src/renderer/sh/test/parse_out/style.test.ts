import { describe, it, expect } from "vitest";
import { parseOut, type ShOutputItemText } from "../../parser_out"; // 需要导出 processTokens
import attr_example from "./show/terminalguide_attr_example.txt?raw";

// 辅助：只取第一行的第一个文本块（简化测试）
const getFirstChunk = (output: string) => {
    const lines = parseOut(output);
    return lines.find((i) => i.type === "text");
};

describe("Styles (Color & Interaction)", () => {
    describe("ANSI Color Parsing", () => {
        it("should parse basic foreground color (8 color with bright) (31m)", () => {
            const chunk = getFirstChunk("\x1b[31mRed\x1b[0m");
            expect(chunk).toMatchObject({ text: "Red", style: { color: "_red" } });
            const chunk2 = getFirstChunk("\x1b[91mBrightRed\x1b[0m");
            expect(chunk2).toMatchObject({ text: "BrightRed", style: { color: "_brightRed" } });
        });

        it("should parse basic background color (8 color with bright) (41m)", () => {
            const chunk = getFirstChunk("\x1b[41mBg\x1b[0m");
            expect(chunk).toMatchObject({ text: "Bg", style: { bgColor: "_red" } });
            const chunk2 = getFirstChunk("\x1b[101mBrightBg\x1b[0m");
            expect(chunk2).toMatchObject({ text: "BrightBg", style: { bgColor: "_brightRed" } });
        });

        it("should parse 256 foreground color index", () => {
            // 38;5;208 = Orange
            const chunk = getFirstChunk("\x1b[38;5;208mOrange\x1b[0m");
            // 计算 208 应该得到 #ff6600
            expect(chunk).toMatchObject({ text: "Orange", style: { color: "#ff6600" } });
            const chunk2 = getFirstChunk("\x1b[38;5;1mRed\x1b[0m");
            expect(chunk2).toMatchObject({ text: "Red", style: { color: "_red" } });
        });

        it("should parse 256 background color index", () => {
            const chunk = getFirstChunk("\x1b[48;5;208mOrange\x1b[0m");
            expect(chunk).toMatchObject({ text: "Orange", style: { bgColor: "#ff6600" } });
        });

        it("should parse RGB True Color foreground", () => {
            const chunk = getFirstChunk("\x1b[38;2;255;128;0mGold\x1b[0m");
            expect(chunk).toMatchObject({ text: "Gold", style: { color: "#ff8000" } });
        });

        it("should parse RGB True Color background", () => {
            const chunk = getFirstChunk("\x1b[48;2;255;128;0mGoldBg\x1b[0m");
            expect(chunk).toMatchObject({ text: "GoldBg", style: { bgColor: "#ff8000" } });
        });
    });

    describe("Attribute Parsing", () => {
        it("should parse bold", () => {
            const chunk = getFirstChunk("\x1b[1mBold\x1b[0m");
            expect(chunk?.style.bold).toBe(true);
        });

        it("should parse italic", () => {
            const chunk = getFirstChunk("\x1b[3mItalic\x1b[0m");
            expect(chunk?.style.italic).toBe(true);
        });

        it("should parse underline", () => {
            const chunk = getFirstChunk("\x1b[4mUnder\x1b[0m");
            expect(chunk?.style.underline).toBe(true);
        });

        it("should parse stacked attributes", () => {
            const chunk = getFirstChunk("\x1b[1;3;4mCombo\x1b[0m");
            expect(chunk?.style).toMatchObject({
                bold: true,
                italic: true,
                underline: true,
            });
        });
    });

    describe("Reset & Conversion", () => {
        it("should reset styles with 0", () => {
            const lines = parseOut("\x1b[1;31mRedBold\x1b[0mNormal");
            const chunks = lines.filter((i) => i.type === "text") as ShOutputItemText[];
            expect(chunks[0].style.bold).toBe(true);
            expect(chunks[1].style.bold).toBe(false);
            expect(chunks[1].style.color).toBeUndefined();
        });

        it("should reset only color with 39", () => {
            const chunk = getFirstChunk("\x1b[1;31m\x1b[39mOnlyBold");
            expect(chunk?.style).toMatchObject({
                bold: true,
                color: "_default",
            });
        });

        it("should handle Inverse (7)", () => {
            // 31 (Red text) + 7 (Inverse) -> Red background, default text
            // 注意：Inverse 交换前景和背景。
            // 在这里我们不计算出默认颜色，而是标记 inverse: true
            // 在渲染层才计算实际颜色。
            const chunk = getFirstChunk("\x1b[31m\x1b[7mTest\x1b[0m");
            expect(chunk?.style.inverse).toBe(true);
            // 这里的逻辑取决于 applySgr 如何处理
            // 如果 applySgr 仅仅是设置了 flag，那么 inverse 为 true。
            // 如果 applySgr 自动交换了颜色，则需要检查 color/bgColor。
            // 让我们假设代码中是设置了 flag。
        });
    });
});

describe("Styles By txt File", () => {
    const result = parseOut(attr_example);
    it("check color", () => {
        function check(x: string | undefined) {
            if (x === undefined) return true;
            if (x.startsWith("#")) {
                // 检查是否为有效的十六进制颜色
                return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(x);
            }
            // 检查是否为已知的语义颜色
            const semanticColors = [
                "_black",
                "_red",
                "_green",
                "_yellow",
                "_blue",
                "_magenta",
                "_cyan",
                "_white",
                "_gray",
                "_brightRed",
                "_brightGreen",
                "_brightYellow",
                "_brightBlue",
                "_brightMagenta",
                "_brightCyan",
                "_brightWhite",
                "_default",
            ];
            return semanticColors.includes(x);
        }
        expect(
            (result.filter((i) => i.type === "text") as ShOutputItemText[]).every((i) => {
                const x = check(i.style.color) && check(i.style.bgColor);
                if (!x) {
                    console.log("Failed color check:", i.style);
                }
                return x;
            }),
        ).toBe(true);
    });
});
