import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import './CalendarToolbar.css';

function CalendarToolbar({ currentDate, view, onDateChange, onViewChange }) {
  const handlePrevious = () => {
    if (view === 'day') {
      onDateChange(subDays(currentDate, 1));
    } else if (view === 'week') {
      onDateChange(subWeeks(currentDate, 1));
    } else if (view === 'month') {
      onDateChange(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === 'day') {
      onDateChange(addDays(currentDate, 1));
    } else if (view === 'week') {
      onDateChange(addWeeks(currentDate, 1));
    } else if (view === 'month') {
      onDateChange(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const getDateLabel = () => {
    if (view === 'day') {
      return format(currentDate, 'MMMM d, yyyy');
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  return (
    <div className="calendar-toolbar">
      <div className="toolbar-left">
        <button className="today-button" onClick={handleToday}>
          Today
        </button>
        <div className="nav-buttons">
          <button className="nav-button" onClick={handlePrevious}>
            <ChevronLeft size={20} />
          </button>
          <button className="nav-button" onClick={handleNext}>
            <ChevronRight size={20} />
          </button>
        </div>
        <h2 className="date-label">{getDateLabel()}</h2>
      </div>

      <div className="view-buttons">
        <button
          className={`view-button ${view === 'day' ? 'active' : ''}`}
          onClick={() => onViewChange('day')}
        >
          Day
        </button>
        <button
          className={`view-button ${view === 'week' ? 'active' : ''}`}
          onClick={() => onViewChange('week')}
        >
          Week
        </button>
        <button
          className={`view-button ${view === 'month' ? 'active' : ''}`}
          onClick={() => onViewChange('month')}
        >
          Month
        </button>
      </div>
    </div>
  );
}

export default CalendarToolbar;
