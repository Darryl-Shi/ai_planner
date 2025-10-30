import React, { useMemo, useRef, useEffect } from 'react';
import { format, parseISO, addDays, isSameDay, isToday, startOfDay, endOfDay } from 'date-fns';
import './AgendaView.css';

function AgendaView({ events, currentDate, onDateChange }) {
  const containerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Generate 30 days centered around current date (15 before, current, 14 after)
  const dateRange = useMemo(() => {
    const days = [];
    for (let i = -15; i <= 14; i++) {
      days.push(addDays(currentDate, i));
    }
    return days;
  }, [currentDate]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = new Map();

    dateRange.forEach(day => {
      const dayEvents = events.filter((event) => {
        if (event.start?.dateTime) {
          return isSameDay(parseISO(event.start.dateTime), day);
        } else if (event.start?.date) {
          return isSameDay(parseISO(event.start.date), day);
        }
        return false;
      });

      // Sort events by start time
      dayEvents.sort((a, b) => {
        const aTime = a.start?.dateTime ? parseISO(a.start.dateTime) : startOfDay(day);
        const bTime = b.start?.dateTime ? parseISO(b.start.dateTime) : startOfDay(day);
        return aTime - bTime;
      });

      grouped.set(day.toISOString(), { date: day, events: dayEvents });
    });

    return grouped;
  }, [events, dateRange]);

  const getEventColor = (event) => {
    return event.colorId ? `#${event.colorId}` : '#3b82f6';
  };

  const getEventTime = (event) => {
    if (event.start?.dateTime && event.end?.dateTime) {
      const start = parseISO(event.start.dateTime);
      const end = parseISO(event.end.dateTime);
      return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
    } else if (event.start?.date) {
      return 'All day';
    }
    return '';
  };

  // Handle swipe gestures for navigation
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swipe right - go to previous day
        onDateChange(addDays(currentDate, -1));
      } else {
        // Swipe left - go to next day
        onDateChange(addDays(currentDate, 1));
      }
    }
  };

  // Scroll to current date on mount
  useEffect(() => {
    const currentDayElement = document.getElementById(`agenda-day-${currentDate.toISOString()}`);
    if (currentDayElement) {
      currentDayElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div
      className="agenda-view"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {Array.from(eventsByDate.values()).map(({ date, events: dayEvents }) => {
        const isCurrentDay = isSameDay(date, currentDate);
        const isTodayDay = isToday(date);

        return (
          <div
            key={date.toISOString()}
            id={`agenda-day-${date.toISOString()}`}
            className={`agenda-day ${isCurrentDay ? 'current-day' : ''}`}
          >
            <div className={`agenda-date-header ${isTodayDay ? 'today' : ''}`}>
              <div className="agenda-day-name">{format(date, 'EEEE')}</div>
              <div className="agenda-date-info">
                <span className={`agenda-day-number ${isTodayDay ? 'today-number' : ''}`}>
                  {format(date, 'd')}
                </span>
                <span className="agenda-month-year">{format(date, 'MMM yyyy')}</span>
              </div>
            </div>

            <div className="agenda-events">
              {dayEvents.length === 0 ? (
                <div className="no-events">No events</div>
              ) : (
                dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="agenda-event-card"
                    style={{ borderLeftColor: getEventColor(event) }}
                  >
                    <div className="agenda-event-time">{getEventTime(event)}</div>
                    <div className="agenda-event-title">{event.summary || 'Untitled Event'}</div>
                    {event.location && (
                      <div className="agenda-event-location">📍 {event.location}</div>
                    )}
                    {event.description && (
                      <div className="agenda-event-description">{event.description}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AgendaView;
