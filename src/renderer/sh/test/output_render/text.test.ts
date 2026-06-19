import { describe, it } from "vitest";
import { renderMatcher } from "./match";

describe("text", () => {
    it("1 width char", async () => {
        (await renderMatcher(3, 10).input("1234567890")).matchAll();
    });
    it("2 width char", async () => {
        (await renderMatcher(3, 10).input("你好世界")).matchAll();
    });
    it("mix width char", async () => {
        (await renderMatcher(3, 20).input("1你2好3世4界5")).matchAll();
    });
});
