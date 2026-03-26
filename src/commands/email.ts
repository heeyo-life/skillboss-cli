import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, formatApiError } from '../lib/api.js';
import { printRaw } from '../lib/output.js';

interface EmailOptions {
  to?: string;
  subject?: string;
  html?: string;
  replyTo?: string;
  batch?: boolean;
  body?: string;
  data?: string;
  raw?: boolean;
  key?: string;
}

export async function emailCommand(options: EmailOptions): Promise<void> {
  try {
    if (options.batch) {
      // Batch email — requires -b with array of emails
      const bodyJson = options.body || options.data;
      if (!bodyJson) {
        console.error(chalk.red('\n  Error: --batch requires -b with JSON array of emails\n'));
        console.log(chalk.gray('  Example: skb email --batch -b \'[{"title":"Hi","body_html":"<p>Hey</p>","receivers":["a@b.com"]}]\''));
        console.log();
        process.exit(1);
      }

      let emails: unknown;
      try {
        emails = JSON.parse(bodyJson);
      } catch {
        console.error(chalk.red('\n  Error: Invalid JSON in --body\n'));
        process.exit(1);
      }

      const spinner = ora({ text: chalk.gray('Sending batch...'), spinner: 'dots' }).start();
      const result = await apiRequest<Record<string, unknown>>('/send-emails', {
        method: 'POST',
        body: { emails },
      }, options.key);
      spinner.stop();

      if (options.raw) {
        printRaw(result);
      } else {
        console.log(chalk.green('\n  Batch emails sent.\n'));
      }
      return;
    }

    // Single email
    if (!options.to || !options.subject || !options.html) {
      console.error(chalk.red('\n  Error: --to, --subject, and --html are required\n'));
      console.log(chalk.gray('  Example: skb email --to user@example.com --subject "Hello" --html "<h1>Hi</h1>"'));
      console.log();
      process.exit(1);
    }

    const receivers = options.to.split(',').map((e) => { return e.trim(); });
    const replyTo = options.replyTo ? options.replyTo.split(',').map((e) => { return e.trim(); }) : undefined;

    const spinner = ora({ text: chalk.gray('Sending...'), spinner: 'dots' }).start();
    const result = await apiRequest<Record<string, unknown>>('/send-email', {
      method: 'POST',
      body: {
        title: options.subject,
        body_html: options.html,
        receivers,
        reply_to: replyTo,
      },
    }, options.key);
    spinner.stop();

    if (options.raw) {
      printRaw(result);
    } else {
      console.log(chalk.green(`\n  Email sent to ${receivers.join(', ')}\n`));
    }
  } catch (error: unknown) {
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}
