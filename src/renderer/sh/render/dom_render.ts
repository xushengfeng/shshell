import { addClass, input, txt, view } from "dkh-ui";
import type { IRender } from "../output_render";
import type { ShOutputItemText, MouseEvent } from "../parser_out";

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

    private onInputCb: (data: string) => void = () => {};
    private onKeyCb: (data: { key: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }) => void =
        () => {};
    private onMouseCb: (event: MouseEvent) => void = () => {};
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
    private charWidth: number | null = null;
    private charHeight: number | null = null;

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
    private getMousePosition(e: globalThis.MouseEvent): { col: number; row: number } {
        if (this.charWidth === null || this.charHeight === null) {
            // 测量 1ch 的宽度和 2ch 的高度，使用 mainEl 的字体样式
            const temp = document.createElement("div");
            temp.style.position = "absolute";
            temp.style.visibility = "hidden";
            temp.style.width = "1ch";
            temp.style.height = "2ch";
            temp.style.fontFamily = "inherit";
            temp.style.fontSize = "inherit";
            temp.style.lineHeight = "inherit";
            // 插入到 mainEl 以继承样式
            this.mainEl.el.appendChild(temp);
            const rect = temp.getBoundingClientRect();
            this.charWidth = rect.width;
            this.charHeight = rect.height; // 这是 2ch 的高度
            this.mainEl.el.removeChild(temp);
        }
        const rect = this.mainEl.el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top + this.el.el.scrollTop;
        // 考虑 mainEl 的内边距
        const style = window.getComputedStyle(this.mainEl.el);
        const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
        const paddingTop = Number.parseFloat(style.paddingTop) || 0;
        const adjustedX = x - paddingLeft;
        const adjustedY = y - paddingTop;
        // 计算列和行，确保至少为1
        const col = Math.max(1, Math.floor(adjustedX / this.charWidth) + 1);
        const row = Math.max(1, Math.floor(adjustedY / this.charHeight) + 1);
        return { col, row };
    }

    constructor() {
        this.el.add(this.mainEl);
        this.mainEl.on(
            "click",
            () => {
                this.inputCursorInputEl.el.focus();
            },
            { signal: this.eventAbortController.signal },
        );

        // 鼠标事件监听
        this.mainEl.on(
            "mousedown",
            (e) => {
                const pos = this.getMousePosition(e);
                this.onMouseCb({
                    button: e.button,
                    col: pos.col,
                    row: pos.row,
                    type: "press",
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey,
                });
            },
            { signal: this.eventAbortController.signal },
        );
        this.mainEl.on(
            "mouseup",
            (e) => {
                const pos = this.getMousePosition(e);
                this.onMouseCb({
                    button: e.button,
                    col: pos.col,
                    row: pos.row,
                    type: "release",
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey,
                });
            },
            { signal: this.eventAbortController.signal },
        );
        this.mainEl.on(
            "mousemove",
            (e) => {
                const pos = this.getMousePosition(e);
                this.onMouseCb({
                    button: e.button,
                    col: pos.col,
                    row: pos.row,
                    type: "move",
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey,
                });
            },
            { signal: this.eventAbortController.signal },
        );
        this.mainEl.on(
            "wheel",
            (e) => {
                const pos = this.getMousePosition(e);
                let button = 4; // wheel up
                if (e.deltaY > 0)
                    button = 5; // wheel down
                else if (e.deltaX > 0)
                    button = 7; // wheel right
                else if (e.deltaX < 0) button = 6; // wheel left
                this.onMouseCb({
                    button,
                    col: pos.col,
                    row: pos.row,
                    type: "wheel",
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey,
                });
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
                    this.onInputCb(this.inputCursorInputEl.gv);
                    this.inputCursorInputEl.sv("");
                },
                { signal: this.eventAbortController.signal },
            )
            .on(
                "keydown",
                (e) => {
                    if (composing) return;
                    this.onKeyCb(e);
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

    private rSet(el: HTMLElement, char: string, width: number, zb: { x: number; y: number }) {
        const y = zb.y;
        const x = zb.x;

        const { chars: line, el: lel } = this.renderedLines[y];

        if (width === 0) {
            line[x] = { is2Width: true };
        } else {
            const last = line[x - 1];
            if (last) {
                if ("el" in last) last.el.after(el);
                else {
                    const lastlast = line[x - 2];
                    if (lastlast && "el" in lastlast) lastlast.el.after(el);
                    else {
                        console.warn("无法定位单元格位置，可能数据结构有误", line, x);
                        console.trace();
                    }
                }
            } else {
                lel.prepend(el);
            }
            line[x] = { el, char };
        }
    }
    setBlankSpace(zb: { x: number; y: number }): void {
        this.rSet(txt(" ").el, " ", 1, zb);
    }
    setText(
        items: { style?: ShOutputItemText["style"]; chars: { t: string; width: number }[] },
        zb: { x: number; y: number },
    ) {
        const renderText = (t: string, w: number, style: ShOutputItemText["style"] | undefined) => {
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
            return textEl
                .style({
                    width: w === 2 ? "2ch" : "1ch",
                })
                .class(girdItemClass);
        };
        const zuobiao = { x: zb.x, y: zb.y };
        const line = this.renderedLines[zb.y].chars;
        const rmEls = line.slice(zuobiao.x, zuobiao.x + items.chars.length);
        for (const rm of rmEls) {
            if ("el" in rm) {
                rm.el.remove();
            }
        }
        for (const { t, width } of items.chars) {
            if (width === 0) {
                this.rSet(txt("").el, "", 0, zuobiao);
                zuobiao.x += 1;
                continue;
            }
            this.rSet(renderText(t, width, items.style).el, t, width, zuobiao);
            zuobiao.x += 1;
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

    onInput(fn: (data: string) => void) {
        this.onInputCb = fn;
    }
    onKey(fn: (data: { key: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }) => void) {
        this.onKeyCb = fn;
    }
    onMouse(fn: (event: MouseEvent) => void) {
        this.onMouseCb = fn;
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
        this.onInputCb = () => {};
        this.onKeyCb = () => {};
    }
}
