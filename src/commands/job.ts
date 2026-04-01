import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, formatApiError, pollJob } from '../lib/api.js';
import { printRaw, handleOutput } from '../lib/output.js';

interface JobOptions {
  wait?: boolean;
  output?: string;
  raw?: boolean;
  key?: string;
}

interface JobData {
  job_id: string;
  status: string;
  model: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
}

/**
 * skb job <job_id> — Fetch async job status/result
 */
export async function jobCommand(jobId: string, options: JobOptions): Promise<void> {
  const spinner = ora({ text: chalk.gray('Fetching job...'), spinner: 'dots' }).start();

  try {
    const data = await apiRequest<JobData>(`/job/${jobId}`, {}, options.key);
    const { status } = data;

    // If --wait and job is still running, poll until done
    if (options.wait && (status === 'queued' || status === 'running')) {
      spinner.text = chalk.gray(`Job ${status}, waiting...`);
      const result = await pollJob(
        jobId,
        options.key,
        (s) => { spinner.text = chalk.gray(`Job status: ${s}...`); },
      );
      spinner.stop();

      if (options.raw) {
        printRaw(result);
        return;
      }
      await handleOutput(result, options.output);
      if (!options.output) {
        console.log(chalk.bold('\n  Result:\n'));
        console.log(JSON.stringify(result, null, 2));
        console.log();
      }
      return;
    }

    spinner.stop();

    if (options.raw) {
      printRaw(data);
      return;
    }

    // Display job info
    const statusColor = status === 'completed' ? chalk.green
      : status === 'failed' ? chalk.red
      : chalk.yellow;

    console.log(chalk.bold(`\n  Job ${data.job_id}\n`));
    console.log(`  Status:    ${statusColor(status)}`);
    console.log(`  Model:     ${chalk.white(data.model)}`);
    if (data.created_at) {
      console.log(`  Created:   ${chalk.gray(data.created_at)}`);
    }
    if (data.completed_at) {
      console.log(`  Completed: ${chalk.gray(data.completed_at)}`);
    }

    if (status === 'completed' && data.result) {
      const handled = await handleOutput(data.result as Record<string, unknown>, options.output);
      if (!handled && !options.output) {
        console.log(chalk.bold('\n  Result:\n'));
        console.log(JSON.stringify(data.result, null, 2));
      }
    }

    if (status === 'failed' && data.error) {
      console.log(chalk.red(`\n  Error: ${data.error}`));
    }

    if (status === 'queued' || status === 'running') {
      console.log(chalk.gray(`\n  Tip: run with --wait to poll until done`));
    }

    console.log();
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}

/**
 * skb job list — List user's async jobs
 */
export async function jobListCommand(options: { status?: string; raw?: boolean; key?: string }): Promise<void> {
  const spinner = ora({ text: chalk.gray('Loading jobs...'), spinner: 'dots' }).start();

  try {
    const query: Record<string, string> = {};
    if (options.status) {
      query.status = options.status;
    }

    const data = await apiRequest<{ jobs: JobData[]; count: number }>('/job', { query }, options.key);
    spinner.stop();

    if (options.raw) {
      printRaw(data);
      return;
    }

    console.log(chalk.bold(`\n  Jobs — ${data.count} total\n`));

    if (data.jobs.length === 0) {
      console.log(chalk.gray('  No jobs found.\n'));
      return;
    }

    for (const job of data.jobs) {
      const statusColor = job.status === 'completed' ? chalk.green
        : job.status === 'failed' ? chalk.red
        : chalk.yellow;

      console.log(
        `  ${chalk.white(job.job_id.padEnd(28))} ${statusColor(job.status.padEnd(12))} ${chalk.gray(job.model || '')}`
      );
    }
    console.log();
  } catch (error: unknown) {
    spinner.stop();
    console.error(chalk.red(`\n  Error: ${formatApiError(error)}\n`));
    process.exit(1);
  }
}
