/**
 * Unit Tests — Diagnostics System & Privacy Guarantees (Phase 9).
 */

import { describe, it, expect } from 'vitest';
import {
  createDiagnosticEntry,
  sanitizeDiagnosticContext,
} from '../../src/utils/Diagnostics';
import { setDebugMode, isDebugMode } from '../../src/utils/logger';

describe('Diagnostics System & Context Sanitization', () => {
  it('1. creates structured DiagnosticEntry with timestamp and level', () => {
    const entry = createDiagnosticEntry(
      'warning',
      'ADAPTER_CONTAINER_NOT_FOUND',
      'Conversation container missing'
    );

    expect(entry.level).toBe('warning');
    expect(entry.code).toBe('ADAPTER_CONTAINER_NOT_FOUND');
    expect(entry.message).toBe('Conversation container missing');
    expect(typeof entry.timestamp).toBe('string');
  });

  it('2. sanitizes context objects and strictly strips sensitive conversation text', () => {
    const rawContext = {
      turnCount: 5,
      prompt: 'This is a secret user prompt text that must NOT be logged!',
      response: 'This is private assistant response text!',
      text: 'Raw body text',
      hasRoot: true,
      selectors: ['main', 'article'],
    };

    const sanitized = sanitizeDiagnosticContext(rawContext);

    expect(sanitized).toBeDefined();
    expect(sanitized?.turnCount).toBe(5);
    expect(sanitized?.hasRoot).toBe(true);
    expect(sanitized?.selectors).toBe(2); // converted array to count
    expect(sanitized?.prompt).toBeUndefined();
    expect(sanitized?.response).toBeUndefined();
    expect(sanitized?.text).toBeUndefined();
  });

  it('3. supports debug mode flag toggle in logger', () => {
    expect(isDebugMode()).toBe(false);
    setDebugMode(true);
    expect(isDebugMode()).toBe(true);
    setDebugMode(false);
    expect(isDebugMode()).toBe(false);
  });
});
