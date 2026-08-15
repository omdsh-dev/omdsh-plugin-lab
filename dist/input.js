const OUTCOMES = new Set(['worked', 'partial', 'failed']);
const RETENTION = new Set(['keep', 'unsure', 'remove']);
export const START_USAGE = 'Usage: /omdsh-start <module-name>[#version] [task-id]';
export const FEEDBACK_USAGE = 'Usage: /omdsh-feedback <worked|partial|failed> <keep|unsure|remove> [--share] [--share-note] [--dry-run] [note]';
export const RESULT_USAGE = 'Usage: /omdsh-result <worked|partial|failed> [note]';
export const JOIN_USAGE = 'Usage: /omdsh-join <latest|event-id> [--share-note]';
export const RETEST_USAGE = 'Usage: /omdsh-retest <receipt-id> <module-name>[#version] [task-id]';
export function parseStartInput(rawInput) {
    const parts = rawInput.trim().split(/\s+/u).filter(Boolean);
    const pluginSpec = parts[0];
    if (pluginSpec === undefined)
        throw new TypeError(START_USAGE);
    const hash = pluginSpec.lastIndexOf('#');
    const moduleName = hash > 0 ? pluginSpec.slice(0, hash) : pluginSpec;
    const version = hash > 0 ? pluginSpec.slice(hash + 1) : undefined;
    if (moduleName.length === 0 || version === '')
        throw new TypeError(START_USAGE);
    const taskId = parts[1];
    if (parts.length > 2)
        throw new TypeError(`${START_USAGE}. task-id must not contain spaces.`);
    return {
        plugin: { moduleName, ...version === undefined ? {} : { version } },
        ...taskId === undefined ? {} : { taskId },
    };
}
export function parseFeedbackInput(rawInput) {
    const parts = rawInput.trim().split(/\s+/u).filter(Boolean);
    const outcome = parts.shift();
    const retention = parts.shift();
    if (!OUTCOMES.has(outcome) || !RETENTION.has(retention)) {
        throw new TypeError(FEEDBACK_USAGE);
    }
    let share = false;
    let shareNote = false;
    let dryRun = false;
    const noteParts = [];
    for (const part of parts) {
        if (part === '--share')
            share = true;
        else if (part === '--share-note') {
            share = true;
            shareNote = true;
        }
        else if (part === '--dry-run')
            dryRun = true;
        else
            noteParts.push(part);
    }
    const note = noteParts.join(' ').trim();
    if (shareNote && note.length === 0) {
        throw new TypeError('--share-note requires a non-empty note');
    }
    return {
        outcome: outcome,
        retention: retention,
        ...note.length === 0 ? {} : { note },
        share,
        shareNote,
        dryRun,
    };
}
export function parseResultInput(rawInput) {
    const parts = rawInput.trim().split(/\s+/u).filter(Boolean);
    const outcome = parts.shift();
    if (!OUTCOMES.has(outcome))
        throw new TypeError(RESULT_USAGE);
    const note = parts.join(' ').trim();
    return {
        outcome: outcome,
        ...note.length === 0 ? {} : { note },
    };
}
export function retentionForOutcome(outcome) {
    if (outcome === 'worked')
        return 'keep';
    if (outcome === 'partial')
        return 'unsure';
    return 'remove';
}
//# sourceMappingURL=input.js.map