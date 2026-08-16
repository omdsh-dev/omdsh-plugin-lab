import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import { type ExperienceVerdict, type FeedbackCategory, type FeedbackPreview, type SafeExperienceAssessment } from './protocol.js';
export declare const AGENT_ASSESSMENT_TOOL = "omdsh_analyze_plugin_experience";
export declare const AGENT_PREVIEW_TOOL = "omdsh_preview_plugin_feedback";
export declare const AGENT_PREPARE_TOOL = "omdsh_prepare_plugin_receipt";
/** A raw ToolDefinition is used so the rc.6 input schema is closed as well as the output. */
export declare function createAgentAssessmentTool(assess: (agent: Agent | undefined) => SafeExperienceAssessment): ToolDefinition;
/**
 * Pure preview tool: finite enum input, fixed-template output, and no storage or network side effect.
 * The Agent can prepare the card, but only the user's separate confirmation can publish it.
 */
export declare function createAgentPreviewTool(preview: (agent: Agent | undefined, experience: ExperienceVerdict, category: FeedbackCategory) => FeedbackPreview): ToolDefinition;
/**
 * Agent orchestration tool: it may prepare/replace one local draft, but never
 * sends it. The Host UI remains the only confirmation capability.
 */
export declare function createAgentPrepareTool(prepare: (agent: Agent | undefined, experience: ExperienceVerdict) => FeedbackPreview): ToolDefinition;
