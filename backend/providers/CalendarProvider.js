/**
 * Base Calendar Provider Interface
 * All calendar providers (Google, Outlook, etc.) must implement this interface
 */
export class CalendarProvider {
  constructor(tokens) {
    if (this.constructor === CalendarProvider) {
      throw new Error("CalendarProvider is an abstract class and cannot be instantiated directly");
    }
    this.tokens = tokens;
  }

  /**
   * List all calendars for the user
   * @returns {Promise<Array>} Array of calendar objects
   */
  async listCalendars() {
    throw new Error("Method 'listCalendars()' must be implemented");
  }

  /**
   * Get events from a specific calendar within a time range
   * @param {Object} params - Query parameters
   * @param {string} params.calendarId - Calendar ID
   * @param {string} params.timeMin - ISO 8601 start time
   * @param {string} params.timeMax - ISO 8601 end time
   * @returns {Promise<Array>} Array of event objects
   */
  async getEvents({ calendarId, timeMin, timeMax }) {
    throw new Error("Method 'getEvents()' must be implemented");
  }

  /**
   * Create a new calendar event
   * @param {Object} params - Event parameters
   * @param {string} params.calendarId - Calendar ID
   * @param {Object} params.event - Event data
   * @returns {Promise<Object>} Created event object
   */
  async createEvent({ calendarId, event }) {
    throw new Error("Method 'createEvent()' must be implemented");
  }

  /**
   * Update an existing calendar event
   * @param {Object} params - Update parameters
   * @param {string} params.calendarId - Calendar ID
   * @param {string} params.eventId - Event ID
   * @param {Object} params.event - Updated event data
   * @returns {Promise<Object>} Updated event object
   */
  async updateEvent({ calendarId, eventId, event }) {
    throw new Error("Method 'updateEvent()' must be implemented");
  }

  /**
   * Delete a calendar event
   * @param {Object} params - Delete parameters
   * @param {string} params.calendarId - Calendar ID
   * @param {string} params.eventId - Event ID
   * @returns {Promise<void>}
   */
  async deleteEvent({ calendarId, eventId }) {
    throw new Error("Method 'deleteEvent()' must be implemented");
  }

  /**
   * Get provider name
   * @returns {string} Provider name ('google' or 'outlook')
   */
  getProviderName() {
    throw new Error("Method 'getProviderName()' must be implemented");
  }

  /**
   * Refresh access token if needed
   * @returns {Promise<Object>} Updated tokens
   */
  async refreshTokenIfNeeded() {
    throw new Error("Method 'refreshTokenIfNeeded()' must be implemented");
  }
}
