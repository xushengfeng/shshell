import chalk from "chalk";

// --- 1. 基础演示测试 ---
console.log("--- 基础测试 (Basic Test) ---");
console.log("aaaaAAAAMMMM\n你好🚀🚀测试");

// --- 2. 补充其他变种样式 (Variants) ---
const styles = [
    { name: "正常(Normal)", fn: (t: string) => t }, // Default
    { name: "加粗(Bold)", fn: chalk.bold },
    { name: "减淡(Dim)", fn: chalk.dim },
    { name: "斜体(Italic)", fn: chalk.italic },
    { name: "下划线(Underline)", fn: chalk.underline },
    { name: "上划线(Overline)", fn: chalk.overline },
    { name: "双下划线(Double Underline)", fn: (t: string) => `\x1b[21m${t}\x1b[24m` },
    { name: "反转(Inverse)", fn: chalk.inverse },
    { name: "删除线(Strike)", fn: chalk.strikethrough },
    { name: "闪烁(Blink)", fn: (t: string) => `\x1b[5m${t}\x1b[25m` },
];

console.log("\n--- 样式变种演示 (Variants Demo) ---");

console.log(styles.map((s) => s.fn(s.name)).join(" "));

// --- 3. 颜色矩阵：前景色 vs 背景色 ---
// 定义颜色：格式为 { name: "中文(English)", fn: ... }

const fgColors = [
    { name: "Default", fn: (t: string) => t }, // 无前景色
    { name: "Black", fn: chalk.black },
    { name: "Red", fn: chalk.red },
    { name: "Green", fn: chalk.green },
    { name: "Yellow", fn: chalk.yellow },
    { name: "Blue", fn: chalk.blue },
    { name: "Magenta", fn: chalk.magenta },
    { name: "Cyan", fn: chalk.cyan },
    { name: "White", fn: chalk.white },
];

const bgColors = [
    { name: "Default", fn: (t: string) => t }, // 无背景色
    { name: "Black", fn: chalk.bgBlack },
    { name: "Red", fn: chalk.bgRed },
    { name: "Green", fn: chalk.bgGreen },
    { name: "Yellow", fn: chalk.bgYellow },
    { name: "Blue", fn: chalk.bgBlue },
    { name: "Magenta", fn: chalk.bgMagenta },
    { name: "Cyan", fn: chalk.bgCyan },
    { name: "White", fn: chalk.bgWhite },
];

console.log("\n--- 颜色矩阵 (Color Matrix: Row=Bg, Col=Fg) ---");

// 3.2 打印矩阵 - 使用 for 循环
for (let r = 0; r < bgColors.length; r++) {
    // 打印行头 + 分隔符
    let t = "";
    t += bgColors[r].name.padEnd(8);
    t += " | ";

    // 内层循环：前景色
    for (let c = 0; c < fgColors.length; c++) {
        // 组合颜色：先前景，再背景
        let styledText = fgColors[c].fn(`■ ${fgColors[c].name}`);
        styledText = bgColors[r].fn(styledText);
        t += ` ${styledText} `;
    }
    console.log(t);
}
