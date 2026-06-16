import { txt, view, pack, input, addClass } from "dkh-ui";
import { wcswidth } from "simple-wcswidth";
import { key2seq, type ShOutputItemText } from "../parser_out";
import type { IRender } from "../output_render";

const girdItemClass = addClass(
    {
        whiteSpace: "pre-wrap",
        display: "inline-block",
        height: "2ch",
        lineHeight: "2ch",
    },
    {},
);

export class DomRender implements IRender {
    el = view();
    private mainEl = view();

    private renderedLines: { chars: ({ el: HTMLElement; char: string } | { is2Width: boolean })[]; el: HTMLElement }[] =
        [];

    private onDataCb: (data: string) => void = () => {};
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

    private eventAbortController = new AbortController();

    private inputCursorInputEl = input().style({
        position: "absolute",
        opacity: "0",
        pointerEvents: "none",
        height: "2ch",
        lineHeight: "2ch",
        width: "1px",
    });
    private inputCursorDisplayEl = view().style({
        position: "absolute",
        width: "1px",
        height: "2ch",
        background: "#000",
    });
    // 显示ime composing字符
    private inputCursorComposeEl = view()
        .style({ position: "absolute", pointerEvents: "none" })
        .bindSet((v: string | { top: string; left: string }, el) => {
            if (typeof v === "string") {
                if (v === "") {
                    this.inputCursorComposeEl.style({ display: "none" });
                } else {
                    this.inputCursorComposeEl.style({ display: "" });
                }
                el.innerText = v;
                setTimeout(() => {
                    // todo 不超出范围
                }, 10);
            } else {
                this.inputCursorComposeEl
                    .style({
                        top: v.top,
                        left: v.left,
                    })
                    .data({
                        pLeft: v.left,
                        pTop: v.top,
                    });
            }
        });
    constructor() {
        this.el.add(this.mainEl);
        this.mainEl.on(
            "click",
            () => {
                this.inputCursorInputEl.el.focus();
            },
            { signal: this.eventAbortController.signal },
        );

        let composing = false;
        this.inputCursorInputEl
            .on(
                "compositionstart",
                () => {
                    composing = true;
                },
                { signal: this.eventAbortController.signal },
            )
            .on(
                "compositionupdate",
                (e) => {
                    this.inputCursorComposeEl.sv(e.data);
                },
                { signal: this.eventAbortController.signal },
            )
            .on(
                "compositionend",
                () => {
                    composing = false;
                    this.inputCursorComposeEl.sv("");
                },
                { signal: this.eventAbortController.signal },
            )
            .on(
                "input",
                () => {
                    this.onDataCb(this.inputCursorInputEl.gv);
                    this.inputCursorInputEl.sv("");
                },
                { signal: this.eventAbortController.signal },
            )
            .on(
                "keydown",
                (e) => {
                    if (composing) return;
                    const s = key2seq(e);
                    if (s) this.onDataCb(s);
                },
                { signal: this.eventAbortController.signal },
            )
            .on(
                "blur",
                () => {
                    composing = false;
                    this.inputCursorComposeEl.sv("");
                },
                { signal: this.eventAbortController.signal },
            );

        this.el
            .style({ position: "relative", overflowY: "auto" })
            .add(this.inputCursorInputEl)
            .add(this.inputCursorDisplayEl)
            .add(this.inputCursorComposeEl);
        this.inputCursorInputEl.el.focus();
    }

    private rSet(el: HTMLElement, char: string, width: number, zb: { x: number; y: number }): { width: number } {
        const y = zb.y;
        const x = zb.x;

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
            const next = line[x + 1];
            if (next && "el" in next) {
                next.el.remove();
            }
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
    setBlankSpace(zb: { x: number; y: number }): void {
        this.rSet(txt(" ").el, " ", 1, zb);
    }
    setText(
        items: { style?: ShOutputItemText["style"]; chars: { t: string; width: number }[] },
        zb: { x: number; y: number },
    ) {
        const renderText = (t: string, style: ShOutputItemText["style"] | undefined) => {
            const textEl = txt(t);
            // 应用样式
            if (style) {
                const s = style;
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
            return textEl;
        };
        const zuobiao = { x: zb.x, y: zb.y };
        for (const { t, width } of items.chars) {
            const w = this.rSet(renderText(t, items.style).el, t, width, zuobiao);
            zuobiao.x += w.width;
        }
    }

    addNewLine() {
        const line = view().style({ minHeight: "2ch", lineHeight: "2ch", lineBreak: "anywhere" });
        this.mainEl.add(line);

        this.renderedLines.push({ chars: [], el: line.el });
    }
    scrollToNewLine() {
        const line = this.renderedLines.at(-1);
        if (!line) return false;
        const toScrollTop = line.el.offsetTop - this.el.el.offsetHeight + line.el.offsetHeight + 15; // 滚动条占位，之后移除
        if (
            toScrollTop - 40 < // 偏移小于40内才追踪
            this.el.el.scrollTop
        ) {
            // 如果当前在底部，保持在底部，否则就是滚动到上面查看的情况，不自动滚动
            this.el.el.scrollTop = toScrollTop;
            return true;
        }
        return false;
    }
    rmLineBelow(): void {
        const line = this.renderedLines.pop();
        if (line) {
            line.el.remove();
        } else {
            console.warn("尝试删除不存在的行");
        }
    }

    clearLine(y: number): void {
        const line = this.renderedLines[y];
        if (!line) return;
        line.chars = [];
        line.el.innerHTML = "";
    }

    updateInputCursor(_row: number, _col: number) {
        // 定位输入光标
        this.inputCursorInputEl.style({
            top: `${_row * 2}ch`,
            left: `${_col}ch`,
        });
        this.inputCursorDisplayEl.style({
            top: `${_row * 2}ch`,
            left: `${_col}ch`,
        });
        this.inputCursorComposeEl.sv({
            top: `${_row * 2}ch`,
            left: `${_col}ch`,
        });
        // todo blink
    }

    setSize(rows: number, cols: number) {
        this.mainEl.style({
            width: `${cols}ch`,
        });
        this.el.style({
            maxHeight: `${rows * 2}ch`,
        });
        // cache
    }

    onData(fn: (data: string) => void) {
        this.onDataCb = fn;
    }

    newAltRender(): IRender {
        const newRender = new DomRender();
        this.el.add(newRender.el);
        return newRender;
    }

    destroy() {
        this.el.remove();
    }

    finish() {
        this.eventAbortController.abort();
        this.inputCursorInputEl.attr({ disabled: true });
        this.inputCursorDisplayEl.style({ display: "none" });
        this.inputCursorComposeEl.style({ display: "none" });
        this.onDataCb = () => {};
    }
}
