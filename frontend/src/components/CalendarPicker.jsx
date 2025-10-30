import React from 'react';
import { Check } from 'lucide-react';
import './CalendarPicker.css';

function CalendarPicker({ calendars, selectedCalendarId, onSelectCalendar }) {
  return (
    <div className="calendar-picker">
      <div className="calendar-picker-label">My Calendars</div>
      <div className="calendar-list">
        {calendars.map((calendar) => (
          <div
            key={calendar.id}
            className={`calendar-item ${
              selectedCalendarId === calendar.id ? 'selected' : ''
            }`}
            onClick={() => onSelectCalendar(calendar.id)}
          >
            <div
              className="calendar-color-indicator"
              style={{ backgroundColor: calendar.backgroundColor || '#3b82f6' }}
            />
            <span className="calendar-name">{calendar.summary || 'Untitled Calendar'}</span>
            {selectedCalendarId === calendar.id && (
              <Check size={16} className="selected-icon" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CalendarPicker;
