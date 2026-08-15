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
            text: z.ZodReadonly<z.ZodString>;
        }, z.core.$strip>;
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
        }, z.core.$strip>;
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
            readonly schema: z.ZodIntersection<z.ZodString, z.ZodUnknown>;
        };
    }];
    readonly result: {
        readonly mode: "strict";
        readonly typeSymbol: "@oh-my-dsh/plugin-lab#PluginLabPanelAction";
        readonly schema: z.ZodObject<{
            ok: z.ZodReadonly<z.ZodBoolean>;
            text: z.ZodReadonly<z.ZodString>;
        }, z.core.$strip>;
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
