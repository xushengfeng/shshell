import { wcswidth } from "simple-wcswidth";
import { type MouseEvent, type ShOutputItem, type ShOutputItemText, key2seq, mouse2seq, parseOut } from "./parser_out";

type ClassicalCR = {
    col: number; // limit warp
    row: number;
};

type ZuoBiao = {
    x: number; // infinite horizontal
    y: number;
};

export interface IRender {
    setBlankSpace(zb: ZuoBiao);
    setText(item: { style?: ShOutputItemText["style"]; chars: { t: string; width: number }[] }, zb: ZuoBiao);
    scrollToNewLine(): boolean;
    addNewLine();
    rmLineBelow();
    clearLine(y: number);
    setSize(rows: number, cols: number);
    updateInputCursor(row: number, col: number);
    onInput(fn: (data: string) => void);
    onKey(fn: (data: { key: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }) => void);
    onMouse(fn: (event: MouseEvent) => void);
    newAltRender(): IRender;
    finish();
    destroy();
}

class TabStops {
    private stops = new Set<number>();
    private noStops = new Set<number>();
    private useDefaultStops = true;

    clearStop(col: number) {
        this.stops.delete(col);
        this.noStops.add(col);
    }
    setStop(col: number) {
        this.noStops.delete(col);
        this.stops.add(col);
    }
    isStop(col: number) {
        if (this.noStops.has(col)) return false;
        if (this.stops.has(col)) return true;
        if (this.useDefaultStops) return col % 8 === 0;
        return false;
    }
    clearAllStops() {
        this.stops.clear();
        this.noStops.clear();
        this.useDefaultStops = false;
    }
    resetDefaultStops() {
        this.stops.clear();
        this.noStops.clear();
        this.useDefaultStops = true;
    }
    nextStop(col: number) {
        let next = col + 1;
        while (!this.isStop(next)) {
            next++;
        }
        return next;
    }
}

export class Render {
    private irender: IRender;
    private seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    private size = {
        rows: 24,
        cols: 80,
    };
    private cursor: ClassicalCR = {
        row: 0,
        col: 0,
    };
    private altbuf: Render | null = null;
    private parent: Render | null = null;
    private mode = new Set<string>();
    private data: Partial<{ cursor: { col: number; row: number }[] }> & {
        mouseMode: 0 | 9 | 1000 | 1001 | 1002 | 1003;
        mouseReportMode: 0 | 1005 | 1006 | 1015; // 0: default, 1005: UTF-8, 1006: SGR, 1015: urxvt
        tab: TabStops;
    } = {
        mouseMode: 0,
        mouseReportMode: 0,
        tab: new TabStops(),
    };
    private zuobiao: ZuoBiao = { x: 0, y: 0 };
    // 用于存储渲染后的单元格信息，2单位宽字符占两个单元格，第一个和其它的一样，第二个为is2Width
    // 提供渲染元素 原始坐标 等信息 不处理自动换行，应该由cursor自动计算
    // 使用 ZuoBiao 表示内部坐标
    private renderedLines: { chars: [] }[] = [];

    private dataRest = {
        rest: "",
    };

    // 用于开发调试，延时输出
    private _delay_to_show: ShOutputItem[] = [];
    private _delay_to_show_timer: NodeJS.Timeout | null = null;

    private onDataCb: (data: string) => void = () => {};
    private onScrollCb: () => void = () => {};

    constructor(render: IRender) {
        this.irender = render;
        this.irender.onInput((data) => {
            this.inputText(data);
        });
        this.irender.onKey((data) => {
            this.inputKey(data);
        });
        this.irender.onMouse((event) => {
            this.inputMouse(event);
        });
        this.setSize(this.size.rows, this.size.cols);
        this.rNewLine();
    }
    private rNewLine() {
        this.irender.addNewLine();
        if (this.irender.scrollToNewLine()) {
            this.onScrollCb();
        }

        this.renderedLines.push({ chars: [] });
    }
    ensureLine(y: number) {
        const lineCount = this.renderedLines.length;
        for (let i = lineCount; i <= y; i++) {
            this.rNewLine();
        }
    }
    private rRmLineBelow() {
        const line = this.renderedLines.pop();
        if (line) {
        } else {
            console.warn("尝试删除不存在的行");
        }
        this.irender.rmLineBelow();
    }
    private rClearLine(zb: ZuoBiao) {
        if (!this.renderedLines[zb.y]) return;
        this.renderedLines[zb.y].chars = [];
        this.irender.clearLine(zb.y);
    }
    private classicalToZuoBiao(cr: ClassicalCR): ZuoBiao {
        if (this.renderedLines.length > this.size.rows) {
            const x = cr.col;
            const y = this.renderedLines.length - (this.size.rows - cr.row);
            return { x, y };
        }
        return { x: cr.col, y: cr.row }; // todo
    }
    private zuoBiaoToClassical(zb: ZuoBiao): ClassicalCR {
        if (this.renderedLines.length > this.size.rows) {
            const col = zb.x;
            const row = this.size.rows - (this.renderedLines.length - zb.y);
            return { col, row };
        }
        return { col: zb.x, row: zb.y }; // todo 换行
    }
    private setCursor(cr: ClassicalCR) {
        const col = Math.max(0, Math.min(cr.col, this.size.cols - 1));
        const row = Math.max(0, Math.min(cr.row, this.size.rows - 1));
        this.cursor = { col, row };
        this.zuobiao = this.classicalToZuoBiao(this.cursor);
        this.updateInputCursor();
    }
    private updateInputCursor() {
        let _col = this.cursor.col;
        let _row = this.cursor.row;
        if (_col === this.size.cols) {
            _col = 0;
            _row += 1;
        }
        if (_row >= this.size.rows) {
            _row = this.size.rows - 1;
        }

        this.irender.updateInputCursor(_row, _col);
    }

    write(data: string) {
        const l = parseOut(this.dataRest.rest + data);
        this.dataRest.rest = l.rest;
        if (l.items.find((i) => i.type === "other")) {
            console.warn(
                "存在未处理的输出项，可能存在bug",
                l,
                l.items.filter((i) => i.type === "other"),
            );
        }
        if (this.altbuf) {
            this.altbuf.writeTokens(l.items);
        } else this.writeTokens(l.items);
    }
    _wirteDelay(data: string) {
        const l = parseOut(this.dataRest.rest + data);
        this.dataRest.rest = l.rest;
        console.log(this.dataRest.rest + data, l);
        if (l.items.find((i) => i.type === "other")) {
            console.warn(
                "存在未处理的输出项，可能存在bug",
                l,
                l.items.filter((i) => i.type === "other"),
            );
        }
        this._delay_to_show.push(...l.items);
        if (!this._delay_to_show_timer) {
            this._delay_to_show_timer = setInterval(() => {
                const token = this._delay_to_show.shift();
                if (token)
                    if (this.altbuf) {
                        this.altbuf.writeTokens([token]);
                    } else this.writeTokens([token]);
            }, 20);
        }
    }
    writeTokens(tokens: ShOutputItem[]) {
        for (const [tokenIndex, item] of tokens.entries()) {
            if (item.type === "edit") {
                if (item.xType === "newLine") {
                    if (this.classicalToZuoBiao(this.cursor).y >= this.renderedLines.length - 1) {
                        // todo 考虑到自动换行，估计会有bug
                        this.rNewLine();
                    }
                    this.zuobiao.y += 1;
                    this.zuobiao.x = 0;
                    this.cursor = this.zuoBiaoToClassical(this.zuobiao);
                    this.updateInputCursor();
                } else if (item.xType === "toSpaceRight") {
                    for (let i = this.cursor.col; i < this.size.cols; i++) {
                        const zb = this.classicalToZuoBiao({ row: this.cursor.row, col: i });
                        this.ensureLine(zb.y);
                        this.irender.setBlankSpace(zb);
                    }
                } else if (item.xType === "toSpaceLeft") {
                    for (let i = 0; i <= this.cursor.col; i++) {
                        const zb = this.classicalToZuoBiao({ row: this.cursor.row, col: i });
                        this.ensureLine(zb.y);
                        this.irender.setBlankSpace(zb);
                    }
                } else if (item.xType === "deleteLineBelowAll") {
                    const count = this.renderedLines.length - this.zuobiao.y - 1;
                    for (let i = 0; i < count; i++) {
                        this.rRmLineBelow();
                    }
                } else if (item.xType === "deleteLineBelow") {
                    this.rRmLineBelow();
                } else if (item.xType === "deleteAll") {
                    for (let i = 0; i < this.size.rows; i++) {
                        const zb = this.classicalToZuoBiao({ row: i, col: 0 });
                        this.rClearLine(zb);
                    }
                }
            } else if (item.type === "cursor") {
                if (item.col) {
                    if (item.col.type === "abs") {
                        this.setCursor({ row: this.cursor.row, col: item.col.v });
                    } else if (item.col.type === "rel") {
                        this.setCursor({ row: this.cursor.row, col: this.cursor.col + item.col.v });
                    }
                }
                if (item.row) {
                    if (item.row.type === "abs") {
                        this.setCursor({ row: item.row.v, col: this.cursor.col });
                    } else if (item.row.type === "rel") {
                        this.setCursor({ row: this.cursor.row + item.row.v, col: this.cursor.col });
                    }
                }
            } else if (item.type === "tab") {
                if (item.xType === "nextTab") {
                    this.setCursor({ row: this.cursor.row, col: this.data.tab.nextStop(this.cursor.col) });
                } else if (item.xType === "clearTab") {
                    this.data.tab.clearStop(this.cursor.col);
                } else if (item.xType === "setTab") {
                    this.data.tab.setStop(this.cursor.col);
                } else if (item.xType === "clearAllTab") {
                    this.data.tab.clearAllStops();
                }
            } else if (item.type === "mode") {
                if (item.action === "set") {
                    this.mode.add(item.mode.toString());
                } else if (item.action === "reset") {
                    this.mode.delete(item.mode.toString());
                }

                if (item.mode === "?47" || item.mode === "?1047" || item.mode === "?1049") {
                    // todo 事件传递出去
                    if (item.action === "set") {
                        if (!this.parent) {
                            this.altbuf = new Render(this.irender.newAltRender());
                            this.altbuf.setSize(this.size.rows, this.size.cols);
                            this.altbuf.writeTokens(tokens.slice(tokenIndex + 1));
                            this.altbuf.setAsAltBuf(this);
                            this.altbuf.onData((data) => {
                                this.onDataCb(data);
                            });
                            break;
                        }
                    } else if (item.action === "reset") {
                        if (this.parent) {
                            this.finish();
                            this.irender.destroy();
                        }
                    }
                }
                if (
                    item.mode === "?9" ||
                    item.mode === "?1000" ||
                    item.mode === "?1001" ||
                    item.mode === "?1002" ||
                    item.mode === "?1003"
                ) {
                    if (item.action === "set") {
                        this.data.mouseMode = Number.parseInt(item.mode.slice(1)) as 9 | 1000 | 1001 | 1002 | 1003;
                    } else if (item.action === "reset") {
                        this.data.mouseMode = 0;
                    }
                }
                if (item.mode === "?1005" || item.mode === "?1006" || item.mode === "?1015") {
                    if (item.action === "set") {
                        this.data.mouseReportMode = Number.parseInt(item.mode.slice(1)) as 1005 | 1006 | 1015;
                    } else if (item.action === "reset") {
                        this.data.mouseReportMode = 0;
                    }
                }
            } else if (item.type === "text") {
                this.ensureLine(this.zuobiao.y);
                const chars = Array.from(this.seg.segment(item.text)).map((i) => {
                    const t = i.segment;
                    return { t, width: wcswidth(t) };
                });
                this.irender.setText(
                    {
                        style: item.style,
                        chars,
                    },
                    this.zuobiao,
                );
                this.zuobiao.x += chars.reduce((sum, i) => sum + i.width, 0);
                this.cursor = this.zuoBiaoToClassical(this.zuobiao);
                this.updateInputCursor();
            } else if (item.type === "raw") {
                // todo 可以外放
                if (item.xType === "csi") {
                    if (item.end === "c" && !item.pre) {
                        this.onDataCb("\x1b[?1;2c");
                    }
                }
                if (item.xType === "esc") {
                    if (item.end === "7" && !item.pre) {
                        // 保存光标 save cursor
                        const l = this.data.cursor ?? [];
                        l.push({ col: this.cursor.col, row: this.cursor.row });
                        this.data.cursor = l;
                        // todo attr
                    }
                    if (item.end === "8" && !item.pre) {
                        const l = this.data.cursor;
                        if (l && l.length > 0) {
                            const pos = l.pop();
                            if (pos) this.setCursor({ col: pos.col, row: pos.row });
                        }
                    }
                }
            }
        }
    }
    setSize(rows: number, cols: number) {
        this.size.rows = rows;
        this.size.cols = cols;
        this.irender.setSize(rows, cols);
    }
    setAsAltBuf(parent: Render) {
        this.parent = parent;
    }

    inputText(data: string) {
        this.onDataCb(data);
    }
    inputKey(ke: { key: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }) {
        this.onDataCb(key2seq(ke));
    }
    inputMouse(event: MouseEvent) {
        if (this.data.mouseMode === 0) return;
        const seq = mouse2seq(event, this.data.mouseMode, this.data.mouseReportMode);
        if (seq) {
            this.onDataCb(seq);
        }
    }

    onData(fn: (data: string) => void) {
        this.onDataCb = fn;
    }
    onScroll(fn: () => void) {
        this.onScrollCb = fn;
    }

    finish() {
        this.irender.finish();
        this.onScrollCb = () => {};
        this.onDataCb = () => {};
    }
}
