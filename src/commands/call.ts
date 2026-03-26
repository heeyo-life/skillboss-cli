import chalk from 'chalk';
import ora from 'ora';
import { readFileSync } from 'fs';
import { basename } from 'path';
import { apiRequest, apiRequestRaw, formatApiError } from '../lib/api.js';
import { printRaw, handleOutput } from '../lib/output.js';

interface CallOptions {
  body?: string;
  data?: string;
  file?: string;
  output?: string;
  stream?: boolean;
  raw?: boolean;
  key?: string;
  fallback?: boolean;
  dryRun?: boolean;
}

export async function callCommand(model: string, options: CallOptions): Promise<void> {
  // Parse inputs from -b/--body or -d/--data
  let inputs: Record<string, unknown> | undefined;
  const bodyJson = options.body || options.data;

  if (bodyJson) {
    try {
      inputs = JSON.parse(bodyJson);
    } catch {
      console.error(chalk.red('\n  Error: Invalid JSON in --body\n'));
      process.exit(1);
    }
  }

  // Handle -f/--file: read and base64-encode
  if (options.file) {
    const fileData = readFileSync(options.file);
    inputs = {
      ...inputs,
      audio_data: fileData.toString('base64'),
      filename: basename(options.file),
    };
  }

  // Check for stdin input (pipe)
  if (!process.stdin.isTTY && !inputs) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const stdinText = Buffer.concat(chunks).toString().trim();
    if (stdinText) {
      try {
        inputs = JSON.parse(stdinText);
      } catch {
        console.error(chalk.red('\n  Error: Invalid JSON from stdin\n'));
        process.exit(1);
      }
    }
  }

  // No input provided — show helpful error
  if (!inputs) {
    console.error(chalk.red('\n  Error: No input provided.\n'));
    console.log(chalk.gray(`  View parameters:  skb api show ${model}`));
    console.log(chalk.gray(`  Example:          skb api call ${model} -b '{"prompt": "..."}'`));
    console.log(chalk.gray(`  Or use task:      skb task <type> -b '{"prompt": "..."}'\n`));
    process.exit(1);
  }

  const requestBody = {
    model,
    inputs,
    auto_fallback: options.fallback !== false,
  };

  // Dry run — show request without executing
  if (options.dryRun) {
    console.log(chalk.cyan('\n  Dry Run (no API call made)\n'));
    console.log(chalk.white(`  POST /v1/run`));
    console.log(chalk.gray(JSON.stringify(requestBody, null, 2)));
    console.log();
    return;
  }

  const spinner = ora({ text: chalk.gray('Calling...'), spinner: 'dots' }).start();

  try {
    // Streaming mode
    if (options.stream) {
      spinner.stop();
      const response = await apiRequestRaw('/run', {
        method: 'POST',
        body: requestBody,
      }, options.key);

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && response.body) {
        console.log();
        await handleSSEStream(response.body);
        console.log('\n');
      } else {
        // Not actually streaming — parse as JSON
        const data = await response.json();
        if (options.raw) {
          printRaw(data);
        } else {
          displayResult(data as Record<string, unknown>, options.output);
        }
      }
      return;
    }

    // Non-streaming mode
    const result = await apiRequest<Record<string, unknown>>('/run', {
      method: 'POST',
      body: requestBody,
    }, options.key);

    spinner.stop();

    if (options.raw) {
      printRaw(result);
      return;
    }

    await displayResult(result, options.output);
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}

/**
 * Handle SSE stream — parse data: lines and print content deltas.
 */
async function handleSSEStream(body: ReadableStream<Uint8Array>): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) { break; }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) { continue; }
      const data = line.slice(6).trim();
      if (data === '[DONE]') { return; }

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          process.stdout.write(content);
        }
      } catch {
        // Skip malformed SSE lines
      }
    }
  }
}

/**
 * Display API result — handle chat responses, media, binary, etc.
 */
async function displayResult(result: Record<string, unknown>, outputPath?: string): Promise<void> {
  // Try to handle as media/binary output
  const handled = await handleOutput(result, outputPath);
  if (handled) { return; }

  // Chat response — extract message content
  const choices = result.choices as Array<{ message?: { content?: string } }> | undefined;
  if (choices?.[0]?.message?.content) {
    console.log('\n' + choices[0].message.content + '\n');

    const usage = result.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    if (usage) {
      console.log(chalk.gray(`  Tokens: ${usage.prompt_tokens} in, ${usage.completion_tokens} out\n`));
    }
    return;
  }

  // Nested result (pilot execute wraps in result.result)
  if (result.result && typeof result.result === 'object') {
    const innerHandled = await handleOutput(result.result as Record<string, unknown>, outputPath);
    if (innerHandled) { return; }
  }

  // Fallback — pretty-print JSON
  console.log(chalk.bold('\n  Response:\n'));
  console.log(JSON.stringify(result, null, 2));
  console.log();
}
