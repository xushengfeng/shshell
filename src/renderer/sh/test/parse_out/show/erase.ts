import ansiEscapes from "ansi-escapes";

const text = `${"1234567890".repeat(3)}\n`.repeat(10);
process.stdout.write(text);
process.stdout.write(ansiEscapes.cursorTo(10, 5));

const CSI = "\x1b[";

const flag = process.argv[2];
if (flag === "displayBelow") {
    process.stdout.write(`${CSI}0J`);
    // 右侧替换为空格
    // 删除下面行
} else if (flag === "displayAbove") {
    process.stdout.write(`${CSI}1J`);
    // 左侧替换为空格
    // 删除上面行？
} else if (flag === "displayAll") {
    process.stdout.write(`${CSI}2J`);
} else if (flag === "eraseLineRight") {
    process.stdout.write(`${CSI}0K`);
} else if (flag === "eraseLineLeft") {
    process.stdout.write(`${CSI}1K`);
} else if (flag === "eraseLineAll") {
    process.stdout.write(`${CSI}2K`);
} else {
    console.log("no flag");
}
