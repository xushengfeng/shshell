import type { IRender } from "../output_render";
import type { ShOutputItemText, MouseEvent } from "../parser_out";

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
    ) {
        const y = zb.y;
        const x = zb.x;

        const { chars: line } = this.renderedLines[y];

        if (width === 0) {
            line[x] = { is2Width: true };
        } else {
            line[x] = { char };
        }
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
            this.rSet(renderText(t, items.style), t, width, zuobiao);
            zuobiao.x += 1;
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
    cursorVisible() {}

    setSize(rows: number, cols: number) {}

    onInput(fn: (data: string) => void) {}
    onKey(fn: (data: { key: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }) => void) {}
    onMouse(fn: (event: MouseEvent) => void) {}

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
