import { expect, it } from "vitest";
import { parseIn, unParseItemValue } from "../parser_in";
import { describe } from "node:test";

function re(itemValue: string, t: `"` | `'` | "") {
    const unparse = unParseItemValue(itemValue, t);
    const parse = parseIn(unparse);
    expect(parse.length).toBe(1);
    expect(parse[0].value).toBe(itemValue);
}

describe("输入反解析", () => {
    describe("引号", () => {
        it("空格", () => {
            re("a b", "'");
        });
        it("引号内引号", () => {
            re(`a'b'c`, "'");
        });
        it("引号内转义引号", () => {
            re(`a'b\\'c`, "'");
        });
        it("引号内双反斜杠", () => {
            re(`a'b\\\\'c`, "'");
        });
        it("\\", () => {
            re("abc\\", "'");
        });
    });
    describe("一般", () => {});
});
