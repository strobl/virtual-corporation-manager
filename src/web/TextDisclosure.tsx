import { LinkedText, textExcerpt } from './LinkedText';
export { textExcerpt } from './LinkedText';

export function TextDisclosure({ text }: { text: string }) {
  const excerpt = textExcerpt(text, 220);
  return (
    <>
      <p className={`purpose-text${excerpt !== text ? ' description-preview' : ''}`}>
        <LinkedText text={text} limit={220} />
      </p>
      {excerpt !== text && (
        <details className="text-disclosure">
          <summary>Read full purpose</summary>
          <pre className="full-text" tabIndex={0} role="region" aria-label="Full purpose">
            <LinkedText text={text} />
          </pre>
        </details>
      )}
    </>
  );
}
