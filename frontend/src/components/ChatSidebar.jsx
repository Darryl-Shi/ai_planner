import React, { useRef, useEffect } from 'react';
import { Send, Loader2, MessageSquarePlus } from 'lucide-react';
import './ChatSidebar.css';

function ChatSidebar({
  messages,
  inputMessage,
  isSending,
  onSendMessage,
  onInputChange,
  onNewChat,
  isMobile = false,
  isVisible = true
}) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    // Scroll only within the messages container, not the entire viewport
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  }, [inputMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage(e);
    }
  };

  return (
    <div className={`chat-sidebar ${isMobile ? 'mobile' : ''} ${!isVisible ? 'hidden' : ''}`}>
      <div className="chat-header">
        <h2>AI Assistant</h2>
        <button
          className="new-chat-button"
          onClick={onNewChat}
          title="Start new chat"
        >
          <MessageSquarePlus size={20} />
          New Chat
        </button>
      </div>

      <div className="messages-container" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h3>Welcome to your AI Calendar Assistant!</h3>
            <p>I can help you:</p>
            <ul>
              <li>Schedule new events and meetings</li>
              <li>Find optimal times that avoid conflicts</li>
              <li>Edit or delete existing events</li>
              <li>Answer questions about your schedule</li>
            </ul>
            <p>Just tell me what you need, and I'll take care of it!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-content">
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={onSendMessage} className="chat-input-form">
        <textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={onInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask your assistant anything... (Shift+Enter for new line)"
          className="chat-input"
          disabled={isSending}
          rows={1}
        />
        <button type="submit" className="send-button" disabled={isSending}>
          {isSending ? (
            <Loader2 className="spinner" size={20} />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>
    </div>
  );
}

export default ChatSidebar;
