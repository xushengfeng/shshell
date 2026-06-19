import { Render } from "../../output_render";
import { SimpleRender } from "../../render/simple_render";
import { Terminal } from "@xterm/xterm";

export function renderMatcher(row: number, col: number) {
    const render = new SimpleRender();
    const term = new Render(render);
    term.setSize(row, col);

    const xterm = new Terminal({ cols: col, rows: row });

    return {
        input: async (text: string) => {
            const p = new Promise((resolve) => {
                xterm.write(text, () => {
                    resolve(true);
                });
            });
            term.write(text);
            await p;

            const renderData = render.getData();
            const xtermData = xterm.buffer.active;
            function matchLine(r: number, x: number) {
                const renderLine = renderData[r]?.chars;
                const xtermLine = xtermData.getLine(x);
                if (!renderLine && !xtermLine) return true;
                if (!renderLine || !xtermLine) return false;
                // todo length 空格影响
                for (let i = 0; i < renderLine.length; i++) {
                    const renderChar = renderLine[i];
                    const xtermChar = xtermLine.getCell(i);
                    if ("char" in renderChar) {
                        if (renderChar.char !== xtermChar?.getChars()) return false;
                    }
                }
                return true;
            }

            return {
                matchDisplay: () => {},
                matchAll: () => {
                    for (let i = 0; i < renderData.length; i++) {
                        if (!matchLine(i, i)) {
                            throw new Error(`line ${i} not match`);
                        }
                    }
                },
                match: () => {
                    console.log(renderData, xtermData);
                },
            };
        },
    };
}
