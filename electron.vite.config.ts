import { defineConfig } from "electron-vite";
import * as path from "node:path";

export default defineConfig({
    main: {
        build: {},
    },
    renderer: {
        build: {
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, "src/renderer/main.html"),
                },
                external: ["@withfig/autocomplete/dynamic"],
            },
        },
    },
});
