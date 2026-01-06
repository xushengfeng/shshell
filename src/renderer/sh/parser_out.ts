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
};

export type ShOutputItem = ShOutputItemText | ShOutputItemCursor;

// TermSequence 用于表示扫描后的基础字符块
// type: "seq" 代表这是一个转义序列，后续需要解析
// type: "text" 代表普通字符、回车、退格等，可以直接处理
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

/**
 * 第一步：将原始字符串拆分为 TermSequence[]
 * 识别出转义序列和其他字符（包括特殊控制字符）
 */
export function tokenize(output: string): TermSequence[] {
    const tokens: TermSequence[] = [];
    let pos = 0;

    while (pos < output.length) {
        const char = output[pos];

        // 1. 检测转义序列开始 (CSI: ESC[ 或 0x9B)
        if (char === "\x1b" || char === "\x9b") {
            pos++; // 跳过 ESC
            let content = char;

            // 检查是否是 [ 开头 (CSI)
            if (pos < output.length && output[pos] === "[") {
                content += output[pos];
                pos++;
                // 读取直到遇到 SGR 终止符 'm' 或其他标准终止符 (A-Z, a-z)
                // 注意：有些复杂序列可能包含中间字节，这里简化处理
                while (pos < output.length) {
                    const c = output[pos];
                    content += c;
                    pos++;
                    // 终止条件：字母(m, H, J等) 或 响铃
                    if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "\x07") {
                        break;
                    }
                }
                tokens.push({ type: "seq", content });
            } else {
                // 如果 ESC 后面不是 [，可能是其他简单序列（如 ESC \）
                // 或者此时就结束。这里我们暂时将其作为一个整体 seq 处理，
                // 或者如果无法解析，可以视为文本（通常会被忽略）。
                // 为兼容性，我们直接按 seq 吞掉。
                // 如果这是一个单独的 ESC 字符，它通常会被终端忽略，这里我们忽略它。
                // 如果后面还有内容，可能需要回退 pos，但为了简单，我们只吞掉 ESC。
                // 如果我们需要处理如 `ESC \` (String Terminator)，上面的逻辑需要调整。
                tokens.push({ type: "seq", content: char });
            }
        }
        // 2. 处理特殊控制字符（换行、回车、退格等）
        // 我们将它们放入 text 类型的 token 中，因为它们直接影响显示内容
        else if (char === "\n" || char === "\r" || char === "\b" || char === "\t") {
            // 为了保持每一步的原子性，这里每次只处理一个字符
            // 后续解析器会处理这些特殊的 text token
            tokens.push({ type: "text", content: char });
            pos++;
        }
        // 3. 普通文本
        else {
            let text = "";
            // 连续读取普通字符，直到遇到控制字符或转义序列
            while (pos < output.length) {
                const c = output[pos];
                if (c === "\x1b" || c === "\x9b" || c === "\n" || c === "\r" || c === "\b" || c === "\t") {
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
    return tokens;
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

/**
 * 第二步：处理 TermSequence[]，生成 ShOutputItem[]
 * 这一步负责处理行内逻辑（回车覆盖、退格删除）
 */
function processTokens(tokens: TermSequence[]): ShOutputItem[] {
    const items: ShOutputItem[] = [];
    const currentStyle: ShOutputItemText["style"] = {
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
        if (token.type === "seq") {
            // 解析序列内容，提取参数
            // 格式通常是 \x1b[...m
            // 我们需要提取 [...] 中的数字
            // biome-ignore lint/suspicious/noControlCharactersInRegex:
            const match = token.content.match(/\x1b\[([\d;]*)m/);
            if (match) {
                // 提取数字并转为整数数组
                const paramsStr = match[1];
                const params = paramsStr
                    .split(";")
                    .map((p) => Number.parseInt(p, 10))
                    .filter((n) => !Number.isNaN(n));
                // 如果为空，视为 0 (重置)
                if (params.length === 0 && paramsStr === "") params.push(0);
                applySgr(currentStyle, params);
            } else {
                // 忽略非 SGR 序列（如光标移动）
            }
        } else if (token.type === "text") {
            const content = token.content;

            // 处理特殊控制字符需要单独逻辑，因为它们不生成样式，而是修改缓冲区
            if (content === "\n") {
                items.push({
                    type: "text",
                    text: "\n",
                    style: {},
                });
            } else if (content === "\r") {
                items.push({
                    type: "text",
                    text: "\r",
                    style: {},
                });
            } else if (content === "\b") {
                // 退格：删除一个字符
                if (items.length > 0) {
                    const lastItem = items[items.length - 1];
                    if (lastItem.type === "text") {
                        if (lastItem.text.length > 1) {
                            lastItem.text = lastItem.text.slice(0, -1);
                        } else {
                            items.pop(); // 删除这个 item
                        }
                    }
                }
            } else if (content === "\t") {
                if (!currentStyle.inverse && !currentStyle.hidden) {
                    items.push({
                        type: "text",
                        text: "\t",
                        style: { ...currentStyle },
                    });
                }
            } else {
                // 普通文本：直接推入
                // 注意：如果上一个 item 的样式和当前一样，应该合并
                if (content.length > 0) {
                    if (items.length > 0 && items[items.length - 1].type === "text") {
                        const prev = items[items.length - 1] as ShOutputItemText;
                        if (JSON.stringify(prev.style) === JSON.stringify(currentStyle)) {
                            prev.text += content;
                        } else {
                            items.push({ type: "text", text: content, style: { ...currentStyle } });
                        }
                    } else {
                        items.push({ type: "text", text: content, style: { ...currentStyle } });
                    }
                }
            }
        }
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
    const items = processTokens(tokens);
    return items;
}
