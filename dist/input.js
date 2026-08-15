const MODULE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const VERDICTS = new Set(['good', 'mixed', 'bad']);
export const START_USAGE = 'Usage: /omdsh-start <public-module-name>[#version]';
export const RESULT_USAGE = 'Usage: /omdsh-result <good|mixed|bad>';
export const JOIN_USAGE = 'Usage: /omdsh-join <latest|event-id>';
export const RETEST_USAGE = 'Usage: /omdsh-retest <receipt-id> <public-module-name>[#version]';
export function parseStartInput(rawInput) {
    const parts = rawInput.trim().split(/\s+/u).filter(Boolean);
    const pluginSpec = parts[0];
    if (pluginSpec === undefined || parts.length !== 1)
        throw new TypeError(START_USAGE);
    const hash = pluginSpec.lastIndexOf('#');
    const moduleName = hash > 0 ? pluginSpec.slice(0, hash) : pluginSpec;
    const version = hash > 0 ? pluginSpec.slice(hash + 1) : undefined;
    if (!MODULE.test(moduleName) || (version !== undefined && !VERSION.test(version))) {
        throw new TypeError(START_USAGE);
    }
    return { plugin: { moduleName, ...version === undefined ? {} : { version } } };
}
export function parseVerdict(rawInput) {
    const value = rawInput.trim();
    if (!VERDICTS.has(value))
        throw new TypeError(RESULT_USAGE);
    return value;
}
export function parseJoinTarget(rawInput) {
    const parts = rawInput.trim().split(/\s+/u).filter(Boolean);
    if (parts.length !== 1 || parts[0] === undefined
        || (parts[0] !== 'latest' && !UUID.test(parts[0])))
        throw new TypeError(JOIN_USAGE);
    return parts[0];
}
export function parseReceiptId(value) {
    if (!UUID.test(value))
        throw new TypeError(RETEST_USAGE);
    return value;
}
//# sourceMappingURL=input.js.map