# @skillboss/cli

Trusted APIs and Skills for Agents — from your terminal.

## Install

```bash
npm install -g @skillboss/cli
```

Or use with npx (no install):

```bash
npx -y @skillboss/cli <command>
```

## Authentication

```bash
# Interactive
skb login

# Non-interactive
skb login -k sk-your-api-key

# Environment variable (no login needed)
export SKILLBOSS_API_KEY=sk-your-api-key

# Per-command (no login needed)
skb api list -k sk-your-api-key
```

Get your API key at [skillboss.co/console](https://skillboss.co/console).

## Commands

```
skb api                    Browse the API/model catalog
skb task                   Smart AI task navigator
skb account                View balance and usage
skb login                  Authenticate
skb logout                 Remove credentials
skb whoami                 Show current user
```

---

### `skb api`

Browse, inspect, and call APIs.

#### `skb api types`

List available API types with model counts.

```bash
skb api types
```

#### `skb api list`

List APIs/models. Shows all by default.

```bash
skb api list                      # All APIs
skb api list --type chat          # Chat models only
skb api list --type chat,image    # Multiple types
```

| Flag | Description |
|------|-------------|
| `--type <type>` | Filter by type (comma-separated) |
| `--raw` | Output raw JSON |
| `-k, --key <key>` | API key override |

#### `skb api show <model_id>`

Show model details, parameters, pricing, and curl example.

```bash
skb api show openai/tts-1
skb api show flux-1.1-pro
skb api show deepseek-v3
```

| Flag | Description |
|------|-------------|
| `--raw` | Output raw JSON |
| `-k, --key <key>` | API key override |

#### `skb api call <model>`

Execute a specific model. Maps to `POST /v1/run`.

```bash
# Chat
skb api call deepseek-v3 -b '{"messages":[{"role":"user","content":"Hello"}]}' --stream

# Image generation
skb api call flux-1.1-pro -b '{"prompt": "A sunset"}' -o sunset.png

# Web scraping
skb api call olostep-scrape -b '{"url": "https://example.com"}' --raw

# Text-to-speech
skb api call openai/tts-1 -b '{"input": "Hello", "voice": "alloy"}' -o hello.mp3

# Speech-to-text (file input)
skb api call whisper -f recording.wav

# Stdin JSON
echo '{"prompt":"A cat"}' | skb api call flux-1.1-pro -o cat.png

# Dry run (show request, don't execute)
skb api call flux-1.1-pro -b '{"prompt": "test"}' --dry-run
```

| Flag | Short | Description |
|------|-------|-------------|
| `--body <json>` | `-b` | JSON inputs for the model |
| `--data <json>` | `-d` | Alias for --body |
| `--file <path>` | `-f` | File input (base64-encoded) |
| `--output <path>` | `-o` | Save output to file |
| `--stream` | `-s` | Stream the response (SSE) |
| `--raw` | | Output raw JSON |
| `--key <key>` | `-k` | API key override |
| `--no-fallback` | | Disable automatic fallback |
| `--dry-run` | | Show request without executing |

Don't know the params? Run `skb api show <model>`.

---

### `skb task`

Smart AI task navigator. Recommends or auto-selects the best model for your task. Maps to `POST /v1/pilot`.

**Modes** (auto-detected from flags):

| Usage | Mode |
|-------|------|
| `skb task` | Guide — show available types |
| `skb task <type>` | Recommend — suggest best models |
| `skb task <type> -b '...'` | Execute — auto-select + run |

```bash
# Guide: what can I do?
skb task

# Recommend: what models for this task?
skb task image
skb task image --prefer price --limit 5
skb task chat --capability "code generation"

# Execute: auto-select best model + run
skb task image -b '{"prompt": "A cat wearing a hat"}' -o cat.png
skb task tts -b '{"text": "Hello"}' -o hello.mp3
skb task stt -f recording.wav
```

| Flag | Short | Description |
|------|-------|-------------|
| `--body <json>` | `-b` | JSON inputs (triggers execute mode) |
| `--data <json>` | `-d` | Alias for --body |
| `--file <path>` | `-f` | File input (triggers execute mode) |
| `--output <path>` | `-o` | Save output to file |
| `--stream` | `-s` | Stream the response |
| `--prefer <pref>` | | `price` \| `quality` \| `balanced` (default) |
| `--capability <cap>` | | Semantic filter (e.g., "style transfer") |
| `--limit <n>` | | Max recommendations, 1-10 (default: 3) |
| `--include-docs` | | Include API docs in recommendations |
| `--raw` | | Output raw JSON |
| `--key <key>` | `-k` | API key override |

#### `skb task search <query>`

Search models by keyword.

```bash
skb task search "web scraping"
skb task search "translate audio"
```

#### `skb task chain <json>`

Execute a multi-step workflow.

```bash
skb task chain '[{"type":"stt"},{"type":"chat","capability":"translate to Chinese"}]'
```

#### `skb task email`

Send email.

```bash
skb task email --to user@example.com --subject "Hello" --html "<h1>Hi</h1>"
skb task email --to a@b.com,c@d.com --subject "Hi" --html "<p>Hello</p>"
skb task email --batch -b '[{"title":"Hi","body_html":"<p>Hey</p>","receivers":["a@b.com"]}]'
```

| Flag | Description |
|------|-------------|
| `--to <emails>` | Recipient emails (comma-separated) |
| `--subject <text>` | Email subject |
| `--html <html>` | Email body (HTML) |
| `--reply-to <emails>` | Reply-to addresses |
| `--batch` | Batch mode (requires `-b`) |
| `-b, --body <json>` | JSON body for batch mode |

#### `skb task prefer [value]`

Get or set model preference.

```bash
skb task prefer                # Show current
skb task prefer price          # Optimize for price
skb task prefer quality        # Optimize for quality
skb task prefer off            # Clear preference
```

---

### `skb account`

View balance and usage.

```bash
skb account                        # Balance
skb account --usage                # Include usage breakdown
skb account --usage --period week  # Weekly breakdown
```

| Flag | Description |
|------|-------------|
| `--usage` | Include usage breakdown |
| `--period <period>` | `day` \| `week` \| `month` (default: day) |
| `--raw` | Output raw JSON |
| `-k, --key <key>` | API key override |

---

### `skb login`

```bash
skb login                # Interactive prompt
skb login -k sk-xxx      # Non-interactive
```

### `skb logout`

```bash
skb logout
```

### `skb whoami`

```bash
skb whoami
```

---

## Global Flags

Available on every command:

| Flag | Description |
|------|-------------|
| `-k, --key <key>` | API key override (skips stored credentials) |
| `--raw` | Output raw JSON for scripting/piping |
| `-h, --help` | Show command help |
| `-V, --version` | Show version |

## npx Usage

No install needed — pass `--key` for one-shot usage:

```bash
npx -y @skillboss/cli api types -k sk-xxx
npx -y @skillboss/cli api call deepseek-v3 -b '{"messages":[{"role":"user","content":"Hello"}]}' -k sk-xxx
npx -y @skillboss/cli task image -b '{"prompt":"A sunset"}' -o sunset.png -k sk-xxx
```

## Configuration

Credentials stored at `~/.config/skillboss/credentials.json`.

Or use the `SKILLBOSS_API_KEY` environment variable.

## Links

- **Website**: https://skillboss.co
- **Docs**: https://skillboss.co/docs
- **Console**: https://skillboss.co/console
- **Support**: support@skillboss.co

## License

MIT
