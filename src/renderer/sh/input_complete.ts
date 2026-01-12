import { tryX } from "../try";
import { unParseItemValue, type ShInputItem2 } from "./parser_in";
import { pathMatchCursor } from "./path_match_cursor";

import Fuse from "fuse.js";

const path = require("node:path") as typeof import("node:path");

type InputTipItem = {
    show: string;
    x: string;
    des: string;
    match?: { start: number; end: number }[];
    cursorOffset?: number;
};
export type InputTip = InputTipItem[];
type InputTipPart = (Omit<InputTipItem, "show"> & { show?: string })[];

export type InputTipSys = {
    cwd: string;
    allCommands: () => string[];
    readDirSync: (p: string) => string[];
    statSync: (p: string) => {
        isDirectory(): boolean;
    } | null;
    isExeSync: (p: string) => boolean;
};

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

export function fillPath(
    matchParseItem: ShInputItem2,
    /** 相对项目原始输入 */
    offset: number,
    sys: InputTipSys,
    _map?: (file: string, path: string, content: InputTip[0]) => InputTip,
) {
    const { input: raw, value: curValue } = matchParseItem;
    const res: (Omit<InputTipItem, "show"> & { show?: string })[] = [];

    const map = _map ?? ((_, __, c) => [c]);

    const yinhao = (raw.startsWith('"') || raw.startsWith("'") ? raw[0] : "") as `"` | `'` | "";
    if (
        !curValue.endsWith(path.sep) &&
        ((matchParseItem.type === "arg" && !matchParseItem.chindren) || matchParseItem.type === "main") // todo 放到外部判断
    ) {
        // 点文件特殊处理
        if (curValue.split(path.sep).at(-1) !== ".") {
            const stat = sys.statSync(path.isAbsolute(curValue) ? curValue : path.join(sys.cwd, curValue));
            if (curValue && stat?.isDirectory()) {
                // 下面的应该只有一个，会默认推上去
                res.push({ x: `${curValue}${path.sep}`, des: "" });
                return res;
            }
        } else {
            res.push({ x: `${curValue}${path.sep}`, des: "" });
        }
    }
    // offset是原始输入的偏移，所以需要传入 raw 路径
    // 路径判断根据path.sep来分割，不用考虑转义与否
    // 但返回值需要考虑转义
    const { basePath: _basePath, focusPart: _focusPart } = pathMatchCursor(
        yinhao ? curValue : raw,
        offset - yinhao.length,
    );

    // todo 这里有点问题，应该根据转义来处理
    const basePath = yinhao ? _basePath : _basePath.replaceAll("\\", "");
    const focusPart = yinhao ? _focusPart : _focusPart.replaceAll("\\", "");

    // 空表示从 cwd 开始，即相对路径
    const p = path.normalize(
        basePath === "" ? sys.cwd : path.isAbsolute(basePath) ? basePath : path.join(sys.cwd, basePath),
    );
    const dir = tryX(() => sys.readDirSync(p))[0] ?? [];
    const ndir = focusPart.startsWith(".") ? dir : dir.filter((i) => !i.startsWith("."));
    const fuse = new Fuse(ndir, { includeMatches: true });
    const r = fuse.search(focusPart);
    if (focusPart.length === 0) {
        // 全部列出
        for (const file of ndir) {
            const nPath = curValue ? basePath + file : file;
            res.push(
                ...map(file, path.join(p, file), {
                    show: file,
                    x: nPath,
                    des: "",
                }),
            );
        }
    } else {
        for (const { item: file, matches } of r) {
            const nPath = curValue ? basePath + file : file;
            res.push(
                ...map(file, path.join(p, file), {
                    show: file,
                    x: nPath,
                    des: "",
                    match: matches?.map((i) => ({ start: i.indices[0][0], end: i.indices[0][1] + 1 })),
                }),
            );
        }
    }
    return res;
}

export async function loadFigSpec(command: string, pathModule = "../../../node_modules/@withfig/autocomplete") {
    if (dataCache.has(command)) {
        return;
    }
    try {
        const x = await import(`${pathModule}/build/${command}.js`);
        const s = x.default as Fig.Spec;
        dataCache.set(command, s);
    } catch (e) {
        console.error(e);
    }
}

export function getFigSpec(command: string) {
    return dataCache.get(command);
}

export function getFigSpecList(
    parse: ShInputItem2[],
    matchItem: ShInputItem2,
    sys: InputTipSys,
): { state: "not_found" | "found"; list: InputTipPart } {
    // 假设parse没有嵌套
    const main = parse.find((i) => i.type === "main");
    if (!main) return { state: "not_found", list: [] };
    const cmd = main.value;
    loadFigSpec(cmd);
    const spec = getFigSpec(cmd);
    if (!spec) return { state: "not_found", list: [] };
    const beforeArgs = parse.slice(
        0,
        parse.findIndex((i) => i === matchItem),
    );
    const thisItem = matchItem.type === "arg" ? matchItem : null;
    const beforeArgsList = beforeArgs.filter((i) => i.type === "arg").map((i) => i.value);
    const res: InputTipPart = [];
    let currentSpec = [...("subcommands" in spec ? (spec.subcommands ?? []) : [])];
    let currentOptions = "options" in spec ? (spec.options ?? []) : [];
    for (const ba of beforeArgsList) {
        if (ba.startsWith("-")) continue; // todo option
        const sc = currentSpec.find((s) => {
            if (typeof s.name === "string") {
                return s.name === ba;
            }
            return s.name.includes(ba);
        });
        if (sc) {
            if (sc.subcommands) {
                currentSpec = sc.subcommands;
            } else {
                if (sc.options) {
                    currentOptions = sc.options;
                }
                currentSpec = [];
            }
        }
    }

    if (!thisItem?.value) {
        for (const sc of currentSpec) {
            if (typeof sc.name === "string") {
                res.push({ x: sc.name, des: sc.description ?? "" });
            } else {
                for (const alias of sc.name) res.push({ x: alias, des: sc.description ?? "" });
            }
        }
    } else {
        for (const sc of currentSpec) {
            if (typeof sc.name === "string") {
                if (sc.name.startsWith(thisItem.value)) {
                    res.push({ x: sc.name, des: sc.description ?? "" });
                }
            } else {
                for (const alias of sc.name) {
                    if (alias.startsWith(thisItem.value)) {
                        res.push({ x: alias, des: sc.description ?? "" });
                    }
                }
            }
        }
        if (thisItem.value.startsWith("-"))
            for (const op of currentOptions) {
                if (typeof op.name === "string") {
                    if (op.name.startsWith(thisItem.value)) {
                        res.push({ x: op.name, des: op.description ?? "" });
                    }
                } else {
                    for (const alias of op.name) {
                        if (alias.startsWith(thisItem.value)) {
                            res.push({ x: alias, des: op.description ?? "" });
                        }
                    }
                }
            }
    }
    return { state: "found", list: res };
}

export function getTip(
    parse: ShInputItem2[],
    _cursorStart: number,
    _cursorEnd: number,
    sys: InputTipSys,
): { list: InputTip; pre: string; last: string } {
    const res: InputTipPart = [];

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

    if (matchParseItem.type === "main" || !matchParseListRaw.find((i) => i.type === "main")) {
        if (curValue) {
            if (curValue.startsWith(".") || path.isAbsolute(curValue)) {
                res.push(
                    ...fillPath(matchParseItem, cursorStart - curPosStart, sys, (_, p, c) => {
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
                    }),
                );
            }
        }
        const l = sys.allCommands();
        const fuse = new Fuse(l, { includeMatches: true });
        const r = fuse.search(curValue);
        if (curValue.length === 0) {
            for (const cmd of l) {
                res.push({ x: cmd, des: "" });
            }
        } else {
            for (const cmd of r) {
                res.push({
                    x: cmd.item,
                    match: cmd.matches?.map((i) => ({ start: i.indices[0][0], end: i.indices[0][1] + 1 })),
                    des: "",
                });
            }
        }
    } else {
        const figRes = getFigSpecList(parse, matchParseItem, sys);
        if (figRes.state === "found") {
            res.push(...figRes.list);
        } else
            res.push(
                ...fillPath(matchParseItem, cursorStart - curPosStart, sys, (_, p, c) => {
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
                }),
            );
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

const dataCache = new Map<string, Fig.Spec>();
