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
                plugin: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodObject<{
                    moduleName: import("zod").ZodString;
                    version: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>>>;
                health: import("zod").ZodReadonly<import("zod").ZodUnion<readonly [import("zod").ZodLiteral<"ok">, import("zod").ZodLiteral<"unavailable">, import("zod").ZodLiteral<"error">, import("zod").ZodLiteral<"unknown">]>>;
                suggestedCategory: import("zod").ZodReadonly<import("zod").ZodUnion<readonly [import("zod").ZodLiteral<"installation">, import("zod").ZodLiteral<"startup">, import("zod").ZodLiteral<"invocation">, import("zod").ZodLiteral<"compatibility">, import("zod").ZodLiteral<"reliability">, import("zod").ZodLiteral<"performance">, import("zod").ZodLiteral<"result_quality">, import("zod").ZodLiteral<"general">]>>;
                draft: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodObject<{
                    eventId: import("zod").ZodReadonly<import("zod").ZodString>;
                    verdict: import("zod").ZodReadonly<import("zod").ZodUnion<readonly [import("zod").ZodLiteral<"good">, import("zod").ZodLiteral<"mixed">, import("zod").ZodLiteral<"bad">]>>;
                    category: import("zod").ZodReadonly<import("zod").ZodUnion<readonly [import("zod").ZodLiteral<"installation">, import("zod").ZodLiteral<"startup">, import("zod").ZodLiteral<"invocation">, import("zod").ZodLiteral<"compatibility">, import("zod").ZodLiteral<"reliability">, import("zod").ZodLiteral<"performance">, import("zod").ZodLiteral<"result_quality">, import("zod").ZodLiteral<"general">]>>;
                    summary: import("zod").ZodReadonly<import("zod").ZodString>;
                    text: import("zod").ZodReadonly<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>>>;
                text: import("zod").ZodReadonly<import("zod").ZodString>;
            }, import("zod/v4/core").$strip>;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 24;
            readonly column: 3;
        };
    }, {
        readonly id: "@oh-my-dsh/plugin-lab#pluginLab/select";
        readonly service: "pluginLab";
        readonly namespace: "pluginLab";
        readonly method: "select";
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
            readonly name: "plugin";
            readonly wire: "plugin";
            readonly source: "json";
            readonly codec: {
                readonly mode: "strict";
                readonly typeSymbol: "@oh-my-dsh/plugin-lab#TrialPluginRef";
                readonly schema: import("zod").ZodObject<{
                    moduleName: import("zod").ZodString;
                    version: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>;
            };
        }];
        readonly result: {
            readonly mode: "strict";
            readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
            readonly schema: import("zod").ZodObject<{
                ok: import("zod").ZodReadonly<import("zod").ZodBoolean>;
                text: import("zod").ZodReadonly<import("zod").ZodString>;
                eventId: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
                summary: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
            }, import("zod/v4/core").$strip>;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 33;
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
                eventId: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
                summary: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
            }, import("zod/v4/core").$strip>;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 29;
            readonly column: 3;
        };
    }, {
        readonly id: "@oh-my-dsh/plugin-lab#pluginLab/revise";
        readonly service: "pluginLab";
        readonly namespace: "pluginLab";
        readonly method: "revise";
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
            readonly name: "summary";
            readonly wire: "summary";
            readonly source: "json";
            readonly codec: {
                readonly mode: "strict";
                readonly typeSymbol: "string";
                readonly schema: import("zod").ZodString;
            };
        }];
        readonly result: {
            readonly mode: "strict";
            readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
            readonly schema: import("zod").ZodObject<{
                ok: import("zod").ZodReadonly<import("zod").ZodBoolean>;
                text: import("zod").ZodReadonly<import("zod").ZodString>;
                eventId: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
                summary: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
            }, import("zod/v4/core").$strip>;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 50;
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
                eventId: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
                summary: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
            }, import("zod/v4/core").$strip>;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 38;
            readonly column: 3;
        };
    }, {
        readonly id: "@oh-my-dsh/plugin-lab#pluginLab/cancel";
        readonly service: "pluginLab";
        readonly namespace: "pluginLab";
        readonly method: "cancel";
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
                eventId: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
                summary: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
            }, import("zod/v4/core").$strip>;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 47;
            readonly column: 3;
        };
    }, {
        readonly id: "@oh-my-dsh/plugin-lab#pluginLab/discard";
        readonly service: "pluginLab";
        readonly namespace: "pluginLab";
        readonly method: "discard";
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
            readonly name: "eventId";
            readonly wire: "eventId";
            readonly source: "json";
            readonly codec: {
                readonly mode: "strict";
                readonly typeSymbol: "string";
                readonly schema: import("zod").ZodString;
            };
        }];
        readonly result: {
            readonly mode: "strict";
            readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
            readonly schema: import("zod").ZodObject<{
                ok: import("zod").ZodReadonly<import("zod").ZodBoolean>;
                text: import("zod").ZodReadonly<import("zod").ZodString>;
                eventId: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
                summary: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
            }, import("zod/v4/core").$strip>;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 51;
            readonly column: 3;
        };
    }, {
        readonly id: "@oh-my-dsh/plugin-lab#pluginLab/receipts";
        readonly service: "pluginLab";
        readonly namespace: "pluginLab";
        readonly method: "receipts";
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
            readonly name: "markRead";
            readonly wire: "markRead";
            readonly source: "json";
            readonly codec: {
                readonly mode: "strict";
                readonly typeSymbol: "boolean";
                readonly schema: import("zod").ZodBoolean;
            };
        }];
        readonly result: {
            readonly mode: "strict";
            readonly typeSymbol: "@oh-my-dsh/plugin-lab#ReceiptBoxSnapshot";
            readonly schema: import("zod").ZodObject<{
                items: import("zod").ZodReadonly<import("zod").ZodArray<import("zod").ZodReadonly<import("zod").ZodObject<{
                    eventId: import("zod").ZodReadonly<import("zod").ZodString>;
                    plugin: import("zod").ZodReadonly<import("zod").ZodObject<{
                        moduleName: import("zod").ZodString;
                        version: import("zod").ZodOptional<import("zod").ZodString>;
                    }, import("zod/v4/core").$strip>>;
                    summary: import("zod").ZodReadonly<import("zod").ZodString>;
                    localState: import("zod").ZodReadonly<import("zod").ZodUnion<readonly [import("zod").ZodLiteral<"draft">, import("zod").ZodLiteral<"queued">, import("zod").ZodLiteral<"submitted">]>>;
                    status: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodUnion<readonly [import("zod").ZodLiteral<"received">, import("zod").ZodLiteral<"clustered">, import("zod").ZodLiteral<"reported">, import("zod").ZodLiteral<"fix-released">, import("zod").ZodLiteral<"retest-requested">, import("zod").ZodLiteral<"verified">, import("zod").ZodLiteral<"confirmed">, import("zod").ZodLiteral<"closed">]>>>;
                    similarReports: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodNumber>>;
                    recommendedVersion: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
                    trackingUrl: import("zod").ZodOptional<import("zod").ZodReadonly<import("zod").ZodString>>;
                    unread: import("zod").ZodReadonly<import("zod").ZodBoolean>;
                }, import("zod/v4/core").$strip>>>>;
                unreadCount: import("zod").ZodReadonly<import("zod").ZodNumber>;
            }, import("zod/v4/core").$strip>;
        };
        readonly sourceLocation: {
            readonly file: "src/panel-service.ts";
            readonly line: 55;
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
