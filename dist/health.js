export const FIBER_PHASE = {
    PENDING: 0,
    LOADING: 1,
    ACTIVE: 2,
    FAILED: 3,
    DISPOSED: 4,
    UNLOADING: 5,
};
/**
 * Read only Host-owned lifecycle cells. No plugin method, logger, Session,
 * exception, filesystem, environment or network capability is reachable here.
 */
export function probeLoaderHealth(loader, moduleName) {
    if (loader === undefined || typeof loader.entries !== 'function')
        return 'unknown';
    try {
        const matches = [...loader.entries()].filter(entry => {
            const name = entry.options?.name;
            return entry.options?.group !== true
                && (name === moduleName || name?.startsWith(`${moduleName}/`) === true);
        });
        if (matches.length === 0 || matches.every(entry => entry.disabled === true))
            return 'unavailable';
        const states = matches
            .filter(entry => entry.disabled !== true)
            .map(entry => entry.fiber?.state);
        if (states.includes(FIBER_PHASE.ACTIVE))
            return 'ok';
        if (states.includes(FIBER_PHASE.FAILED))
            return 'error';
        if (states.some(state => state === FIBER_PHASE.PENDING
            || state === FIBER_PHASE.LOADING
            || state === FIBER_PHASE.DISPOSED
            || state === FIBER_PHASE.UNLOADING))
            return 'unavailable';
        return 'unknown';
    }
    catch {
        return 'unknown';
    }
}
export function healthText(status) {
    if (status === 'ok')
        return '当前运行 OK';
    if (status === 'unavailable')
        return '当前暂不可用';
    if (status === 'error')
        return '当前运行异常';
    return '暂时无法判断';
}
//# sourceMappingURL=health.js.map