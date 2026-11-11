export const THEME_IDS = ['it', 'football', 'yoga', 'movies'] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeWord {
  word: string;
  category: string;
  picture: string;
}

export interface ThemeMeta {
  id: ThemeId;
  title: string;
  blurb: string;
}

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}
