import { view } from "dkh-ui";

export class Render {
    el = view();
    private mainEl = view();
    constructor() {
        this.el.add(this.mainEl);
    }
    write(data: string) {
        this.mainEl.add(data);
    }
}
