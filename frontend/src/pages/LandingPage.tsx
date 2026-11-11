import { Link } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-container">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <h1 className="hero-title">
            🕵️ <span className="gradient-text">Codenames</span>
          </h1>
          <p className="hero-subtitle">
            Командная игра на ассоциации: IT, футбол, йога или фильмы
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => scrollToSection('rules')}>
              📖 Правила
            </button>
            <Link to="/demo" className="btn-demo">
              🧪 Демо-игра
            </Link>
            <Link to="/lobby" className="btn-secondary">
              ▶ Играть
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="sample-grid">
            {[
              ['⚛️', 'React'],
              ['⚽', 'Пенальти'],
              ['🧘', 'Лотос'],
              ['🎬', 'Кадр'],
              ['🐳', 'Docker'],
            ].map(([picture, word]) => (
              <div key={word} className="sample-card">
                <span className="sample-picture">{picture}</span>
                <span>{word}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rules Section */}
      <section id="rules" className="landing-section">
        <h2 className="section-title">Как играть</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Создайте комнату</h3>
            <p>
              Один игрок создаёт комнату и получает уникальный код.
              Этот код нужно передать всем участникам.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Присоединитесь</h3>
            <p>
              Остальные вводят код комнаты и своё имя.
              Система автоматически распределяет команды по двое.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Начните игру</h3>
            <p>
              Когда все готовы, организатор нажимает «Старт».
              Поле 5×5 с IT-словами готово к разгадыванию.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">4</div>
            <h3>Давайте подсказки</h3>
            <p>
              Шпион каждой команды видит подсказку и называет
              слово + число. Команда угадывает карточки.
            </p>
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section id="roles" className="landing-section roles-section">
        <h2 className="section-title">Роли в команде</h2>
        <div className="roles-grid">
          <div className="role-card role-spymaster">
            <div className="role-icon">🕵️</div>
            <h3>Шпион (Spymaster)</h3>
            <ul className="role-tasks">
              <li>Видит цвета всех карточек на поле</li>
              <li>Даёт подсказку одному слову + число</li>
              <li>Направляет команду к нужным карточкам</li>
              <li>Подсказка вида: <code>"React 3"</code> = 3 карточки React</li>
            </ul>
          </div>
          <div className="role-card role-guesser">
            <div className="role-icon">👆</div>
            <h3>Угадайка (Guesser)</h3>
            <ul className="role-tasks">
              <li>Слушает подсказку от шпиона</li>
              <li>Выбирает карточку на поле</li>
              <li>Может пропустить ход если не уверен</li>
              <li>Команда угадывает до 8 карточек за ход</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Card Colors Legend */}
      <section id="colors" className="landing-section colors-section">
        <h2 className="section-title">Цветовая легенда</h2>
        <div className="colors-grid">
          <div className="color-item color-red">
            <div className="color-preview color-red-bg"></div>
            <div className="color-info">
              <h3>🔴 Красная команда</h3>
              <p>9 карточек. Угадывайте только свои!</p>
              <span className="color-count">+ 1 очко за каждую</span>
            </div>
          </div>
          <div className="color-item color-blue">
            <div className="color-preview color-blue-bg"></div>
            <div className="color-info">
              <h3>🔵 Синяя команда</h3>
              <p>9 карточек. Угадывайте только свои!</p>
              <span className="color-count">+ 1 очко за каждую</span>
            </div>
          </div>
          <div className="color-item color-civilian">
            <div className="color-preview color-civilian-bg"></div>
            <div className="color-info">
              <h3>⚪ Гражданский</h3>
              <p>7 карточек. Нейтральные слова.</p>
              <span className="color-count">Ход переходит сопернику</span>
            </div>
          </div>
          <div className="color-item color-assassin">
            <div className="color-preview color-assassin-bg"></div>
            <div className="color-info">
              <h3>💀 Ассасин</h3>
              <p>1 карточка. Опасный противник!</p>
              <span className="color-count color-danger">Мгновенное поражение</span>
            </div>
          </div>
        </div>
      </section>

      {/* Game Field Example */}
      <section id="example" className="landing-section">
        <h2 className="section-title">Пример игрового поля</h2>
        <p className="section-subtitle">25 карточек в сетке 5×5</p>
        <div className="example-board">
          {[
            'React', 'Python', 'Docker', 'Git', 'AWS',
            'API', 'Node', 'Redis', 'Linux', 'GitLab',
            'Java', 'Kubernetes', 'MySQL', 'Nginx', 'CI',
            'TypeScript', 'Terraform', 'GraphQL', 'Jenkins', 'SSH',
            'Webpack', 'MongoDB', 'Vue', 'PostgreSQL', 'npm',
          ].map((word, i) => (
            <div key={i} className="example-card">
              {word}
            </div>
          ))}
        </div>
        <p className="field-note">
          Каждая карточка скрыта от команды до момента выбора.
          Слова выбираются случайно из базы 150+ IT-терминов.
        </p>
      </section>

      {/* Win Conditions */}
      <section className="landing-section win-section">
        <h2 className="section-title">Как победить</h2>
        <div className="win-cards">
          <div className="win-card win-win">
            <div className="win-icon">🏆</div>
            <h3>Выигрыш</h3>
            <p>
              Угадайте все 9 карточек своей команды первыми.
              Команда с правильными угадываниями побеждает!
            </p>
          </div>
          <div className="win-card win-lose">
            <div className="win-icon">💀</div>
            <h3>Проигрыш</h3>
            <p>
              Если угадали карточку Ассасина — мгновенное поражение,
              даже если у вас больше очков.
            </p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="landing-cta">
        <h2>Готовы начать?</h2>
        <p>Соберите команду из 3-6 человек и начните игру!</p>
        <Link to="/lobby" className="btn-cta">
          🚀 Создать комнату
        </Link>
      </section>
    </div>
  );
}

export default LandingPage;
