import { txt, view, pack } from "dkh-ui";
import { wcswidth } from "simple-wcswidth";
import { parseOut, type ShOutputItemText } from "./parser_out";

type ClassicalCR = {
    col: number; // limit warp
    row: number;
};

type ZuoBiao = {
    x: number; // infinite horizontal
    y: number;
};

export class Render {
    el = view();
    private mainEl = view();
    private seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    private size = {
        rows: 24,
        cols: 80,
    };
    private cursor: ClassicalCR = {
        row: 0,
        col: 0,
    };
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
    constructor() {
        this.el.add(this.mainEl);
        this.setSize(this.size.rows, this.size.cols);
        this.rNewLine();
    }
    private rSet(el: HTMLElement, char: string, zb: ZuoBiao) {
        const y = Math.min(zb.y, this.renderedLines.length - 1);
        const x = zb.x;
        const width = wcswidth(char);
        const { chars: line, el: lel } = this.renderedLines[y];
        function set(el: HTMLElement, _char: string, i: number) {
            const w = _char === char ? width : wcswidth(_char);
            pack(el).style({ whiteSpace: "pre-wrap", display: "inline-block", width: w === 2 ? "2ch" : "1ch" });
            const has = line[i];
            if (has && "el" in has) {
                has.el.replaceWith(el);
                line[i] = { el, char: _char };
            } else {
                lel.appendChild(el); // todo 性能
                line[i] = { el, char: _char };
            }
        }
        // 扩展行
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
        }
        return { width };
    }
    private rNewLine() {
        const line = view().style({ minHeight: "1lh", lineBreak: "anywhere" });
        this.mainEl.add(line);
        this.renderedLines.push({ chars: [], el: line.el });
    }
    private classicalToZuoBiao(cr: ClassicalCR): ZuoBiao {
        return { x: cr.col, y: cr.row }; // todo
    }
    private zuoBiaoToClassical(zb: ZuoBiao): ClassicalCR {
        return { col: zb.x, row: zb.y }; // todo 换行
    }
    private setCursor(cr: ClassicalCR) {
        const col = Math.max(0, Math.min(cr.col, this.size.cols - 1));
        const row = Math.max(0, Math.min(cr.row, this.size.rows - 1));
        this.cursor = { col, row };
        this.zuobiao = this.classicalToZuoBiao(this.cursor);
    }

    write(data: string) {
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
        const l = parseOut(this.dataRest.rest + data);
        this.dataRest.rest = l.rest;
        console.log(this.dataRest.rest + data, l);

        for (const item of l.items) {
            if (item.type === "edit" && item.xType === "newLine") {
                this.rNewLine();
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
            } else if (item.type === "text") {
                const rendered = renderText(item);
                for (const { el, char } of rendered) {
                    const w = this.rSet(el.el, char, {
                        x: this.cursor.col,
                        y: this.cursor.row,
                    });
                    this.zuobiao.x += w.width;
                    this.cursor = this.zuoBiaoToClassical(this.zuobiao);
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
}
