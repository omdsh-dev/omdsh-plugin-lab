import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { SafeExperienceAssessment } from './protocol.js';
export declare const AGENT_ASSESSMENT_TOOL = "omdsh_analyze_plugin_experience";
/** A raw ToolDefinition is used so the rc.6 input schema is closed as well as the output. */
export declare function createAgentAssessmentTool(assess: (agent: Agent | undefined) => SafeExperienceAssessment): ToolDefinition;
