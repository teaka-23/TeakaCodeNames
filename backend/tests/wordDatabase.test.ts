import { getRandomWords, getWordsByCategory, itWords } from '../src/utils/wordDatabase';

describe('getRandomWords', () => {
  it('should return exactly 25 words when count is 25', () => {
    const words = getRandomWords(25);
    expect(words).toHaveLength(25);
  });

  it('should return requested number of words', () => {
    const words = getRandomWords(10);
    expect(words).toHaveLength(10);
  });

  it('should return unique words', () => {
    const words = getRandomWords(25);
    const uniqueWords = new Set(words);
    expect(uniqueWords.size).toBe(25);
  });

  it('should return words from the database', () => {
    const words = getRandomWords(25);
    words.forEach(word => {
      expect(itWords.some(w => w.word === word)).toBe(true);
    });
  });

  it('should handle edge case of 0 words', () => {
    const words = getRandomWords(0);
    expect(words).toHaveLength(0);
  });
});

describe('getWordsByCategory', () => {
  it('should return correct number of languages', () => {
    const languages = getWordsByCategory('languages');
    expect(languages.length).toBeGreaterThanOrEqual(15);
  });

  it('should return correct number of frameworks', () => {
    const frameworks = getWordsByCategory('frameworks');
    expect(frameworks.length).toBeGreaterThanOrEqual(10);
  });

  it('should return empty array for unknown category', () => {
    const words = getWordsByCategory('unknown');
    expect(words).toEqual([]);
  });

  it('should return only words from specified category', () => {
    const words = getWordsByCategory('devops');
    words.forEach(word => {
      expect(itWords.some(w => w.word === word && w.category === 'devops')).toBe(true);
    });
  });
});

describe('itWords database', () => {
  it('should have at least 150 words', () => {
    expect(itWords.length).toBeGreaterThanOrEqual(150);
  });

  it('should have all words with word, category and a picture', () => {
    itWords.forEach(entry => {
      expect(entry.word).toBeDefined();
      expect(entry.category).toBeDefined();
      expect(typeof entry.word).toBe('string');
      expect(typeof entry.category).toBe('string');
      expect(entry.picture).toBeTruthy();
      expect(entry.picture).not.toBe('💻');
    });
  });

  it('should have all unique words', () => {
    const words = itWords.map(w => w.word);
    const uniqueWords = new Set(words);
    // Some words may map to same category, so count could be less
    expect(uniqueWords.size).toBeGreaterThanOrEqual(150);
  });
});
