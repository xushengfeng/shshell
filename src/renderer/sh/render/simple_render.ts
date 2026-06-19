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

        function setAs0(i: number) {
            line[i] = { is2Width: true };
        }
        if (!line[x]) {
            // 扩展行内（列）
            const lineEndStart = line.length;
            for (let i = lineEndStart; i < x; i++) {
                set({ style: {} }, " ", i);
            }
            if (width === 2) {
                set(el, char, x);
                setAs0(x + 1);
            } else {
                set(el, char, x);
            }
        } else {
            if (width === 2) {
                if ("is2Width" in line[x]) {
                    set({ style: {} }, " ", x - 1);
                }
                if (line[x + 1] && "is2Width" in line[x + 1]) {
                    set(el, char, x);
                } else if (line[x + 2] && "is2Width" in line[x + 2]) {
                    set(el, char, x);
                    setAs0(x + 1);
                    set({ style: {} }, " ", x + 2);
                } else {
                    set(el, char, x);
                    setAs0(x + 1);
                }
            } else {
                if ("is2Width" in line[x]) {
                    set({ style: {} }, " ", x - 1);
                    set(el, char, x);
                } else {
                    if (line[x + 1] && "is2Width" in line[x + 1]) {
                        set(el, char, x);
                        set({ style: {} }, " ", x + 1);
                    } else set(el, char, x);
                }
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
