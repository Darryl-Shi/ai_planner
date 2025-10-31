import { GoogleCalendarProvider } from './GoogleCalendarProvider.js';
import { OutlookCalendarProvider } from './OutlookCalendarProvider.js';

/**
 * Factory for creating calendar provider instances
 */
export class ProviderFactory {
  /**
   * Create a calendar provider based on provider type
   * @param {string} providerType - 'google' or 'outlook'
   * @param {Object} tokens - OAuth tokens
   * @param {Object} config - Provider-specific configuration
   * @returns {CalendarProvider} Calendar provider instance
   */
  static createProvider(providerType, tokens, config = {}) {
    switch (providerType.toLowerCase()) {
      case 'google':
        return new GoogleCalendarProvider(
          tokens,
          config.clientId,
          config.clientSecret,
          config.redirectUri
        );

      case 'outlook':
        return new OutlookCalendarProvider(
          tokens,
          config.msalClient
        );

      default:
        throw new Error(`Unsupported calendar provider: ${providerType}`);
    }
  }

  /**
   * Get list of supported providers
   * @returns {Array<string>} Array of supported provider names
   */
  static getSupportedProviders() {
    return ['google', 'outlook'];
  }

  /**
   * Check if a provider is supported
   * @param {string} providerType - Provider type to check
   * @returns {boolean} True if provider is supported
   */
  static isProviderSupported(providerType) {
    return this.getSupportedProviders().includes(providerType.toLowerCase());
  }
}
