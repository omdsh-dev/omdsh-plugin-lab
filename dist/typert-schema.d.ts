import { z } from 'zod';
export declare const PLUGIN_LAB_REMOTE_DESCRIPTORS: readonly [{
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
            readonly schema: z.ZodIntersection<z.ZodString, z.ZodUnknown>;
        };
    }];
    readonly result: {
        readonly mode: "strict";
        readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelProbe";
        readonly schema: z.ZodObject<{
            active: z.ZodReadonly<z.ZodBoolean>;
            plugin: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
                moduleName: z.ZodString;
                version: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            health: z.ZodReadonly<z.ZodUnion<readonly [z.ZodLiteral<"ok">, z.ZodLiteral<"unavailable">, z.ZodLiteral<"error">, z.ZodLiteral<"unknown">]>>;
            suggestedCategory: z.ZodReadonly<z.ZodUnion<readonly [z.ZodLiteral<"installation">, z.ZodLiteral<"startup">, z.ZodLiteral<"invocation">, z.ZodLiteral<"compatibility">, z.ZodLiteral<"reliability">, z.ZodLiteral<"performance">, z.ZodLiteral<"result_quality">, z.ZodLiteral<"general">]>>;
            draft: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
                eventId: z.ZodReadonly<z.ZodString>;
                verdict: z.ZodReadonly<z.ZodUnion<readonly [z.ZodLiteral<"good">, z.ZodLiteral<"mixed">, z.ZodLiteral<"bad">]>>;
                category: z.ZodReadonly<z.ZodUnion<readonly [z.ZodLiteral<"installation">, z.ZodLiteral<"startup">, z.ZodLiteral<"invocation">, z.ZodLiteral<"compatibility">, z.ZodLiteral<"reliability">, z.ZodLiteral<"performance">, z.ZodLiteral<"result_quality">, z.ZodLiteral<"general">]>>;
                summary: z.ZodReadonly<z.ZodString>;
                text: z.ZodReadonly<z.ZodString>;
            }, z.core.$strip>>>;
            text: z.ZodReadonly<z.ZodString>;
        }, z.core.$strip>;
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
            readonly schema: z.ZodIntersection<z.ZodString, z.ZodUnknown>;
        };
    }, {
        readonly name: "plugin";
        readonly wire: "plugin";
        readonly source: "json";
        readonly codec: {
            readonly mode: "strict";
            readonly typeSymbol: "@oh-my-dsh/plugin-lab#TrialPluginRef";
            readonly schema: z.ZodObject<{
                moduleName: z.ZodString;
                version: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }];
    readonly result: {
        readonly mode: "strict";
        readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
        readonly schema: z.ZodObject<{
            ok: z.ZodReadonly<z.ZodBoolean>;
            text: z.ZodReadonly<z.ZodString>;
            eventId: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
            summary: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
        }, z.core.$strip>;
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
            readonly schema: z.ZodIntersection<z.ZodString, z.ZodUnknown>;
        };
    }, {
        readonly name: "verdict";
        readonly wire: "verdict";
        readonly source: "json";
        readonly codec: {
            readonly mode: "strict";
            readonly typeSymbol: "@oh-my-dsh/plugin-lab#ExperienceVerdict";
            readonly schema: z.ZodUnion<readonly [z.ZodLiteral<"good">, z.ZodLiteral<"mixed">, z.ZodLiteral<"bad">]>;
        };
    }, {
        readonly name: "category";
        readonly wire: "category";
        readonly source: "json";
        readonly codec: {
            readonly mode: "strict";
            readonly typeSymbol: "@oh-my-dsh/plugin-lab#FeedbackCategory";
            readonly schema: z.ZodUnion<readonly [z.ZodLiteral<"installation">, z.ZodLiteral<"startup">, z.ZodLiteral<"invocation">, z.ZodLiteral<"compatibility">, z.ZodLiteral<"reliability">, z.ZodLiteral<"performance">, z.ZodLiteral<"result_quality">, z.ZodLiteral<"general">]>;
        };
    }];
    readonly result: {
        readonly mode: "strict";
        readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
        readonly schema: z.ZodObject<{
            ok: z.ZodReadonly<z.ZodBoolean>;
            text: z.ZodReadonly<z.ZodString>;
            eventId: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
            summary: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
        }, z.core.$strip>;
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
            readonly schema: z.ZodIntersection<z.ZodString, z.ZodUnknown>;
        };
    }, {
        readonly name: "summary";
        readonly wire: "summary";
        readonly source: "json";
        readonly codec: {
            readonly mode: "strict";
            readonly typeSymbol: "string";
            readonly schema: z.ZodString;
        };
    }];
    readonly result: {
        readonly mode: "strict";
        readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
        readonly schema: z.ZodObject<{
            ok: z.ZodReadonly<z.ZodBoolean>;
            text: z.ZodReadonly<z.ZodString>;
            eventId: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
            summary: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
        }, z.core.$strip>;
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
            readonly schema: z.ZodIntersection<z.ZodString, z.ZodUnknown>;
        };
    }];
    readonly result: {
        readonly mode: "strict";
        readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
        readonly schema: z.ZodObject<{
            ok: z.ZodReadonly<z.ZodBoolean>;
            text: z.ZodReadonly<z.ZodString>;
            eventId: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
            summary: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
        }, z.core.$strip>;
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
            readonly schema: z.ZodIntersection<z.ZodString, z.ZodUnknown>;
        };
    }];
    readonly result: {
        readonly mode: "strict";
        readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
        readonly schema: z.ZodObject<{
            ok: z.ZodReadonly<z.ZodBoolean>;
            text: z.ZodReadonly<z.ZodString>;
            eventId: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
            summary: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
        }, z.core.$strip>;
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
            readonly schema: z.ZodIntersection<z.ZodString, z.ZodUnknown>;
        };
    }, {
        readonly name: "eventId";
        readonly wire: "eventId";
        readonly source: "json";
        readonly codec: {
            readonly mode: "strict";
            readonly typeSymbol: "string";
            readonly schema: z.ZodString;
        };
    }];
    readonly result: {
        readonly mode: "strict";
        readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
        readonly schema: z.ZodObject<{
            ok: z.ZodReadonly<z.ZodBoolean>;
            text: z.ZodReadonly<z.ZodString>;
            eventId: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
            summary: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
        }, z.core.$strip>;
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
            readonly schema: z.ZodIntersection<z.ZodString, z.ZodUnknown>;
        };
    }, {
        readonly name: "markRead";
        readonly wire: "markRead";
        readonly source: "json";
        readonly codec: {
            readonly mode: "strict";
            readonly typeSymbol: "boolean";
            readonly schema: z.ZodBoolean;
        };
    }];
    readonly result: {
        readonly mode: "strict";
        readonly typeSymbol: "@oh-my-dsh/plugin-lab#ReceiptBoxSnapshot";
        readonly schema: z.ZodObject<{
            items: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                eventId: z.ZodReadonly<z.ZodString>;
                plugin: z.ZodReadonly<z.ZodObject<{
                    moduleName: z.ZodString;
                    version: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                summary: z.ZodReadonly<z.ZodString>;
                localState: z.ZodReadonly<z.ZodUnion<readonly [z.ZodLiteral<"draft">, z.ZodLiteral<"queued">, z.ZodLiteral<"submitted">]>>;
                status: z.ZodOptional<z.ZodReadonly<z.ZodUnion<readonly [z.ZodLiteral<"received">, z.ZodLiteral<"clustered">, z.ZodLiteral<"reported">, z.ZodLiteral<"fix-released">, z.ZodLiteral<"retest-requested">, z.ZodLiteral<"verified">, z.ZodLiteral<"confirmed">, z.ZodLiteral<"closed">]>>>;
                similarReports: z.ZodOptional<z.ZodReadonly<z.ZodNumber>>;
                recommendedVersion: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
                trackingUrl: z.ZodOptional<z.ZodReadonly<z.ZodString>>;
                unread: z.ZodReadonly<z.ZodBoolean>;
            }, z.core.$strip>>>>;
            unreadCount: z.ZodReadonly<z.ZodNumber>;
        }, z.core.$strip>;
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
            readonly schema: z.ZodIntersection<z.ZodString, z.ZodUnknown>;
        };
    }];
    readonly result: {
        readonly mode: "strict";
        readonly typeSymbol: "@oh-my-dsh/plugin-lab#pluginLab/inbox:result";
        readonly schema: z.ZodString;
    };
    readonly sourceLocation: {
        readonly file: "src/panel-service.ts";
        readonly line: 43;
        readonly column: 3;
    };
}];
