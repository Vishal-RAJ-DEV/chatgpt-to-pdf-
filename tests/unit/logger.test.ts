import { describe, it, expect, vi } from 'vitest';
import { logger } from '../../src/utils/logger';

describe('logger', () => {
  it('prefixes info messages with [ChatGPT PDF Exporter]', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test message');
    expect(spy).toHaveBeenCalledWith('[ChatGPT PDF Exporter]', 'test message');
    spy.mockRestore();
  });

  it('prefixes warn messages with [ChatGPT PDF Exporter]', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('warning');
    expect(spy).toHaveBeenCalledWith('[ChatGPT PDF Exporter]', 'warning');
    spy.mockRestore();
  });

  it('prefixes error messages with [ChatGPT PDF Exporter]', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('error');
    expect(spy).toHaveBeenCalledWith('[ChatGPT PDF Exporter]', 'error');
    spy.mockRestore();
  });
});
