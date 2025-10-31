import { google } from 'googleapis';
import { CalendarProvider } from './CalendarProvider.js';

/**
 * Google Calendar Provider
 * Implements calendar operations using Google Calendar API
 */
export class GoogleCalendarProvider extends CalendarProvider {
  constructor(tokens, clientId, clientSecret, redirectUri) {
    super(tokens);

    // Initialize Google OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    this.oauth2Client.setCredentials(tokens);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * List all calendars for the user
   */
  async listCalendars() {
    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      console.error('Google Calendar: Error listing calendars:', error);
      throw new Error('Failed to fetch calendars from Google');
    }
  }

  /**
   * Get events from a specific calendar within a time range
   */
  async getEvents({ calendarId = 'primary', timeMin, timeMax, maxResults = 100 }) {
    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin: timeMin || new Date().toISOString(),
        timeMax,
        maxResults: parseInt(maxResults),
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Google Calendar: Error fetching events:', error);
      throw new Error('Failed to fetch events from Google Calendar');
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent({ calendarId = 'primary', event }) {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: event
      });

      return response.data;
    } catch (error) {
      console.error('Google Calendar: Error creating event:', error);
      throw new Error('Failed to create event in Google Calendar');
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent({ calendarId = 'primary', eventId, event }) {
    try {
      const response = await this.calendar.events.patch({
        calendarId,
        eventId,
        requestBody: event
      });

      return response.data;
    } catch (error) {
      console.error('Google Calendar: Error updating event:', error);
      throw new Error('Failed to update event in Google Calendar');
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent({ calendarId = 'primary', eventId }) {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId
      });
    } catch (error) {
      console.error('Google Calendar: Error deleting event:', error);
      throw new Error('Failed to delete event from Google Calendar');
    }
  }

  /**
   * Get provider name
   */
  getProviderName() {
    return 'google';
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded() {
    try {
      // Google client library automatically refreshes tokens if refresh_token is present
      const tokens = this.oauth2Client.credentials;

      // Check if token is expired or about to expire
      if (tokens.expiry_date && tokens.expiry_date < Date.now() + 60000) {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        this.oauth2Client.setCredentials(credentials);
        return credentials;
      }

      return tokens;
    } catch (error) {
      console.error('Google Calendar: Error refreshing token:', error);
      throw new Error('Failed to refresh Google OAuth token');
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile() {
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const response = await oauth2.userinfo.get();

      return {
        id: response.data.id,
        email: response.data.email,
        name: response.data.name
      };
    } catch (error) {
      console.error('Google Calendar: Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile from Google');
    }
  }

  /**
   * Verify ID token and get user information
   */
  async verifyIdToken(idToken, clientId) {
    try {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken,
        audience: clientId
      });

      const payload = ticket.getPayload();
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name || payload.given_name || ''
      };
    } catch (error) {
      console.error('Google Calendar: Error verifying ID token:', error);
      return null;
    }
  }
}
