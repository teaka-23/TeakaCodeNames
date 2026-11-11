import { itWords } from '../utils/wordDatabase';
import { footballWords } from './football';
import { movieWords } from './movies';
import { yogaWords } from './yoga';
import { isThemeId, THEME_IDS, type ThemeId, type ThemeMeta, type ThemeWord } from './types';

export { isThemeId, THEME_IDS };
export type { ThemeId, ThemeMeta, ThemeWord };

export const THEME_META: ThemeMeta[] = [
  { id: 'it', title: 'IT', blurb: 'Код, серверы, данные' },
  { id: 'football', title: 'Футбол', blurb: 'Мяч, схема, трибуны' },
  { id: 'yoga', title: 'Йога', blurb: 'Поза, дыхание, тишина' },
  { id: 'movies', title: 'Фильмы', blurb: 'Кадр, сюжет, премьера' },
];

const PACKS: Record<ThemeId, ThemeWord[]> = {
  it: itWords,
  football: footballWords,
  yoga: yogaWords,
  movies: movieWords,
};

export function getPack(theme: ThemeId): ThemeWord[] {
  return PACKS[theme];
}

export function categoryOf(theme: ThemeId, word: string): string {
  return getPack(theme).find((entry) => entry.word === word)?.category ?? 'разное';
}

/** Fisher-Yates sample. Throws if the pack is smaller than count. */
export function dealEntries(theme: ThemeId, count: number): ThemeWord[] {
  const pack = [...getPack(theme)];
  for (let i = pack.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pack[i], pack[j]] = [pack[j], pack[i]];
  }
  if (pack.length < count) {
    throw new Error(`Not enough words in theme ${theme}: need ${count}, got ${pack.length}`);
  }
  return pack.slice(0, count);
}
