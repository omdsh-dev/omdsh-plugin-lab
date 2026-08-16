import type { Agent } from '@deepseek-ai/dsh-agent'
import type { JsonSchemaNode, ToolDefinition } from '@deepseek-ai/dsh-tools'
import {
  FEEDBACK_CATEGORIES,
  type ExperienceVerdict,
  type FeedbackCategory,
  type FeedbackPreview,
  type SafeExperienceAssessment,
} from './protocol.js'

export const AGENT_ASSESSMENT_TOOL = 'omdsh_analyze_plugin_experience'
export const AGENT_PREVIEW_TOOL = 'omdsh_preview_plugin_feedback'
export const AGENT_PREPARE_TOOL = 'omdsh_prepare_plugin_receipt'

const PARAMETERS = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
}

const OUTPUT: JsonSchemaNode = {
  type: 'object',
  properties: {
    plugin: {
      type: 'object',
      properties: {
        moduleName: { type: 'string' },
        version: { type: 'string' },
      },
      required: ['moduleName'],
      additionalProperties: false,
    },
    health: { type: 'string', enum: ['ok', 'unavailable', 'error', 'unknown'] },
    experience: { type: 'string', const: 'unknown' },
    feedbackCategories: {
      type: 'array',
      items: { type: 'string', enum: [...FEEDBACK_CATEGORIES] },
    },
    suggestedCategory: { type: 'string', enum: [...FEEDBACK_CATEGORIES] },
    analysisScope: { type: 'string', const: 'plugin_identity_and_host_state_only' },
    summaryIsTemplateOnly: { type: 'boolean', const: true },
    userConfirmationRequired: { type: 'boolean', const: true },
  },
  required: [
    'health', 'experience', 'feedbackCategories', 'suggestedCategory', 'analysisScope',
    'summaryIsTemplateOnly', 'userConfirmationRequired',
  ],
  additionalProperties: false,
}

const PREVIEW_PARAMETERS = {
  type: 'object',
  properties: {
    experience: { type: 'string', enum: ['good', 'mixed', 'bad'] },
    category: { type: 'string', enum: [...FEEDBACK_CATEGORIES] },
  },
  required: ['experience', 'category'],
  additionalProperties: false,
}

const PREPARE_PARAMETERS = {
  type: 'object',
  properties: {
    experience: { type: 'string', enum: ['good', 'mixed', 'bad'] },
  },
  required: ['experience'],
  additionalProperties: false,
}

const PREVIEW_OUTPUT: JsonSchemaNode = {
  type: 'object',
  properties: {
    plugin: {
      type: 'object',
      properties: {
        moduleName: { type: 'string' },
        version: { type: 'string' },
      },
      required: ['moduleName'],
      additionalProperties: false,
    },
    health: { type: 'string', enum: ['ok', 'unavailable', 'error', 'unknown'] },
    experience: { type: 'string', enum: ['good', 'mixed', 'bad'] },
    category: { type: 'string', enum: [...FEEDBACK_CATEGORIES] },
    summary: { type: 'string' },
    willUpload: { type: 'boolean', const: false },
    userConfirmationRequired: { type: 'boolean', const: true },
  },
  required: [
    'plugin', 'health', 'experience', 'category', 'summary', 'willUpload', 'userConfirmationRequired',
  ],
  additionalProperties: false,
}

function noArguments(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === 0
}

function previewArguments(value: unknown): { experience: ExperienceVerdict; category: FeedbackCategory } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('feedback preview accepts finite enums only')
  }
  const row = value as Record<string, unknown>
  if (Object.keys(row).sort().join(',') !== 'category,experience'
    || !['good', 'mixed', 'bad'].includes(row.experience as string)
    || !FEEDBACK_CATEGORIES.includes(row.category as FeedbackCategory)) {
    throw new TypeError('feedback preview accepts finite enums only')
  }
  return {
    experience: row.experience as ExperienceVerdict,
    category: row.category as FeedbackCategory,
  }
}

function prepareArguments(value: unknown): ExperienceVerdict {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('receipt preparation accepts one finite verdict only')
  }
  const row = value as Record<string, unknown>
  if (Object.keys(row).join(',') !== 'experience'
    || !['good', 'mixed', 'bad'].includes(row.experience as string)) {
    throw new TypeError('receipt preparation accepts one finite verdict only')
  }
  return row.experience as ExperienceVerdict
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
      'Use suggestedCategory, which is derived only from public plugin identity and the Host status enum.',
      'Never read or include task details, conversation content, logs, files, paths, prompts, or outputs.',
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

/**
 * Pure preview tool: finite enum input, fixed-template output, and no storage or network side effect.
 * The Agent can prepare the card, but only the user's separate confirmation can publish it.
 */
export function createAgentPreviewTool(
  preview: (
    agent: Agent | undefined,
    experience: ExperienceVerdict,
    category: FeedbackCategory,
  ) => FeedbackPreview,
): ToolDefinition {
  return {
    name: AGENT_PREVIEW_TOOL,
    description: [
      'Prepare a task-agnostic feedback preview from two finite enums.',
      'Do not include or paraphrase the user task, conversation, logs, paths, errors, prompts, or outputs.',
      'This tool never stores or uploads anything. Show the preview and ask the user to confirm separately.',
    ].join(' '),
    parameters: PREVIEW_PARAMETERS,
    output: {
      schema: PREVIEW_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const parsed = previewArguments(args)
      return preview(exec.agent, parsed.experience, parsed.category)
    },
    isConcurrencySafe: () => true,
  }
}

/**
 * Agent orchestration tool: it may prepare/replace one local draft, but never
 * sends it. The Host UI remains the only confirmation capability.
 */
export function createAgentPrepareTool(
  prepare: (agent: Agent | undefined, experience: ExperienceVerdict) => FeedbackPreview,
): ToolDefinition {
  return {
    name: AGENT_PREPARE_TOOL,
    description: [
      'Prepare or replace one local Plugin Lab receipt after the user expresses a finite verdict.',
      'The current trial supplies the public plugin identity; the Host status supplies the category.',
      'Accept only good, mixed, or bad. Never include task, conversation, log, path, prompt, output, or error text.',
      'This creates a local preview only and never uploads. Tell the user to inspect the card and click confirm.',
    ].join(' '),
    parameters: PREPARE_PARAMETERS,
    output: {
      schema: PREVIEW_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      return prepare(exec.agent, prepareArguments(args))
    },
    isConcurrencySafe: () => false,
  }
}
