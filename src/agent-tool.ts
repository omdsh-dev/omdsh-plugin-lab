import type { Agent } from '@deepseek-ai/dsh-agent'
import type { JsonSchemaNode, ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { SafeExperienceAssessment } from './protocol.js'

export const AGENT_ASSESSMENT_TOOL = 'omdsh_analyze_plugin_experience'

const PARAMETERS = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
}

const OUTPUT: JsonSchemaNode = {
  type: 'object',
  properties: {
    health: { type: 'string', enum: ['ok', 'unavailable', 'error', 'unknown'] },
    experience: { type: 'string', const: 'unknown' },
    userConfirmationRequired: { type: 'boolean', const: true },
  },
  required: ['health', 'experience', 'userConfirmationRequired'],
  additionalProperties: false,
}

function noArguments(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === 0
}

/** A raw ToolDefinition is used so the rc.6 input schema is closed as well as the output. */
export function createAgentAssessmentTool(
  assess: (agent: Agent | undefined) => SafeExperienceAssessment,
): ToolDefinition {
  return {
    name: AGENT_ASSESSMENT_TOOL,
    description: [
      'Read only the current Plugin Lab trial lifecycle status from the DSH Host.',
      'Call with an empty object. Never infer subjective quality from conversation content.',
      'When experience is unknown, ask the user to confirm good, mixed, or bad.',
    ].join(' '),
    parameters: PARAMETERS,
    output: {
      schema: OUTPUT,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      if (!noArguments(args)) throw new TypeError('experience assessment accepts no arguments')
      return assess(exec.agent)
    },
    isConcurrencySafe: () => true,
  }
}
