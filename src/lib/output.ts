import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Print raw JSON (for --raw flag).
 */
export function printRaw(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Write file exclusively — refuse to overwrite existing files.
 * Pattern from Orthogonal CLI.
 */
export function writeExclusive(filePath: string, data: Buffer | string): void {
  const resolved = resolve(filePath);
  try {
    writeFileSync(resolved, data, { flag: 'wx' });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'EEXIST') {
      console.error(chalk.red(`\n  Error: File already exists: ${resolved}`));
      console.error(chalk.gray('  Remove it first or choose a different path.\n'));
      process.exit(1);
    }
    throw err;
  }
}

/**
 * Extract a media URL from various API response formats.
 * Pattern from skillboss-skills/pilot.js.
 */
export function extractMediaUrl(result: Record<string, unknown>): string | null {
  return (
    (result.image_url as string) ||
    (result.video_url as string) ||
    (result.audio_url as string) ||
    (result.url as string) ||
    ((result.data as unknown[])?.[0] as string) ||
    ((result.generated_images as unknown[])?.[0] as string) ||
    null
  );
}

interface BinaryEnvelope {
  _binary: true;
  encoding: string;
  contentType: string;
  data: string;
  size: number;
}

const VALID_ENCODINGS = new Set(['base64', 'base64url', 'hex', 'utf8', 'utf-8', 'ascii', 'latin1', 'binary']);

/**
 * Check if response data is a binary envelope.
 * Pattern from Orthogonal CLI.
 */
export function isBinaryEnvelope(data: unknown): data is BinaryEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>)._binary === true &&
    typeof (data as Record<string, unknown>).data === 'string' &&
    typeof (data as Record<string, unknown>).encoding === 'string' &&
    typeof (data as Record<string, unknown>).contentType === 'string' &&
    typeof (data as Record<string, unknown>).size === 'number'
  );
}

/**
 * Download a URL to a local file.
 */
export async function downloadToFile(url: string, outputPath: string): Promise<number> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeExclusive(outputPath, buffer);
  return buffer.length;
}

/**
 * Handle binary envelope: decode and save to file.
 */
export function saveBinaryEnvelope(envelope: BinaryEnvelope, outputPath: string): number {
  if (!VALID_ENCODINGS.has(envelope.encoding)) {
    console.error(chalk.red(`\n  Error: Unsupported encoding "${envelope.encoding}"\n`));
    process.exit(1);
  }
  const buffer = Buffer.from(envelope.data, envelope.encoding as BufferEncoding);
  writeExclusive(outputPath, buffer);
  return buffer.length;
}

/**
 * Handle the output of an API call — detect media URLs, binary, audio base64, etc.
 * Returns true if output was handled (saved to file or printed URL).
 */
export async function handleOutput(
  result: Record<string, unknown>,
  outputPath?: string,
): Promise<boolean> {
  // Binary envelope
  if (isBinaryEnvelope(result)) {
    if (!outputPath) {
      console.log(chalk.yellow(
        `\n  Response contains binary data (${result.size} bytes).` +
        `\n  Use -o to save it.\n`
      ));
      return true;
    }
    const size = saveBinaryEnvelope(result, outputPath);
    console.log(chalk.green(`\n  Saved to: ${resolve(outputPath)} (${formatBytes(size)})\n`));
    return true;
  }

  // Media URL
  const mediaUrl = extractMediaUrl(result);
  if (mediaUrl) {
    if (outputPath) {
      const size = await downloadToFile(mediaUrl, outputPath);
      console.log(chalk.green(`\n  Saved to: ${resolve(outputPath)} (${formatBytes(size)})\n`));
    } else {
      console.log(chalk.cyan(`\n  ${mediaUrl}\n`));
    }
    return true;
  }

  // Audio base64
  const audioBase64 = (result.audio_base64 as string) || (result.audio as string);
  if (audioBase64 && typeof audioBase64 === 'string') {
    if (!outputPath) {
      console.log(chalk.yellow('\n  Response contains audio data. Use -o to save it.\n'));
      return true;
    }
    const buffer = Buffer.from(audioBase64, 'base64');
    writeExclusive(outputPath, buffer);
    console.log(chalk.green(`\n  Saved to: ${resolve(outputPath)} (${formatBytes(buffer.length)})\n`));
    return true;
  }

  return false;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) { return `${bytes} B`; }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
