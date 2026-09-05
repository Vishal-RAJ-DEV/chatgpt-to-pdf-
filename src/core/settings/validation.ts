/**
 * Settings Validation Engine — Phase 5.
 *
 * Implements strict validation and sanitization for user settings to prevent
 * broken state, invalid options, or malicious CSS injection.
 */

import { CodeTheme, PageOrientation, PageSize, UserSettings } from './Settings';
import { DEFAULT_SETTINGS } from './defaults';

/**
 * Valid CSS length regex supporting common units (mm, cm, in, px, pt, rem, em, %).
 */
const SAFE_CSS_LENGTH_REGEX = /^\d+(?:\.\d+)?(?:mm|cm|in|px|pt|rem|em|%)?$/i;

/**
 * Characters explicitly forbidden in font family strings to prevent CSS injection.
 */
const UNSAFE_FONT_CHARS_REGEX = /[;{}:<>\n\r\0\\]/;

/**
 * Validates a CSS length string (e.g., '18mm', '12pt').
 */
export function validateCssLength(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed || UNSAFE_FONT_CHARS_REGEX.test(trimmed)) {
    return fallback;
  }
  if (!SAFE_CSS_LENGTH_REGEX.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

/**
 * Validates and sanitizes a font family string.
 */
export function validateFontFamily(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 250 || UNSAFE_FONT_CHARS_REGEX.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

/**
 * Validates line height (must be finite number between 0.5 and 3.0).
 */
export function validateLineHeight(value: unknown, fallback: number): number {
  let numVal: number;
  if (typeof value === 'number') {
    numVal = value;
  } else if (typeof value === 'string' && value.trim() !== '') {
    numVal = Number(value);
  } else {
    return fallback;
  }

  if (!Number.isFinite(numVal) || numVal < 0.5 || numVal > 3.0) {
    return fallback;
  }
  return numVal;
}

/**
 * Validates a boolean setting value.
 */
export function validateBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

/**
 * Validates PageSize enum value.
 */
export function validatePageSize(value: unknown, fallback: PageSize): PageSize {
  if (value === 'A4' || value === 'LETTER') {
    return value;
  }
  return fallback;
}

/**
 * Validates PageOrientation enum value.
 */
export function validateOrientation(value: unknown, fallback: PageOrientation): PageOrientation {
  if (value === 'portrait' || value === 'landscape') {
    return value;
  }
  return fallback;
}

/**
 * Validates CodeTheme enum value.
 */
export function validateCodeTheme(value: unknown, fallback: CodeTheme): CodeTheme {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return fallback;
}

/**
 * Takes an arbitrary unvalidated input object and guarantees a fully valid UserSettings object.
 */
export function validateSettings(input: unknown): UserSettings {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};

  const userMsgs = validateBoolean(record.showUserMessages, DEFAULT_SETTINGS.showUserMessages);
  const assistantMsgs = validateBoolean(record.showAssistantMessages, DEFAULT_SETTINGS.showAssistantMessages);

  // Prevent completely empty message export (which would render a 100% blank page)
  const safeUserMsgs = !userMsgs && !assistantMsgs ? true : userMsgs;
  const safeAssistantMsgs = !userMsgs && !assistantMsgs ? true : assistantMsgs;

  return {
    pageSize: validatePageSize(record.pageSize, DEFAULT_SETTINGS.pageSize),
    orientation: validateOrientation(record.orientation, DEFAULT_SETTINGS.orientation),
    marginTop: validateCssLength(record.marginTop, DEFAULT_SETTINGS.marginTop),
    marginRight: validateCssLength(record.marginRight, DEFAULT_SETTINGS.marginRight),
    marginBottom: validateCssLength(record.marginBottom, DEFAULT_SETTINGS.marginBottom),
    marginLeft: validateCssLength(record.marginLeft, DEFAULT_SETTINGS.marginLeft),

    fontFamily: validateFontFamily(record.fontFamily, DEFAULT_SETTINGS.fontFamily),
    baseFontSize: validateCssLength(record.baseFontSize, DEFAULT_SETTINGS.baseFontSize),
    lineHeight: validateLineHeight(record.lineHeight, DEFAULT_SETTINGS.lineHeight),

    showUserMessages: safeUserMsgs,
    showAssistantMessages: safeAssistantMsgs,
    showConversationTitle: validateBoolean(record.showConversationTitle, DEFAULT_SETTINGS.showConversationTitle),
    showDate: validateBoolean(record.showDate, DEFAULT_SETTINGS.showDate),
    showRoleLabels: validateBoolean(record.showRoleLabels, DEFAULT_SETTINGS.showRoleLabels),
    showConversationSource: validateBoolean(record.showConversationSource, DEFAULT_SETTINGS.showConversationSource),
    showFooterPageNumbers: validateBoolean(record.showFooterPageNumbers, DEFAULT_SETTINGS.showFooterPageNumbers),

    codeTheme: validateCodeTheme(record.codeTheme, DEFAULT_SETTINGS.codeTheme),
    headingSpacing: validateBoolean(record.headingSpacing, DEFAULT_SETTINGS.headingSpacing),
  };
}

/**
 * Validates partial settings update. Invalid fields are omitted from result object.
 */
export function validatePartialSettings(input: unknown): Partial<UserSettings> {
  if (typeof input !== 'object' || input === null) {
    return {};
  }
  const record = input as Record<string, unknown>;
  const result: Partial<UserSettings> = {};

  if ('pageSize' in record && (record.pageSize === 'A4' || record.pageSize === 'LETTER')) {
    result.pageSize = record.pageSize;
  }
  if ('orientation' in record && (record.orientation === 'portrait' || record.orientation === 'landscape')) {
    result.orientation = record.orientation;
  }
  if ('marginTop' in record) {
    const val = validateCssLength(record.marginTop, '');
    if (val) result.marginTop = val;
  }
  if ('marginRight' in record) {
    const val = validateCssLength(record.marginRight, '');
    if (val) result.marginRight = val;
  }
  if ('marginBottom' in record) {
    const val = validateCssLength(record.marginBottom, '');
    if (val) result.marginBottom = val;
  }
  if ('marginLeft' in record) {
    const val = validateCssLength(record.marginLeft, '');
    if (val) result.marginLeft = val;
  }

  if ('fontFamily' in record) {
    const val = validateFontFamily(record.fontFamily, '');
    if (val) result.fontFamily = val;
  }
  if ('baseFontSize' in record) {
    const val = validateCssLength(record.baseFontSize, '');
    if (val) result.baseFontSize = val;
  }
  if ('lineHeight' in record) {
    const val = validateLineHeight(record.lineHeight, -1);
    if (val !== -1) result.lineHeight = val;
  }

  if ('showUserMessages' in record && typeof record.showUserMessages === 'boolean') {
    result.showUserMessages = record.showUserMessages;
  }
  if ('showAssistantMessages' in record && typeof record.showAssistantMessages === 'boolean') {
    result.showAssistantMessages = record.showAssistantMessages;
  }
  if ('showConversationTitle' in record && typeof record.showConversationTitle === 'boolean') {
    result.showConversationTitle = record.showConversationTitle;
  }
  if ('showDate' in record && typeof record.showDate === 'boolean') {
    result.showDate = record.showDate;
  }
  if ('showRoleLabels' in record && typeof record.showRoleLabels === 'boolean') {
    result.showRoleLabels = record.showRoleLabels;
  }
  if ('showConversationSource' in record && typeof record.showConversationSource === 'boolean') {
    result.showConversationSource = record.showConversationSource;
  }
  if ('showFooterPageNumbers' in record && typeof record.showFooterPageNumbers === 'boolean') {
    result.showFooterPageNumbers = record.showFooterPageNumbers;
  }

  if ('codeTheme' in record && (record.codeTheme === 'light' || record.codeTheme === 'dark')) {
    result.codeTheme = record.codeTheme;
  }
  if ('headingSpacing' in record && typeof record.headingSpacing === 'boolean') {
    result.headingSpacing = record.headingSpacing;
  }

  return result;
}
