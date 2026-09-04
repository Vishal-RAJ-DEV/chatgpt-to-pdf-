import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { checkHealth } from '../../src/adapters/chatgpt/healthCheck';

function loadFixture(filename: string): Document {
  const filePath = resolve(__dirname, '../fixtures/html', filename);
  const html = readFileSync(filePath, 'utf8');
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('checkHealth Extended Diagnostics', () => {
  it('returns high confidence for a valid basic fixture', () => {
    const doc = loadFixture('chatgpt-current-basic.html');
    const status = checkHealth(doc);

    expect(status.supportedHost).toBe(true);
    expect(status.documentReady).toBe(true);
    expect(status.conversationDetected).toBe(true);
    expect(status.turnCandidatesFound).toBe(true);
    expect(status.userTurnsFound).toBe(true);
    expect(status.assistantTurnsFound).toBe(true);
    expect(status.confidence).toBe('high');
  });

  it('returns medium/low confidence if turns are missing', () => {
    const doc = loadFixture('chatgpt-current-basic.html');
    // Remove all turns from fixture
    doc.querySelectorAll('[data-testid^="conversation-turn-"]').forEach((el) => el.remove());

    const status = checkHealth(doc);
    expect(status.conversationDetected).toBe(true);
    expect(status.turnCandidatesFound).toBe(false);
    expect(status.confidence).toBe('low');
  });
});
