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
 * Converts UserSettings into RenderOptions consumed by DocumentRenderer.
 * Ensures the settings passed are fully validated.
 */
export function toRenderOptions(settings: UserSettings): RenderOptions {
  const safeSettings = validateSettings(settings);

  return {
    pageSize: safeSettings.pageSize,
    orientation: safeSettings.orientation,
    marginTop: safeSettings.marginTop,
    marginRight: safeSettings.marginRight,
    marginBottom: safeSettings.marginBottom,
    marginLeft: safeSettings.marginLeft,

    fontFamily: safeSettings.fontFamily,
    baseFontSize: safeSettings.baseFontSize,
    lineHeight: safeSettings.lineHeight,

    showConversationTitle: safeSettings.showConversationTitle,
    showDate: safeSettings.showDate,
    showUserMessages: safeSettings.showUserMessages,
    showAssistantMessages: safeSettings.showAssistantMessages,
    showFooterPageNumbers: safeSettings.showFooterPageNumbers,

    codeTheme: safeSettings.codeTheme,
    headingSpacing: safeSettings.headingSpacing,
  };
}
