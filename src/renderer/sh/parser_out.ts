export type SemanticColor =
    | "_black"
    | "_red"
    | "_green"
    | "_yellow"
    | "_blue"
    | "_magenta"
    | "_cyan"
    | "_white"
    | "_gray"
    | "_brightRed"
    | "_brightGreen"
    | "_brightYellow"
    | "_brightBlue"
    | "_brightMagenta"
    | "_brightCyan"
    | "_brightWhite"
    | "_default";

export type ShOutputItemText = {
    type: "text";
    text: string;
    style: {
        // see https://terminalguide.namepad.de/attr/
        color?: SemanticColor | string;
        bgColor?: SemanticColor | string;
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        dbunderline?: boolean;
        overline?: boolean;
        dim?: boolean;
        blink?: boolean;
        inverse?: boolean;
        hidden?: boolean;
        strikethrough?: boolean;
    };
};
export type ShOutputItemCursor = {
    type: "cursor";
    row?: { type: "abs" | "rel"; v: number };
    col?: { type: "abs" | "rel"; v: number };
};
export type ShOutputItemScroll = {
    type: "scroll";
    row?: number;
    col?: number;
};
export type ShOutputItemEdit = {
    type: "edit";
    xType: "newLine" | "deleteLineBelowAll" | "deleteLineBelow" | "deleteAll" | "toSpaceLeft" | "toSpaceRight";
};
export type ShOutputItemMode = {
    type: "mode";
    action: "set" | "reset";
    mode: string;
};

//** 不想设计api，提供原始数据（其实稍加解析了一下） */
export type ShOutputItemRaw = {
    type: "raw";
    xType: "esc" | "csi" | "dcs" | "osc";
    pre?: string;
    end?: string;
    ps: string[];
};

export type ShOutputItem =
    | ShOutputItemText
    | ShOutputItemScroll
    | ShOutputItemCursor
    | ShOutputItemEdit
    | ShOutputItemMode
    | ShOutputItemRaw
    | {
          type: "other";
          content: string;
      };

// TermSequence 用于表示扫描后的基础字符块
// type: "seq" 代表这是一个转义序列，后续需要解析
// type: "text" 代表普通字符，可以直接处理
type TermSequence = {
    type: "text" | "seq";
    content: string;
};

function get256Color(code: number): string {
    if (code < 16) {
        if (code <= 7) {
            return getSemanticColor(code + 30);
        }
        return getSemanticColor(code + 82);
    }

    if (code >= 232) {
        const val = Math.round(((code - 232) * 10 + 8) * (255 / 238));
        const hex = val.toString(16).padStart(2, "0");
        return `#${hex}${hex}${hex}`;
    }
    const v = code - 16;
    const r = Math.floor(v / 36);
    const g = Math.floor((v % 36) / 6);
    const b = v % 6;
    const toHex = (n: number) =>
        Math.round((n * 255) / 5)
            .toString(16)
            .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const csiEnd = [
    "A",
    " A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "P",
    "S",
    "T",
    "W",
    "?W",
    "X",
    "Z",
    "a",
    "b",
    "c",
    "d",
    " d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "!p",
    "$p",
    "#p",
    "+p",
    '"p',
    "q",
    "#q",
    '"q',
    " q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
    "@",
    " @",
    "]",
    "^",
    "`",
].sort((a, b) => b.length - a.length);

const oscEnd = ["\x07", "\x1b\\"].sort((a, b) => b.length - a.length);

const dcsEnd = ["\x1b\\"].sort((a, b) => b.length - a.length);

function findSeqEnd(_content: string, endMarkers: string[]): { matchEnd: boolean; deltaPos: number; content: string } {
    const nl = endMarkers;
    let matchEnd = false;
    let content = "";
    let pos = 0;
    o: while (pos < _content.length) {
        const c = _content[pos];
        content += c;
        pos++;
        for (const end of nl) {
            if (content.endsWith(end)) {
                matchEnd = true;
                break o;
            }
        }
    }
    return { matchEnd, deltaPos: pos, content };
}
/**
 * 第一步：将原始字符串拆分为 TermSequence[]
 * 识别出转义序列和其他字符（包括特殊控制字符）
 */
export function tokenize(output: string) {
    const tokens: TermSequence[] = [];
    let restMaySeq = "";
    let pos = 0;

    while (pos < output.length) {
        const char = output[pos];

        const nowStart = pos; // 用于不完整序列返回

        let t: "normal" | "esc" | "csi" | "dcs" | "osc" = "normal";

        if (char === "\x1b") {
            if (output[pos + 1] === "[") {
                t = "csi";
                pos += 2;
            } else if (output[pos + 1] === "]") {
                t = "osc";
                pos += 2;
            } else if (output[pos + 1] === "P") {
                t = "dcs";
                pos += 2;
            } else {
                t = "esc";
                pos++;
            }
        } else if (char === "\x9b") {
            t = "csi";
            pos++;
        } else if (char === "\x9d") {
            t = "osc";
            pos++;
        } else if (char === "\x90") {
            t = "dcs";
            pos++;
        }

        if (t === "csi") {
            const result = findSeqEnd(output.slice(pos), csiEnd);
            pos += result.deltaPos;
            if (result.matchEnd) {
                tokens.push({ type: "seq", content: `\x1b[${result.content}` });
            } else {
                restMaySeq = output.slice(nowStart);
            }
        } else if (t === "osc") {
            const result = findSeqEnd(output.slice(pos), oscEnd);
            pos += result.deltaPos;
            if (result.matchEnd) {
                tokens.push({ type: "seq", content: `\x1b]${result.content}` });
            } else {
                restMaySeq = output.slice(nowStart);
            }
        } else if (t === "dcs") {
            const result = findSeqEnd(output.slice(pos), dcsEnd);
            pos += result.deltaPos;
            if (result.matchEnd) {
                tokens.push({ type: "seq", content: `\x1bP${result.content}` });
            } else {
                restMaySeq = output.slice(nowStart);
            }
        } else if (t === "esc") {
            const first = output[pos];
            if (first) {
                if (first === " ") {
                    const next = output[pos + 1];
                    if (next) {
                        tokens.push({ type: "seq", content: `\x1b ${next}` });
                        pos += 2;
                    } else {
                        restMaySeq = output.slice(nowStart);
                    }
                } else if (["(", ")", "*", "+"].includes(first)) {
                    const next = output[pos + 1];
                    if (next) {
                        if (next === "%" || next === '"') {
                            const third = output[pos + 2];
                            if (third) {
                                tokens.push({ type: "seq", content: `\x1b${first}${next}${third}` });
                                pos += 3;
                            } else {
                                restMaySeq = output.slice(nowStart);
                            }
                        } else {
                            tokens.push({ type: "seq", content: `\x1b${first}${next}` });
                            pos += 2;
                        }
                    } else {
                        restMaySeq = output.slice(nowStart);
                    }
                } else if (["-", ".", "/"].includes(first)) {
                    const third = output[pos + 2];
                    if (third) {
                        tokens.push({ type: "seq", content: `\x1b${first}${third}` });
                        pos += 2;
                    } else {
                        restMaySeq = output.slice(nowStart);
                    }
                } else {
                    tokens.push({ type: "seq", content: `\x1b${first}` });
                    pos++;
                }
            } else {
                restMaySeq = output.slice(nowStart);
            }
        } else {
            if (char === "\n" || char === "\r" || char === "\b") {
                tokens.push({ type: "seq", content: char });
                pos++;
            } else if (char === "\t") {
                tokens.push({ type: "text", content: char });
                pos++;
            }
            // 普通文本
            else {
                let text = "";
                // 连续读取普通字符，直到遇到控制字符或转义序列
                while (pos < output.length) {
                    const c = output[pos];
                    if (["\x1b", "\x9b", "\x9d", "\x90", "\n", "\r", "\b", "\t"].includes(c)) {
                        break;
                    }
                    text += c;
                    pos++;
                }
                if (text.length > 0) {
                    tokens.push({ type: "text", content: text });
                }
            }
        }
    }
    return { tokens, rest: restMaySeq };
}

// 辅助：将 ANSI 代码字符串转为 SemanticColor
function getSemanticColor(code: number): SemanticColor {
    switch (code) {
        case 30:
            return "_black";
        case 31:
            return "_red";
        case 32:
            return "_green";
        case 33:
            return "_yellow";
        case 34:
            return "_blue";
        case 35:
            return "_magenta";
        case 36:
            return "_cyan";
        case 37:
            return "_white";
        case 90:
            return "_gray";
        case 91:
            return "_brightRed";
        case 92:
            return "_brightGreen";
        case 93:
            return "_brightYellow";
        case 94:
            return "_brightBlue";
        case 95:
            return "_brightMagenta";
        case 96:
            return "_brightCyan";
        case 97:
            return "_brightWhite";
        default:
            return "_default";
    }
}

/**
 * 辅助函数：应用 SGR 参数到样式对象
 */
function applySgr(style: ShOutputItemText["style"], params: number[]) {
    let i = 0;
    while (i < params.length) {
        const code = params[i];
        if (code === 0) {
            style.color = undefined;
            style.bgColor = undefined;
            style.bold = false;
            style.italic = false;
            style.underline = false;
            style.dbunderline = false;
            style.overline = false;
            style.dim = false;
            style.blink = false;
            style.inverse = false;
            style.hidden = false;
            style.strikethrough = false;
        } else if (code === 1) style.bold = true;
        else if (code === 2) style.dim = true;
        else if (code === 3) style.italic = true;
        else if (code === 4) style.underline = true;
        else if (code === 5) style.blink = true;
        else if (code === 7) style.inverse = true;
        else if (code === 8) style.hidden = true;
        else if (code === 9) style.strikethrough = true;
        else if (code === 21) style.dbunderline = true;
        else if (code === 22) {
            style.bold = false;
            style.dim = false;
        } else if (code === 23) style.italic = false;
        else if (code === 24) {
            style.underline = false;
            style.dbunderline = false;
        } else if (code === 25) style.blink = false;
        else if (code === 27) style.inverse = false;
        else if (code === 28) style.hidden = false;
        else if (code === 29) style.strikethrough = false;
        else if (code === 53) style.overline = true;
        else if (code === 55) style.overline = false;
        // Foreground
        else if (code >= 30 && code <= 37) style.color = getSemanticColor(code);
        else if (code >= 90 && code <= 97) style.color = getSemanticColor(code);
        // Background
        else if (code >= 40 && code <= 47)
            style.bgColor = getSemanticColor(code - 10); // 40->30
        else if (code >= 100 && code <= 107)
            style.bgColor = getSemanticColor(code - 10); // 100->90
        else if (code === 38 || code === 48) {
            if (params[i + 1] === 5) {
                // 256色
                const idx = params[i + 2];
                if (idx !== undefined) {
                    if (code === 38) style.color = get256Color(idx);
                    else style.bgColor = get256Color(idx);
                    i += 2;
                }
            } else if (params[i + 1] === 2) {
                // RGB
                const r = params[i + 2];
                const g = params[i + 3];
                const b = params[i + 4];
                if (r !== undefined) {
                    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
                    if (code === 38) style.color = hex;
                    else style.bgColor = hex;
                    i += 4;
                }
            }
        } else if (code === 39) {
            style.color = "_default";
        } else if (code === 49) {
            style.bgColor = "_default";
        }
        i++;
    }
}

function parseCSIContent(content: string): number[] {
    const match = content.match(/([\d;]*)/);
    if (match) {
        // 提取数字并转为整数数组
        const paramsStr = match[1];
        const params = paramsStr
            .split(";")
            .map((p) => Number.parseInt(p, 10))
            .filter((n) => !Number.isNaN(n));
        // 如果为空，视为 0 (重置)
        if (params.length === 0 && paramsStr === "") params.push(0);
        return params;
    }
    return [];
}

function processToken(
    token: TermSequence,
    currentStyle: ShOutputItemText["style"],
): { items: ShOutputItem[]; style?: ShOutputItemText["style"] } {
    if (token.type === "seq") {
        // 解析序列内容，提取参数
        // 格式通常是 \x1b[...m
        // 我们需要提取 [...] 中的数字
        let t: "esc" | "csi" | "dcs" | "osc" | "c01" = "c01";
        let x = token.content;
        if (token.content.startsWith("\x1b[")) {
            t = "csi";
            x = token.content.slice(2);
        } else if (token.content.startsWith("\x1bP")) {
            t = "dcs";
            x = token.content.slice(2);
        } else if (token.content.startsWith("\x1b]")) {
            t = "osc";
            x = token.content.slice(2);
        } else if (token.content.startsWith("\x1b")) {
            t = "esc";
            x = token.content.slice(1);
        }
        let last = "";
        if (t === "csi") {
            const l = csiEnd.find((end) => x.endsWith(end));
            if (!l) return { items: [{ type: "other", content: token.content }], style: currentStyle };
            last = l;
            x = x.slice(0, x.length - l.length);
            const params = parseCSIContent(x);
            // 处理 SGR (m) 指令
            if (last === "m") {
                applySgr(currentStyle, params);
                return { items: [], style: currentStyle };
            }
            if (last === "h") {
                const p = x.startsWith("?") ? parseCSIContent(x.slice(1)) : params;
                return {
                    items: p.map((mode) => ({
                        type: "mode",
                        action: "set",
                        mode: x.startsWith("?") ? `?${mode}` : `${mode}`,
                    })),
                };
            }
            if (last === "l") {
                const p = x.startsWith("?") ? parseCSIContent(x.slice(1)) : params;
                return {
                    items: p.map((mode) => ({
                        type: "mode",
                        action: "reset",
                        mode: x.startsWith("?") ? `?${mode}` : `${mode}`,
                    })),
                };
            }
            if (last === "A") {
                return {
                    items: [
                        {
                            type: "cursor",
                            row: { type: "rel", v: -(params[0] || 1) },
                        },
                    ],
                };
            }
            if (last === "B") {
                return {
                    items: [
                        {
                            type: "cursor",
                            row: { type: "rel", v: params[0] || 1 },
                        },
                    ],
                };
            }
            if (last === "C") {
                return {
                    items: [
                        {
                            type: "cursor",
                            col: { type: "rel", v: params[0] || 1 },
                        },
                    ],
                };
            }
            if (last === "D") {
                return {
                    items: [
                        {
                            type: "cursor",
                            col: { type: "rel", v: -(params[0] || 1) },
                        },
                    ],
                };
            }
            if (last === "E") {
                return {
                    items: [
                        {
                            type: "cursor",
                            row: { type: "rel", v: params[0] || 1 },
                            col: { type: "abs", v: 0 },
                        },
                    ],
                };
            }
            if (last === "F") {
                return {
                    items: [
                        {
                            type: "cursor",
                            row: { type: "rel", v: -(params[0] || 1) },
                            col: { type: "abs", v: 0 },
                        },
                    ],
                };
            }
            if (last === "G" || last === "`") {
                return {
                    items: [
                        {
                            type: "cursor",
                            col: { type: "abs", v: (params[0] || 1) - 1 },
                        },
                    ],
                };
            }
            if (last === "H") {
                return {
                    items: [
                        {
                            type: "cursor",
                            row: { type: "abs", v: (params[0] || 1) - 1 },
                            col: { type: "abs", v: (params[1] || 1) - 1 },
                        },
                    ],
                };
            }
            if (last === "I") {
                return {
                    items: [
                        {
                            type: "text",
                            text: "    ".repeat(params[0] || 1),
                            style: { ...currentStyle },
                        },
                    ],
                };
            }
            if (last === "J") {
                // todo
                const p = params[0] || 0;
                if (p === 0) {
                    return {
                        items: [
                            { type: "edit", xType: "toSpaceRight" },
                            { type: "edit", xType: "deleteLineBelowAll" },
                        ],
                    };
                }
                if (p === 1) {
                }
                if (p === 2) {
                    return {
                        items: [{ type: "edit", xType: "deleteAll" }],
                    };
                }
                if (p === 3) {
                }
                return { items: [{ type: "other", content: token.content }] };
            }
            if (last === "K") {
                const p = params[0] || 0;
                if (p === 0) {
                    return {
                        items: [{ type: "edit", xType: "toSpaceRight" }],
                    };
                }
                if (p === 1) {
                    return {
                        items: [{ type: "edit", xType: "toSpaceLeft" }],
                    };
                }
                if (p === 2) {
                    return {
                        items: [{ type: "edit", xType: "deleteLineBelow" }],
                    };
                }
                return { items: [{ type: "other", content: token.content }] };
            }
            if (last === "c") {
                return {
                    items: [{ type: "raw", xType: "csi", ps: params.map((i) => String(i)), end: "c" }],
                };
            }
        }
        if (t === "esc") {
            if (x === "7") {
                return {
                    items: [{ type: "raw", xType: "esc", end: "7", ps: [] }],
                };
            }
            if (x === "8") {
                return {
                    items: [{ type: "raw", xType: "esc", end: "8", ps: [] }],
                };
            }
        }
        if (t === "c01") {
            if (token.content === "\n") {
                return {
                    items: [{ type: "edit", xType: "newLine" }],
                };
            }
            if (token.content === "\r") {
                return {
                    items: [
                        {
                            type: "cursor",
                            col: { type: "abs", v: 0 },
                        },
                    ],
                };
            }
            if (token.content === "\b") {
                return {
                    items: [
                        {
                            type: "cursor",
                            col: { type: "rel", v: -1 },
                        },
                    ],
                };
            }
        }
    } else if (token.type === "text") {
        const content = token.content;

        if (content === "\t") {
            return {
                items: [
                    {
                        type: "text",
                        text: "    ",
                        style: { ...currentStyle },
                    },
                ],
            };
        }
        return { items: [{ type: "text", text: content, style: { ...currentStyle } }] };
    }
    return { items: [{ type: "other", content: token.content }] };
}

function processTokens(tokens: TermSequence[]): ShOutputItem[] {
    const items: ShOutputItem[] = [];
    let currentStyle: ShOutputItemText["style"] = {
        bold: false,
        italic: false,
        underline: false,
        dim: false,
        blink: false,
        inverse: false,
        hidden: false,
        strikethrough: false,
    };

    // 逐个 Token 处理
    for (const token of tokens) {
        const result = processToken(token, structuredClone(currentStyle));
        items.push(...result.items);
        if (result.style) currentStyle = result.style;
    }
    return items;
}

/**
 * 主函数：分层处理
 */
export function parseOut(output: string) {
    // 第一层：拆分字符串
    const tokens = tokenize(output);

    // 第二层：解析序列并生成样式
    const items = processTokens(tokens.tokens);
    return { items, rest: tokens.rest };
}

export function key2seq(keyevent: KeyboardEvent): string {
    let seq = "";
    if (keyevent.ctrlKey) {
        const key = keyevent.key.toUpperCase();
        if (key.length === 1 && key >= "A" && key <= "Z") {
            seq += String.fromCharCode(key.charCodeAt(0) - 64);
        } else if (key === " ") {
            seq += String.fromCharCode(0);
        } else if (key === "[") {
            seq += String.fromCharCode(27);
        } else if (key === "\\") {
            seq += String.fromCharCode(28);
        } else if (key === "]") {
            seq += String.fromCharCode(29);
        } else if (key === "^") {
            seq += String.fromCharCode(30);
        } else if (key === "_") {
            seq += String.fromCharCode(31);
        }
    } else {
        if (keyevent.key === "Enter") {
            seq += "\r";
        } else if (keyevent.key === "Backspace") {
            seq += "\x7f";
        } else if (keyevent.key === "Tab") {
            seq += "\t";
        } else if (keyevent.key.startsWith("Arrow")) {
            if (keyevent.key === "ArrowUp") {
                seq += "\x1b[A";
            } else if (keyevent.key === "ArrowDown") {
                seq += "\x1b[B";
            } else if (keyevent.key === "ArrowRight") {
                seq += "\x1b[C";
            } else if (keyevent.key === "ArrowLeft") {
                seq += "\x1b[D";
            }
        }
    }
    return seq;
}
