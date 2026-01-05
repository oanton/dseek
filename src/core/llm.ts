/**
 * LLM integration - Ollama client wrapper
 *
 * Provides local LLM generation via Ollama for RAG-powered chat.
 * Handles model management, prompt building, and response generation.
 *
 * @module llm
 */

import { execSync, spawn } from 'node:child_process';
import type { DseekConfig } from '../types/index.js';
import { loadConfig } from './config.js';
import { DEFAULTS, MODELS, NETWORK, TIMING } from './constants.js';

/**
 * Detect language from text using Unicode ranges
 * Returns null if language cannot be determined (fallback to generic rule)
 */
function detectLanguage(text: string): string | null {
  if (/[\u0400-\u04FF]/.test(text)) return 'Ukrainian';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'Chinese';
  if (/[\u3040-\u30FF]/.test(text)) return 'Japanese';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'Korean';
  return null;
}

/**
 * Get Ollama URL from environment, config, or default.
 *
 * Priority: OLLAMA_HOST env > config.runtime.ollama_url > default
 *
 * @param config - Optional configuration object
 * @returns Ollama API URL
 */
function getOllamaUrl(config?: DseekConfig): string {
  return process.env.OLLAMA_HOST ?? config?.runtime?.ollama_url ?? NETWORK.DEFAULT_OLLAMA_URL;
}

/**
 * Check if Ollama CLI is installed
 */
export function isOllamaInstalled(): boolean {
  try {
    execSync('which ollama', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure Ollama is running, start it if not
 */
export async function ensureOllamaRunning(): Promise<boolean> {
  // Already running?
  if (await isOllamaAvailable()) {
    return true;
  }

  // Check if installed
  if (!isOllamaInstalled()) {
    console.error('Error: Ollama not found.');
    console.error('Install from: https://ollama.ai');
    return false;
  }

  console.log('Starting Ollama...');

  // Start Ollama in background
  const ollamaProcess = spawn('ollama', ['serve'], {
    detached: true,
    stdio: 'ignore',
  });
  ollamaProcess.unref(); // Don't wait for it

  // Wait for Ollama to be ready (max 30 seconds)
  for (let i = 0; i < TIMING.OLLAMA_MAX_STARTUP_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, TIMING.OLLAMA_STARTUP_WAIT_MS));
    if (await isOllamaAvailable()) {
      console.log('Ollama started.');
      return true;
    }
  }

  console.error('Error: Could not start Ollama.');
  console.error('Try manually: ollama serve');
  return false;
}

/**
 * Ensure model is available, pull it if not.
 *
 * @param model - Model name to check/pull
 * @returns True if model is available
 */
export async function ensureModelAvailable(model: string = MODELS.DEFAULT_LLM): Promise<boolean> {
  const models = await listModels();

  // Check if model is available (match by base name)
  const modelBase = model.split(':')[0];
  const hasModel = models.some((m) => m.startsWith(modelBase));

  if (hasModel) {
    return true;
  }

  console.log(`Pulling model ${model}...`);

  try {
    // Pull model synchronously (shows progress in terminal)
    execSync(`ollama pull ${model}`, { stdio: 'inherit' });
    console.log(`Model ${model} ready.`);
    return true;
  } catch {
    console.error(`Error: Could not pull model ${model}.`);
    console.error(`Try manually: ollama pull ${model}`);
    return false;
  }
}

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResponse {
  response: string;
  model: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Check if Ollama is running
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const url = getOllamaUrl();
    const response = await fetch(`${url}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * List available models
 */
export async function listModels(): Promise<string[]> {
  try {
    const url = getOllamaUrl();
    const response = await fetch(`${url}/api/tags`);
    if (!response.ok) return [];

    const data = (await response.json()) as { models?: Array<{ name: string }> };
    return data.models?.map((m) => m.name) ?? [];
  } catch {
    return [];
  }
}

/**
 * Generate response from Ollama.
 *
 * @param prompt - The prompt to send to the LLM
 * @param options - Generation options (model, temperature, maxTokens)
 * @returns Generated text response
 */
export async function generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
  const config = await loadConfig();
  const model = options.model ?? config.runtime.ollama_model ?? MODELS.DEFAULT_LLM;
  const url = getOllamaUrl(config);

  const response = await fetch(`${url}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? DEFAULTS.LLM_TEMPERATURE,
        num_predict: options.maxTokens ?? DEFAULTS.LLM_MAX_TOKENS,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama error: ${error}`);
  }

  const data = (await response.json()) as GenerateResponse;
  return data.response;
}

export interface RAGPromptOptions {
  noCite?: boolean;
}

/**
 * Build RAG prompt with context sources.
 *
 * Constructs a prompt with numbered sources, citation format instructions,
 * and language detection for multilingual support.
 *
 * @param query - User's question
 * @param contexts - Retrieved context snippets with file paths and line numbers
 * @param options - Optional settings (noCite to disable citations)
 * @returns Formatted prompt string for LLM
 *
 * @example
 * ```ts
 * const prompt = buildRAGPrompt("How to authenticate?", [
 *   { path: "docs/auth.md", line_start: 10, line_end: 20, snippet: "..." }
 * ]);
 * ```
 */
export function buildRAGPrompt(
  query: string,
  contexts: Array<{ path: string; line_start: number; line_end: number; snippet: string }>,
  options?: RAGPromptOptions,
): string {
  // Format context with numbered sources including file paths
  const contextText = contexts
    .map((c, i) => `[${i + 1}] Source: ${c.path} (lines ${c.line_start}-${c.line_end})\n${c.snippet}`)
    .join('\n\n');

  // Build example citation from first context (with lines)
  const exampleCitation =
    contexts.length > 0
      ? `[1: ${contexts[0].path}:${contexts[0].line_start}-${contexts[0].line_end}]`
      : '[1: filename.md:10-20]';

  const language = detectLanguage(query);

  // Build language rules - explicit and strong
  let languageRules: string;
  if (language) {
    if (language === 'Chinese') {
      languageRules = `LANGUAGE: Respond in Chinese (中文).`;
    } else {
      // For non-Chinese languages, explicitly forbid Chinese output
      languageRules = `LANGUAGE (CRITICAL):
- You MUST respond ONLY in ${language}.
- NEVER use Chinese characters (中文) in your response.
- NEVER mix languages.`;
    }
  } else {
    // English or unknown - forbid Chinese
    languageRules = `LANGUAGE (CRITICAL):
- Respond in the same language as the question.
- NEVER use Chinese characters (中文) unless the question is in Chinese.
- NEVER mix languages.`;
  }

  // Citation section - only if not disabled
  const citationSection = options?.noCite
    ? `If information is not in sources, say so briefly.`
    : `CITATION FORMAT:
- Cite sources as [N: file:lines], for example: ${exampleCitation}
- When combining facts from multiple sources, cite all: [1][2] or [1, 2]
- Only cite sources you actually use.
- If information is not in sources, say so briefly.`;

  return `${languageRules}

You are a documentation assistant. Answer questions based ONLY on the provided sources.

SOURCES:
${contextText}

${citationSection}

QUESTION: ${query}

ANSWER:`;
}

/**
 * Generate answer using RAG (Retrieval-Augmented Generation).
 *
 * Builds a prompt with retrieved context and generates a response via Ollama.
 *
 * @param query - User's question
 * @param contexts - Retrieved context snippets
 * @param options - Generation options (model, temperature, noCite)
 * @returns Generated answer with source citations
 *
 * @example
 * ```ts
 * const answer = await generateWithRAG("What is the auth flow?", contexts, {
 *   model: "llama3.2",
 *   noCite: false
 * });
 * ```
 */
export async function generateWithRAG(
  query: string,
  contexts: Array<{ path: string; line_start: number; line_end: number; snippet: string }>,
  options: GenerateOptions & RAGPromptOptions = {},
): Promise<string> {
  const prompt = buildRAGPrompt(query, contexts, { noCite: options.noCite });
  return generate(prompt, options);
}
