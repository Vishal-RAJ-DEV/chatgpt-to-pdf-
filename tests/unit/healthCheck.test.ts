import { describe, it, expect } from 'vitest';
import { isSupportedHost, isDocumentReady } from '../../src/adapters/chatgpt/ChatGPTAdapter';

describe('isSupportedHost', () => {
  it('returns true for chatgpt.com', () => {
    expect(isSupportedHost('chatgpt.com')).toBe(true);
  });

  it('returns true for www.chatgpt.com', () => {
    expect(isSupportedHost('www.chatgpt.com')).toBe(true);
  });

  it('returns false for other hostnames', () => {
    expect(isSupportedHost('example.com')).toBe(false);
    expect(isSupportedHost('chat.openai.com')).toBe(false);
    expect(isSupportedHost('localhost')).toBe(false);
    expect(isSupportedHost('')).toBe(false);
  });
});

describe('isDocumentReady', () => {
  it('returns true when readyState is complete', () => {
    expect(isDocumentReady('complete')).toBe(true);
  });

  it('returns true when readyState is interactive', () => {
    expect(isDocumentReady('interactive')).toBe(true);
  });

  it('returns false when readyState is loading', () => {
    expect(isDocumentReady('loading')).toBe(false);
  });
});
