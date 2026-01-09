export function tryX<T>(x: () => T): [T, null] | [null, Error] {
    try {
        return [x(), null];
    } catch (error) {
        return [null, error as Error];
    }
}
