import { Link } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-container">
      <section className="landing-hero">
        <div className="hero-stage">
          <p className="hero-kicker">IT Edition</p>
          <h1 className="hero-title">Codenames</h1>
          <p className="hero-subtitle">
            Командная игра на ассоциации за оперативным столом: IT, футбол, йога или фильмы.
          </p>
          <div className="hero-actions">
            <Link to="/lobby" className="btn-secondary">
              Играть
            </Link>
            <Link to="/demo" className="btn-ghost">
              Демо
            </Link>
            <button type="button" className="btn-ghost" onClick={() => scrollToSection('rules')}>
              Правила
            </button>
          </div>
        </div>
        <div className="hero-felt" aria-hidden="true">
          <div className="sample-grid">
            {[
              ['⚛️', 'React'],
              ['⚽', 'Пенальти'],
              ['🧘', 'Лотос'],
              ['🎬', 'Кадр'],
              ['🐳', 'Docker'],
              ['☕', 'Java'],
            ].map(([picture, word]) => (
              <div key={word} className="sample-card">
                <span className="sample-picture">{picture}</span>
                <span>{word}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="rules" className="landing-section">
        <h2 className="section-title">Как играть</h2>
        <div className="steps-grid">
          {[
            ['01', 'Создайте комнату', 'Один игрок создаёт комнату и получает код для друзей.'],
            ['02', 'Присоединитесь', 'Остальные вводят код и имя, выбирают места за столом.'],
            ['03', 'Начните партию', 'Когда обе команды готовы — старт. Поле 5×5 уже разложено.'],
            ['04', 'Давайте подсказки', 'Шпион отмечает цели и даёт слово + число. Команда угадывает.'],
          ].map(([num, title, text]) => (
            <div key={num} className="step-card">
              <div className="step-number">{num}</div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="roles" className="landing-section">
        <h2 className="section-title">Роли</h2>
        <div className="roles-grid">
          <div className="role-card">
            <p className="role-label">Spymaster</p>
            <h3>Шпион</h3>
            <ul className="role-tasks">
              <li>Видит цвета всех карточек</li>
              <li>Отмечает цели и даёт подсказку</li>
              <li>Формат: слово + число</li>
            </ul>
          </div>
          <div className="role-card">
            <p className="role-label">Operative</p>
            <h3>Полевой</h3>
            <ul className="role-tasks">
              <li>Слушает подсказку шпиона</li>
              <li>Открывает карточки на поле</li>
              <li>Может пропустить ход</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="colors" className="landing-section">
        <h2 className="section-title">Легенда поля</h2>
        <div className="colors-grid">
          <div className="color-item">
            <div className="color-preview red" />
            <div>
              <h3>Красные</h3>
              <p>Карточки вашей команды</p>
            </div>
          </div>
          <div className="color-item">
            <div className="color-preview blue" />
            <div>
              <h3>Синие</h3>
              <p>Карточки соперника</p>
            </div>
          </div>
          <div className="color-item">
            <div className="color-preview civ" />
            <div>
              <h3>Гражданский</h3>
              <p>Ход переходит</p>
            </div>
          </div>
          <div className="color-item">
            <div className="color-preview assassin" />
            <div>
              <h3>Ассасин</h3>
              <p>Мгновенное поражение</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <h2 className="font-display">Стол свободен</h2>
        <p>Соберите 3–6 человек и разложите колоду.</p>
        <Link to="/lobby" className="btn-secondary">
          Создать комнату
        </Link>
      </section>
    </div>
  );
}

export default LandingPage;
