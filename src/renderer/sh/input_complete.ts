import { tryX } from "../try";
import { unParseItemValue, type ShInputItem2 } from "./parser_in";
import { pathMatchCursor } from "./path_match_cursor";

const path = require("node:path") as typeof import("node:path");

type InputTipItem = { show: string; x: string; des: string; cursorOffset?: number };
export type InputTip = InputTipItem[];

export function matchItem(parse: ShInputItem2[], cursorPos: number) {
    // 表示层级，方便处理嵌套
    // list包括同时接触的所有节点，一般为0，1，2个（2个时为一个item一个blank）
    const d: {
        list: ShInputItem2[];
        raw: ShInputItem2[];
    }[] = [];
    let nowList: ShInputItem2[] | null = parse;
    while (nowList !== null && nowList.length > 0) {
        let count = 0;
        const matchList: ShInputItem2[] = [];
        const rawList = nowList;
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
        d.push({ list: matchList, raw: rawList });
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
    const res: (Omit<InputTipItem, "show"> & { show?: string })[] = [];

    const input = parse.map((i) => i.input).join("");
    const cursorStart = Math.min(_cursorStart, input.length);
    const cursorEnd = Math.min(_cursorEnd, input.length);
    const pos = Math.min(cursorStart, cursorEnd);

    const matchList = matchItem(parse, pos).d;
    const matchParseList = matchList.at(-1)?.list ?? [];
    const matchParseListRaw = matchList.at(-1)?.raw ?? [];

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
    function fillPath(
        curValue: string,
        raw: string,
        offset: number,
        map: (file: string, path: string, content: InputTip[0]) => InputTip,
    ) {
        const yinhao = (raw.startsWith('"') || raw.startsWith("'") ? raw[0] : "") as `"` | `'` | "";
        if (
            !curValue.endsWith(path.sep) &&
            ((matchParseItem.type === "arg" && !matchParseItem.chindren) || matchParseItem.type === "main")
        ) {
            // 点文件特殊处理
            if (curValue.split(path.sep).at(-1) !== ".") {
                const stat = sys.statSync(path.isAbsolute(curValue) ? curValue : path.join(sys.cwd, curValue));
                if (curValue && stat?.isDirectory()) {
                    // 下面的应该只有一个，会默认推上去
                    res.push({ x: `${curValue}${path.sep}`, des: "" });
                    return;
                }
            } else {
                res.push({ x: `${curValue}${path.sep}`, des: "" });
            }
        }
        const { basePath, focusPart } = pathMatchCursor(curValue, offset - yinhao.length);

        // 空表示从 cwd 开始，即相对路径
        const p = path.normalize(
            basePath === "" ? sys.cwd : path.isAbsolute(basePath) ? basePath : path.join(sys.cwd, basePath),
        );
        const [dir] = tryX(() => sys.readDirSync(p));
        for (const file of dir ?? []) {
            if (!file.startsWith(focusPart)) continue; // todo 模糊
            const nPath = curValue ? basePath + file : file;
            res.push(
                ...map(file, path.join(p, file), {
                    show: file,
                    x: nPath,
                    des: "",
                }),
            );
        }
    }

    if (matchParseItem.type === "main" || !matchParseListRaw.find((i) => i.type === "main")) {
        if (curValue) {
            if (curValue.startsWith(".") || path.isAbsolute(curValue)) {
                fillPath(curValue, matchParseItem.input, cursorStart - curPosStart, (_, p, c) => {
                    const stat = sys.statSync(path.join(p));
                    if (!stat) {
                        return [{ ...c, des: "error" }];
                    }
                    if (stat.isDirectory()) {
                        return [{ ...c, des: "dir" }];
                    }
                    if (sys.isExeSync(path.join(p))) {
                        return [{ ...c, des: "file" }];
                    }
                    return [];
                });
            }
        }
        const l = sys.allCommands();
        for (const cmd of l) {
            if (cmd.startsWith(cur)) {
                res.push({ x: cmd, des: "" });
            }
        }
    } else {
        fillPath(curValue, matchParseItem.input, cursorStart - curPosStart, (_, p, c) => {
            const stat = sys.statSync(p);
            if (!stat) {
                return [{ ...c, des: "error" }];
            }
            if (stat.isDirectory()) {
                return [{ ...c, des: "dir" }];
            }
            if (p) {
                return [{ ...c, des: "file" }];
            }
            return [];
        });
    }
    const yinhao = (cur.startsWith('"') || cur.startsWith("'") ? cur[0] : "") as `"` | `'` | "";
    return {
        list: res.slice(0, 500).map((i) => {
            const ni = { show: "", ...i };
            if (i.show === undefined) ni.show = ni.x;
            ni.x = unParseItemValue(ni.x, yinhao);
            // todo 应该有其他标记
            if (ni.des !== "file" && yinhao) {
                ni.cursorOffset = -1;
            }
            return ni;
        }),
        pre,
        last,
    };
}
