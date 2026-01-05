import { txt, view, pack, type ElType } from "dkh-ui";
import { wcswidth } from "simple-wcswidth";
import { parseOut, type ShOutputItem } from "./parser_out";

export class Render {
    el = view();
    private mainEl = view();
    private seg = new Intl.Segmenter("en", { granularity: "grapheme" });
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
    constructor() {
        this.el.add(this.mainEl);
    }
    write(data: string) {
        const gLineEl = () => view().style({ minHeight: "1lh", lineBreak: "anywhere" });
        const renderText = (item: ShOutputItem) => {
            if (item.type === "text") {
                const l: (string | ElType<HTMLElement>)[] = [];
                for (const i of Array.from(this.seg.segment(item.text))) {
                    const w = wcswidth(i.segment);
                    if (w === 2) {
                        l.push(txt(i.segment).style({ display: "inline-block", width: "2ch" }));
                    } else {
                        const last = l.at(-1);
                        if (last) {
                            if (typeof last === "string") {
                                l[l.length - 1] = last + i.segment;
                            } else {
                                l.push(i.segment);
                            }
                        } else l.push(i.segment);
                    }
                }
                const textEl = txt().add(l).style({ whiteSpace: "pre-wrap" });
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
                return textEl;
            }
            // 其他类型暂不处理
            return view();
        };
        const l = parseOut(data);
        console.log(l);

        if (this.mainEl.el.children.length === 0) {
            this.mainEl.add(gLineEl());
        }
        // biome-ignore lint/style/noNonNullAssertion: added
        const lineEl = pack(Array.from(this.mainEl.el.children).at(-1)! as HTMLElement);
        const splitLines = l.reduce(
            (acc: ShOutputItem[][], curr) => {
                if (curr.type === "text" && curr.text === "\n") {
                    acc.push([]);
                } else {
                    acc[acc.length - 1].push(curr);
                }
                return acc;
            },
            [[]],
        );
        const firstL = splitLines.shift();
        if (firstL) {
            lineEl.add(firstL.map((item) => renderText(item)));
        }
        this.mainEl.add(splitLines.map((line) => gLineEl().add(line.map((item) => renderText(item)))));
    }
}
