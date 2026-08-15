import { createHash } from 'node:crypto';
const LOCATION = /(?:file:\/\/)?(?:[A-Za-z]:)?[^()\s]+:\d+:\d+/u;
const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/u;
const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
function errorName(value) {
    return typeof value === 'string' && ERROR_NAME.test(value) ? value : 'Error';
}
function errorCode(error) {
    if (typeof error !== 'object' || error === null || !('code' in error))
        return undefined;
    return typeof error.code === 'string' && ERROR_CODE.test(error.code) ? error.code : undefined;
}
/** Keep only a package-relative or built-in first frame, never a machine path or function name. */
export function sanitizeCrashFrame(stack) {
    if (typeof stack !== 'string')
        return undefined;
    for (const line of stack.split('\n').slice(1)) {
        const matched = line.match(LOCATION)?.[0];
        if (matched === undefined)
            continue;
        const normalized = matched.replace(/^file:\/\//u, '').replaceAll('\\', '/');
        if (normalized.startsWith('node:'))
            return normalized.slice(0, 200);
        const dependency = normalized.lastIndexOf('/node_modules/');
        if (dependency >= 0)
            return `node_modules/${normalized.slice(dependency + '/node_modules/'.length)}`.slice(0, 200);
        const file = normalized.split('/').at(-1);
        return file === undefined ? undefined : `<app>/${file}`.slice(0, 200);
    }
    return undefined;
}
export function runtimeCrashSignal(error, origin) {
    const row = typeof error === 'object' && error !== null ? error : {};
    const name = errorName(row.name);
    const code = errorCode(error);
    const frame = sanitizeCrashFrame(row.stack);
    const fingerprint = createHash('sha256')
        .update([name, code ?? '', origin, frame ?? ''].join('\u001f'))
        .digest('hex')
        .slice(0, 20);
    return {
        fingerprint,
        name,
        origin,
        ...code === undefined ? {} : { code },
        ...frame === undefined ? {} : { frame },
    };
}
//# sourceMappingURL=crash.js.map