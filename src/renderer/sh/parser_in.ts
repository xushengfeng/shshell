export type ShInputItem = {
    input: string;
    value: string;
    start: number;
    end: number;
    protected?: boolean; // 是否被引号保护 实际可以通过input和value对比得出，这里方便
} & (
    | {
          type: "item" | "blank" | "ignore" | "()";
      }
    | {
          type: "sub";
          chindren: ShInputItem[];
      }
);

export type ShInputItem2 = {
    type: "main" | "arg" | "blank" | "ignore" | "other";
    input: string;
    value: string;
    start: number;
    end: number;
    protected?: boolean; // 是否被引号保护 实际可以通过input和value对比得出，这里方便
} & (
    | {
          type: "main" | "blank" | "ignore" | "other";
      }
    | {
          type: "arg";
          chindren?: ShInputItem2[];
      }
);

export function parseInFlat(command: string): ShInputItem[] {
    const result: ShInputItem[] = [];
    const len = command.length;
    let i = 0;

    while (i < len) {
        const char = command[i];

        if (char === " " || char === "\t" || char === "\n") {
            const start = i;
            let input = "";
            while (i < len && (command[i] === " " || command[i] === "\t" || command[i] === "\n")) {
                input += command[i];
                i++;
            }
            result.push({
                type: "blank",
                input,
                value: " ".repeat(input.length),
                start,
                end: start + input.length,
            });
            continue;
        }

        const start = i;
        const tokenInputParts: string[] = [];
        const tokenValueParts: string[] = [];
        let isYinhao = false;

        if ((char === `'` || char === `"`) && (command[i - 1] === " " || i === 0)) {
            isYinhao = true;
            tokenInputParts.push(char);
            i++;

            for (let n = i; n < len; n++) {
                if (command[n] === char) {
                    if (command[n - 1] === "\\") {
                        if (command[n - 2] === "\\") {
                            // 双反斜杠 转义为单反斜杠
                            tokenValueParts.pop();
                        } else {
                            tokenValueParts.pop();
                            // 此引号被转义，继续
                            tokenInputParts.push(command[n]);
                            tokenValueParts.push(command[n]);
                            i++;
                            continue;
                        }
                    }

                    if (n + 1 === len || command[n + 1] === " ") {
                        // 找到闭合引号
                        tokenInputParts.push(command.slice(i, n + 1));
                        tokenValueParts.push(command.slice(i, n));
                        i = n + 1;
                        break;
                    }
                }
                // 普通字符
                tokenInputParts.push(command[n]);
                tokenValueParts.push(command[n]);
                i++;
            }
        } else if (char === "#") {
            // 注释，忽略后续所有内容
            const nextLineIndex = command.indexOf("\n", i);
            const endIndex = nextLineIndex === -1 ? len : nextLineIndex;
            const input = command.slice(i, endIndex);
            result.push({
                type: "ignore",
                input,
                value: "",
                start: i,
                end: endIndex,
            });
            break; // 结束解析
        } else {
            // 无引号 token
            while (i < len) {
                if (command[i] === "(") {
                    result.push({
                        type: "()",
                        value: "(",
                        input: "(",
                        start: i,
                        end: i + 1,
                    });
                    i++;
                    break;
                }
                if (command[i] === ")") {
                    commitParts();
                    tokenInputParts.length = 0;
                    tokenValueParts.length = 0;
                    result.push({
                        type: "()",
                        value: ")",
                        input: ")",
                        start: i,
                        end: i + 1,
                    });
                    i++;
                    break;
                }
                if (command[i] === " " || command[i] === "\t" || command[i] === "\n") {
                    break;
                }
                if (command[i] === "\\" && i + 1 < len) {
                    tokenInputParts.push(command[i], command[i + 1]);
                    tokenValueParts.push(command[i + 1]);
                    i += 2;
                    continue;
                }
                // 在无引号模式下遇到引号，它就是token的一部分，无需特殊处理
                tokenInputParts.push(command[i]);
                tokenValueParts.push(command[i]);
                i++;
            }
        }

        function commitParts() {
            const input = tokenInputParts.join("");
            if (input.length > 0) {
                const value = tokenValueParts.join("");
                const x: ShInputItem = {
                    type: "item",
                    input,
                    value,
                    start,
                    end: start + input.length,
                };
                if (isYinhao) {
                    x.protected = true;
                }
                result.push(x);
            }
        }
        commitParts();
    }

    return result;
}

function parseTokens(tokens: ShInputItem[]): ShInputItem[] {
    const result: ShInputItem[] = [];
    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];
        if (token.type === "()" && token.value === "(") {
            // 1. 找到对应的右括号
            let depth = 1;
            let j = i + 1;
            const contentTokens: ShInputItem[] = [];
            let rightParenIndex = -1;
            while (j < tokens.length) {
                const current = tokens[j];
                if (current.type === "()" && current.value === "(") {
                    depth++;
                } else if (current.type === "()" && current.value === ")") {
                    depth--;
                    if (depth === 0) {
                        rightParenIndex = j;
                        break; // 找到匹配的右括号
                    }
                }

                // 如果还没找到匹配的右括号，收集内容
                if (depth > 0) {
                    contentTokens.push(current);
                }
                j++;
            }
            // 自动闭合
            if (rightParenIndex === -1) {
                rightParenIndex = tokens.length;
            }
            // 递归解析括号内部的内容
            // 注意：这里 contentTokens 已经排除了最外层的左括号内容
            // 我们需要再次调用 parseTokens 来处理内部可能存在的嵌套结构
            const innerChildren = parseTokens(contentTokens);
            const leftParen = token;
            const rightParen = tokens.at(rightParenIndex);

            const innerInput = contentTokens.map((t) => t.input).join("");
            const innerValue = contentTokens.map((t) => t.value).join("");

            const fullInput = leftParen.input + innerInput + (rightParen?.input ?? "");
            const children = [leftParen, ...innerChildren].concat(rightParen ? [rightParen] : []);

            const parentItem: ShInputItem = {
                type: "sub",
                input: fullInput,
                value: innerValue,
                start: leftParen.start,
                end: rightParen?.end ?? innerChildren.at(-1)?.end ?? leftParen.end,
                chindren: children,
            };
            result.push(parentItem);

            // 跳过已经处理过的 tokens（左括号、内部内容、右括号）
            // 当前 i 在左括号，处理完后 i 应该跳到右括号的下一个
            i = rightParenIndex + 1;
        } else {
            result.push(token);
            i++;
        }
    }
    return result;
}

export function parseIn(command: string): ShInputItem[] {
    const p = parseInFlat(command);
    return parseTokens(p);
}

// todo 按换行分割
// todo 分号分割
// todo && || 等等控制符分割

// todo 需要测试
export function parseIn2(p: ShInputItem[]): ShInputItem2[] {
    const result: ShInputItem2[] = [];
    let isMainMatched = false;
    for (const item of p) {
        if (item.type === "blank" || item.type === "ignore") {
            result.push({
                type: item.type,
                input: item.input,
                value: item.value,
                start: item.start,
                end: item.end,
            });
        } else if (item.type === "item") {
            if (!isMainMatched) {
                result.push({
                    type: "main",
                    input: item.input,
                    value: item.value,
                    start: item.start,
                    end: item.end,
                    protected: item.protected,
                });
                isMainMatched = true;
            } else {
                result.push({
                    type: "arg",
                    input: item.input,
                    value: item.value,
                    start: item.start,
                    end: item.end,
                    protected: item.protected,
                });
            }
        } else if (item.type === "sub") {
            result.push({
                type: "arg",
                input: item.input,
                value: item.value,
                start: item.start,
                end: item.end,
                chindren: parseIn2(item.chindren),
            });
        } else if (item.type === "()") {
            result.push({
                type: "other",
                input: item.input,
                value: item.value,
                start: item.start,
                end: item.end,
            });
        }
    }
    return result;
}
