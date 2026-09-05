/** Public identity lives in one place. No account or remote service is required. */
const heroLines = ['Your company.', 'In your hands.'] as const;

export const brand = {
  name: 'GitFlash',
  productName: 'Virtual Corporation Manager',
  heroLines,
  tagline: heroLines.join(' '),
  descriptor: 'Virtual Corporation Manager',
  explanation: 'Build the structure of your AI company. Assign work. Review the results.',
  accent: '#F4A340',
  ink: '#202824',
  wood: '#C9A576',
  face: '#F6DDB5',
  markPath:
    'M16 8H54.6Q56.4 8 55.1 9.3L50 14H54Q56 14 56 16V22Q56 24 54 24H28V30H43Q45 30 45 32V41Q45 43 43 43H28V54Q28 56 26 56H12Q10 56 10 54V14Q10 8 16 8Z',
  repository: 'https://github.com/strobl/gitflash',
};
