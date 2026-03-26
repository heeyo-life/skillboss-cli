#!/usr/bin/env node

import { Command } from 'commander';
import { callCommand } from './commands/call.js';
import { taskCommand, taskSearchCommand, taskChainCommand, taskPreferCommand } from './commands/task.js';
import { apiTypesCommand, apiListCommand, apiShowCommand } from './commands/apis.js';
import { emailCommand } from './commands/email.js';
// import { skillsListCommand, skillsInvokeCommand } from './commands/skills.js';
import { accountCommand } from './commands/account.js';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/auth.js';

const VERSION = '2.0.0';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asyncAction(fn: (...args: any[]) => Promise<void>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (...args: any[]) => {
    fn(...args).catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : 'Unknown error');
      process.exit(1);
    });
  };
}

const program = new Command();

program
  .name('skb')
  .description('SkillBoss CLI — Trusted APIs and Skills for Agents')
  .version(`@skillboss/cli v${VERSION}\nNode.js: ${process.version}`, '-V, --version');

// (call command moved under skb api call)

// ─────────────────────────────────────────────────────────────────────────────
// skb task [type] — Smart AI task navigator (POST /v1/pilot)
// ─────────────────────────────────────────────────────────────────────────────

const task = program
  .command('task [type]')
  .description('Smart AI task navigator (POST /v1/pilot)')
  .option('-b, --body <json>', 'JSON inputs (triggers execute mode)')
  .option('-d, --data <json>', 'Alias for --body')
  .option('-f, --file <path>', 'File input (triggers execute mode)')
  .option('-o, --output <path>', 'Save output to file')
  .option('-s, --stream', 'Stream the response')
  .option('--prefer <pref>', 'Optimize: price | quality | balanced', 'balanced')
  .option('--capability <cap>', 'Semantic filter (e.g., "code generation")')
  .option('--limit <n>', 'Max recommendations (1-10)', '3')
  .option('--include-docs', 'Include API docs in recommendations')
  .option('--raw', 'Output raw JSON')
  .option('-k, --key <key>', 'API key override')
  .addHelpText('after', `
Modes (auto-detected):
  skb task                          Guide — show available types
  skb task <type>                   Recommend — suggest best models
  skb task <type> -b '...'          Execute — auto-select + run

Examples:
  skb task                                                         # What can I do?
  skb task image --prefer price                                    # Cheapest image models
  skb task image -b '{"prompt":"A sunset"}' -o sunset.png          # Auto-select + generate
  skb task search "web scraping"                                   # Find models
  skb task chain '[{"type":"stt"},{"type":"chat"}]'                # Multi-step
  skb task prefer price                                            # Set preference
  `)
  .action(asyncAction(async (type: string | undefined, options) => {
    await taskCommand(type, options);
  }));

task
  .command('search <query>')
  .description('Search models by keyword')
  .option('--raw', 'Output raw JSON')
  .option('-k, --key <key>', 'API key override')
  .action(asyncAction(async (query: string, options) => {
    await taskSearchCommand(query, options);
  }));

task
  .command('chain <json>')
  .description('Execute a multi-step workflow')
  .option('-o, --output <path>', 'Save output to file')
  .option('--raw', 'Output raw JSON')
  .option('-k, --key <key>', 'API key override')
  .action(asyncAction(async (chainJson: string, options) => {
    await taskChainCommand(chainJson, options);
  }));

task
  .command('prefer [value]')
  .description('Get or set model preference (price | quality | off)')
  .option('--raw', 'Output raw JSON')
  .option('-k, --key <key>', 'API key override')
  .action(asyncAction(async (value: string | undefined, options) => {
    await taskPreferCommand(value, options);
  }));

task
  .command('email')
  .description('Send email (POST /v1/send-email)')
  .option('--to <emails>', 'Recipient emails (comma-separated)')
  .option('--subject <text>', 'Email subject')
  .option('--html <html>', 'Email body (HTML)')
  .option('--reply-to <emails>', 'Reply-to addresses (comma-separated)')
  .option('--batch', 'Send batch emails (requires -b with JSON array)')
  .option('-b, --body <json>', 'JSON body for batch mode')
  .option('-d, --data <json>', 'Alias for --body')
  .option('--raw', 'Output raw JSON')
  .option('-k, --key <key>', 'API key override')
  .addHelpText('after', `
Examples:
  skb task email --to user@example.com --subject "Hello" --html "<h1>Hi</h1>"
  skb task email --batch -b '[{"title":"Hi","body_html":"<p>Hey</p>","receivers":["a@b.com"]}]'
  `)
  .action(asyncAction(async (options) => {
    await emailCommand(options);
  }));

// ─────────────────────────────────────────────────────────────────────────────
// skb api — Browse model catalog (GET /v1/models)
// ─────────────────────────────────────────────────────────────────────────────

const api = program
  .command('api')
  .description('Browse the API/model catalog');

api
  .command('types')
  .description('List available API types with model counts')
  .option('--raw', 'Output raw JSON')
  .option('-k, --key <key>', 'API key override')
  .action(asyncAction(async (options) => {
    await apiTypesCommand(options);
  }));

api
  .command('list')
  .description('List APIs/models')
  .option('--type <type>', 'Filter by type (comma-separated, run `skb api types` to see options)')
  .option('--raw', 'Output raw JSON')
  .option('-k, --key <key>', 'API key override')
  .addHelpText('after', `
Examples:
  skb api list                    List all APIs
  skb api list --type chat        List chat models
  skb api list --type chat,image  Multiple types
  `)
  .action(asyncAction(async (options) => {
    await apiListCommand(options);
  }));

api
  .command('show <model_id>')
  .description('Show model details, params, and pricing')
  .option('--raw', 'Output raw JSON')
  .option('-k, --key <key>', 'API key override')
  .addHelpText('after', `
Examples:
  skb api show flux-1.1-pro       View model params + pricing
  skb api show deepseek-v3        View model params + curl example
  `)
  .action(asyncAction(async (modelId: string, options) => {
    await apiShowCommand(modelId, options);
  }));

api
  .command('call <model>')
  .description('Execute a specific model (POST /v1/run)')
  .option('-b, --body <json>', 'JSON inputs for the model')
  .option('-d, --data <json>', 'Alias for --body')
  .option('-f, --file <path>', 'File input (base64-encoded)')
  .option('-o, --output <path>', 'Save output to file')
  .option('-s, --stream', 'Stream the response (SSE)')
  .option('--raw', 'Output raw JSON')
  .option('-k, --key <key>', 'API key override')
  .option('--no-fallback', 'Disable automatic fallback')
  .option('--dry-run', 'Show request without executing')
  .addHelpText('after', `
Examples:
  skb api call deepseek-v3 -b '{"messages":[{"role":"user","content":"Hello"}]}' --stream
  skb api call flux-1.1-pro -b '{"prompt": "A sunset"}' -o sunset.png
  skb api call olostep-scrape -b '{"url": "https://example.com"}' --raw
  skb api call whisper -f recording.wav
  echo '{"prompt":"A cat"}' | skb api call flux-1.1-pro -o cat.png

Don't know the params? Run: skb api show <model>
  `)
  .action(asyncAction(async (model: string, options) => {
    await callCommand(model, options);
  }));

// skb skills — disabled (backend 500)

// ─────────────────────────────────────────────────────────────────────────────
// skb account — Balance & usage
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('account')
  .description('View balance and usage')
  .option('--usage', 'Include usage breakdown')
  .option('--period <period>', 'Usage period: day | week | month', 'day')
  .option('--raw', 'Output raw JSON')
  .option('-k, --key <key>', 'API key override')
  .action(asyncAction(async (options) => {
    await accountCommand(options);
  }));

// ─────────────────────────────────────────────────────────────────────────────
// Auth commands
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('login')
  .description('Authenticate with your SkillBoss API key')
  .option('-k, --key <key>', 'API key (non-interactive)')
  .action(asyncAction(async (options) => {
    await loginCommand(options);
  }));

program
  .command('logout')
  .description('Remove stored credentials')
  .action(asyncAction(async () => {
    await logoutCommand();
  }));

program
  .command('whoami')
  .description('Show current authenticated user')
  .option('-k, --key <key>', 'API key override')
  .action(asyncAction(async (options) => {
    await whoamiCommand(options);
  }));

program.parse();
