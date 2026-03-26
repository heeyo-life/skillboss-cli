import chalk from 'chalk';
import ora from 'ora';
import { readFileSync } from 'fs';
import { basename } from 'path';
import { apiRequest, formatApiError } from '../lib/api.js';
import { printRaw, handleOutput } from '../lib/output.js';

interface TaskOptions {
  body?: string;
  data?: string;
  file?: string;
  output?: string;
  stream?: boolean;
  prefer?: string;
  capability?: string;
  limit?: string;
  includeDocs?: boolean;
  raw?: boolean;
  key?: string;
}

/**
 * skb task [type] — Smart AI task navigator (POST /v1/pilot)
 * Mode auto-detected from flags.
 */
export async function taskCommand(type: string | undefined, options: TaskOptions): Promise<void> {
  // Parse inputs from -b/--body
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

  // Handle -f/--file
  if (options.file) {
    const fileData = readFileSync(options.file);
    inputs = {
      ...inputs,
      audio_data: fileData.toString('base64'),
      filename: basename(options.file),
    };
  }

  // Mode detection
  const hasInput = !!inputs;
  const isExecute = !!type && hasInput;
  const isRecommend = !!type && !hasInput;
  const isGuide = !type;

  // Build pilot request body
  const body: Record<string, unknown> = {};

  if (isGuide) {
    // Empty body → guide mode
  } else if (isExecute) {
    body.type = type;
    body.inputs = inputs;
    if (options.prefer) { body.prefer = options.prefer; }
    if (options.capability) { body.capability = options.capability; }
    if (options.includeDocs !== undefined) { body.include_docs = options.includeDocs; }
  } else if (isRecommend) {
    body.type = type;
    if (options.prefer) { body.prefer = options.prefer; }
    if (options.limit) { body.limit = parseInt(options.limit, 10); }
    if (options.capability) { body.capability = options.capability; }
    if (options.includeDocs !== undefined) { body.include_docs = options.includeDocs; }
  }

  const spinner = ora({ text: chalk.gray('Thinking...'), spinner: 'dots' }).start();

  try {
    const result = await apiRequest<Record<string, unknown>>('/pilot', {
      method: 'POST',
      body,
    }, options.key);

    spinner.stop();

    if (options.raw) {
      printRaw(result);
      return;
    }

    if (isGuide) {
      displayGuide(result);
    } else if (isRecommend) {
      displayRecommendations(result, type!);
    } else if (isExecute) {
      // Execute mode — handle the result like a call response
      const inner = (result.result || result) as Record<string, unknown>;
      const handled = await handleOutput(inner, options.output);
      if (!handled) {
        // Chat response
        const choices = inner.choices as Array<{ message?: { content?: string } }> | undefined;
        if (choices?.[0]?.message?.content) {
          console.log('\n' + choices[0].message.content + '\n');
        } else {
          console.log(chalk.bold('\n  Response:\n'));
          console.log(JSON.stringify(result, null, 2));
          console.log();
        }
      }
    }
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}

/**
 * skb task search <query>
 */
export async function taskSearchCommand(query: string, options: { raw?: boolean; key?: string }): Promise<void> {
  const spinner = ora({ text: chalk.gray('Searching...'), spinner: 'dots' }).start();

  try {
    const result = await apiRequest<Record<string, unknown>>('/pilot', {
      method: 'POST',
      body: { discover: true, keyword: query },
    }, options.key);

    spinner.stop();

    if (options.raw) {
      printRaw(result);
      return;
    }

    displayDiscover(result, query);
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}

/**
 * skb task chain <json>
 */
export async function taskChainCommand(chainJson: string, options: { output?: string; raw?: boolean; key?: string }): Promise<void> {
  let chain: unknown[];
  try {
    chain = JSON.parse(chainJson);
  } catch {
    console.error(chalk.red('\n  Error: Invalid JSON for chain\n'));
    process.exit(1);
  }

  const spinner = ora({ text: chalk.gray('Running chain...'), spinner: 'dots' }).start();

  try {
    const result = await apiRequest<Record<string, unknown>>('/pilot', {
      method: 'POST',
      body: { chain },
    }, options.key);

    spinner.stop();

    if (options.raw) {
      printRaw(result);
      return;
    }

    console.log(chalk.bold('\n  Chain Result:\n'));
    console.log(JSON.stringify(result, null, 2));
    console.log();
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}

/**
 * skb task prefer [value]
 */
export async function taskPreferCommand(value: string | undefined, options: { raw?: boolean; key?: string }): Promise<void> {
  try {
    if (!value) {
      // GET preference
      const result = await apiRequest<Record<string, unknown>>('/pilot/preferences', {}, options.key);
      if (options.raw) {
        printRaw(result);
        return;
      }
      const prefer = (result as Record<string, unknown>).prefer || 'balanced (default)';
      console.log(chalk.cyan(`\n  Pilot preference: ${prefer}\n`));
    } else {
      // SET preference
      const prefer = value === 'off' ? null : value;
      if (prefer !== null && prefer !== 'price' && prefer !== 'quality') {
        console.error(chalk.red("\n  Error: prefer must be 'price', 'quality', or 'off'\n"));
        process.exit(1);
      }
      await apiRequest('/pilot/preferences', {
        method: 'PUT',
        body: { prefer },
      }, options.key);
      console.log(chalk.green(`\n  Pilot preference set to: ${value}\n`));
    }
  } catch (error: unknown) {
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}

// ── Display helpers ──

function displayGuide(result: Record<string, unknown>): void {
  console.log(chalk.bold('\n  SkillBoss Task Navigator\n'));

  const availableTypes = result.available_types as Record<string, number> | undefined;
  if (availableTypes) {
    const sorted = Object.entries(availableTypes).sort((a, b) => { return b[1] - a[1]; });
    for (const [type, count] of sorted) {
      console.log(
        chalk.cyan(`    ${type.padEnd(20)}`) +
        chalk.white(`${String(count).padStart(4)} models`) +
        chalk.gray(`    skb task ${type}`)
      );
    }
  }

  console.log(chalk.gray('\n  Examples:'));
  console.log(chalk.gray('    skb task chat                              Recommend chat models'));
  console.log(chalk.gray('    skb task image -b \'{"prompt":"A sunset"}\'   Auto-select + execute'));
  console.log(chalk.gray('    skb task search "web scraping"              Search by keyword'));
  console.log();
}

function displayRecommendations(result: Record<string, unknown>, type: string): void {
  const models = (result.models || result.recommendations) as Array<Record<string, unknown>> | undefined;
  const prefer = result.prefer as string || 'balanced';

  console.log(chalk.bold(`\n  ${capitalize(type)} Models (prefer: ${prefer})\n`));

  if (models && models.length > 0) {
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      const name = (m.model_id || m.model || m.name) as string;
      const pricing = formatPricing(m.pricing as Record<string, unknown> | undefined);
      console.log(chalk.white(`  ${(i + 1).toString().padStart(2)}  `) + chalk.cyan(name.padEnd(30)) + chalk.gray(pricing));

      if (m.description) {
        console.log(chalk.gray(`      ${(m.description as string).slice(0, 70)}`));
      }
    }
  } else {
    console.log(chalk.yellow('  No models found for this type.'));
  }

  console.log(chalk.gray(`\n  Execute: skb task ${type} -b '{"prompt": "your prompt"}'`));
  console.log(chalk.gray(`  Details: skb api show <model_id>\n`));
}

function displayDiscover(result: Record<string, unknown>, query: string): void {
  console.log(chalk.bold(`\n  Search results for "${query}"\n`));

  const matches = (result.matches || result.models || result.results) as Array<Record<string, unknown>> | undefined;
  if (matches && matches.length > 0) {
    for (const m of matches) {
      const name = (m.id || m.model_id || m.model || m.name || '') as string;
      const type = (m.type || '') as string;
      const desc = (m.description || '') as string;
      console.log(chalk.cyan(`  ${name.padEnd(35)}`) + chalk.yellow(type ? `${type.padEnd(18)}` : '') + chalk.gray(desc.slice(0, 50)));
    }
    console.log(chalk.gray(`\n  ${matches.length} results. Details: skb api show <model_id>`));
  } else {
    console.log(chalk.yellow('  No results found.'));
  }
  console.log();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPricing(pricing: Record<string, unknown> | undefined): string {
  if (!pricing) { return ''; }
  if (pricing.input !== undefined && pricing.output !== undefined) {
    return `$${pricing.input}/$${pricing.output} per token`;
  }
  if (pricing.input !== undefined) {
    return `$${pricing.input}/request`;
  }
  if (pricing.per_second !== undefined) {
    return `$${pricing.per_second}/sec`;
  }
  if (pricing.per_character !== undefined) {
    return `$${pricing.per_character}/char`;
  }
  if (pricing.per_minute !== undefined) {
    return `$${pricing.per_minute}/min`;
  }
  return '';
}
