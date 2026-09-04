/**
 * Unit Tests — Core Settings & Validation Engine (Phase 5).
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/core/settings/defaults';
import { UserSettings } from '../../src/core/settings/Settings';
import { toRenderOptions } from '../../src/core/settings/toRenderOptions';
import {
  validateBoolean,
  validateCodeTheme,
  validateCssLength,
  validateFontFamily,
  validateLineHeight,
  validateOrientation,
  validatePageSize,
  validatePartialSettings,
  validateSettings,
} from '../../src/core/settings/validation';

describe('Settings Defaults & Validation Engine', () => {

  it('1. provides canonical DEFAULT_SETTINGS matching Phase 4 renderer specs', () => {
    expect(DEFAULT_SETTINGS.pageSize).toBe('A4');
    expect(DEFAULT_SETTINGS.orientation).toBe('portrait');
    expect(DEFAULT_SETTINGS.marginTop).toBe('18mm');
    expect(DEFAULT_SETTINGS.baseFontSize).toBe('10pt');
    expect(DEFAULT_SETTINGS.lineHeight).toBe(1.5);
    expect(DEFAULT_SETTINGS.showUserMessages).toBe(true);
    expect(DEFAULT_SETTINGS.showAssistantMessages).toBe(true);
    expect(DEFAULT_SETTINGS.codeTheme).toBe('dark');
  });

  it('2. accepts fully valid UserSettings without alteration', () => {
    const custom: UserSettings = {
      pageSize: 'LETTER',
      orientation: 'landscape',
      marginTop: '25mm',
      marginRight: '20mm',
      marginBottom: '25mm',
      marginLeft: '20mm',
      fontFamily: 'Georgia, serif',
      baseFontSize: '12pt',
      lineHeight: 1.8,
      showUserMessages: true,
      showAssistantMessages: false,
      showConversationTitle: true,
      showDate: false,
      showFooterPageNumbers: true,
      codeTheme: 'light',
      headingSpacing: false,
    };

    const validated = validateSettings(custom);
    expect(validated).toEqual(custom);
  });

  it('3. falls back to default when pageSize is invalid', () => {
    expect(validatePageSize('TABLOID', 'A4')).toBe('A4');
    expect(validatePageSize(123, 'LETTER')).toBe('LETTER');

    const result = validateSettings({ pageSize: 'INVALID_SIZE' });
    expect(result.pageSize).toBe(DEFAULT_SETTINGS.pageSize);
  });

  it('4. falls back to default when orientation is invalid', () => {
    expect(validateOrientation('upside-down', 'portrait')).toBe('portrait');

    const result = validateSettings({ orientation: 'sideways' });
    expect(result.orientation).toBe(DEFAULT_SETTINGS.orientation);
  });

  it('5. falls back to default when margins are invalid CSS lengths', () => {
    expect(validateCssLength('invalid-margin', '18mm')).toBe('18mm');
    expect(validateCssLength('-10px', '18mm')).toBe('18mm');
    expect(validateCssLength('20', '18mm')).toBe('20'); // numeric strings without unit are valid CSS lengths

    const result = validateSettings({ marginTop: 'bad; injection' });
    expect(result.marginTop).toBe(DEFAULT_SETTINGS.marginTop);
  });

  it('6. prevents CSS injection attacks in fontFamily', () => {
    const malicious = 'Arial; } body { display: none !important; }';
    expect(validateFontFamily(malicious, DEFAULT_SETTINGS.fontFamily)).toBe(DEFAULT_SETTINGS.fontFamily);

    const result = validateSettings({ fontFamily: 'Helvetica<script>alert(1)</script>' });
    expect(result.fontFamily).toBe(DEFAULT_SETTINGS.fontFamily);
  });

  it('7. validates baseFontSize correctly', () => {
    expect(validateCssLength('14pt', '10pt')).toBe('14pt');
    expect(validateCssLength('1.2rem', '10pt')).toBe('1.2rem');
    expect(validateCssLength('drop table;', '10pt')).toBe('10pt');
  });

  it('8. falls back to default when lineHeight is non-numeric or out of range', () => {
    expect(validateLineHeight(0.1, 1.5)).toBe(1.5); // too low
    expect(validateLineHeight(10.0, 1.5)).toBe(1.5); // too high
    expect(validateLineHeight('abc', 1.5)).toBe(1.5);

    expect(validateLineHeight(2.0, 1.5)).toBe(2.0);
    expect(validateLineHeight('1.8', 1.5)).toBe(1.8);
  });

  it('9. falls back to default when codeTheme is invalid', () => {
    expect(validateCodeTheme('blue', 'dark')).toBe('dark');

    const result = validateSettings({ codeTheme: 'neon' });
    expect(result.codeTheme).toBe(DEFAULT_SETTINGS.codeTheme);
  });

  it('10. falls back to default when booleans are not strict booleans', () => {
    expect(validateBoolean('true', true)).toBe(true);
    expect(validateBoolean(1, false)).toBe(false);

    const result = validateSettings({
      showUserMessages: 'yes' as unknown as boolean,
      showAssistantMessages: 0 as unknown as boolean,
    });

    expect(result.showUserMessages).toBe(DEFAULT_SETTINGS.showUserMessages);
    expect(result.showAssistantMessages).toBe(DEFAULT_SETTINGS.showAssistantMessages);
  });

  it('11. validates partial settings updates cleanly', () => {
    const partial = validatePartialSettings({
      pageSize: 'LETTER',
      codeTheme: 'light',
      lineHeight: 1.6,
      fontFamily: 'Roboto; injection', // invalid, omitted
    });

    expect(partial.pageSize).toBe('LETTER');
    expect(partial.codeTheme).toBe('light');
    expect(partial.lineHeight).toBe(1.6);
    expect(partial.fontFamily).toBeUndefined();
  });

  it('12. converts UserSettings to RenderOptions via toRenderOptions() boundary', () => {
    const settings: UserSettings = {
      ...DEFAULT_SETTINGS,
      pageSize: 'LETTER',
      codeTheme: 'light',
      showUserMessages: false,
    };

    const renderOpts = toRenderOptions(settings);
    expect(renderOpts.pageSize).toBe('LETTER');
    expect(renderOpts.codeTheme).toBe('light');
    expect(renderOpts.showUserMessages).toBe(false);
    expect(renderOpts.fontFamily).toBe(settings.fontFamily);
  });
});
