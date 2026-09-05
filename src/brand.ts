/** Public identity lives in one place. No account or remote service is required. */
const heroLines = ['Big ambition.', 'Meet your little company.'] as const;

export const brand = {
  name: 'GitFlash',
  productName: 'Virtual Corporation Manager',
  heroLines,
  tagline: heroLines.join(' '),
  descriptor: 'Virtual Corporation Manager',
  explanation:
    'Build a company of AI agents. Give every role a purpose, direct the work, and keep the results in your hands.',
  accent: '#EF3B24',
  ink: '#1C211F',
  cream: '#F7F1E5',
  cobalt: '#244ADD',
  butter: '#F9CE55',
  markPath:
    'M10 8H22Q24 8 24 10V16H54Q56 16 56 18V26Q56 28 54 28H24V36H46Q48 36 48 38V46Q48 48 46 48H24V54Q24 56 22 56H10Q8 56 8 54V10Q8 8 10 8Z',
  repository: 'https://github.com/strobl/gitflash',
};
