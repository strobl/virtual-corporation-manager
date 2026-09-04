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

export function TextDisclosure({ text }: { text: string }) {
  const excerpt = textExcerpt(text, 220);
  return (
    <>
      <p className={`purpose-text${excerpt !== text ? ' description-preview' : ''}`}>{excerpt}</p>
      {excerpt !== text && (
        <details className="text-disclosure">
          <summary>Read full purpose</summary>
          <pre className="full-text" tabIndex={0} role="region" aria-label="Full purpose">
            {text}
          </pre>
        </details>
      )}
    </>
  );
}
