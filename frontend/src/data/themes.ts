export const THEMES = [
  { id: 'it', title: 'IT', blurb: 'Код, серверы, данные' },
  { id: 'football', title: 'Футбол', blurb: 'Мяч, схема, трибуны' },
  { id: 'yoga', title: 'Йога', blurb: 'Поза, дыхание, тишина' },
  { id: 'movies', title: 'Фильмы', blurb: 'Кадр, сюжет, премьера' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export function themeTitle(id: string | undefined): string {
  return THEMES.find((theme) => theme.id === id)?.title ?? 'IT';
}
