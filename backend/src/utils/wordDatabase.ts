// IT Technology themed words for Codenames.
// Picture glyphs illustrate the word itself and never encode the team color.

import { IT_PICTURES } from '../themes/itPictures';
import type { ThemeWord } from '../themes/types';

export interface ITWord {
  word: string;
  category: string;
  picture: string;
}

const itWordList: Array<Omit<ThemeWord, 'picture'>> = [
  // Programming Languages
  { word: 'JavaScript', category: 'languages' },
  { word: 'Python', category: 'languages' },
  { word: 'TypeScript', category: 'languages' },
  { word: 'Java', category: 'languages' },
  { word: 'Rust', category: 'languages' },
  { word: 'Go', category: 'languages' },
  { word: 'Ruby', category: 'languages' },
  { word: 'Swift', category: 'languages' },
  { word: 'Kotlin', category: 'languages' },
  { word: 'CSharp', category: 'languages' },
  { word: 'PHP', category: 'languages' },
  { word: 'Scala', category: 'languages' },
  { word: 'Haskell', category: 'languages' },
  { word: 'Lua', category: 'languages' },
  { word: 'R', category: 'languages' },

  // Frameworks & Libraries
  { word: 'React', category: 'frameworks' },
  { word: 'Angular', category: 'frameworks' },
  { word: 'Vue', category: 'frameworks' },
  { word: 'Django', category: 'frameworks' },
  { word: 'Flask', category: 'frameworks' },
  { word: 'Node', category: 'frameworks' },
  { word: 'Express', category: 'frameworks' },
  { word: 'Spring', category: 'frameworks' },
  { word: 'Rails', category: 'frameworks' },
  { word: 'Svelte', category: 'frameworks' },
  { word: 'Next', category: 'frameworks' },
  { word: 'Redux', category: 'frameworks' },
  { word: 'Tailwind', category: 'frameworks' },
  { word: 'Webpack', category: 'frameworks' },
  { word: 'Vite', category: 'frameworks' },

  // Databases
  { word: 'PostgreSQL', category: 'databases' },
  { word: 'MongoDB', category: 'databases' },
  { word: 'Redis', category: 'databases' },
  { word: 'MySQL', category: 'databases' },
  { word: 'SQLite', category: 'databases' },
  { word: 'Cassandra', category: 'databases' },
  { word: 'DynamoDB', category: 'databases' },
  { word: 'ElasticSearch', category: 'databases' },
  { word: 'Firestore', category: 'databases' },

  // DevOps & Cloud
  { word: 'Docker', category: 'devops' },
  { word: 'Kubernetes', category: 'devops' },
  { word: 'AWS', category: 'devops' },
  { word: 'Azure', category: 'devops' },
  { word: 'GCP', category: 'devops' },
  { word: 'Terraform', category: 'devops' },
  { word: 'Jenkins', category: 'devops' },
  { word: 'GitLab', category: 'devops' },
  { word: 'GitHub', category: 'devops' },
  { word: 'CI', category: 'devops' },
  { word: 'CD', category: 'devops' },
  { word: 'Serverless', category: 'devops' },
  { word: 'Lambda', category: 'devops' },
  { word: 'CloudFormation', category: 'devops' },
  { word: 'Ansible', category: 'devops' },

  // Concepts & Methodologies
  { word: 'API', category: 'concepts' },
  { word: 'REST', category: 'concepts' },
  { word: 'GraphQL', category: 'concepts' },
  { word: 'Microservices', category: 'concepts' },
  { word: 'Monolith', category: 'concepts' },
  { word: 'Agile', category: 'concepts' },
  { word: 'Scrum', category: 'concepts' },
  { word: 'DevOps', category: 'concepts' },
  { word: 'CI/CD', category: 'concepts' },
  { word: 'OOP', category: 'concepts' },
  { word: 'Functional', category: 'concepts' },
  { word: 'Reactive', category: 'concepts' },
  { word: 'Event', category: 'concepts' },
  { word: 'Async', category: 'concepts' },
  { word: 'Concurrency', category: 'concepts' },

  // Version Control & Collaboration
  { word: 'Git', category: 'vcs' },
  { word: 'Commit', category: 'vcs' },
  { word: 'Branch', category: 'vcs' },
  { word: 'Merge', category: 'vcs' },
  { word: 'Pull', category: 'vcs' },
  { word: 'Fork', category: 'vcs' },
  { word: 'Clone', category: 'vcs' },
  { word: 'Rebase', category: 'vcs' },
  { word: 'Tag', category: 'vcs' },
  { word: 'Push', category: 'vcs' },

  // AI & Data Science
  { word: 'Neural', category: 'ai' },
  { word: 'Tensor', category: 'ai' },
  { word: 'PyTorch', category: 'ai' },
  { word: 'Scikit', category: 'ai' },
  { word: 'NLP', category: 'ai' },
  { word: 'Computer', category: 'ai' },
  { word: 'Vision', category: 'ai' },
  { word: 'GAN', category: 'ai' },
  { word: 'Transformer', category: 'ai' },
  { word: 'BERT', category: 'ai' },
  { word: 'GPT', category: 'ai' },
  { word: 'LLM', category: 'ai' },
  { word: 'Dataset', category: 'ai' },
  { word: 'Training', category: 'ai' },
  { word: 'Inference', category: 'ai' },

  // Security
  { word: 'OAuth', category: 'security' },
  { word: 'JWT', category: 'security' },
  { word: 'SSL', category: 'security' },
  { word: 'Encryption', category: 'security' },
  { word: 'Firewall', category: 'security' },
  { word: 'VPN', category: 'security' },
  { word: 'LDAP', category: 'security' },
  { word: 'SAML', category: 'security' },
  { word: 'SSH', category: 'security' },
  { word: 'TLS', category: 'security' },

  // Operating Systems & Platforms
  { word: 'Linux', category: 'os' },
  { word: 'Ubuntu', category: 'os' },
  { word: 'CentOS', category: 'os' },
  { word: 'Windows', category: 'os' },
  { word: 'macOS', category: 'os' },
  { word: 'BSD', category: 'os' },
  { word: 'Nginx', category: 'os' },
  { word: 'Apache', category: 'os' },
  { word: 'IIS', category: 'os' },
  { word: 'Systemd', category: 'os' },

  // Mobile & Platforms
  { word: 'iOS', category: 'mobile' },
  { word: 'Android', category: 'mobile' },
  { word: 'Flutter', category: 'mobile' },
  { word: 'ReactNative', category: 'mobile' },
  { word: 'SwiftUI', category: 'mobile' },
  { word: 'Jetpack', category: 'mobile' },
  { word: 'Xamarin', category: 'mobile' },
  { word: 'PWA', category: 'mobile' },
  { word: 'WebAssembly', category: 'mobile' },
  { word: 'Electron', category: 'mobile' },

  // Testing & Quality
  { word: 'Jest', category: 'testing' },
  { word: 'Mocha', category: 'testing' },
  { word: 'Cypress', category: 'testing' },
  { word: 'Selenium', category: 'testing' },
  { word: 'JUnit', category: 'testing' },
  { word: 'UnitTest', category: 'testing' },
  { word: 'Integration', category: 'testing' },
  { word: 'E2E', category: 'testing' },
  { word: 'Mock', category: 'testing' },
  { word: 'Stub', category: 'testing' },

  // Architecture Patterns
  { word: 'MVC', category: 'patterns' },
  { word: 'MVP', category: 'patterns' },
  { word: 'MVVM', category: 'patterns' },
  { word: 'Singleton', category: 'patterns' },
  { word: 'Factory', category: 'patterns' },
  { word: 'Observer', category: 'patterns' },
  { word: 'Adapter', category: 'patterns' },
  { word: 'Proxy', category: 'patterns' },
  { word: 'Decorator', category: 'patterns' },
  { word: 'Strategy', category: 'patterns' },

  // Miscellaneous
  { word: 'Binary', category: 'misc' },
  { word: 'Kernel', category: 'misc' },
  { word: 'Socket', category: 'misc' },
  { word: 'Queue', category: 'misc' },
  { word: 'Cache', category: 'misc' },
  { word: 'Router', category: 'misc' },
  { word: 'Middleware', category: 'misc' },
  { word: 'Thread', category: 'misc' },
  { word: 'Process', category: 'misc' },
];

export const itWords: ITWord[] = itWordList.map((entry) => ({
  ...entry,
  picture: IT_PICTURES[entry.word] ?? '💻',
}));

// Get random words for a game (25 words needed)
export function getRandomWords(count: number = 25): string[] {
  const uniqueWords = [...new Set(itWords.map(w => w.word))];
  // Fisher-Yates shuffle for a uniform distribution
  for (let i = uniqueWords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueWords[i], uniqueWords[j]] = [uniqueWords[j], uniqueWords[i]];
  }
  return uniqueWords.slice(0, count);
}

// Get words by category
export function getWordsByCategory(category: string): string[] {
  return itWords.filter(w => w.category === category).map(w => w.word);
}
