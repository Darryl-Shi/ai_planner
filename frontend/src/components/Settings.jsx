import { useState, useEffect } from 'react';
import './Settings.css';

function Settings({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('anthropic/claude-3.5-sonnet');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/user/settings', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setHasApiKey(data.hasApiKey);
        setModel(data.model || 'anthropic/claude-3.5-sonnet');
        setApiKeyPreview(data.apiKeyPreview);
      } else {
        console.error('Failed to fetch settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    if (!model.trim()) {
      setMessage({ type: 'error', text: 'Please enter a model name' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          model: model.trim()
        })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setApiKey(''); // Clear the input after saving
        await fetchSettings(); // Refresh settings
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/user/settings/api-key', {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'API key deleted successfully' });
        setApiKey('');
        setShowDeleteConfirm(false);
        await fetchSettings();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to delete API key' });
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      setMessage({ type: 'error', text: 'Failed to delete API key' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-content">
          {message.text && (
            <div className={`settings-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="settings-section">
            <h3>OpenRouter Configuration</h3>
            <p className="settings-description">
              Configure your personal OpenRouter API key and preferred model.
              Your API key is encrypted and stored securely.
            </p>

            {hasApiKey && apiKeyPreview && (
              <div className="settings-status">
                <span className="status-indicator">✓</span>
                <span>API key configured: {apiKeyPreview}</span>
              </div>
            )}

            <div className="settings-field">
              <label htmlFor="apiKey">OpenRouter API Key</label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="settings-input"
              />
              <small className="settings-help">
                Get your API key from{' '}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                  openrouter.ai/keys
                </a>
              </small>
            </div>

            <div className="settings-field">
              <label htmlFor="model">Model Name</label>
              <input
                type="text"
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="anthropic/claude-3.5-sonnet"
                className="settings-input"
              />
              <small className="settings-help">
                Examples: anthropic/claude-3.5-sonnet, openai/gpt-4, meta-llama/llama-3-70b-instruct
                <br />
                View all models at{' '}
                <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">
                  openrouter.ai/models
                </a>
              </small>
            </div>

            <div className="settings-actions">
              <button
                onClick={handleSave}
                disabled={loading}
                className="settings-button primary"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>

              {hasApiKey && !showDeleteConfirm && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                  className="settings-button danger"
                >
                  Delete API Key
                </button>
              )}

              {showDeleteConfirm && (
                <div className="delete-confirm">
                  <p>Are you sure you want to delete your API key?</p>
                  <div className="delete-confirm-actions">
                    <button
                      onClick={handleDelete}
                      disabled={loading}
                      className="settings-button danger"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={loading}
                      className="settings-button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
