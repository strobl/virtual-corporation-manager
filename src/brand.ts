/** Public identity lives in one place. No account or remote service is required. */
const heroLines = ['Your company.', 'In your hands.'] as const;

export const brand = {
  name: 'GitFlash',
  productName: 'Virtual Corporation Manager',
  heroLines,
  tagline: heroLines.join(' '),
  descriptor: 'The open-source control center for your AI company.',
  accent: '#F4A340',
  ink: '#202824',
  wood: '#C9A576',
  face: '#F6DDB5',
  repository: 'https://github.com/strobl/gitflash',
};
