import type { ThemeId } from './themes';

/** Offline fallback decks (25+ entries each) when the API is cold or unreachable. */
export const DEMO_DECKS: Record<ThemeId, Array<{ word: string; picture: string }>> = {
  it: [
    { word: 'JavaScript', picture: '🟨' }, { word: 'Python', picture: '🐍' },
    { word: 'TypeScript', picture: '🟦' }, { word: 'Java', picture: '☕' },
    { word: 'Rust', picture: '🦀' }, { word: 'Go', picture: '🐹' },
    { word: 'Ruby', picture: '💎' }, { word: 'Swift', picture: '🕊️' },
    { word: 'Kotlin', picture: '🅺' }, { word: 'CSharp', picture: '♯' },
    { word: 'PHP', picture: '🐘' }, { word: 'Scala', picture: '🎼' },
    { word: 'Haskell', picture: 'λ' }, { word: 'Lua', picture: '🌙' },
    { word: 'React', picture: '⚛️' }, { word: 'Angular', picture: '🅰️' },
    { word: 'Vue', picture: '💚' }, { word: 'Django', picture: '🎸' },
    { word: 'Flask', picture: '🧪' }, { word: 'Node', picture: '🟩' },
    { word: 'Express', picture: '🚂' }, { word: 'Spring', picture: '🌱' },
    { word: 'Rails', picture: '🛤️' }, { word: 'Svelte', picture: '🔥' },
    { word: 'Next', picture: '⏭️' }, { word: 'Redux', picture: '🔁' },
    { word: 'Tailwind', picture: '🌬️' }, { word: 'Docker', picture: '🐳' },
  ],
  football: [
    { word: 'Вратарь', picture: '🧤' }, { word: 'Защитник', picture: '🛡️' },
    { word: 'Полузащитник', picture: '🎯' }, { word: 'Нападающий', picture: '⚡' },
    { word: 'Капитан', picture: '©️' }, { word: 'Тренер', picture: '📋' },
    { word: 'Либеро', picture: '🧭' }, { word: 'Вингер', picture: '🪽' },
    { word: 'Плеймейкер', picture: '🎹' }, { word: 'Форвард', picture: '🏹' },
    { word: 'Удар', picture: '🦵' }, { word: 'Пас', picture: '📨' },
    { word: 'Навес', picture: '🪂' }, { word: 'Дриблинг', picture: '🌀' },
    { word: 'Сейв', picture: '🤲' }, { word: 'Пенальти', picture: '⚪' },
    { word: 'Угловой', picture: '🚩' }, { word: 'Офсайд', picture: '🚫' },
    { word: 'Гол', picture: '🎉' }, { word: 'Лига', picture: '🏆' },
    { word: 'Кубок', picture: '🥇' }, { word: 'Стадион', picture: '🏟️' },
    { word: 'Трибуна', picture: '📣' }, { word: 'Ворота', picture: '🥅' },
    { word: 'Прессинг', picture: '📈' }, { word: 'Контратака', picture: '💥' },
    { word: 'Фланг', picture: '↔️' }, { word: 'Дерби', picture: '🔥' },
  ],
  yoga: [
    { word: 'Собака', picture: '🐕' }, { word: 'Воин', picture: '🗡️' },
    { word: 'Дерево', picture: '🌳' }, { word: 'Кобра', picture: '🐍' },
    { word: 'Мост', picture: '🌉' }, { word: 'Планка', picture: '🪵' },
    { word: 'Лотос', picture: '🪷' }, { word: 'Гора', picture: '⛰️' },
    { word: 'Треугольник', picture: '🔺' }, { word: 'Полумесяц', picture: '🌙' },
    { word: 'Голубь', picture: '🕊️' }, { word: 'Стойка', picture: '🙃' },
    { word: 'Вдох', picture: '💨' }, { word: 'Выдох', picture: '🌬️' },
    { word: 'Задержка', picture: '⏸️' }, { word: 'Уджайи', picture: '🌊' },
    { word: 'Ритм', picture: '🥁' }, { word: 'Диафрагма', picture: '🫁' },
    { word: 'Пауза', picture: '🤫' }, { word: 'Очищение', picture: '✨' },
    { word: 'Поток', picture: '💧' }, { word: 'Хатха', picture: '🧘' },
    { word: 'Виньяса', picture: '🌀' }, { word: 'Лук', picture: '🏹' },
    { word: 'Нади', picture: '🧬' }, { word: 'Счёт', picture: '🔢' },
    { word: 'Ноздри', picture: '👃' }, { word: 'Капалабхати', picture: '🔥' },
  ],
  movies: [
    { word: 'Комедия', picture: '😂' }, { word: 'Драма', picture: '😢' },
    { word: 'Триллер', picture: '😰' }, { word: 'Ужасы', picture: '👻' },
    { word: 'Фантастика', picture: '🚀' }, { word: 'Детектив', picture: '🔍' },
    { word: 'Вестерн', picture: '🤠' }, { word: 'Мюзикл', picture: '🎤' },
    { word: 'Нуар', picture: '🕶️' }, { word: 'Боевик', picture: '💥' },
    { word: 'Фэнтези', picture: '🐉' }, { word: 'Анимация', picture: '✏️' },
    { word: 'Режиссёр', picture: '🎬' }, { word: 'Актёр', picture: '🎭' },
    { word: 'Оператор', picture: '🎥' }, { word: 'Сценарист', picture: '✍️' },
    { word: 'Продюсер', picture: '💼' }, { word: 'Монтажёр', picture: '✂️' },
    { word: 'Композитор', picture: '🎼' }, { word: 'Каскадёр', picture: '🤸' },
    { word: 'Гример', picture: '💄' }, { word: 'Костюмер', picture: '👗' },
    { word: 'Камера', picture: '📷' }, { word: 'Хлопушка', picture: '👏' },
    { word: 'Кастинг', picture: '⭐' }, { word: 'Мелодрама', picture: '💌' },
    { word: 'Дублёр', picture: '👥' }, { word: 'Звукорежиссёр', picture: '🎚️' },
  ],
};

export function shuffleDeal(
  theme: ThemeId,
  count = 25
): Array<{ word: string; picture: string }> {
  const pack = [...DEMO_DECKS[theme]];
  for (let i = pack.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pack[i], pack[j]] = [pack[j], pack[i]];
  }
  return pack.slice(0, count);
}
