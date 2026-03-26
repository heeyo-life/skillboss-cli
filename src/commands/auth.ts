import chalk from 'chalk';
import { createInterface } from 'readline';
import { getApiKey, saveCredentials, clearCredentials, WEB_BASE_URL } from '../config.js';
import { apiRequest, formatApiError } from '../lib/api.js';

async function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function loginCommand(options?: { key?: string }): Promise<void> {
  console.log(chalk.cyan('\n  SkillBoss CLI Login\n'));

  let apiKey = options?.key;

  if (!apiKey) {
    console.log(chalk.gray(`  Get your API key at: ${WEB_BASE_URL}/console\n`));
    apiKey = await prompt(chalk.white('  API Key: '));
  }

  if (!apiKey) {
    console.error(chalk.red('\n  Error: API key is required\n'));
    process.exit(1);
  }

  console.log(chalk.gray('\n  Validating...'));

  try {
    // Validate key by calling /v1/models — if 200, key is valid
    await apiRequest<Record<string, unknown>>('/models', {}, apiKey);

    saveCredentials({ apiKey });

    console.log(chalk.green('\n  Success! Logged in.\n'));
    console.log(chalk.gray('  Credentials saved to ~/.config/skillboss/credentials.json\n'));
  } catch {
    console.error(chalk.red('\n  Error: Invalid API key or could not connect\n'));
    process.exit(1);
  }
}

export async function logoutCommand(): Promise<void> {
  clearCredentials();
  console.log(chalk.green('\n  Logged out successfully\n'));
}

export async function whoamiCommand(options?: { key?: string }): Promise<void> {
  const apiKey = options?.key || getApiKey();

  if (!apiKey) {
    console.log(chalk.yellow('\n  Not logged in. Run `skb login` to authenticate.\n'));
    process.exit(1);
  }

  try {
    // Validate key works
    await apiRequest<Record<string, unknown>>('/models', {}, apiKey);

    console.log(chalk.cyan('\n  SkillBoss Account\n'));
    console.log(chalk.white(`  API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`));
    console.log(chalk.green('  Status:  Valid'));
    console.log();
  } catch (error: unknown) {
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}
