export declare const TYPERT: {
    package: string;
    face: string;
    schemas: never[];
    invocations: readonly [{
        readonly id: "@oh-my-dsh/plugin-lab#pluginLab/probe";
        readonly service: "pluginLab";
        readonly namespace: "pluginLab";
        readonly method: "probe";
        readonly invocation: {
            readonly kind: "direct";
        };
        readonly scope: {
            readonly context: "agent";
            readonly wire: "agentId";
        };
        readonly parameters: readonly [{
            readonly name: "agent";
            readonly wire: "agentId";
            readonly source: "lookup";
            readonly lookup: "agent";
            readonly codec: {
                readonly mode: "strict";
                readonly typeSymbol: "@deepseek-ai/dsh-session/types#SessionId";
                readonly schema: import("zod").ZodIntersection<import("zod").ZodString, import("zod").ZodUnknown>;
            };
        }];
        readonly result: {
            readonly mode: "strict";
            readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelProbe";
            readonly schema: import("zod").ZodObject<{
                active: import("zod").ZodReadonly<import("zod").ZodBoolean>;
                health: import("zod").ZodReadonly<import("zod").ZodUnion<readonly [import("zod").ZodLiteral<"ok">, import("zod").ZodLiteral<"unavailable">, import("zod").ZodLiteral<"error">, import("zod").ZodLiteral<"unknown">]>>;
                text: import("zod").ZodReadonly<import("zod").ZodString>;
            }, import("zod/v4/core").$strip>;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 24;
            readonly column: 3;
        };
    }, {
        readonly id: "@oh-my-dsh/plugin-lab#pluginLab/record";
        readonly service: "pluginLab";
        readonly namespace: "pluginLab";
        readonly method: "record";
        readonly invocation: {
            readonly kind: "direct";
        };
        readonly scope: {
            readonly context: "agent";
            readonly wire: "agentId";
        };
        readonly parameters: readonly [{
            readonly name: "agent";
            readonly wire: "agentId";
            readonly source: "lookup";
            readonly lookup: "agent";
            readonly codec: {
                readonly mode: "strict";
                readonly typeSymbol: "@deepseek-ai/dsh-session/types#SessionId";
                readonly schema: import("zod").ZodIntersection<import("zod").ZodString, import("zod").ZodUnknown>;
            };
        }, {
            readonly name: "verdict";
            readonly wire: "verdict";
            readonly source: "json";
            readonly codec: {
                readonly mode: "strict";
                readonly typeSymbol: "@oh-my-dsh/plugin-lab#ExperienceVerdict";
                readonly schema: import("zod").ZodUnion<readonly [import("zod").ZodLiteral<"good">, import("zod").ZodLiteral<"mixed">, import("zod").ZodLiteral<"bad">]>;
            };
        }, {
            readonly name: "category";
            readonly wire: "category";
            readonly source: "json";
            readonly codec: {
                readonly mode: "strict";
                readonly typeSymbol: "@oh-my-dsh/plugin-lab#FeedbackCategory";
                readonly schema: import("zod").ZodUnion<readonly [import("zod").ZodLiteral<"installation">, import("zod").ZodLiteral<"startup">, import("zod").ZodLiteral<"invocation">, import("zod").ZodLiteral<"compatibility">, import("zod").ZodLiteral<"reliability">, import("zod").ZodLiteral<"performance">, import("zod").ZodLiteral<"result_quality">, import("zod").ZodLiteral<"general">]>;
            };
        }];
        readonly result: {
            readonly mode: "strict";
            readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
            readonly schema: import("zod").ZodObject<{
                ok: import("zod").ZodReadonly<import("zod").ZodBoolean>;
                text: import("zod").ZodReadonly<import("zod").ZodString>;
            }, import("zod/v4/core").$strip>;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 29;
            readonly column: 3;
        };
    }, {
        readonly id: "@oh-my-dsh/plugin-lab#pluginLab/join";
        readonly service: "pluginLab";
        readonly namespace: "pluginLab";
        readonly method: "join";
        readonly invocation: {
            readonly kind: "direct";
        };
        readonly scope: {
            readonly context: "agent";
            readonly wire: "agentId";
        };
        readonly parameters: readonly [{
            readonly name: "agent";
            readonly wire: "agentId";
            readonly source: "lookup";
            readonly lookup: "agent";
            readonly codec: {
                readonly mode: "strict";
                readonly typeSymbol: "@deepseek-ai/dsh-session/types#SessionId";
                readonly schema: import("zod").ZodIntersection<import("zod").ZodString, import("zod").ZodUnknown>;
            };
        }];
        readonly result: {
            readonly mode: "strict";
            readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
            readonly schema: import("zod").ZodObject<{
                ok: import("zod").ZodReadonly<import("zod").ZodBoolean>;
                text: import("zod").ZodReadonly<import("zod").ZodString>;
            }, import("zod/v4/core").$strip>;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 38;
            readonly column: 3;
        };
    }, {
        readonly id: "@oh-my-dsh/plugin-lab#pluginLab/inbox";
        readonly service: "pluginLab";
        readonly namespace: "pluginLab";
        readonly method: "inbox";
        readonly invocation: {
            readonly kind: "direct";
        };
        readonly scope: {
            readonly context: "agent";
            readonly wire: "agentId";
        };
        readonly parameters: readonly [{
            readonly name: "agent";
            readonly wire: "agentId";
            readonly source: "lookup";
            readonly lookup: "agent";
            readonly codec: {
                readonly mode: "strict";
                readonly typeSymbol: "@deepseek-ai/dsh-session/types#SessionId";
                readonly schema: import("zod").ZodIntersection<import("zod").ZodString, import("zod").ZodUnknown>;
            };
        }];
        readonly result: {
            readonly mode: "strict";
            readonly typeSymbol: "@oh-my-dsh/plugin-lab#pluginLab/inbox:result";
            readonly schema: import("zod").ZodString;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 43;
            readonly column: 3;
        };
    }];
    model: {
        services: never[];
        events: never[];
        objects: never[];
    };
};
