import { tryX } from "../try";
import type { ShInputItem2 } from "./parser_in";
import { pathMatchCursor } from "./path_match_cursor";

const path = require("node:path") as typeof import("node:path");

export type InputTip = { show?: string; x: string; des: string }[];

export function matchItem(
    parse: ShInputItem2[],
    cursorPos: number,
): {
    d: {
        list: ShInputItem2[];
    }[];
} {
    // 表示层级，方便处理嵌套
    // list包括同时接触的所有节点，一般为0，1，2个（2个时为一个item一个blank）
    const d: {
        list: ShInputItem2[];
    }[] = [];
    let nowList: ShInputItem2[] | null = parse;
    while (nowList !== null && nowList.length > 0) {
        let count = 0;
        const matchList: ShInputItem2[] = [];
        for (const item of nowList) {
            // todo 性能优化？
            if (item.start <= cursorPos && item.end >= cursorPos) {
                if (item.type === "arg" && item.chindren) {
                    nowList = item.chindren;
                } else nowList = null;
                matchList.push(item);
                count++;
                if (count >= 2) break;
            }
        }
        d.push({ list: matchList });
    }
    return { d };
}

export function getTip(
    parse: ShInputItem2[],
    _cursorStart: number,
    _cursorEnd: number,
    sys: {
        cwd: string;
        allCommands: () => string[];
        readDirSync: (p: string) => string[];
        statSync: (p: string) => {
            isDirectory(): boolean;
        } | null;
        isExeSync: (p: string) => boolean;
    },
): { list: InputTip; pre: string; last: string } {
    const res: InputTip = [];

    const input = parse.map((i) => i.input).join("");
    const cursorStart = Math.min(_cursorStart, input.length);
    const cursorEnd = Math.min(_cursorEnd, input.length);
    const pos = Math.min(cursorStart, cursorEnd);

    const matchList = matchItem(parse, pos).d;
    const matchParseList = matchList.at(-1)?.list ?? [];

    const matchParseItem = matchParseList.find((i) => i.type === "arg" || i.type === "main") ?? {
        type: "blank",
        input: "",
        value: "",
        start: pos,
        end: pos,
    };

    const curPosStart = matchParseItem.start;
    const curPosEnd = matchParseItem.end;
    const pre = input.slice(0, curPosStart);
    const last = input.slice(curPosEnd);
    const cur = input.slice(curPosStart, curPosEnd);
    const curValue = matchParseItem.value;

    console.log({ pre, cur, curValue, last, matchParseItem, parse });

    if (matchParseItem.type === "main" || !matchParseList.find((i) => i.type === "main")) {
        if (curValue) {
            if (curValue.startsWith(".") || path.isAbsolute(curValue)) {
                // is path
                const { basePath, focusPart, p } = pathMatchCursor(curValue, cursorStart - curPosStart, sys.cwd);
                const [dir] = tryX(() => sys.readDirSync(p)); // todo 如果是文件呢
                for (const file of dir ?? []) {
                    if (!file.startsWith(focusPart)) continue; // todo 模糊
                    const nFile = file.replaceAll(" ", "\\ ").replaceAll("'", "\\'").replaceAll('"', '\\"');
                    const stat = sys.statSync(path.join(p, file));
                    const nPath = curValue ? path.join(basePath, nFile) : nFile;
                    if (!stat) {
                        res.push({ show: file, x: nPath, des: "error" });
                    } else if (stat.isDirectory()) {
                        res.push({ show: file, x: nPath, des: "dir" });
                    } else {
                        if (sys.isExeSync(path.join(p, file))) {
                            res.push({ show: file, x: nPath, des: "file" });
                        }
                    }
                }
            }
        }
        const l = sys.allCommands();
        for (const cmd of l) {
            if (cmd.startsWith(cur)) {
                res.push({ x: cmd, des: "" });
            }
        }
    } else {
        // is path
        if (!matchParseItem.input.endsWith(path.sep) && matchParseItem.type === "arg" && !matchParseItem.chindren) {
            const stat = sys.statSync(path.isAbsolute(cur) ? cur : path.join(sys.cwd, cur));
            if (stat?.isDirectory()) return { list: [{ x: `${cur}${path.sep}`, des: "" }], pre, last };
        }
        const { basePath, focusPart, p } = pathMatchCursor(cur, cursorStart - curPosStart, sys.cwd);
        const [dir] = tryX(() => sys.readDirSync(p));
        for (const file of dir ?? []) {
            if (!file.startsWith(focusPart)) continue; // todo 模糊
            const nFile = file.replaceAll(" ", "\\ ").replaceAll("'", "\\'").replaceAll('"', '\\"');
            const stat = sys.statSync(path.join(p, file));
            const nPath = cur ? path.join(basePath, nFile) : nFile;
            if (!stat) {
                res.push({ show: file, x: nPath, des: "error" });
            } else if (stat.isDirectory()) {
                res.push({ show: file, x: nPath, des: "dir" });
            } else {
                res.push({ show: file, x: nPath, des: "file" });
            }
        }
    }
    return { list: res.slice(0, 500), pre, last };
}
