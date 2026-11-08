import { LinkifyIt } from 'linkify-it';
import type { ReactNode } from 'react';

const options = { fuzzyLink: true, fuzzyEmail: false, urlAuth: true, maxLength: 10_000 };
const linkify = new LinkifyIt(options);

/** A display-only excerpt; callers retain the original text for reading and storage. */
export function textExcerpt(text: string, limit = 160): string {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  const characters = Array.from(normalized);
  return characters.length > limit
    ? `${characters
        .slice(0, limit - 1)
        .join('')
        .trimEnd()}…`
    : normalized;
}

/** Render untrusted plain text as text nodes and web links, never as HTML or Markdown. */
export function LinkedText({ text, limit }: { text: string; limit?: number }) {
  const source = limit === undefined ? text : text.replace(/\s+/gu, ' ').trim();
  const excerpt = limit === undefined ? source : textExcerpt(source, limit);
  const truncated = excerpt !== source;
  const visible = truncated ? excerpt.slice(0, -1) : excerpt;
  const children: ReactNode[] = [];
  let cursor = 0;

  // Detect against the full source so an excerpt can never cut an href in half.
  // The parser's default length cap can also cut a long URL; cover this whole input.
  const matcher =
    source.length > options.maxLength
      ? new LinkifyIt({ ...options, maxLength: source.length })
      : linkify;
  for (const match of matcher.match(source) ?? []) {
    if (match.index >= visible.length) break;
    const href =
      match.schema === ''
        ? `https://${match.raw}`
        : match.schema === '//'
          ? `https:${match.raw}`
          : match.url;
    try {
      if (!['http:', 'https:'].includes(new URL(href).protocol)) continue;
    } catch {
      continue;
    }
    children.push(visible.slice(cursor, match.index));
    const end = Math.min(match.lastIndex, visible.length);
    children.push(
      <a
        key={match.index}
        className="linked-text-link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={`${href} (opens in a new tab)`}
      >
        {visible.slice(match.index, end)}
      </a>,
    );
    cursor = end;
  }
  children.push(visible.slice(cursor));
  if (truncated) children.push('…');
  // The wrapper preserves an initial newline when server-rendered inside <pre>.
  return <span className="linked-text">{children}</span>;
}
