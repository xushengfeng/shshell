import path from "node:path";

// 定义基础节点接口
interface FSNode {
    type: "file" | "dir" | "link";
    isExecutable?: boolean; // 新增：是否可执行
    children?: { [key: string]: FSNode }; // 仅目录有效
    content?: string; // 仅文件有效
    target?: string; // 仅链接有效
}

// 简化版的 Stats 接口，去掉了 mode/size/birthtime
interface SimpleStats {
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
    isExecutable(): boolean; // 新增：返回节点的 isExecutable 属性
}

export class VirtualLinux {
    private root: FSNode;

    constructor(root: FSNode) {
        this.root = root;
    }

    /**
     * 核心工具：查找节点
     */
    private findNode(p: string): FSNode | null {
        // 规范化路径
        const parts = path
            .resolve(p)
            .split(path.sep)
            .filter((x) => x);
        if (parts.length === 0) return this.root;

        let current = this.root;

        for (const part of parts) {
            if (!current.children) return null;
            let next: FSNode | null = current.children[part];

            // 简单的链接解析
            if (next && next.type === "link" && next.target) {
                // 递归解析链接的目标
                next = this.findNode(next.target);
            }

            if (!next) return null;
            current = next;
        }
        return current;
    }

    /**
     * fs.statSync 模拟
     * 返回一个 SimpleStats 对象
     */
    statSync(p: string): SimpleStats {
        const node = this.findNode(p);
        if (!node) {
            throw new Error(`ENOENT: no such file or directory, stat '${p}'`);
        }

        return {
            isFile: () => node.type === "file",
            isDirectory: () => node.type === "dir",
            isSymbolicLink: () => node.type === "link",
            isExecutable: () => !!node.isExecutable,
        };
    }

    /**
     * fs.readdirSync 模拟
     */
    readdirSync(p: string): string[] {
        const node = this.findNode(p);
        if (!node) {
            throw new Error(`ENOENT: no such file or directory, scandir '${p}'`);
        }
        if (node.type !== "dir") {
            throw new Error(`ENOTDIR: not a directory, scandir '${p}'`);
        }
        // 通过连接 Object.keys 和 children 属性
        return Object.keys(node.children || {});
    }

    /**
     * 新增：isExeSync
     * 检查文件是否存在且是否可执行
     */
    isExeSync(p: string): boolean {
        try {
            const stats = this.statSync(p);
            // 只有普通文件才被视为可执行文件，如果是目录，即使标记了 isExecutable 也不应被视作可执行程序
            // (Linux 中目录本身没有可执行概念，是靠目录的权限位来控制进入)
            if (stats.isDirectory()) return false;
            return stats.isExecutable();
        } catch (err) {
            // 捕获 ENOENT 错误，如果文件不存在，则不可执行
            return false;
        }
    }

    /**
     * 辅助：读取文件内容 (方便测试)
     */
    readFileSync(p: string): string {
        const node = this.findNode(p);
        if (!node || node.type !== "file") {
            throw new Error("Is not a file");
        }
        return node.content || "";
    }
}
