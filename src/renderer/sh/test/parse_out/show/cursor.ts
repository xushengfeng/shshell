import ansiEscapes from "ansi-escapes";

console.log(`a${ansiEscapes.cursorForward(2)}${ansiEscapes.cursorDown(1)}b`);

console.log("\\b在不同尺寸字符下的表现");

process.stdout.write("你好");
console.log();
process.stdout.write("你好\ba"); // 你好
console.log();
process.stdout.write("你好\b在"); // 你好
console.log();
process.stdout.write("你好\b在a"); // 你好
console.log();
process.stdout.write("你好\bab"); // 你好b
console.log();
process.stdout.write("你好\b再见"); // 你好见
console.log();
process.stdout.write("你好\b\ba"); // 你a
console.log();
process.stdout.write("你好\b\bab"); // 你ab
// 对于xterm.js，半个宽字符被替换为空格，并继续渲染
// konsole中则是重叠，新文字无效，后续文字继续渲染
console.log();
console.log("cursorBackward在不同尺寸字符下的表现");

process.stdout.write("你好");
console.log();
process.stdout.write(`你好${ansiEscapes.cursorBackward()}a`); // 你好
console.log();
process.stdout.write(`你好${ansiEscapes.cursorBackward()}在`); // 你好
console.log();
process.stdout.write(`你好${ansiEscapes.cursorBackward()}在a`); // 你好
console.log();
process.stdout.write(`你好${ansiEscapes.cursorBackward()}ab`); // 你好b
console.log();
process.stdout.write(`你好${ansiEscapes.cursorBackward()}再见`); // 你好见
console.log();
process.stdout.write(`你好${ansiEscapes.cursorBackward(2)}a`); // 你a
console.log();
process.stdout.write(`你好${ansiEscapes.cursorBackward(2)}ab`); // 你ab

// 结论：cursorBackward与\b表现一致

console.log();
console.log("tab");
process.stdout.write("1234\t5678");
// 结论：tab转成空格

console.log();
console.log("\\n");
process.stdout.write("你好\n世界");
console.log();
process.stdout.write("你好\n\r世界");
console.log();
process.stdout.write("你好\r\n世界");
console.log();

console.log("\\r");

process.stdout.write("123\r世"); // 世3
console.log();
process.stdout.write("你好\r1"); // 1 好
console.log();
// 结论：\r将光标移到行首，新字符覆盖旧字符，宽度不匹配的剩余部分改成空格

console.log("long");
console.log(
    "这是一个很长的字符串，用来测试当字符串长度超过终端宽度时，光标控制字符的表现情况。这是一个很长的字符串，用来测试当字符串长度超过终端宽度时，光标控制字符的表现情况。这是一个很长的字符串，用来测试当字符串长度超过终端宽度时，光标控制字符的表现情况。",
);
process.stdout.write(
    "这是一个很长的字符串，用来测试当字符串长度超过终端宽度时，光标控制字符的表现情况。这是一个很长的字符串，用来测试当字符串长度超过终端宽度时，光标控制字符的表现情况。这是一个很长的字符串，用来测试当字符串长度超过终端宽度时，光标控制字符的表现情况。",
);
process.stdout.write(ansiEscapes.cursorUp(1));
process.stdout.write("W");

process.stdout.write(ansiEscapes.cursorDown(2));

console.log();

console.log(`a${ansiEscapes.cursorForward(2)}`);
console.log(`a${ansiEscapes.cursorForward(2)}b`);

// 移动光标后只有那个位置有字符，才补充空格

console.log(`a${ansiEscapes.cursorForward(2)}${ansiEscapes.cursorDown(1)}b`);

// 超出视图范围，无法下移

console.log(`a${ansiEscapes.cursorForward(100)}bcd`); // b在同一行，后续的软换行

setTimeout(() => {}, 10000);
