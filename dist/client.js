import { useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";

//#region src/client/controller.ts
const INITIAL_VIEW = Object.freeze({ active: false });
function commandText(result) {
	if (result === void 0) return "命令未被 DSH 接收。";
	return result.text ?? (result.kind === "success" ? "完成。" : "操作失败。");
}
var LabController = class {
	view = INITIAL_VIEW;
	listeners = /* @__PURE__ */ new Set();
	mounted = /* @__PURE__ */ new Map();
	mountOrder = 0;
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
	observe(messageId) {
		this.mounted.set(messageId, ++this.mountOrder);
		this.publishLatest();
		return () => {
			this.mounted.delete(messageId);
			this.publishLatest();
		};
	}
	async record(messageId, outcome) {
		this.publish({
			...this.view,
			pending: {
				messageId,
				outcome,
				phase: "saving"
			}
		});
		const settled = await this.execute(`/omdsh-result ${outcome}`);
		if (settled.ok) this.publish({
			...this.view,
			active: false,
			pending: {
				messageId,
				outcome,
				phase: "local",
				text: settled.text
			}
		});
		else this.publish({
			...this.view,
			pending: {
				messageId,
				outcome,
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
	publishLatest() {
		let latest;
		for (const row of this.mounted) if (latest === void 0 || row[1] > latest[1]) latest = row;
		const { latestMessageId: _latestMessageId,...view } = this.view;
		this.publish(latest === void 0 ? view : {
			...view,
			latestMessageId: latest[0]
		});
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
function shareLabel(outcome) {
	if (outcome === "worked") return "贡献匿名实测";
	if (outcome === "partial") return "查找相似问题";
	return "加入并等待修复";
}
function visible(view, messageId) {
	return view.pending?.messageId === messageId || view.active && view.latestMessageId === messageId;
}
function ExperienceResultCard({ messageId, usePluginLab, observe, record, join, dismiss }) {
	const view = usePluginLab((value) => value);
	const [open, setOpen] = useState(false);
	useEffect(() => observe(messageId), [messageId, observe]);
	if (!visible(view, messageId)) return null;
	const pending = view.pending?.messageId === messageId ? view.pending : void 0;
	pending?.phase === "saving" || pending?.phase;
	return /* @__PURE__ */ jsxs("span", {
		style: {
			position: "relative",
			display: "inline-flex"
		},
		children: [/* @__PURE__ */ jsx("button", {
			type: "button",
			style: triggerStyle,
			onClick: () => {
				setOpen((value) => !value);
			},
			children: pending?.phase === "joined" ? "已加入跟进" : "体验结果"
		}), open && /* @__PURE__ */ jsxs("span", {
			role: "dialog",
			"aria-label": "插件体验结果",
			style: panelStyle,
			children: [
				/* @__PURE__ */ jsx("strong", {
					style: {
						display: "block",
						marginBottom: 9
					},
					children: "这次插件把事情做成了吗？"
				}),
				pending === void 0 && /* @__PURE__ */ jsxs("span", {
					style: {
						display: "grid",
						gridTemplateColumns: "repeat(3, 1fr)",
						gap: 7
					},
					children: [
						/* @__PURE__ */ jsx("button", {
							type: "button",
							style: choiceStyle,
							onClick: () => {
								record(messageId, "worked");
							},
							children: "做成了"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							style: choiceStyle,
							onClick: () => {
								record(messageId, "partial");
							},
							children: "做了一部分"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							style: choiceStyle,
							onClick: () => {
								record(messageId, "failed");
							},
							children: "没做成"
						})
					]
				}),
				pending !== void 0 && /* @__PURE__ */ jsxs("span", {
					style: {
						display: "grid",
						gap: 9
					},
					children: [
						/* @__PURE__ */ jsx("span", {
							style: {
								whiteSpace: "pre-wrap",
								color: "var(--dsw-alias-label-secondary)"
							},
							children: pending.phase === "saving" ? "正在只存到本机…" : pending.text
						}),
						pending.phase === "local" && /* @__PURE__ */ jsx("button", {
							type: "button",
							style: {
								...choiceStyle,
								background: "var(--dsw-alias-interactive-bg-primary)"
							},
							onClick: () => {
								join();
							},
							children: shareLabel(pending.outcome)
						}),
						(pending.phase === "joined" || pending.phase === "error") && /* @__PURE__ */ jsx("button", {
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
				/* @__PURE__ */ jsx("small", {
					style: {
						display: "block",
						marginTop: 10,
						color: "var(--dsw-alias-label-tertiary)"
					},
					children: "第一步只保存在本机；加入跟进仅发送插件、版本、结果与无内容运行指标，不发送对话正文。"
				})
			]
		})]
	});
}

//#endregion
//#region src/client/InboxButton.tsx
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
function InboxButton({ checkInbox }) {
	const [text, setText] = useState(null);
	const [busy, setBusy] = useState(false);
	return /* @__PURE__ */ jsxs("span", {
		style: {
			position: "relative",
			display: "inline-flex"
		},
		children: [/* @__PURE__ */ jsx("button", {
			type: "button",
			style: button,
			disabled: busy,
			onClick: () => {
				if (text !== null) return setText(null);
				setBusy(true);
				checkInbox().then(setText).finally(() => {
					setBusy(false);
				});
			},
			children: busy ? "检查中…" : "反馈进展"
		}), text !== null && /* @__PURE__ */ jsx("span", {
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
	const controllerFor = (sessionId) => {
		let controller = controllers.get(sessionId);
		if (controller === void 0) {
			controller = new LabController(ctx.remote.commands, sessionId);
			controllers.set(sessionId, controller);
		}
		return controller;
	};
	ctx.on("command/executed", (sessionId, name) => {
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
				observe: (messageId) => controller.observe(messageId),
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
}

//#endregion
export { ExperienceResultCard, InboxButton, LabController, apply, inject };
//# sourceMappingURL=client.js.map