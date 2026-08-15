import type { RuntimeCrashSignal } from './protocol.js';
/** Keep only a package-relative or built-in first frame, never a machine path or function name. */
export declare function sanitizeCrashFrame(stack: unknown): string | undefined;
export declare function runtimeCrashSignal(error: unknown, origin: RuntimeCrashSignal['origin']): RuntimeCrashSignal;
