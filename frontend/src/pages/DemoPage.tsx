import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameBoard from '../components/GameBoard';
import Scoreboard from '../components/Scoreboard';
import type { TeamColor } from '../types';
import './DemoPage.css';

// Import word database directly
const itWords = [
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
  { word: 'PostgreSQL', category: 'databases' },
  { word: 'MongoDB', category: 'databases' },
  { word: 'Redis', category: 'databases' },
  { word: 'MySQL', category: 'databases' },
  { word: 'SQLite', category: 'databases' },
  { word: 'Cassandra', category: 'databases' },
  { word: 'DynamoDB', category: 'databases' },
  { word: 'ElasticSearch', category: 'databases' },
  { word: 'Firestore', category: 'databases' },
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
  { word: 'Ansible', category: 'devops' },
  { word: 'API', category: 'concepts' },
  { word: 'REST', category: 'concepts' },
  { word: 'Microservices', category: 'concepts' },
  { word: 'Monolith', category: 'concepts' },
  { word: 'Agile', category: 'concepts' },
  { word: 'Scrum', category: 'concepts' },
  { word: 'DevOps', category: 'concepts' },
  { word: 'OOP', category: 'concepts' },
  { word: 'Functional', category: 'concepts' },
  { word: 'Reactive', category: 'concepts' },
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
  { word: 'Neural', category: 'ai' },
  { word: 'Tensor', category: 'ai' },
  { word: 'PyTorch', category: 'ai' },
  { word: 'NLP', category: 'ai' },
  { word: 'Vision', category: 'ai' },
  { word: 'Transformer', category: 'ai' },
  { word: 'GPT', category: 'ai' },
  { word: 'LLM', category: 'ai' },
  { word: 'Dataset', category: 'ai' },
  { word: 'Training', category: 'ai' },
  { word: 'OAuth', category: 'security' },
  { word: 'JWT', category: 'security' },
  { word: 'SSL', category: 'security' },
  { word: 'Encryption', category: 'security' },
  { word: 'Firewall', category: 'security' },
  { word: 'VPN', category: 'security' },
  { word: 'SSH', category: 'security' },
  { word: 'TLS', category: 'security' },
  { word: 'Linux', category: 'os' },
  { word: 'Ubuntu', category: 'os' },
  { word: 'Windows', category: 'os' },
  { word: 'Nginx', category: 'os' },
  { word: 'Apache', category: 'os' },
  { word: 'iOS', category: 'mobile' },
  { word: 'Android', category: 'mobile' },
  { word: 'Flutter', category: 'mobile' },
  { word: 'ReactNative', category: 'mobile' },
  { word: 'SwiftUI', category: 'mobile' },
  { word: 'Jest', category: 'testing' },
  { word: 'Cypress', category: 'testing' },
  { word: 'Selenium', category: 'testing' },
  { word: 'JUnit', category: 'testing' },
  { word: 'E2E', category: 'testing' },
  { word: 'MVC', category: 'patterns' },
  { word: 'Singleton', category: 'patterns' },
  { word: 'Factory', category: 'patterns' },
  { word: 'Observer', category: 'patterns' },
  { word: 'Binary', category: 'misc' },
  { word: 'Kernel', category: 'misc' },
  { word: 'Socket', category: 'misc' },
  { word: 'Cache', category: 'misc' },
  { word: 'Router', category: 'misc' },
  { word: 'Thread', category: 'misc' },
  { word: 'Lambda', category: 'misc' },
  { word: 'Process', category: 'misc' },
];

function getRandomWords(count: number = 25): string[] {
  const shuffled = [...itWords].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(w => w.word);
}

interface Card {
  word: string;
  color: 'red' | 'blue' | 'civilian' | 'assassin';
  x: number;
  y: number;
  revealed: boolean;
}

interface GameState {
  cards: Card[];
  scores: { red: number; blue: number };
  remainingCards: { red: number; blue: number; civilian: number; assassin: number };
  currentTurn: 'red' | 'blue';
  status: 'playing' | 'finished';
  winner: TeamColor | null;
}

function createCardSet(): Card[] {
  const words = getRandomWords(25);

  const colors: Card['color'][] = [];
  for (let i = 0; i < 8; i++) colors.push('red');
  for (let i = 0; i < 8; i++) colors.push('blue');
  for (let i = 0; i < 8; i++) colors.push('civilian');
  colors.push('assassin');

  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }

  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }

  return words.map((word, index) => ({
    word,
    color: colors[index],
    x: index % 5,
    y: Math.floor(index / 5),
    revealed: false,
  }));
}

function createInitialGameState(): GameState {
  const turn: TeamColor = Math.random() < 0.5 ? 'red' : 'blue';
  return {
    cards: createCardSet(),
    scores: { red: 0, blue: 0 },
    remainingCards: { red: 8, blue: 8, civilian: 8, assassin: 1 },
    currentTurn: turn,
    status: 'playing',
    winner: null,
  };
}

function DemoPage() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);
  const [debugMode, setDebugMode] = useState(true);
  const [turnCount, setTurnCount] = useState(0);


  const handleGuess = (cardIndex: number) => {
    const card = gameState.cards[cardIndex];
    if (card.revealed || gameState.status === 'finished') return;

    setGameState(prev => {
      const picked = prev.cards[cardIndex];
      const cards = prev.cards.map((c, i) => (i === cardIndex ? { ...c, revealed: true } : c));
      const remaining = { ...prev.remainingCards };
      const scores = { ...prev.scores };
      let currentTurn = prev.currentTurn;
      let status = prev.status;
      let winner: TeamColor | null = null;

      const finish = (team: TeamColor) => {
        status = 'finished';
        winner = team;
        for (let i = 0; i < cards.length; i++) cards[i] = { ...cards[i], revealed: true };
      };

      if (picked.color === 'assassin') {
        remaining.assassin = 0;
        finish(currentTurn === 'red' ? 'blue' : 'red');
      } else if (picked.color === currentTurn) {
        scores[currentTurn]++;
        remaining[currentTurn]--;
        if (remaining[currentTurn] === 0) finish(currentTurn);
      } else if (picked.color === 'civilian') {
        remaining.civilian--;
        currentTurn = currentTurn === 'red' ? 'blue' : 'red';
      } else {
        scores[picked.color]++;
        remaining[picked.color]--;
        if (remaining[picked.color] === 0) finish(picked.color);
        else currentTurn = currentTurn === 'red' ? 'blue' : 'red';
      }

      return { cards, scores, remainingCards: remaining, currentTurn, status, winner };
    });

    setTurnCount(prev => prev + 1);
  };

  const handleReset = () => {
    setGameState(createInitialGameState());
    setTurnCount(0);
  };

  return (
    <div className="demo-page">
      <div className="demo-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← На главную
        </button>

        <h1>🧪 Демо-режим</h1>
        <p className="demo-subtitle">Проверка работы игры без подключения к серверу</p>
      </div>

      <div className="demo-controls">
        <button
          className={`btn-debug ${debugMode ? 'active' : ''}`}
          onClick={() => setDebugMode(!debugMode)}
        >
          {debugMode ? '👁️ Скрыть цвета' : '👁️ Показать все карточки'}
        </button>
        <button className="btn-reset" onClick={handleReset}>
          🔄 Новая игра
        </button>
      </div>

      <div className="demo-stats">
        <div className="stat-item">
          <span className="stat-label">Ходов сделано:</span>
          <span className="stat-value">{turnCount}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Текущая команда:</span>
          <span className={`stat-value team-${gameState.currentTurn}`}>
            {gameState.currentTurn === 'red' ? '🔴 Красные' : '🔵 Синие'}
          </span>
        </div>
      </div>

      <Scoreboard
        scores={gameState.scores}
        remaining={gameState.remainingCards}
        currentTurn={gameState.currentTurn}
      />

      {gameState.status === 'finished' && (
        <div className="game-finished">
          <h2>🏆 Игра окончена!</h2>
          {gameState.winner === 'red' ? (
            <p className="winner-red">🔴 Красные победили!</p>
          ) : gameState.winner === 'blue' ? (
            <p className="winner-blue">🔵 Синие победили!</p>
          ) : (
            <p>Ничья!</p>
          )}
          <button className="btn-play-again" onClick={handleReset}>
            Начать новую игру
          </button>
        </div>
      )}

      <GameBoard
        cards={gameState.cards}
        onGuess={handleGuess}
        disabled={gameState.status === 'finished'}
        showAll={debugMode || gameState.status === 'finished'}
      />

      <div className="demo-info">
        <h3>📚 Как тестировать:</h3>
        <ul>
          <li>✅ <strong>Показать все карточки</strong> — нажмите кнопку выше, чтобы увидеть цвета всех карточек</li>
          <li>✅ <strong>Проверить логику</strong> — кликайте карточки и наблюдайте за изменениями</li>
          <li>✅ <strong>Проверить победу</strong> — угадайте все 8 карточек своей команды</li>
          <li>✅ <strong>Проверить поражение</strong> — кликните на 💀 Ассасин</li>
          <li>✅ <strong>Проверить переход хода</strong> — кликните на карточку соперника или нейтральную</li>
        </ul>

        <h3>🎯 Ожидаемое поведение:</h3>
        <div className="expected-grid">
          <div className="expected-item expected-correct">
            <span className="expected-icon">✅</span>
            <div>
              <strong>Своя карточка</strong>
              <p>+1 очко, ход продолжается</p>
            </div>
          </div>
          <div className="expected-item expected-wrong">
            <span className="expected-icon">↪️</span>
            <div>
              <strong>Чужая карточка</strong>
              <p>+1 сопернику, ход переходит. Последняя — его победа</p>
            </div>
          </div>
          <div className="expected-item expected-lose">
            <span className="expected-icon">💀</span>
            <div>
              <strong>Ассасин</strong>
              <p>Мгновенное поражение</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemoPage;
