import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
const remoteInitializers = [];
/** Non-durable UI RPC. It never appends command lifecycle nodes to the Session. */
export class PluginLabPanelService extends TypertRemoteService {
    handlers;
    constructor(ctx, handlers) {
        super(ctx, 'pluginLab');
        this.handlers = handlers;
        for (const initialize of remoteInitializers)
            initialize.call(this);
    }
    probe(agent) {
        return this.handlers.probe(agent);
    }
    record(agent, verdict, category) {
        return this.handlers.record(agent, verdict, category);
    }
    join(agent) {
        return this.handlers.join(agent);
    }
    inbox(agent) {
        return this.handlers.inbox(agent);
    }
}
for (const method of ['probe', 'record', 'join', 'inbox']) {
    Remote(PluginLabPanelService.prototype[method], {
        kind: 'method',
        name: method,
        static: false,
        private: false,
        addInitializer(initializer) {
            remoteInitializers.push(initializer);
        },
    });
}
//# sourceMappingURL=panel-service.js.map