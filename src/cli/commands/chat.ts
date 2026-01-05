/**
 * Chat command - RAG-powered Q&A with local LLM
 *
 * Answers questions using retrieved documentation context via Ollama.
 *
 * @module cli/commands/chat
 */

import { Command } from 'commander';
import { DEFAULTS, MODELS, UI } from '../../core/constants.js';
import { buildRAGPrompt, ensureModelAvailable, ensureOllamaRunning, generateWithRAG } from '../../core/llm.js';
import { search } from '../../core/retrieval.js';

export const chatCommand = new Command('chat')
  .description('Chat with your documentation using local LLM')
  .argument('<query>', 'Your question')
  .option('-m, --model <model>', 'Ollama model to use')
  .option('-k, --top-k <number>', 'Number of context chunks', String(DEFAULTS.CHAT_TOP_K))
  .option('-t, --temperature <number>', 'Generation temperature', String(DEFAULTS.LLM_TEMPERATURE))
  .option('--show-context', 'Show retrieved context chunks')
  .option('--show-prompt', 'Show the prompt sent to LLM')
  .option('--rerank', 'Use cross-encoder reranking for better context')
  .option('--no-cite', 'Disable source citations in response')
  .option('--json', 'Output as JSON')
  .action(async (query: string, options) => {
    try {
      // Ensure Ollama is running (auto-start if not)
      const ollamaReady = await ensureOllamaRunning();
      if (!ollamaReady) {
        process.exit(1);
      }

      // Ensure model is available (auto-pull if not)
      const model = options.model ?? MODELS.DEFAULT_LLM;
      const modelReady = await ensureModelAvailable(model);
      if (!modelReady) {
        process.exit(1);
      }

      // Search for relevant context
      const topK = parseInt(options.topK, 10);
      const searchResult = await search({
        query,
        limit: topK,
        rerank: options.rerank ?? false,
      });

      if (searchResult.results.length === 0) {
        const response = {
          query,
          answer: 'No relevant documentation found for your question.',
          context: [],
          model,
        };

        if (options.json) {
          console.log(JSON.stringify(response, null, 2));
        } else {
          console.log(response.answer);
        }
        return;
      }

      // Prepare context
      const contexts = searchResult.results.map((r) => ({
        path: r.path,
        line_start: r.line_start,
        line_end: r.line_end,
        snippet: r.snippet,
        score: r.score,
      }));

      // Show context if requested
      if (options.showContext && !options.json) {
        console.log('Retrieved context:');
        console.log('─'.repeat(UI.SEPARATOR_WIDTH));
        for (const ctx of contexts) {
          console.log(`[${ctx.path}:${ctx.line_start}-${ctx.line_end}] (score: ${ctx.score.toFixed(3)})`);
          console.log(ctx.snippet);
          console.log('─'.repeat(UI.SEPARATOR_WIDTH));
        }
      }

      // Show prompt if requested
      if (options.showPrompt && !options.json) {
        const prompt = buildRAGPrompt(query, contexts);
        console.log('\nPrompt sent to LLM:');
        console.log('─'.repeat(UI.SEPARATOR_WIDTH));
        console.log(prompt);
        console.log('─'.repeat(UI.SEPARATOR_WIDTH));
      }

      if ((options.showContext || options.showPrompt) && !options.json) {
        console.log('\nGenerating answer...\n');
      }

      // Generate answer
      const temperature = parseFloat(options.temperature);
      const startTime = Date.now();
      const answer = await generateWithRAG(query, contexts, {
        model,
        temperature,
        noCite: !options.cite,
      });
      const genTime = ((Date.now() - startTime) / 1000).toFixed(1);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              query,
              answer,
              context: contexts,
              model,
              confidence: searchResult.confidence,
              generation_time_s: parseFloat(genTime),
            },
            null,
            2,
          ),
        );
      } else {
        console.log(answer);
        console.error(`\nAnswer generated in ${genTime}s`);
      }
    } catch (error) {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error),
            },
            null,
            2,
          ),
        );
      } else {
        console.error('Error:', error instanceof Error ? error.message : error);
      }
      process.exit(1);
    }
  });
