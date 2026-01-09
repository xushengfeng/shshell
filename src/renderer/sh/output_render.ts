import { txt, view, pack, input, addClass } from "dkh-ui";
import { wcswidth } from "simple-wcswidth";
import { key2seq, parseOut, type ShOutputItem, type ShOutputItemText } from "./parser_out";

type ClassicalCR = {
    col: number; // limit warp
    row: number;
};

type ZuoBiao = {
    x: number; // infinite horizontal
    y: number;
};

const girdItemClass = addClass(
    {
        whiteSpace: "pre-wrap",
        display: "inline-block",
        height: "2ch",
        lineHeight: "2ch",
    },
    {},
);

export class Render {
    el = view();
    private mainEl = view();
    private inputCursorEl = input().style({ position: "absolute", opacity: "0", pointerEvents: "none" });
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
    private data: Partial<{ cursor: { col: number; row: number }[] }> = {};
    private zuobiao: ZuoBiao = { x: 0, y: 0 };
    // 用于存储渲染后的单元格信息，2单位宽字符占两个单元格，第一个和其它的一样，第二个为is2Width
    // 提供渲染元素 原始坐标 等信息 不处理自动换行，应该由cursor自动计算
    // 使用 ZuoBiao 表示内部坐标
    private renderedLines: { chars: ({ el: HTMLElement; char: string } | { is2Width: boolean })[]; el: HTMLElement }[] =
        [];
    private colorMap = {
        background: {
            _black: "#000000",
            _red: "#ed1515",
            _green: "#11d116",
            _yellow: "#f67400",
            _blue: "#1d99f3",
            _magenta: "#9b59b6",
            _cyan: "#1abc9c",
            _white: "#fcfcfc",
            _gray: "#808080",
            _brightRed: "#ff0000",
            _brightGreen: "#00ff00",
            _brightYellow: "#ffff00",
            _brightBlue: "#0000ff",
            _brightMagenta: "#ff00ff",
            _brightCyan: "#00ffff",
            _brightWhite: "#ffffff",
            _default: "#ffffff",
        },
        color: {
            _black: "#000000",
            _red: "#ed1515",
            _green: "#11d116",
            _yellow: "#f67400",
            _blue: "#1d99f3",
            _magenta: "#9b59b6",
            _cyan: "#1abc9c",
            _white: "#fcfcfc",
            _gray: "#808080",
            _brightRed: "#ff0000",
            _brightGreen: "#00ff00",
            _brightYellow: "#ffff00",
            _brightBlue: "#0000ff",
            _brightMagenta: "#ff00ff",
            _brightCyan: "#00ffff",
            _brightWhite: "#ffffff",
            _default: "#000000",
        },
    };
    private dataRest = {
        rest: "",
    };

    private onDataCb: (data: string) => void = () => {};

    constructor() {
        this.el.add(this.mainEl);
        this.setSize(this.size.rows, this.size.cols);
        this.rNewLine();

        let composing = false;
        this.mainEl.on("click", () => {
            this.inputCursorEl.el.focus();
        });
        this.inputCursorEl
            .on("compositionstart", () => {
                composing = true;
            })
            .on("compositionend", () => {
                composing = false;
            })
            .on("input", () => {
                this.onDataCb(this.inputCursorEl.gv);
                this.inputCursorEl.sv("");
            })
            .on("keydown", (e) => {
                if (composing) return;
                const s = key2seq(e);
                if (s) this.onDataCb(s);
            })
            .on("blur", () => {
                composing = false;
            });

        this.el.add(this.inputCursorEl);
        this.inputCursorEl.el.focus();
        // todo 定位光标，渲染光标
    }
    private rSet(el: HTMLElement, char: string, zb: ZuoBiao) {
        const y = zb.y;
        const x = zb.x;
        // 扩展行
        const lineCount = this.renderedLines.length;
        for (let i = lineCount; i <= y; i++) {
            this.rNewLine();
        }

        const width = wcswidth(char);
        const { chars: line, el: lel } = this.renderedLines[y];
        function set(el: HTMLElement, _char: string, i: number) {
            const w = _char === char ? width : wcswidth(_char);
            pack(el)
                .style({
                    width: w === 2 ? "2ch" : "1ch",
                })
                .class(girdItemClass);
            const has = line[i];
            if (has) {
                if ("el" in has) {
                    has.el.replaceWith(el);
                } else {
                    const last = line[i - 1];
                    if (last && "el" in last) {
                        last.el.after(el);
                    } else {
                        const pre = line[i + 1];
                        if (pre && "el" in pre) {
                            pre.el.before(el);
                        } else {
                            console.warn("无法定位单元格位置，可能数据结构有误", line, i);
                            console.trace();
                            lel.appendChild(el);
                        }
                    }
                }
            } else {
                lel.appendChild(el); // todo 性能
            }
            line[i] = { el, char: _char };
        }
        // 扩展行内（列）
        const lineEndStart = line.length;
        for (let i = lineEndStart; i < x; i++) {
            set(txt(" ").el, " ", i);
        }
        if (line[x] && "is2Width" in line[x]) {
            set(txt(" ").el, " ", x - 1);
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
                set(txt(" ").el, " ", x + 1);
            }
        }
        return { width };
    }
    private rNewLine() {
        const line = view().style({ minHeight: "2ch", lineBreak: "anywhere" });
        this.mainEl.add(line);
        this.renderedLines.push({ chars: [], el: line.el });
    }
    private rRmLineBelow() {
        const line = this.renderedLines.pop();
        if (line) {
            line.el.remove();
        } else {
            console.warn("尝试删除不存在的行");
        }
    }
    private rClearLine(zb: ZuoBiao) {
        if (!this.renderedLines[zb.y]) return;
        this.renderedLines[zb.y].chars = [];
        this.renderedLines[zb.y].el.innerHTML = "";
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
    }

    write(data: string) {
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
        if (this.altbuf) {
            this.altbuf.writeTokens(l.items);
        } else this.writeTokens(l.items);
    }
    writeTokens(tokens: ShOutputItem[]) {
        const renderText = (item: ShOutputItemText) => {
            return Array.from(this.seg.segment(item.text)).map((i) => {
                const t = i.segment;
                const textEl = txt(t);
                // 应用样式
                if (item.style) {
                    const s = item.style;
                    const cF = s.color ? (this.colorMap.color[s.color] ?? s.color) : this.colorMap.color._default;
                    const bgF = s.bgColor
                        ? (this.colorMap.background[s.bgColor] ?? s.bgColor)
                        : this.colorMap.background._default;

                    if (!s.inverse) {
                        textEl.style({
                            color: cF,
                            backgroundColor: bgF,
                        });
                    } else {
                        textEl.style({
                            color: bgF,
                            backgroundColor: cF,
                        });
                    }
                    if (s.bold) textEl.style({ fontWeight: "bold" });
                    if (s.italic) textEl.style({ fontStyle: "italic" });
                    if (s.underline) textEl.style({ textDecoration: "underline" });
                    if (s.dbunderline) textEl.style({ textDecoration: "underline double" });
                    if (s.overline) textEl.style({ textDecoration: "overline" });
                    // todo blink
                    if (s.strikethrough) textEl.style({ textDecoration: "line-through" });
                    if (s.hidden) textEl.style({ visibility: "hidden" });
                    if (s.dim) textEl.style({ opacity: "0.6" });
                }
                return { el: textEl, char: t };
            });
        };
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
                } else if (item.xType === "toSpaceRight") {
                    for (let i = this.cursor.col; i < this.size.cols; i++) {
                        const zb = this.classicalToZuoBiao({ row: this.cursor.row, col: i });
                        this.rSet(txt(" ").el, " ", zb);
                    }
                } else if (item.xType === "toSpaceLeft") {
                    for (let i = 0; i <= this.cursor.col; i++) {
                        const zb = this.classicalToZuoBiao({ row: this.cursor.row, col: i });
                        this.rSet(txt(" ").el, " ", zb);
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
                            this.altbuf = new Render();
                            this.altbuf.setSize(this.size.rows, this.size.cols);
                            this.altbuf.writeTokens(tokens.slice(tokenIndex + 1));
                            this.altbuf.setAsAltBuf(this);
                            this.altbuf.onData((data) => {
                                this.onDataCb(data);
                            });
                            this.el.add(this.altbuf.el);
                            break;
                        }
                    } else if (item.action === "reset") {
                        if (this.parent) {
                            this.el.remove();
                        }
                    }
                }
            } else if (item.type === "text") {
                const rendered = renderText(item);
                for (const { el, char } of rendered) {
                    const w = this.rSet(el.el, char, this.zuobiao);
                    this.zuobiao.x += w.width;
                    this.cursor = this.zuoBiaoToClassical(this.zuobiao);
                }
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
        this.mainEl.style({
            width: `${cols}ch`,
        });
        // cache
    }
    setAsAltBuf(parent: Render) {
        this.parent = parent;
    }
    onData(fn: (data: string) => void) {
        this.onDataCb = fn;
    }
}
