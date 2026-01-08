function log(str: string, delay = 0) {
    if (delay > 0) {
        let x = str;
        const t = setInterval(() => {
            process.stdout.write(x[0]);
            x = x.slice(1);
            if (x.length === 0) {
                clearInterval(t);
                setTimeout(() => {}, delay);
            }
        }, delay);
    } else {
        process.stdout.write(str);
    }
}

function logList(strs: string[], delay = 0) {
    let x = strs;
    const t = setInterval(() => {
        process.stdout.write(x[0]);
        x = x.slice(1);
        if (x.length === 0) {
            clearInterval(t);
            setTimeout(() => {}, delay);
        }
    }, delay);
}

function repeat<t>(any: t, n: number): t[] {
    const r: t[] = [];
    for (let i = 0; i < n; i++) {
        r.push(any);
    }
    return r;
}

// log("c"); // c\0
// log("a\rc"); // c\0
// log("a\nc"); // a\nc\0

// 一切符合预期

// log("a\n\u001b[1Fc"); // c\n\0
// 向上并没有直接移除\n

// logList(["a", ...repeat(["\n", "\u001b[1F"], 4).flat(), "c"], 500); // c\n\0
// logList(["a", ...repeat("\n", 4), ...repeat("\u001b[1F", 4), "c"], 500); // c\n\n\n\n\0
// logList(["a", ...repeat("\n", 4), ...repeat("\u001b[1F", 4), "\n", "\n", "c"], 500); // a\n\nc\n\n\0

// 结论，在某一行添加\n 当后面有空行，不添加，后面没有行，添加

// logList(["a", ...repeat("\n1", 4), ...repeat("\u001b[1F", 4), "\n", "\n", "c"], 500); // a\n1\nc\n1\n1\0

// 进一步结论，在某一行添加\n 如果后面没有任何东西，就添加，否则，表现为向下移动一行光标，不改变其他

logList(["a", ...repeat("\n12345", 4), ...repeat("\u001b[1F", 4), "\u001b[2C", "\n", "\n", "c"], 500); // a\n12345\nc2345\n12345\n12345\0

// 补充结论，上面的特殊情况表现为 CSI E，即光标移动到下一行行首

setTimeout(() => {}, 10000);
