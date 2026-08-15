import type { HealthStatus } from './protocol.js';
export declare const FIBER_PHASE: {
    readonly PENDING: 0;
    readonly LOADING: 1;
    readonly ACTIVE: 2;
    readonly FAILED: 3;
    readonly DISPOSED: 4;
    readonly UNLOADING: 5;
};
export interface LoaderEntryLike {
    readonly disabled?: boolean;
    readonly options?: {
        readonly name?: string;
        readonly group?: boolean;
    };
    readonly fiber?: {
        readonly state?: number;
    };
}
export interface LoaderLike {
    entries(): Iterable<LoaderEntryLike>;
}
/**
 * Read only Host-owned lifecycle cells. No plugin method, logger, Session,
 * exception, filesystem, environment or network capability is reachable here.
 */
export declare function probeLoaderHealth(loader: LoaderLike | undefined, moduleName: string): HealthStatus;
export declare function healthText(status: HealthStatus): string;
