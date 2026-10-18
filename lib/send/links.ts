// Pure helpers that turn a finished prompt into links / commands for coding agents.
// Always encodeURIComponent: Cursor's deeplink drops everything after a raw "&"
// and treats "+" as a literal plus, so form-style encoding is never safe.

/** Conservative cap on the full encoded Cursor URL. Cursor's docs state 10,000. */
export const CURSOR_URL_LIMIT = 8000;
export const CURSOR_DOCS_LIMIT = 10000;
/** Documented maximum for the `q` parameter of a claude-cli:// link. */
export const CLAUDE_CODE_Q_LIMIT = 5000;

const CURSOR_WEB_BASE = "https://cursor.com/link/prompt?text=";
const CURSOR_APP_BASE = "cursor://anysphere.cursor-deeplink/prompt?text=";

export interface CursorDeeplink {
  web: string;
  app: string;
  /** Length of the longer of the two URLs. */
  encodedLength: number;
  fits: boolean;
}

export function cursorDeeplink(prompt: string): CursorDeeplink {
  const text = encodeURIComponent(prompt);
  const web = CURSOR_WEB_BASE + text;
  const app = CURSOR_APP_BASE + text;
  const encodedLength = Math.max(web.length, app.length);
  return { web, app, encodedLength, fits: encodedLength <= CURSOR_URL_LIMIT };
}

export interface ClaudeCodeDeeplink {
  url: string;
  /** Length of the encoded q value (conservative: the cap is applied to this). */
  qLength: number;
  fits: boolean;
}

export function claudeCodeDeeplink(
  prompt: string,
  opts: { repo?: string; cwd?: string } = {},
): ClaudeCodeDeeplink {
  const q = encodeURIComponent(prompt); // newlines become %0A
  const parts: string[] = [];
  // cwd wins over repo in Claude Code, so only send one.
  if (opts.cwd) parts.push(`cwd=${encodeURIComponent(opts.cwd)}`);
  else if (opts.repo) parts.push(`repo=${encodeURIComponent(opts.repo)}`);
  parts.push(`q=${q}`);
  return {
    url: `claude-cli://open?${parts.join("&")}`,
    qLength: q.length,
    fits: prompt.length <= CLAUDE_CODE_Q_LIMIT && q.length <= CLAUDE_CODE_Q_LIMIT,
  };
}

/** Best effort: claude.ai/new?q= prefill is not documented, so unverified. */
export function claudeWebLink(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

export function shortPromptReferencingFile(fileName: string): string {
  return `Read ${fileName} in the repo root and apply every change it describes`;
}

/** POSIX single-quote a string so a shell passes it through verbatim. */
export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Command-line alternative: claude '<prompt>' */
export function claudeCliCommand(prompt: string): string {
  return `claude ${shellQuote(prompt)}`;
}
