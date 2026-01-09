const path = require("node:path") as typeof import("node:path");

export function pathMatchCursor(cur: string, curOffset: number) {
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
    const focusPart = pathList[pathIndex];

    return { basePath, focusPart };
}
