import chalk from 'chalk';
import ora from 'ora';
import { webRequest, formatApiError } from '../lib/api.js';
import { printRaw } from '../lib/output.js';

interface AccountOptions {
  usage?: boolean;
  period?: string;
  raw?: boolean;
  key?: string;
}

export async function accountCommand(options: AccountOptions): Promise<void> {
  const spinner = ora({ text: chalk.gray('Loading...'), spinner: 'dots' }).start();

  try {
    const balanceData = await webRequest<{
      email?: string;
      balance?: number;
      credits?: number;
    }>('/api/me/balance', options.key);

    let usageData: {
      summary?: { total_usd?: number; total_requests?: number };
      by_model?: Array<{ model: string; requests: number; cost_usd: number }>;
    } | undefined;

    if (options.usage) {
      const period = options.period || 'day';
      usageData = await webRequest(`/api/me/usage?period=${period}`, options.key);
    }

    spinner.stop();

    if (options.raw) {
      printRaw({ balance: balanceData, usage: usageData });
      return;
    }

    console.log(chalk.bold('\n  SkillBoss Account\n'));

    if (balanceData.email) {
      console.log(chalk.white(`  Email:   ${balanceData.email}`));
    }

    if (typeof balanceData.balance === 'number') {
      const color = balanceData.balance > 5 ? chalk.green : balanceData.balance > 1 ? chalk.yellow : chalk.red;
      console.log(chalk.white(`  Balance: ${color(`$${balanceData.balance.toFixed(2)}`)}`));
    }

    if (usageData) {
      console.log();
      const period = options.period || 'day';
      console.log(chalk.white(`  Usage (${period}):`));

      if (usageData.summary) {
        if (typeof usageData.summary.total_usd === 'number') {
          console.log(chalk.gray(`    Spend:    $${usageData.summary.total_usd.toFixed(4)}`));
        }
        if (typeof usageData.summary.total_requests === 'number') {
          console.log(chalk.gray(`    Requests: ${usageData.summary.total_requests}`));
        }
      }

      if (usageData.by_model && usageData.by_model.length > 0) {
        console.log(chalk.white('\n  By Model:'));
        for (const item of usageData.by_model.slice(0, 10)) {
          console.log(chalk.gray(`    ${item.model.padEnd(30)} ${item.requests} reqs  $${item.cost_usd.toFixed(4)}`));
        }
      }
    }

    console.log(chalk.gray('\n  Add credits: https://skillboss.co/console\n'));
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}
