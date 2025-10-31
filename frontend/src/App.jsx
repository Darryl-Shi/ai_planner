import React, { useState, useEffect } from 'react';
import { Calendar, LogOut, Loader2, Settings as SettingsIcon, Menu, X, MessageSquare, CalendarDays } from 'lucide-react';
import CalendarPicker from './components/CalendarPicker';
import CalendarGrid from './components/CalendarGrid';
import CalendarToolbar from './components/CalendarToolbar';
import ChatSidebar from './components/ChatSidebar';
import Settings from './components/Settings';
import AgendaView from './components/AgendaView';
import './App.css';

const API_BASE = '/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [provider, setProvider] = useState(null);
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

  // Mobile-specific state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('chat'); // 'calendar' or 'chat'
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      setProvider(data.provider);
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (provider) => {
    try {
      const response = await fetch(`${API_BASE}/auth/${provider}?ts=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store'
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
          <p>Connect your calendar and chat with your AI assistant to manage your schedule effortlessly.</p>
          <div className="login-buttons">
            <button onClick={() => handleLogin('google')} className="login-button google-button">
              <Calendar size={20} />
              Connect Google Calendar
            </button>
            <button onClick={() => handleLogin('outlook')} className="login-button outlook-button">
              <Calendar size={20} />
              Connect Outlook Calendar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          {isMobile && (
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="hamburger-button"
              aria-label="Toggle calendar picker"
            >
              {drawerOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
          <div className="header-title">
            <Calendar size={24} />
            <h1>AI Calendar Assistant</h1>
          </div>
          <div className="header-actions">
            <button onClick={() => setShowSettings(true)} className="settings-button">
              <SettingsIcon size={18} />
              {!isMobile && <span>Settings</span>}
            </button>
            <button onClick={handleLogout} className="logout-button">
              <LogOut size={18} />
              {!isMobile && <span>Logout</span>}
            </button>
          </div>
        </div>
      </header>

      <div className="main-layout">
        {/* Calendar Picker - Sidebar on desktop, Drawer on mobile */}
        <aside className={`sidebar ${drawerOpen ? 'drawer-open' : ''}`}>
          <CalendarPicker
            calendars={calendars}
            selectedCalendarId={selectedCalendarId}
            onSelectCalendar={(id) => {
              setSelectedCalendarId(id);
              if (isMobile) setDrawerOpen(false); // Close drawer after selection on mobile
            }}
          />
        </aside>

        {/* Drawer overlay for mobile */}
        {isMobile && drawerOpen && (
          <div
            className="drawer-overlay"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Calendar Section - Hidden on mobile when chat tab is active */}
        <div className={`calendar-section ${isMobile && activeTab !== 'calendar' ? 'mobile-hidden' : ''}`}>
          <CalendarToolbar
            currentDate={currentDate}
            view={view}
            onDateChange={setCurrentDate}
            onViewChange={setView}
            isMobile={isMobile}
          />
          {isMobile ? (
            <AgendaView
              events={events}
              currentDate={currentDate}
              onDateChange={setCurrentDate}
            />
          ) : (
            <CalendarGrid
              events={events}
              currentDate={currentDate}
              view={view}
            />
          )}
        </div>

        {/* Chat Sidebar - Hidden on mobile when calendar tab is active */}
        <ChatSidebar
          messages={messages}
          inputMessage={inputMessage}
          isSending={isSending}
          onSendMessage={handleSendMessage}
          onInputChange={(e) => setInputMessage(e.target.value)}
          onNewChat={handleNewChat}
          isMobile={isMobile}
          isVisible={!isMobile || activeTab === 'chat'}
        />
      </div>

      {/* Mobile Tab Navigation */}
      {isMobile && (
        <nav className="mobile-tabs">
          <button
            className={`tab-button ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <CalendarDays size={24} />
            <span>Calendar</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={24} />
            <span>Chat</span>
          </button>
        </nav>
      )}

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

export default App;
