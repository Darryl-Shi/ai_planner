import { Client } from '@microsoft/microsoft-graph-client';
import { CalendarProvider } from './CalendarProvider.js';

/**
 * Outlook Calendar Provider
 * Implements calendar operations using Microsoft Graph API
 */
export class OutlookCalendarProvider extends CalendarProvider {
  constructor(tokens, msalClient) {
    super(tokens);
    this.msalClient = msalClient;

    // Initialize Microsoft Graph client with access token
    this.client = Client.init({
      authProvider: (done) => {
        done(null, tokens.access_token);
      }
    });
  }

  /**
   * List all calendars for the user
   */
  async listCalendars() {
    try {
      const response = await this.client
        .api('/me/calendars')
        .select('id,name,color,canEdit,owner')
        .get();

      // Transform to match Google Calendar format for consistency
      return (response.value || []).map(calendar => ({
        id: calendar.id,
        summary: calendar.name,
        backgroundColor: this._convertOutlookColor(calendar.color),
        accessRole: calendar.canEdit ? 'owner' : 'reader',
        primary: calendar.isDefaultCalendar || false
      }));
    } catch (error) {
      console.error('Outlook Calendar: Error listing calendars:', error);
      throw new Error('Failed to fetch calendars from Outlook');
    }
  }

  /**
   * Get events from a specific calendar within a time range
   */
  async getEvents({ calendarId, timeMin, timeMax, maxResults = 100 }) {
    try {
      // Use default calendar if not specified
      const calendarPath = calendarId && calendarId !== 'primary'
        ? `/me/calendars/${calendarId}/events`
        : '/me/calendar/events';

      let query = this.client
        .api(calendarPath)
        .select('id,subject,body,start,end,location,attendees,isAllDay,webLink')
        .orderby('start/dateTime')
        .top(maxResults);

      // Add time filters if provided
      if (timeMin || timeMax) {
        const filter = [];
        if (timeMin) {
          filter.push(`start/dateTime ge '${timeMin}'`);
        }
        if (timeMax) {
          filter.push(`start/dateTime lt '${timeMax}'`);
        }
        query = query.filter(filter.join(' and '));
      }

      const response = await query.get();

      // Transform to match Google Calendar format
      return (response.value || []).map(event => this._transformOutlookEventToGoogle(event));
    } catch (error) {
      console.error('Outlook Calendar: Error fetching events:', error);
      throw new Error('Failed to fetch events from Outlook Calendar');
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent({ calendarId, event }) {
    try {
      // Transform from Google Calendar format to Outlook format
      const outlookEvent = this._transformGoogleEventToOutlook(event);

      const calendarPath = calendarId && calendarId !== 'primary'
        ? `/me/calendars/${calendarId}/events`
        : '/me/calendar/events';

      const response = await this.client
        .api(calendarPath)
        .post(outlookEvent);

      // Transform response back to Google format
      return this._transformOutlookEventToGoogle(response);
    } catch (error) {
      console.error('Outlook Calendar: Error creating event:', error);
      throw new Error('Failed to create event in Outlook Calendar');
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent({ calendarId, eventId, event }) {
    try {
      // Transform from Google Calendar format to Outlook format
      const outlookEvent = this._transformGoogleEventToOutlook(event);

      const response = await this.client
        .api(`/me/events/${eventId}`)
        .patch(outlookEvent);

      // Transform response back to Google format
      return this._transformOutlookEventToGoogle(response);
    } catch (error) {
      console.error('Outlook Calendar: Error updating event:', error);
      throw new Error('Failed to update event in Outlook Calendar');
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent({ calendarId, eventId }) {
    try {
      await this.client
        .api(`/me/events/${eventId}`)
        .delete();
    } catch (error) {
      console.error('Outlook Calendar: Error deleting event:', error);
      throw new Error('Failed to delete event from Outlook Calendar');
    }
  }

  /**
   * Get provider name
   */
  getProviderName() {
    return 'outlook';
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded() {
    try {
      // Check if token is expired or about to expire (within 5 minutes)
      if (this.tokens.expires_at && this.tokens.expires_at < Date.now() + 300000) {
        const tokenRequest = {
          scopes: ['Calendars.ReadWrite', 'User.Read'],
          refreshToken: this.tokens.refresh_token
        };

        const response = await this.msalClient.acquireTokenByRefreshToken(tokenRequest);

        // Update tokens
        this.tokens = {
          access_token: response.accessToken,
          refresh_token: response.refreshToken || this.tokens.refresh_token,
          expires_at: Date.now() + (response.expiresOn.getTime() - Date.now())
        };

        // Update Graph client with new token
        this.client = Client.init({
          authProvider: (done) => {
            done(null, this.tokens.access_token);
          }
        });

        return this.tokens;
      }

      return this.tokens;
    } catch (error) {
      console.error('Outlook Calendar: Error refreshing token:', error);
      throw new Error('Failed to refresh Outlook OAuth token');
    }
  }

  /**
   * Transform Outlook event to Google Calendar format
   */
  _transformOutlookEventToGoogle(outlookEvent) {
    return {
      id: outlookEvent.id,
      summary: outlookEvent.subject,
      description: outlookEvent.body?.content || '',
      start: {
        dateTime: outlookEvent.start?.dateTime,
        timeZone: outlookEvent.start?.timeZone || 'UTC'
      },
      end: {
        dateTime: outlookEvent.end?.dateTime,
        timeZone: outlookEvent.end?.timeZone || 'UTC'
      },
      location: outlookEvent.location?.displayName || '',
      attendees: (outlookEvent.attendees || []).map(attendee => ({
        email: attendee.emailAddress?.address,
        displayName: attendee.emailAddress?.name,
        responseStatus: this._convertOutlookResponseStatus(attendee.status?.response)
      })),
      htmlLink: outlookEvent.webLink
    };
  }

  /**
   * Transform Google Calendar event to Outlook format
   */
  _transformGoogleEventToOutlook(googleEvent) {
    const outlookEvent = {
      subject: googleEvent.summary,
      body: {
        contentType: 'HTML',
        content: googleEvent.description || ''
      },
      start: {
        dateTime: googleEvent.start?.dateTime || googleEvent.start?.date,
        timeZone: googleEvent.start?.timeZone || 'UTC'
      },
      end: {
        dateTime: googleEvent.end?.dateTime || googleEvent.end?.date,
        timeZone: googleEvent.end?.timeZone || 'UTC'
      }
    };

    if (googleEvent.location) {
      outlookEvent.location = {
        displayName: googleEvent.location
      };
    }

    if (googleEvent.attendees && googleEvent.attendees.length > 0) {
      outlookEvent.attendees = googleEvent.attendees.map(attendee => ({
        emailAddress: {
          address: attendee.email,
          name: attendee.displayName || attendee.email
        },
        type: 'required'
      }));
    }

    return outlookEvent;
  }

  /**
   * Convert Outlook color to hex color
   */
  _convertOutlookColor(outlookColor) {
    const colorMap = {
      'lightBlue': '#4A8CF7',
      'lightGreen': '#0B8043',
      'lightOrange': '#F6BF26',
      'lightGray': '#A8A8A8',
      'lightYellow': '#FFD800',
      'lightTeal': '#039BE5',
      'lightPink': '#E67C73',
      'lightBrown': '#8E6C42',
      'lightRed': '#D50000',
      'auto': '#039BE5'
    };

    return colorMap[outlookColor] || '#039BE5';
  }

  /**
   * Convert Outlook response status to Google format
   */
  _convertOutlookResponseStatus(outlookStatus) {
    const statusMap = {
      'accepted': 'accepted',
      'declined': 'declined',
      'tentativelyAccepted': 'tentative',
      'notResponded': 'needsAction',
      'organizer': 'accepted'
    };

    return statusMap[outlookStatus] || 'needsAction';
  }
}
