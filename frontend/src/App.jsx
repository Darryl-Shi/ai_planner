import React, { useState, useEffect } from 'react';
import { Calendar, LogOut, Loader2, Settings as SettingsIcon } from 'lucide-react';
import CalendarPicker from './components/CalendarPicker';
import CalendarGrid from './components/CalendarGrid';
import CalendarToolbar from './components/CalendarToolbar';
import ChatSidebar from './components/ChatSidebar';
import Settings from './components/Settings';
import './App.css';

const API_BASE = '/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary');
  const [events, setEvents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week');
  const [showSettings, setShowSettings] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Fetch calendars and events when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchCalendars();
      fetchEvents();
    }
  }, [isAuthenticated]);

  // Fetch events when selected calendar changes
  useEffect(() => {
    if (isAuthenticated && selectedCalendarId) {
      fetchEvents();
    }
  }, [selectedCalendarId]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/status`, {
        credentials: 'include'
      });
      const data = await response.json();
      setIsAuthenticated(data.isAuthenticated);
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/google`, {
        credentials: 'include'
      });
      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Error initiating login:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setIsAuthenticated(false);
      setEvents([]);
      setMessages([]);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const fetchCalendars = async () => {
    try {
      const response = await fetch(`${API_BASE}/calendar/list`, {
        credentials: 'include'
      });
      const data = await response.json();
      setCalendars(data.calendars || []);
    } catch (error) {
      console.error('Error fetching calendars:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch(
        `${API_BASE}/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}&calendarId=${selectedCalendarId}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    const userMessage = {
      role: 'user',
      content: inputMessage
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsSending(true);

    try {
      // Get user's timezone from browser
      const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: [...messages, userMessage],
          events: events,
          timeZone: userTimeZone
        })
      });

      if (response.status === 403) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ ${data.message || 'Please configure your OpenRouter API key in Settings before using the chat feature.'}\n\nClick the "Settings" button in the top right to add your API key.`
        }]);
      } else if (!response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error: ${data.error || 'Something went wrong. Please try again.'}`
        }]);
      } else {
        const data = await response.json();
        setMessages(prev => [...prev, data.message]);

        // If tool calls were executed, refresh events
        if (data.toolCallsExecuted) {
          console.log('Tool calls executed, refreshing events...');
          await fetchEvents();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setIsSending(false);
    }
  };


  if (isLoading) {
    return (
      <div className="loading-screen">
        <Loader2 className="spinner" size={48} />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <Calendar size={64} className="login-icon" />
          <h1>AI Calendar Assistant</h1>
          <p>Connect your Google Calendar and chat with your AI assistant to manage your schedule effortlessly.</p>
          <button onClick={handleLogin} className="login-button">
            <Calendar size={20} />
            Connect Google Calendar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-title">
            <Calendar size={24} />
            <h1>AI Calendar Assistant</h1>
          </div>
          <div className="header-actions">
            <button onClick={() => setShowSettings(true)} className="settings-button">
              <SettingsIcon size={18} />
              Settings
            </button>
            <button onClick={handleLogout} className="logout-button">
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar">
          <CalendarPicker
            calendars={calendars}
            selectedCalendarId={selectedCalendarId}
            onSelectCalendar={setSelectedCalendarId}
          />
        </aside>

        <div className="calendar-section">
          <CalendarToolbar
            currentDate={currentDate}
            view={view}
            onDateChange={setCurrentDate}
            onViewChange={setView}
          />
          <CalendarGrid
            events={events}
            currentDate={currentDate}
            view={view}
          />
        </div>

        <ChatSidebar
          messages={messages}
          inputMessage={inputMessage}
          isSending={isSending}
          onSendMessage={handleSendMessage}
          onInputChange={(e) => setInputMessage(e.target.value)}
          onNewChat={handleNewChat}
        />
      </div>

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

export default App;
