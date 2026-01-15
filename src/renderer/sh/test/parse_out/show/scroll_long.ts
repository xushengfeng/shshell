async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

for (let i = 0; i < 100; i++) {
    console.log(`测试自动滚动行为 ${i}`);
    await sleep(100);
}

export {};
