const path = require("node:path") as typeof import("node:path");

export function pathMatchCursor(
    cur: string,
    curOffset: number,
    cwd: string,
): { basePath: string; focusPart: string; p: string } {
    const pathList = cur.split(path.sep);
    let pathPos = 0;
    let pathIndex = 0;
    for (const [i, part] of pathList.entries()) {
        const thisStart = pathPos;
        const thisEnd = pathPos + part.length;
        if (curOffset >= thisStart && curOffset <= thisEnd) {
            pathIndex = i;
            break;
        }
        pathPos = thisEnd + 1; // for sep
    }
    let basePathI = 0;
    for (let i = 0; i < pathIndex; i++) {
        basePathI += pathList[i].length;
        basePathI += 1;
    }
    const basePath = cur.slice(0, basePathI);
    const focusPart = pathList[pathIndex] ?? "";

    // 空表示从 cwd 开始，即相对路径
    const p = path.normalize(basePath === "" ? cwd : path.isAbsolute(basePath) ? basePath : path.join(cwd, basePath));
    return { basePath, focusPart, p };
}
