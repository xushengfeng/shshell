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
     * 修改点：不再自动递归解析链接。
     * 如果用户访问 /link_to_home，这里返回 'link' 类型的节点。
     */
    private findNode(p: string): FSNode | null {
        if (!this.root) return null;
        const parts = path
            .resolve(p)
            .split(path.sep)
            .filter((x) => x);
        if (parts.length === 0) return this.root;

        let current: FSNode | undefined = this.root;

        for (const part of parts) {
            if (!current.children) return null;
            current = current.children[part];

            if (!current) return null;
        }
        return current;
    }

    /**
     * 辅助：解析链接，直到找到非链接目标
     * 用于那些需要“进入”目录的函数：readdirSync
     */
    private resolveLinkRecursively(node: FSNode): FSNode | null {
        if (node.type !== "link" || !node.target) return node;

        // 简单防止死循环，实际应用中应有 depth limit
        const target = this.findNode(node.target);
        if (!target) return null;

        if (target.type === "link") {
            return this.resolveLinkRecursively(target);
        }
        return target;
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

    private statDeep(p: string): SimpleStats {
        const node = this.findNode(p);
        if (!node) {
            throw new Error(`ENOENT: no such file or directory, stat '${p}'`);
        }
        const dnode = this.resolveLinkRecursively(node);
        if (!dnode) {
            throw new Error(`ENOENT: no such file or directory, stat '${p}'`);
        }
        return {
            isFile: () => dnode.type === "file",
            isDirectory: () => dnode.type === "dir",
            isSymbolicLink: () => node.type === "link",
            isExecutable: () => !!dnode.isExecutable,
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
        const dnode = this.resolveLinkRecursively(node);
        if (!dnode) {
            throw new Error(`ENOENT: no such file or directory, scandir '${p}'`);
        }
        if (dnode.type !== "dir") {
            throw new Error(`ENOTDIR: not a directory, scandir '${p}'`);
        }
        // 通过连接 Object.keys 和 children 属性
        return Object.keys(dnode.children || {});
    }

    /**
     * 新增：isExeSync
     * 检查文件是否存在且是否可执行
     */
    isExeSync(p: string): boolean {
        try {
            const stats = this.statDeep(p);
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
        if (!node || node.type !== "file") throw new Error("Not a file");
        return node.content || "";
    }
}
