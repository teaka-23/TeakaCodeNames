import { Card, GameState, Player, TeamColor, CardColor } from '../types';
import { getRandomWords } from '../utils/wordDatabase';

const GRID_SIZE = 5;
const CARDS_PER_TEAM = 8;
const CIVILIANS = 8;
const ASSASSINS = 1;
const TOTAL_CARDS = GRID_SIZE * GRID_SIZE; // 25

export function createGameState(
  roomId: string,
  players: Player[]
): GameState {
  return {
    roomId,
    status: 'waiting',
    players,
    cards: [],
    currentTurn: Math.random() < 0.5 ? 'red' : 'blue',
    clues: null,
    scores: { red: 0, blue: 0 },
    remainingCards: {
      red: CARDS_PER_TEAM,
      blue: CARDS_PER_TEAM,
      civilian: CIVILIANS,
      assassin: ASSASSINS,
    },
    turnDeadline: null,
    winner: null,
  };
}

export function generateCards(): Card[] {
  const words = getRandomWords(TOTAL_CARDS);

  if (words.length < TOTAL_CARDS) {
    throw new Error(`Not enough words in database: need ${TOTAL_CARDS}, got ${words.length}`);
  }

  // Create color distribution
  const colors: CardColor[] = [];
  for (let i = 0; i < CARDS_PER_TEAM; i++) colors.push('red');
  for (let i = 0; i < CARDS_PER_TEAM; i++) colors.push('blue');
  for (let i = 0; i < CIVILIANS; i++) colors.push('civilian');
  colors.push('assassin');

  // Shuffle colors
  const shuffledColors = shuffleArray([...colors]);

  // Shuffle words
  const shuffledWords = shuffleArray([...words]);

  // Assign positions (row-major order in 5x5 grid)
  const cards: Card[] = shuffledWords.map((word, index) => ({
    word,
    color: shuffledColors[index],
    x: index % GRID_SIZE,
    y: Math.floor(index / GRID_SIZE),
    revealed: false,
  }));

  return cards;
}

export function generateClue(
  cards: Card[],
  team?: TeamColor
): { word: string; count: number } {
  // Simple clue generation: find a word that relates to multiple cards of one team
  // This is a basic AI - in production you'd use a Spymaster (human)
  const teamCards = cards.filter(
    c => !c.revealed && (team ? c.color === team : c.color === 'red' || c.color === 'blue')
  );

  // Count category frequencies
  const categoryCounts = new Map<string, number>();

  for (const card of teamCards) {
    const category = getCategoryForWord(card.word);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  // Find the category with most unrevealed cards
  let bestCategory = '';
  let bestCount = 0;
  for (const [cat, count] of categoryCounts) {
    if (count > bestCount) {
      bestCategory = cat;
      bestCount = count;
    }
  }

  return {
    word: bestCategory || 'tech',
    count: bestCount || 1,
  };
}

export function getSimpleClue(word: string): string {
  // Return a simple related word based on the category
  const category = getCategoryForWord(word);
  const related: Record<string, string[]> = {
    languages: ['code', 'script', 'type', 'strong', 'static'],
    frameworks: ['component', 'hook', 'state', 'route', 'serve'],
    databases: ['query', 'schema', 'index', 'node', 'store'],
    devops: ['container', 'deploy', 'build', 'pipeline', 'infra'],
    concepts: ['service', 'pattern', 'style', 'paradigm', 'method'],
    vcs: ['source', 'repo', 'code', 'share', 'track'],
    ai: ['model', 'data', 'learn', 'predict', 'train'],
    security: ['protect', 'auth', 'token', 'cert', 'key'],
    os: ['unix', 'nix', 'server', 'shell', 'kernel'],
    mobile: ['phone', 'app', 'touch', 'screen', 'mobile'],
    testing: ['verify', 'check', 'suite', 'mock', 'run'],
    patterns: ['design', 'class', 'object', 'inherit', 'implement'],
    misc: ['low', 'level', 'bit', 'byte', 'word'],
  };

  const options = related[category] || ['tech'];
  return options[Math.floor(Math.random() * options.length)];
}

function getCategoryForWord(word: string): string {
  // Map words back to their categories
  // This is used for clue generation
  const wordToCategory: Record<string, string> = {
    // Languages
    JavaScript: 'languages', Python: 'languages', TypeScript: 'languages',
    Java: 'languages', Rust: 'languages', Go: 'languages', Ruby: 'languages',
    Swift: 'languages', Kotlin: 'languages', CSharp: 'languages',
    PHP: 'languages', Scala: 'languages', Haskell: 'languages',
    Lua: 'languages', R: 'languages',

    // Frameworks
    React: 'frameworks', Angular: 'frameworks', Vue: 'frameworks',
    Django: 'frameworks', Flask: 'frameworks', Node: 'frameworks',
    Express: 'frameworks', Spring: 'frameworks', Rails: 'frameworks',
    Svelte: 'frameworks', Next: 'frameworks', Redux: 'frameworks',
    Tailwind: 'frameworks', Webpack: 'frameworks', Vite: 'frameworks',

    // Databases
    PostgreSQL: 'databases', MongoDB: 'databases', Redis: 'databases',
    MySQL: 'databases', SQLite: 'databases', Cassandra: 'databases',
    DynamoDB: 'databases', ElasticSearch: 'databases', GraphQL: 'databases',
    Firestore: 'databases',

    // DevOps
    Docker: 'devops', Kubernetes: 'devops', AWS: 'devops',
    Azure: 'devops', GCP: 'devops', Terraform: 'devops', Jenkins: 'devops',
    GitLab: 'devops', GitHub: 'devops', CI: 'devops', CD: 'devops',
    Serverless: 'devops', Lambda: 'devops', CloudFormation: 'devops',
    Ansible: 'devops',

    // Concepts
    API: 'concepts', REST: 'concepts', Microservices: 'concepts',
    Monolith: 'concepts', Agile: 'concepts', Scrum: 'concepts',
    DevOps: 'concepts', 'CI/CD': 'concepts', OOP: 'concepts',
    Functional: 'concepts', Reactive: 'concepts', Event: 'concepts',
    Async: 'concepts', Concurrency: 'concepts',

    // VCS
    Git: 'vcs', Commit: 'vcs', Branch: 'vcs', Merge: 'vcs',
    Pull: 'vcs', Fork: 'vcs', Clone: 'vcs', Rebase: 'vcs',
    Tag: 'vcs', Push: 'vcs',

    // AI
    Neural: 'ai', Tensor: 'ai', PyTorch: 'ai', Scikit: 'ai',
    NLP: 'ai', Computer: 'ai', Vision: 'ai', GAN: 'ai',
    Transformer: 'ai', BERT: 'ai', GPT: 'ai', LLM: 'ai',
    Dataset: 'ai', Training: 'ai', Inference: 'ai',

    // Security
    OAuth: 'security', JWT: 'security', SSL: 'security',
    Encryption: 'security', Firewall: 'security', VPN: 'security',
    LDAP: 'security', SAML: 'security', SSH: 'security', TLS: 'security',

    // OS
    Linux: 'os', Ubuntu: 'os', CentOS: 'os', Windows: 'os',
    macOS: 'os', BSD: 'os', Nginx: 'os', Apache: 'os', IIS: 'os',
    Systemd: 'os',

    // Mobile
    iOS: 'mobile', Android: 'mobile', Flutter: 'mobile',
    ReactNative: 'mobile', SwiftUI: 'mobile', Jetpack: 'mobile',
    Xamarin: 'mobile', PWA: 'mobile', WebAssembly: 'mobile',
    Electron: 'mobile',

    // Testing
    Jest: 'testing', Mocha: 'testing', Cypress: 'testing',
    Selenium: 'testing', JUnit: 'testing', UnitTest: 'testing',
    Integration: 'testing', E2E: 'testing', Mock: 'testing', Stub: 'testing',

    // Patterns
    MVC: 'patterns', MVP: 'patterns', MVVM: 'patterns',
    Singleton: 'patterns', Factory: 'patterns', Observer: 'patterns',
    Adapter: 'patterns', Proxy: 'patterns', Decorator: 'patterns',
    Strategy: 'patterns',

    // Misc
    Binary: 'misc', Kernel: 'misc', Socket: 'misc', Queue: 'misc',
    Cache: 'misc', Router: 'misc', Middleware: 'misc',
    Promise: 'misc', Callback: 'misc', Closure: 'misc',
    Pointer: 'misc', Thread: 'misc', Process: 'misc',
  };

  return wordToCategory[word] || 'misc';
}

function oppositeTeam(team: TeamColor): TeamColor {
  return team === 'red' ? 'blue' : 'red';
}

/** Flip every card and record the winner. Called only when the game is over. */
function finishGame(state: GameState, winner: TeamColor): void {
  state.status = 'finished';
  state.winner = winner;
  state.turnDeadline = null;
  for (const card of state.cards) {
    card.revealed = true;
  }
}

/**
 * Apply one guess and return the next state.
 *
 * Own card: score +1, turn continues; the team wins when none of its 8 cards remain.
 * Opponent card: that team scores it, then the turn passes. If it was their last
 * card, they win immediately.
 * Civilian: turn passes. Assassin: the guessing team loses and the board flips.
 */
export function handleGuess(
  gameState: GameState,
  cardIndex: number
): {
  newState: GameState;
  gameOver: boolean;
  winner?: TeamColor;
  cardRevealed: Card;
  previousTurn: TeamColor;
} {
  const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
  const card = newState.cards[cardIndex];
  card.revealed = true;

  const currentTeam = newState.currentTurn;
  const previousTurn = currentTeam;
  let gameOver = false;
  let winner: TeamColor | undefined;

  if (card.color === 'assassin') {
    newState.remainingCards.assassin = 0;
    winner = oppositeTeam(currentTeam);
    gameOver = true;
    finishGame(newState, winner);
  } else if (card.color === currentTeam) {
    newState.scores[currentTeam]++;
    newState.remainingCards[currentTeam]--;

    if (newState.remainingCards[currentTeam] === 0) {
      winner = currentTeam;
      gameOver = true;
      finishGame(newState, winner);
    }
  } else if (card.color === 'civilian') {
    newState.remainingCards.civilian--;
    newState.currentTurn = oppositeTeam(currentTeam);
  } else {
    const owner = card.color;
    newState.scores[owner]++;
    newState.remainingCards[owner]--;

    if (newState.remainingCards[owner] === 0) {
      winner = owner;
      gameOver = true;
      finishGame(newState, winner);
    } else {
      newState.currentTurn = oppositeTeam(currentTeam);
    }
  }

  return {
    newState,
    gameOver,
    winner,
    cardRevealed: card,
    previousTurn,
  };
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
