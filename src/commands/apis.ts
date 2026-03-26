import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, formatApiError } from '../lib/api.js';
import { printRaw } from '../lib/output.js';
import { withCache } from '../lib/cache.js';

interface ListOptions {
  type?: string;
  raw?: boolean;
  key?: string;
}

interface ShowOptions {
  raw?: boolean;
  key?: string;
}

interface TypesOptions {
  raw?: boolean;
  key?: string;
}

/**
 * skb api types — List available types with counts
 */
export async function apiTypesCommand(options: TypesOptions): Promise<void> {
  const spinner = ora({ text: chalk.gray('Loading...'), spinner: 'dots' }).start();

  try {
    const result = await withCache('api_types', () => {
      return apiRequest<Record<string, unknown>>('/models', {}, options.key);
    });
    spinner.stop();

    if (options.raw) {
      printRaw(result.available_types);
      return;
    }

    const availableTypes = result.available_types as Record<string, number> | undefined;
    if (!availableTypes) {
      console.log(chalk.yellow('\n  No types found.\n'));
      return;
    }

    console.log(chalk.bold('\n  Available API Types\n'));

    const sorted = Object.entries(availableTypes).sort((a, b) => { return b[1] - a[1]; });
    for (const [type, count] of sorted) {
      console.log(
        chalk.cyan(`    ${type.padEnd(20)}`) +
        chalk.white(`${String(count).padStart(4)} models`) +
        chalk.gray(`    skb api list --type ${type}`)
      );
    }

    console.log(chalk.gray('\n  Browse: skb api list --type <type>'));
    console.log(chalk.gray('  All:    skb api list\n'));
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}

/**
 * skb api list [--type chat] — List APIs/models
 */
export async function apiListCommand(options: ListOptions): Promise<void> {
  const spinner = ora({ text: chalk.gray('Loading...'), spinner: 'dots' }).start();

  try {
    const query: Record<string, string> = {};
    if (options.type) {
      query.types = options.type;
    } else {
      query.types = 'all';
    }

    const cacheKey = `api_list_${options.type || 'all'}`;
    const result = await withCache(cacheKey, () => {
      return apiRequest<Record<string, unknown>>('/models', { query }, options.key);
    });
    spinner.stop();

    if (options.raw) {
      printRaw(result);
      return;
    }

    const models = result.models as Array<Record<string, unknown>> | undefined;
    const count = result.count as number | undefined;

    console.log(chalk.bold(`\n  APIs${options.type ? ` (${options.type})` : ''} — ${count || 0} models\n`));

    if (models && models.length > 0) {
      const cols = process.stdout.columns || 120;
      const descWidth = Math.max(20, cols - 2 - 35 - 18);
      for (const m of models) {
        const id = (m.model_id || m.id) as string;
        const type = (m.type || '') as string;
        const desc = (m.description || '') as string;
        console.log(
          chalk.cyan(`  ${id.padEnd(35)}`) +
          chalk.yellow(`${type.padEnd(18)}`) +
          chalk.gray(desc.slice(0, descWidth))
        );
      }
    } else {
      console.log(chalk.yellow('  No models found.'));
    }

    console.log(chalk.gray('\n  Details: skb api show <model_id>\n'));
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}

/**
 * skb api show <model_id> — Show model details + params
 */
export async function apiShowCommand(modelId: string, options: ShowOptions): Promise<void> {
  const spinner = ora({ text: chalk.gray('Loading...'), spinner: 'dots' }).start();

  try {
    const cacheKey = `api_show_${modelId}`;
    const result = await withCache(cacheKey, () => {
      return apiRequest<Record<string, unknown>>(`/models/${modelId}`, {}, options.key);
    });
    spinner.stop();

    if (options.raw) {
      printRaw(result);
      return;
    }

    displayModelDetail(result, modelId);
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}

// ── Display helpers ──

function displayModelDetail(result: Record<string, unknown>, modelId: string): void {
  const model = (result.model || result) as Record<string, unknown>;
  const name = (model.display_name || model.name || modelId) as string;
  const type = (model.type || '') as string;
  const description = (model.description || '') as string;

  console.log(chalk.bold(`\n  ${name}`) + chalk.gray(type ? ` (${type})` : ''));
  if (description) {
    console.log(chalk.gray(`  ${description}`));
  }

  // Pricing
  const pricing = model.pricing as Record<string, unknown> | undefined;
  if (pricing) {
    console.log(chalk.white('\n  Pricing:'));
    for (const [key, value] of Object.entries(pricing)) {
      console.log(chalk.gray(`    ${key}: $${value}`));
    }
  }

  // Request doc
  const requestDoc = model.request_doc;
  if (requestDoc) {
    console.log(chalk.white('\n  Request:'));
    if (typeof requestDoc === 'string') {
      for (const line of requestDoc.split('\n')) {
        console.log(chalk.gray(`    ${line}`));
      }
    } else {
      displayParams(requestDoc as Record<string, unknown>);
    }
  }

  // Response doc
  const responseDoc = model.response_doc;
  if (responseDoc) {
    console.log(chalk.white('\n  Response:'));
    if (typeof responseDoc === 'string') {
      for (const line of responseDoc.split('\n')) {
        console.log(chalk.gray(`    ${line}`));
      }
    } else {
      displayParams(responseDoc as Record<string, unknown>);
    }
  }

  // Curl example
  const curlExample = model.curl_example as string | undefined;
  if (curlExample) {
    console.log(chalk.white('\n  Curl:'));
    for (const line of curlExample.split('\n')) {
      console.log(chalk.gray(`    ${line}`));
    }
  }

  // CLI example
  console.log(chalk.white('\n  CLI:'));
  console.log(chalk.gray(`    skb api call ${modelId} -b '...'`));
  console.log();
}

function displayParams(doc: Record<string, unknown>, indent: string = '    '): void {
  for (const [key, value] of Object.entries(doc)) {
    if (typeof value === 'object' && value !== null) {
      const param = value as Record<string, unknown>;
      const type = (param.type || '') as string;
      const required = param.required ? chalk.red('*') : '';
      const desc = (param.description || '') as string;
      const defaultVal = param.default !== undefined ? chalk.gray(` (default: ${param.default})`) : '';
      console.log(
        chalk.yellow(`${indent}${key}${required}`) +
        chalk.gray(type ? ` (${type})` : '') +
        chalk.gray(desc ? `  ${desc}` : '') +
        defaultVal
      );
    } else {
      console.log(chalk.gray(`${indent}${key}: ${value}`));
    }
  }
}
