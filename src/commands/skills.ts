import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, formatApiError } from '../lib/api.js';
import { printRaw } from '../lib/output.js';

interface SkillsListOptions {
  raw?: boolean;
  key?: string;
}

interface SkillsInvokeOptions {
  body?: string;
  data?: string;
  budget?: string;
  raw?: boolean;
  key?: string;
}

/**
 * skb skills — List available skills (GET /v1/skills)
 */
export async function skillsListCommand(options: SkillsListOptions): Promise<void> {
  const spinner = ora({ text: chalk.gray('Loading skills...'), spinner: 'dots' }).start();

  try {
    const result = await apiRequest<Record<string, unknown>>('/skills', {}, options.key);
    spinner.stop();

    if (options.raw) {
      printRaw(result);
      return;
    }

    const skills = result.skills as Array<Record<string, unknown>> | undefined;
    console.log(chalk.bold('\n  Available Skills\n'));

    if (skills && skills.length > 0) {
      for (const skill of skills) {
        const name = (skill.name || skill.slug) as string;
        const desc = (skill.description || '') as string;
        console.log(chalk.cyan(`  ${name.padEnd(25)}`) + chalk.gray(desc.slice(0, 55)));
      }
    } else {
      console.log(chalk.yellow('  No skills available.'));
    }

    console.log(chalk.gray('\n  Invoke: skb skills invoke <name> -b \'{"prompt": "..."}\''));
    console.log();
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}

/**
 * skb skills invoke <name> — Invoke a skill (POST /v1/skills/invoke)
 */
export async function skillsInvokeCommand(name: string, options: SkillsInvokeOptions): Promise<void> {
  const bodyJson = options.body || options.data;
  let body: Record<string, unknown> = { skill: name };

  if (bodyJson) {
    try {
      const parsed = JSON.parse(bodyJson);
      body = { ...body, ...parsed };
    } catch {
      console.error(chalk.red('\n  Error: Invalid JSON in --body\n'));
      process.exit(1);
    }
  }

  if (options.budget) {
    body.max_budget_usd = parseFloat(options.budget);
  }

  // Ensure prompt is provided
  if (!body.prompt) {
    console.error(chalk.red('\n  Error: -b must include "prompt" field\n'));
    console.log(chalk.gray(`  Example: skb skills invoke ${name} -b '{"prompt": "your instructions"}'\n`));
    process.exit(1);
  }

  const spinner = ora({ text: chalk.gray(`Invoking ${name}...`), spinner: 'dots' }).start();

  try {
    const result = await apiRequest<Record<string, unknown>>('/skills/invoke', {
      method: 'POST',
      body,
    }, options.key);

    spinner.stop();

    if (options.raw) {
      printRaw(result);
    } else {
      console.log(chalk.bold('\n  Skill Result:\n'));
      console.log(JSON.stringify(result, null, 2));
      console.log();
    }
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}
