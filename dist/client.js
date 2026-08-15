window.__ModuleLoader__.load({ id: "@oh-my-dsh/plugin-lab", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let react = require("react");
react = __toESM(react);
let react_jsx_runtime = require("react/jsx-runtime");
react_jsx_runtime = __toESM(react_jsx_runtime);

//#region src/client/controller.ts
const INITIAL_VIEW = Object.freeze({ active: false });
function commandText(result) {
	if (result === void 0) return "命令未被 DSH 接收。";
	return result.text ?? (result.kind === "success" ? "完成。" : "操作失败。");
}
var LabController = class {
	view = INITIAL_VIEW;
	listeners = /* @__PURE__ */ new Set();
	constructor(remote, sessionId) {
		this.remote = remote;
		this.sessionId = sessionId;
	}
	getSnapshot = () => this.view;
	subscribe = (listener) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};
	setTrialActive(active) {
		this.publish({
			...this.view,
			active
		});
	}
	async record(messageId, verdict) {
		this.publish({
			...this.view,
			pending: {
				messageId,
				verdict,
				phase: "saving"
			}
		});
		const settled = await this.execute(`/omdsh-result ${verdict}`);
		if (settled.ok) this.publish({
			...this.view,
			active: false,
			pending: {
				messageId,
				verdict,
				phase: "local",
				text: settled.text
			}
		});
		else this.publish({
			...this.view,
			pending: {
				messageId,
				verdict,
				phase: "error",
				text: settled.text
			}
		});
	}
	async join() {
		const pending = this.view.pending;
		if (pending === void 0 || pending.phase !== "local") return;
		this.publish({
			...this.view,
			pending: {
				...pending,
				phase: "joining"
			}
		});
		const settled = await this.execute("/omdsh-join latest");
		this.publish({
			...this.view,
			pending: {
				...pending,
				phase: settled.ok ? "joined" : "error",
				text: settled.text
			}
		});
	}
	async inbox() {
		return (await this.execute("/omdsh-inbox")).text;
	}
	async probe() {
		return (await this.execute("/omdsh-probe")).text;
	}
	dismiss() {
		const { pending: _pending,...view } = this.view;
		this.publish(view);
	}
	async execute(line) {
		try {
			const result = await this.remote.execute(this.sessionId, line);
			if (!result.ok) return {
				ok: false,
				text: `${result.error.message} (${result.error.code})`
			};
			const command = result.value?.result;
			return {
				ok: command?.kind === "success",
				text: commandText(command)
			};
		} catch (error) {
			return {
				ok: false,
				text: error instanceof Error ? error.message : String(error)
			};
		}
	}
	publish(view) {
		this.view = Object.freeze(view);
		for (const listener of [...this.listeners]) listener();
	}
};

//#endregion
//#region src/client/ExperienceResultCard.tsx
const triggerStyle = {
	border: "none",
	borderRadius: 14,
	padding: "4px 9px",
	cursor: "pointer",
	background: "var(--dsw-alias-interactive-bg-hover)",
	color: "var(--dsw-alias-label-secondary)",
	fontSize: 12
};
const panelStyle = {
	position: "absolute",
	zIndex: 30,
	right: 0,
	bottom: 34,
	width: 330,
	padding: 14,
	border: "1px solid var(--dsw-alias-border-secondary)",
	borderRadius: 12,
	background: "var(--dsw-alias-bg-primary)",
	color: "var(--dsw-alias-label-primary)",
	boxShadow: "0 12px 36px rgba(0,0,0,.18)",
	fontSize: 13,
	lineHeight: 1.5
};
const choiceStyle = {
	border: "1px solid var(--dsw-alias-border-secondary)",
	borderRadius: 9,
	padding: "7px 9px",
	background: "transparent",
	color: "inherit",
	cursor: "pointer"
};
function shareLabel(verdict) {
	if (verdict === "good") return "贡献聚合实测";
	if (verdict === "mixed") return "查找相似反馈";
	return "加入并等待修复";
}
/** Latest durable assistant identity from the rc.6 conversation projection. */
function latestAssistantMessageId(nodes) {
	for (let index = nodes.length - 1; index >= 0; index -= 1) {
		const node = nodes[index];
		if (node?.kind === "assistant" && node.messageId !== void 0) return node.messageId;
	}
}
function visible(view, messageId, latestMessageId) {
	return view.pending?.messageId === messageId || view.active && latestMessageId === messageId;
}
function ExperienceResultCard({ messageId, useSession, usePluginLab, record, join, dismiss }) {
	const view = usePluginLab((value) => value);
	const latestMessageId = useSession((snapshot) => latestAssistantMessageId(snapshot.nodes));
	const [open, setOpen] = (0, react.useState)(false);
	if (!visible(view, messageId, latestMessageId)) return null;
	const pending = view.pending?.messageId === messageId ? view.pending : void 0;
	pending?.phase === "saving" || pending?.phase;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		style: {
			position: "relative",
			display: "inline-flex"
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type: "button",
			style: triggerStyle,
			onClick: () => {
				setOpen((value) => !value);
			},
			children: pending?.phase === "joined" ? "已加入跟进" : "体验结果"
		}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
			role: "dialog",
			"aria-label": "插件体验结果",
			style: panelStyle,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
					style: {
						display: "block",
						marginBottom: 9
					},
					children: "你觉得这个插件好用吗？"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						display: "block",
						marginBottom: 9,
						color: "var(--dsw-alias-label-secondary)"
					},
					children: "Agent 只知道运行状态，不会读取会话或日志替你判断。"
				}),
				pending === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: {
						display: "grid",
						gridTemplateColumns: "repeat(3, 1fr)",
						gap: 7
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: choiceStyle,
							onClick: () => {
								record(messageId, "good");
							},
							children: "好用"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: choiceStyle,
							onClick: () => {
								record(messageId, "mixed");
							},
							children: "一般"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: choiceStyle,
							onClick: () => {
								record(messageId, "bad");
							},
							children: "不好用"
						})
					]
				}),
				pending !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: {
						display: "grid",
						gap: 9
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								whiteSpace: "pre-wrap",
								color: "var(--dsw-alias-label-secondary)"
							},
							children: pending.phase === "saving" ? "正在只存到本机…" : pending.text
						}),
						pending.phase === "local" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: {
								...choiceStyle,
								background: "var(--dsw-alias-interactive-bg-primary)"
							},
							onClick: () => {
								join();
							},
							children: shareLabel(pending.verdict)
						}),
						(pending.phase === "joined" || pending.phase === "error") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: choiceStyle,
							onClick: () => {
								dismiss();
								setOpen(false);
							},
							children: "完成"
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
					style: {
						display: "block",
						marginTop: 10,
						color: "var(--dsw-alias-label-tertiary)"
					},
					children: "第一步只保存在本机；加入跟进只发送插件、版本、状态枚举和你的选择。网络传输并非绝对匿名。"
				})
			]
		})]
	});
}

//#endregion
//#region src/client/InboxButton.tsx
const button$1 = {
	height: 28,
	padding: "0 9px",
	border: "none",
	borderRadius: 14,
	cursor: "pointer",
	background: "transparent",
	color: "var(--dsw-alias-label-tertiary)",
	fontSize: 12
};
function InboxButton({ checkInbox }) {
	const [text, setText] = (0, react.useState)(null);
	const [busy, setBusy] = (0, react.useState)(false);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		style: {
			position: "relative",
			display: "inline-flex"
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type: "button",
			style: button$1,
			disabled: busy,
			onClick: () => {
				if (text !== null) return setText(null);
				setBusy(true);
				checkInbox().then(setText).finally(() => {
					setBusy(false);
				});
			},
			children: busy ? "检查中…" : "反馈进展"
		}), text !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			role: "status",
			style: {
				position: "absolute",
				zIndex: 30,
				left: 0,
				bottom: 34,
				width: 330,
				padding: 12,
				border: "1px solid var(--dsw-alias-border-secondary)",
				borderRadius: 10,
				background: "var(--dsw-alias-bg-primary)",
				color: "var(--dsw-alias-label-secondary)",
				boxShadow: "0 12px 36px rgba(0,0,0,.18)",
				whiteSpace: "pre-wrap",
				fontSize: 13
			},
			children: text
		})]
	});
}

//#endregion
//#region src/client/ProbeButton.tsx
const button = {
	height: 28,
	padding: "0 9px",
	border: "none",
	borderRadius: 14,
	cursor: "pointer",
	background: "transparent",
	color: "var(--dsw-alias-label-tertiary)",
	fontSize: 12
};
function ProbeButton({ checkHealth }) {
	const [text, setText] = (0, react.useState)(null);
	const [busy, setBusy] = (0, react.useState)(false);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		style: {
			position: "relative",
			display: "inline-flex"
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type: "button",
			style: button,
			disabled: busy,
			onClick: () => {
				if (text !== null) return setText(null);
				setBusy(true);
				checkHealth().then(setText).finally(() => {
					setBusy(false);
				});
			},
			children: busy ? "探活中…" : "插件探活"
		}), text !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			role: "status",
			style: {
				position: "absolute",
				zIndex: 30,
				left: 0,
				bottom: 34,
				width: 330,
				padding: 12,
				border: "1px solid var(--dsw-alias-border-secondary)",
				borderRadius: 10,
				background: "var(--dsw-alias-bg-primary)",
				color: "var(--dsw-alias-label-secondary)",
				boxShadow: "0 12px 36px rgba(0,0,0,.18)",
				whiteSpace: "pre-wrap",
				fontSize: 13
			},
			children: text
		})]
	});
}

//#endregion
//#region src/client/index.ts
const inject = [
	"slots",
	"remote",
	"remote.commands"
];
function apply(ctx) {
	const controllers = /* @__PURE__ */ new Map();
	ctx.effect(() => () => {
		controllers.clear();
	}, "plugin-lab: client controller lifecycle");
	const controllerFor = (sessionId) => {
		let controller = controllers.get(sessionId);
		if (controller === void 0) {
			controller = new LabController(ctx.remote.commands, sessionId);
			controllers.set(sessionId, controller);
		}
		return controller;
	};
	ctx.on("command/executed", (sessionId, name, result) => {
		if (result.kind !== "success") return;
		if (name === "omdsh-start" || name === "omdsh-retest") controllerFor(sessionId).setTrialActive(true);
		if (name === "omdsh-result" || name === "omdsh-feedback") controllerFor(sessionId).setTrialActive(false);
	});
	ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
		name: "conversation.chat.assistant-actions",
		id: "omdsh-plugin-lab",
		order: 20,
		inject: (sessionId) => {
			const controller = controllerFor(sessionId);
			return {
				hooks: { pluginLab: controller },
				record: (messageId, outcome) => controller.record(messageId, outcome),
				join: () => controller.join(),
				dismiss: () => controller.dismiss()
			};
		}
	}, ExperienceResultCard));
	ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
		name: "conversation.input.left",
		id: "omdsh-plugin-lab-inbox",
		order: 40,
		inject: (sessionId) => ({ checkInbox: () => controllerFor(sessionId).inbox() })
	}, InboxButton));
	ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
		name: "conversation.input.left",
		id: "omdsh-plugin-lab-probe",
		order: 39,
		inject: (sessionId) => ({ checkHealth: () => controllerFor(sessionId).probe() })
	}, ProbeButton));
}

//#endregion
exports.ExperienceResultCard = ExperienceResultCard;
exports.InboxButton = InboxButton;
exports.LabController = LabController;
exports.ProbeButton = ProbeButton;
exports.apply = apply;
exports.inject = inject;
return module.exports; } });
//# sourceMappingURL=client.js.map