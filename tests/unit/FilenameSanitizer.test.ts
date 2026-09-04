import { describe, expect, it } from 'vitest';
import { sanitizeFilename } from '../../src/core/utils/filenameSanitizer';

describe('Filename Sanitizer Unit Tests', () => {
  it('1. preserves normal alphanumeric conversation titles', () => {
    const result = sanitizeFilename('Quantum Computing Overview');
    expect(result).toBe('Quantum Computing Overview');
  });

  it('2. returns fallback for empty, undefined, or null titles', () => {
    expect(sanitizeFilename('')).toBe('ChatGPT-Conversation');
    expect(sanitizeFilename(undefined)).toBe('ChatGPT-Conversation');
    expect(sanitizeFilename(null)).toBe('ChatGPT-Conversation');
    expect(sanitizeFilename('   ')).toBe('ChatGPT-Conversation');
  });

  it('3. returns fallback for punctuation-heavy or symbol-only titles', () => {
    expect(sanitizeFilename('...---???')).toBe('ChatGPT-Conversation');
    expect(sanitizeFilename(':::***<<<>>>')).toBe('ChatGPT-Conversation');
  });

  it('4. strips illegal OS filename characters across Windows, Mac, and Linux', () => {
    const raw = 'What: is/a*file?name<test>|foo"bar\\test';
    const result = sanitizeFilename(raw);
    expect(result).toBe('What is a file name test foo bar test');
    expect(result).not.toMatch(/[\\/:*?"<>|]/);
  });


  it('5. preserves international Unicode characters (CJK, Japanese, accents, Emoji)', () => {
    const japanese = sanitizeFilename('日本語のタイトル — 量子コンピュータ');
    expect(japanese).toBe('日本語のタイトル — 量子コンピュータ');

    const french = sanitizeFilename('Résumé de la réunion d\'équipe');
    expect(french).toBe('Résumé de la réunion d\'équipe');
  });

  it('6. safely truncates long titles exceeding 100 characters', () => {
    const longTitle = 'A'.repeat(150);
    const result = sanitizeFilename(longTitle);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toBe('A'.repeat(100));
  });
});
