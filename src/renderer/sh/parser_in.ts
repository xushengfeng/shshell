export type ShInputItem = {
    type: "main" | "arg" | "blank";
    input: string;
    value: string;
    start: number;
    end: number;
};

export function parseIn(command: string): ShInputItem[] {
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

        if (char === "'") {
            tokenInputParts.push(char);
            i++;
            while (i < len && command[i] !== "'") {
                if (command[i] === "\\" && i + 1 < len && command[i + 1] === "'") {
                    tokenInputParts.push(command[i], command[i + 1]);
                    tokenValueParts.push(command[i + 1]);
                    i += 2;
                } else {
                    // 普通字符
                    tokenInputParts.push(command[i]);
                    tokenValueParts.push(command[i]);
                    i++;
                }
            }
            if (i < len) {
                // 找到闭合单引号
                tokenInputParts.push(command[i]);
                i++; // 跳过闭合单引号
            }
        } else if (char === '"') {
            // 双引号 token
            tokenInputParts.push(char);
            i++; // 跳过开头的双引号
            while (i < len && command[i] !== '"') {
                if (command[i] === "\\" && i + 1 < len) {
                    const next = command[i + 1];
                    if (['"', "\\", "$", "`"].includes(next)) {
                        tokenInputParts.push(command[i], next);
                        tokenValueParts.push(next);
                        i += 2;
                        continue;
                    }
                }
                tokenInputParts.push(command[i]);
                tokenValueParts.push(command[i]);
                i++;
            }
            if (i < len) {
                tokenInputParts.push(command[i]);
                i++;
            }
        } else {
            // 无引号 token
            while (i < len) {
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

        const input = tokenInputParts.join("");
        if (input.length > 0) {
            const value = tokenValueParts.join("");
            const type: ShInputItem["type"] = result.filter((t) => t.type !== "blank").length === 0 ? "main" : "arg";
            result.push({ type, input, value, start, end: start + input.length });
        }
    }

    return result;
}
