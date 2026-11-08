import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LinkedText, textExcerpt } from '../src/web/LinkedText';
import { TextDisclosure } from '../src/web/TextDisclosure';

const render = (text: string, limit?: number) =>
  renderToStaticMarkup(createElement(LinkedText, { text, limit }))
    .replace(/^<span class="linked-text">/, '')
    .replace(/<\/span>$/, '');
const plain = (text: string) => renderToStaticMarkup(createElement(Fragment, null, text));
const withoutLinks = (html: string) => html.replace(/<a\b[^>]*>|<\/a>/g, '');

describe('clickable plain-text web addresses', () => {
  it('preserves PDF paths, query parameters and fragments without swallowing sentence punctuation', () => {
    const url = 'https://example.com/files/report_(final).pdf?download=1&team=ops#page=3';
    const text = `Report (${url}).\n  Also http://localhost:4310/help, thanks!  `;
    const html = render(text);
    expect(html).toContain(`href="${url.replace('&', '&amp;')}"`);
    expect(html).toContain('href="http://localhost:4310/help"');
    expect(html.match(/<a\b/g)).toHaveLength(2);
    expect(withoutLinks(html)).toBe(plain(text));
  });

  it.each([
    ['www.example.com/report.pdf', 'https://www.example.com/report.pdf'],
    ['example.org/report.pdf', 'https://example.org/report.pdf'],
    ['//example.com/report.pdf', 'https://example.com/report.pdf'],
    ['https://münchen.de/übersicht', 'https://münchen.de/übersicht'],
    ['HTTPS://EXAMPLE.COM/report.pdf', 'HTTPS://EXAMPLE.COM/report.pdf'],
    ['https://user@example.com/report.pdf', 'https://user@example.com/report.pdf'],
  ])('recognizes %s and opens it safely in another tab', (text, href) => {
    const html = render(text);
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(withoutLinks(html)).toBe(plain(text));
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///tmp/report.pdf',
    'ftp://example.com/report.pdf',
    'mailto:team@example.com',
    'team@example.com',
    'Not a URL: https://',
    'Version 1.2.3, reference 123.45.',
  ])('keeps unsupported or incomplete addresses as literal text: %s', (text) => {
    expect(render(text)).toBe(plain(text));
  });

  it('escapes HTML around links and never interprets pasted tags or attributes', () => {
    const text =
      '<script>alert(1)</script> <img src=x onerror=alert(1)> https://example.com/?q="x"';
    const html = render(text);
    expect(html).not.toMatch(/<script|<img|<a[^>]* onerror=/);
    expect(html).toContain('href="https://example.com/?q=&quot;x&quot;"');
    expect(withoutLinks(html)).toBe(plain(text));
  });

  it('retains the full target when an excerpt ends inside a URL', () => {
    const url = `https://example.com/${'long-path/'.repeat(30)}report.pdf?download=1&team=ops`;
    const text = `📄\n  Report: ${url} More detail.`;
    const html = render(text, 55);
    expect(html).toContain(`href="${url.replace('&', '&amp;')}"`);
    expect(withoutLinks(html)).toBe(plain(textExcerpt(text, 55)));
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/href="[^"]*…/);
  });

  it('does not add a hidden link when an excerpt ends before the address', () => {
    const text = `${'Context '.repeat(30)} https://example.com/report.pdf`;
    expect(render(text, 25)).toBe(plain(textExcerpt(text, 25)));
  });

  it('keeps URLs longer than the parser default intact, including in excerpts', () => {
    const url = `https://example.com/${'a'.repeat(11_000)}?download=1`;
    for (const limit of [undefined, 60]) {
      expect(render(url, limit)).toContain(`href="${url}"`);
    }
  });

  it('preserves initial newlines inside preformatted output', () => {
    const text = '\n  https://example.com/report.pdf\n';
    const html = renderToStaticMarkup(
      createElement('pre', null, createElement(LinkedText, { text })),
    );
    expect(html).toMatch(/^<pre><span class="linked-text">\n  /);
  });

  it('links both a shortened purpose and its full disclosure to the same complete resource', () => {
    const url = `https://example.com/${'folder/'.repeat(50)}report.pdf`;
    const html = renderToStaticMarkup(createElement(TextDisclosure, { text: `Read ${url}` }));
    expect(html.match(new RegExp(`href="${url}"`, 'g'))).toHaveLength(2);
    expect(html).toContain('<summary>Read full purpose</summary>');
  });
});
