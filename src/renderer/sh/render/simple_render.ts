import type { ShOutputItemText } from "../parser_out";
import type { IRender } from "../output_render";

export class SimpleRender implements IRender {
    private renderedLines: { chars: ({ char: string } | { is2Width: boolean })[] }[] = [];

    private altRender: SimpleRender | null = null;

    private rSet(
        el: {
            style: {
                color?: string;
                backgroundColor?: string;
            };
        },
        char: string,
        width: number,
        zb: { x: number; y: number },
    ): { width: number } {
        const y = zb.y;
        const x = zb.x;

        const { chars: line } = this.renderedLines[y];
        function set(
            el: {
                style: {
                    color?: string;
                    backgroundColor?: string;
                };
            },
            _char: string,
            i: number,
        ) {
            line[i] = { char: _char };
        }
        // 扩展行内（列）
        const lineEndStart = line.length;
        for (let i = lineEndStart; i < x; i++) {
            set({ style: {} }, " ", i);
        }
        if (line[x] && "is2Width" in line[x]) {
            set({ style: {} }, " ", x - 1);
        }
        // 设置当前单元格
        set(el, char, x);
        // 如果是宽字符，设置下一个单元格为占位
        if (width === 2) {
            line[x + 1] = { is2Width: true };
        } else if (line[x + 1] && "is2Width" in line[x + 1]) {
            if (x + 1 + 1 === line.length) {
                line.pop();
            } else {
                set({ style: {} }, " ", x + 1);
            }
        }
        return { width };
    }
    setBlankSpace(zb: { x: number; y: number }): void {
        this.rSet({ style: {} }, " ", 1, zb);
    }
    setText(
        items: { style?: ShOutputItemText["style"]; chars: { t: string; width: number }[] },
        zb: { x: number; y: number },
    ) {
        const renderText = (t: string, style: ShOutputItemText["style"] | undefined) => {
            const textEl = { style: {} };
            return textEl;
        };
        const zuobiao = { x: zb.x, y: zb.y };
        for (const { t, width } of items.chars) {
            const w = this.rSet(renderText(t, items.style), t, width, zuobiao);
            zuobiao.x += w.width;
        }
    }

    addNewLine() {
        this.renderedLines.push({ chars: [] });
    }
    scrollToNewLine() {
        return false;
    }
    rmLineBelow(): void {
        this.renderedLines.pop();
    }

    clearLine(y: number): void {
        const line = this.renderedLines[y];
        if (!line) return;
        line.chars = [];
    }

    updateInputCursor(_row: number, _col: number) {}

    setSize(rows: number, cols: number) {}

    onData(fn: (data: string) => void) {}

    newAltRender(): IRender {
        const newRender = new SimpleRender();
        this.altRender = newRender;
        return newRender;
    }

    destroy() {}

    finish() {}

    getData(): typeof this.renderedLines {
        if (this.altRender) {
            return this.altRender.getData();
        }
        return this.renderedLines;
    }
}
