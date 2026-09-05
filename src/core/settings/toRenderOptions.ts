/**
 * UserSettings to RenderOptions Converter Boundary — Phase 5.
 *
 * Transforms core UserSettings into DocumentRenderer RenderOptions.
 * Decouples Chrome extension settings management from document generation.
 */

import { RenderOptions } from '../renderer/RenderTypes';
import { UserSettings } from './Settings';
import { validateSettings } from './validation';

/**
 * Ensures a CSS length value has a valid CSS unit (appends defaultUnit if pure numeric).
 */
function ensureCssUnit(val: string, defaultUnit: string): string {
  if (!val) return val;
  const trimmed = val.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return `${trimmed}${defaultUnit}`;
  }
  return trimmed;
}

/**
 * Converts UserSettings into RenderOptions consumed by DocumentRenderer.
 * Ensures the settings passed are fully validated and formatted with valid CSS units.
 */
export function toRenderOptions(settings: UserSettings): RenderOptions {
  const safeSettings = validateSettings(settings);

  return {
    pageSize: safeSettings.pageSize,
    orientation: safeSettings.orientation,
    marginTop: ensureCssUnit(safeSettings.marginTop, 'mm'),
    marginRight: ensureCssUnit(safeSettings.marginRight, 'mm'),
    marginBottom: ensureCssUnit(safeSettings.marginBottom, 'mm'),
    marginLeft: ensureCssUnit(safeSettings.marginLeft, 'mm'),

    fontFamily: safeSettings.fontFamily,
    baseFontSize: ensureCssUnit(safeSettings.baseFontSize, 'pt'),
    lineHeight: safeSettings.lineHeight,

    showConversationTitle: safeSettings.showConversationTitle,
    showDate: safeSettings.showDate,
    showUserMessages: safeSettings.showUserMessages,
    showAssistantMessages: safeSettings.showAssistantMessages,
    showRoleLabels: safeSettings.showRoleLabels,
    showConversationSource: safeSettings.showConversationSource,
    showFooterPageNumbers: safeSettings.showFooterPageNumbers,

    codeTheme: safeSettings.codeTheme,
    headingSpacing: safeSettings.headingSpacing,
  };
}
