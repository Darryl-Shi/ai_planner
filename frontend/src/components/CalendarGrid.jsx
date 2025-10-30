import React, { useMemo } from 'react';
import { format, parseISO, startOfWeek, startOfMonth, endOfMonth, addDays, isSameDay, isToday, isSameMonth, getDay } from 'date-fns';
import './CalendarGrid.css';

function CalendarGrid({ events, currentDate, view }) {
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate]);
  const weekDays = useMemo(() => {
    if (view === 'day') {
      return [currentDate];
    } else if (view === 'week') {
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    } else {
      // Month view
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
      const endDate = addDays(startDate, 41); // 6 weeks

      return Array.from({ length: 42 }, (_, i) => addDays(startDate, i));
    }
  }, [currentDate, view, weekStart]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDay = (day) => {
    return events.filter((event) => {
      if (event.start?.dateTime) {
        return isSameDay(parseISO(event.start.dateTime), day);
      } else if (event.start?.date) {
        return isSameDay(parseISO(event.start.date), day);
      }
      return false;
    });
  };

  const getEventPosition = (event) => {
    if (!event.start?.dateTime || !event.end?.dateTime) {
      return { top: 0, height: 48 };
    }

    const startTime = parseISO(event.start.dateTime);
    const endTime = parseISO(event.end.dateTime);

    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;
    const duration = endHour - startHour;

    const top = startHour * 60; // 60px per hour
    const height = Math.max(duration * 60, 30); // Minimum 30px height

    return { top, height };
  };

  const getEventColor = (event) => {
    // Use event color if available, otherwise use default
    return event.colorId ? `#${event.colorId}` : '#3b82f6';
  };

  // Month view rendering
  if (view === 'month') {
    const weeks = [];
    for (let i = 0; i < weekDays.length; i += 7) {
      weeks.push(weekDays.slice(i, i + 7));
    }

    return (
      <div className="calendar-grid month-view">
        <div className="month-header">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <div key={index} className="month-day-name">
              {day}
            </div>
          ))}
        </div>
        <div className="month-grid">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="month-week">
              {week.map((day, dayIndex) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                return (
                  <div
                    key={dayIndex}
                    className={`month-day ${isToday(day) ? 'today' : ''} ${
                      !isCurrentMonth ? 'other-month' : ''
                    }`}
                  >
                    <div className="month-day-number">{format(day, 'd')}</div>
                    <div className="month-day-events">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className="month-event"
                          style={{ backgroundColor: getEventColor(event) }}
                        >
                          {event.start?.dateTime && format(parseISO(event.start.dateTime), 'h:mm a')} {event.summary || 'Untitled'}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="month-event-more">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Day and Week view rendering (with time slots)
  return (
    <div className="calendar-grid">
      <div className="calendar-header">
        <div className="time-column-header"></div>
        {weekDays.map((day, index) => (
          <div key={index} className={`day-header ${isToday(day) ? 'today' : ''}`}>
            <div className="day-name">{format(day, 'EEE')}</div>
            <div className={`day-number ${isToday(day) ? 'today-number' : ''}`}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      <div className="calendar-body">
        <div className="time-column">
          {hours.map((hour) => (
            <div key={hour} className="time-slot">
              <span className="time-label">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </span>
            </div>
          ))}
        </div>

        <div className="days-grid" style={{ gridTemplateColumns: `repeat(${weekDays.length}, 1fr)` }}>
          {weekDays.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(day);
            return (
              <div key={dayIndex} className="day-column">
                {hours.map((hour) => (
                  <div key={hour} className="hour-slot"></div>
                ))}
                <div className="events-container">
                  {dayEvents.map((event) => {
                    const { top, height } = getEventPosition(event);
                    return (
                      <div
                        key={event.id}
                        className="calendar-event"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: getEventColor(event),
                        }}
                      >
                        <div className="event-content">
                          <div className="event-time-label">
                            {event.start?.dateTime
                              ? format(parseISO(event.start.dateTime), 'h:mm a')
                              : 'All day'}
                          </div>
                          <div className="event-title-label">
                            {event.summary || 'Untitled Event'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CalendarGrid;
