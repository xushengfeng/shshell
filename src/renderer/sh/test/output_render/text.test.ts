import { describe, expect, it } from "vitest";
import ansiEscapes from "ansi-escapes";

import { renderMatcher } from "./match";
import { Render } from "../../output_render";
import { SimpleRender } from "../../render/simple_render";

function newTerm(row: number, col: number) {
    const render = new SimpleRender();
    const term = new Render(render, { strict: true });
    term.setSize(row, col);
    return term;
}

function dataTo(renderData: ReturnType<Render["getRenderedLines"]>) {
    return renderData.map((line) => line.chars.map((i) => ("char" in i ? i.char : null)));
}

describe("normal", () => {
    it("1 width char", () => {
        const term = newTerm(3, 10);
        term.write("1234567890");
        const renderData = term.getRenderedLines();
        expect(dataTo(renderData)[0]).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]);
    });
    it("2 width char", () => {
        const term = newTerm(3, 10);
        term.write("你好世界");
        const renderData = term.getRenderedLines();
        expect(dataTo(renderData)[0]).toEqual(["你", null, "好", null, "世", null, "界", null]);
    });
    it("mix width char", () => {
        const term = newTerm(3, 20);
        term.write("1你2好3世4界5");
        const renderData = term.getRenderedLines();
        expect(dataTo(renderData)[0]).toEqual([
            "1",
            "你",
            null,
            "2",
            "好",
            null,
            "3",
            "世",
            null,
            "4",
            "界",
            null,
            "5",
        ]);
    });
    it("覆盖 1 on 1", () => {
        const term = newTerm(3, 20);
        term.write("xyzijk");
        term.write(ansiEscapes.cursorTo(0, 0));
        term.write("abc");
        const renderData = term.getRenderedLines();
        expect(dataTo(renderData)[0]).toEqual(["a", "b", "c", "i", "j", "k"]);
    });
    it("覆盖 1 on 2", () => {
        const term = newTerm(3, 20);
        term.write("你好世界");
        term.write(ansiEscapes.cursorTo(0, 0));
        term.write("abc");
        const renderData = term.getRenderedLines();
        expect(dataTo(renderData)[0]).toEqual(["a", "b", "c", " ", "世", null, "界", null]);
    });
    it("覆盖 1 on 2 错位", () => {
        const term = newTerm(3, 20);
        term.write("你好世界");
        term.write(ansiEscapes.cursorTo(1, 0));
        term.write("ab");
        const renderData = term.getRenderedLines();
        expect(dataTo(renderData)[0]).toEqual([" ", "a", "b", " ", "世", null, "界", null]);
    });
    it("覆盖 2 on 1", () => {
        const term = newTerm(3, 20);
        term.write("abcdef");
        term.write(ansiEscapes.cursorTo(1, 0));
        term.write("你好");
        const renderData = term.getRenderedLines();
        expect(dataTo(renderData)[0]).toEqual(["a", "你", null, "好", null, "f"]);
    });
    it("覆盖 2 to 2 单宽字符错位", () => {
        const term = newTerm(3, 20);
        term.write("你好世界");
        term.write(ansiEscapes.cursorTo(0, 0));
        term.write(".再见");
        const renderData = term.getRenderedLines();
        expect(dataTo(renderData)[0]).toEqual([".", "再", null, "见", null, " ", "界", null]);
    });
    it("覆盖 2 to 2 cursor单宽错位", () => {
        const term = newTerm(3, 20);
        term.write("你好世界");
        term.write(ansiEscapes.cursorTo(1, 0));
        term.write("再见");
        const renderData = term.getRenderedLines();
        expect(dataTo(renderData)[0]).toEqual([" ", "再", null, "见", null, " ", "界", null]);
    });
    it("覆盖 2 to 2", () => {
        const term = newTerm(3, 20);
        term.write("你好世界");
        term.write(ansiEscapes.cursorTo(0, 0));
        term.write("再见");
        const renderData = term.getRenderedLines();
        expect(dataTo(renderData)[0]).toEqual(["再", null, "见", null, "世", null, "界", null]);
    });
});

describe("match", () => {
    it("1 width char", async () => {
        (await renderMatcher(3, 10).input("1234567890")).matchAll();
    });
    it("2 width char", async () => {
        (await renderMatcher(3, 10).input("你好世界")).matchAll();
    });
    it("mix width char", async () => {
        (await renderMatcher(3, 20).input("1你2好3世4界5")).matchAll();
    });
    it("覆盖 1 on 2", async () => {
        (await renderMatcher(3, 20).input(`你好${ansiEscapes.cursorTo(0, 0)}a`)).matchAll();
    });
    it("覆盖 1 on 2 错位", async () => {
        (await renderMatcher(3, 20).input(`你好${ansiEscapes.cursorTo(1, 0)}a`)).matchAll();
    });
    it("覆盖 2 on 2 错位", async () => {
        (await renderMatcher(3, 20).input(`你好${ansiEscapes.cursorTo(1, 0)}再见`)).matchAll();
    });
});
