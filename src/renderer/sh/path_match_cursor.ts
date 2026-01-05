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
    const basePath = pathList.slice(0, pathIndex).join(path.sep) + path.sep;
    const focusPart = pathList[pathIndex] ?? "";

    const p = path.isAbsolute(cur) ? basePath : path.join(cwd, basePath);
    return { basePath, focusPart, p };
}
