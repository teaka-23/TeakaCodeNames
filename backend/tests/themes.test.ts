import { dealEntries, getPack, THEME_IDS } from '../src/themes';

describe('theme packs', () => {
  it('deals 25 words from the selected pack only', () => {
    const football = new Set(getPack('football').map((entry) => entry.word));
    const dealt = dealEntries('football', 25);

    expect(dealt).toHaveLength(25);
    expect(new Set(dealt.map((entry) => entry.word)).size).toBe(25);
    dealt.forEach((entry) => {
      expect(football.has(entry.word)).toBe(true);
      expect(entry.picture.length).toBeGreaterThan(0);
    });
    expect(dealt.some((entry) => entry.word === 'React')).toBe(false);
  });

  it.each(THEME_IDS)('keeps %s words unique and pictured', (theme) => {
    const pack = getPack(theme);
    const words = pack.map((entry) => entry.word);
    expect(new Set(words).size).toBe(words.length);
    expect(pack.length).toBeGreaterThanOrEqual(theme === 'it' ? 150 : 100);
    pack.forEach((entry) => {
      expect(entry.picture.trim().length).toBeGreaterThan(0);
      expect(entry.category).not.toBe(entry.word);
    });
  });
});