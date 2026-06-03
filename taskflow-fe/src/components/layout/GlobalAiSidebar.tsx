import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Input, Spin, message } from 'antd';
import { CloseOutlined, SendOutlined, BulbOutlined, ThunderboltOutlined, CopyOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useTranslation } from '../../utils/i18n';
import './GlobalAiSidebar.scss';

interface Message {
  role: 'user' | 'ai';
  content: string;
  tool_calls?: any[];
}

interface GlobalAiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalAiSidebar: React.FC<GlobalAiSidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize welcome message with translated text
  useEffect(() => {
    setMessages([
      {
        role: 'ai',
        content: t('ai.global.welcome' as any)
      }
    ]);
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, loading, isOpen]);

  useEffect(() => {
    // Escape key listener to close sidebar
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (!textToSend) {
      setInputText('');
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);
    setActions([]);

    try {
      const response = await api.chatGlobalAi(newMessages);
      if (response.success) {
        setMessages(prev => [
          ...prev,
          { role: 'ai', content: response.reply }
        ]);
        if (response.actions && response.actions.length > 0) {
          setActions(response.actions);
        }
        if (response.events && response.events.length > 0) {
          response.events.forEach((ev: any) => {
            if (ev.type === 'project_created') {
              message.success(t('ai.global.event_project' as any, { name: ev.name || '' }));
              navigate(`/projects/${ev.id}`);
              window.dispatchEvent(new Event('projects-changed'));
            } else if (ev.type === 'task_created') {
              message.success(t('ai.global.event_task' as any, { title: ev.title || '' }));
              if (location.pathname === '/my-tasks') {
                navigate(`/my-tasks?task_id=${ev.id}`);
              } else {
                navigate(`/projects/${ev.project_id}?task_id=${ev.id}`);
              }
              window.dispatchEvent(new CustomEvent('task-created-global', { detail: ev }));
            } else if (ev.type === 'timer_started' || ev.type === 'timer_stopped') {
              window.dispatchEvent(new Event('timer-updated'));
            }
          });
        }
      } else {
        message.error(response.message || t('ai.global.error_process' as any));
      }
    } catch (err: any) {
      console.error(err);
      message.error(t('ai.global.error_connect' as any));
    } finally {
      setLoading(false);
    }
  };

  const runFeature = (promptKey: string) => {
    handleSendMessage(t(promptKey as any));
  };

  function renderMarkdown(text: string) {
    if (!text) return null;
    const lines = text.split('\n');
    let inList = false;
    let listItems: string[] = [];
    const elements: React.ReactNode[] = [];

    const parseInline = (inlineText: string) => {
      const regex = /(\*\*.*?\*\*|`.*?`)/g;
      const splitParts = inlineText.split(regex);

      return splitParts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              style={{
                background: 'rgba(120, 120, 120, 0.15)',
                padding: '2px 4px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '90%',
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        return;
      }

      if (trimmed.startsWith('### ')) {
        elements.push(<h4 key={idx} className="md-h4">{parseInline(trimmed.slice(4))}</h4>);
        return;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(<h3 key={idx} className="md-h3">{parseInline(trimmed.slice(3))}</h3>);
        return;
      }
      if (trimmed.startsWith('# ')) {
        elements.push(<h2 key={idx} className="md-h2">{parseInline(trimmed.slice(2))}</h2>);
        return;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) {
          inList = true;
          listItems = [];
        }
        listItems.push(trimmed.slice(2));
        return;
      } else {
        if (inList) {
          elements.push(
            <ul key={`list-${idx}`} className="md-ul">
              {listItems.map((item, lIdx) => (
                <li key={lIdx} className="md-li">{parseInline(item)}</li>
              ))}
            </ul>
          );
          inList = false;
        }
      }

      if (trimmed === '') {
        elements.push(<div key={idx} style={{ height: '8px' }} />);
      } else {
        elements.push(<p key={idx} className="md-p">{parseInline(trimmed)}</p>);
      }
    });

    if (inList) {
      elements.push(
        <ul key={`list-trailing`} className="md-ul">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="md-li">{parseInline(item)}</li>
          ))}
        </ul>
      );
    }

    return <div className="md-container">{elements}</div>;
  }

  if (!isOpen) return null;

  return (
    <div className="global-ai-sidebar-overlay" onClick={onClose}>
      <div className="global-ai-sidebar" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="global-ai-sidebar__header">
          <div className="header-title">
            <span className="sparkles-icon">✨</span>
            <span className="brain-text">{t('ai.global.title' as any)}</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <CloseOutlined />
          </button>
        </div>

        {/* Conversation Stream */}
        <div className="global-ai-sidebar__body">
          {messages.length === 1 && (
            <div className="welcome-screen">
              <div className="welcome-screen__subtitle">{t('ai.global.ask_workspace' as any)}</div>
              <div className="suggested-prompts">
                <div className="prompt-chip" onClick={() => handleSendMessage(t('ai.global.prompt1_send' as any))}>
                  <BulbOutlined /> {t('ai.global.prompt1_label' as any)}
                </div>
                <div className="prompt-chip" onClick={() => handleSendMessage(t('ai.global.prompt2_send' as any))}>
                  <BulbOutlined /> {t('ai.global.prompt2_label' as any)}
                </div>
                <div className="prompt-chip" onClick={() => handleSendMessage(t('ai.global.prompt3_send' as any))}>
                  <BulbOutlined /> {t('ai.global.prompt3_label' as any)}
                </div>
              </div>

              <div className="welcome-screen__subtitle">{t('ai.global.features' as any)}</div>
              <div className="features-grid">
                <div className="feature-card" onClick={() => runFeature('ai.global.feat_summary_prompt')}>
                  <div className="feature-card__icon summary-icon"><ThunderboltOutlined /></div>
                  <div className="feature-card__content">
                    <div className="feature-card__title">{t('ai.global.feat_summary_title' as any)} <span className="badge">{t('ai.global.badge_new' as any)}</span></div>
                    <div className="feature-card__desc">{t('ai.global.feat_summary_desc' as any)}</div>
                  </div>
                </div>

                <div className="feature-card" onClick={() => runFeature('ai.global.feat_update_prompt')}>
                  <div className="feature-card__icon update-icon"><HistoryOutlined /></div>
                  <div className="feature-card__content">
                    <div className="feature-card__title">{t('ai.global.feat_update_title' as any)} <span className="badge">{t('ai.global.badge_new' as any)}</span></div>
                    <div className="feature-card__desc">{t('ai.global.feat_update_desc' as any)}</div>
                  </div>
                </div>

                <div className="feature-card" onClick={() => runFeature('ai.global.feat_stuck_prompt')}>
                  <div className="feature-card__icon stuck-icon"><CopyOutlined /></div>
                  <div className="feature-card__content">
                    <div className="feature-card__title">{t('ai.global.feat_stuck_title' as any)} <span className="badge">{t('ai.global.badge_new' as any)}</span></div>
                    <div className="feature-card__desc">{t('ai.global.feat_stuck_desc' as any)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role}`}>
              <div className="message-header">
                {msg.role === 'ai' ? (
                  <span className="ai-name">✨ Brain</span>
                ) : (
                  <span className="user-name">{t('ai.global.user_label' as any)}</span>
                )}
              </div>
              <div className="message-content">
                {msg.role === 'ai' ? renderMarkdown(msg.content) : <p>{msg.content}</p>}
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-message ai loading">
              <span className="ai-name">✨ {t('ai.global.loading' as any)}</span>
              <div className="loading-spinner">
                <Spin size="small" />
              </div>
            </div>
          )}

          {/* Follow-up actions */}
          {actions.length > 0 && (
            <div className="follow-up-section">
              <div className="follow-up-title">{t('ai.global.follow_ups' as any)}</div>
              <div className="follow-up-buttons">
                {actions.map((act, i) => (
                  <button key={i} className="follow-up-btn" onClick={() => handleSendMessage(act)}>
                    ↪️ {act}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="global-ai-sidebar__footer">
          <Input.TextArea
            rows={2}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onPressEnter={e => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={t('ai.global.placeholder' as any)}
            disabled={loading}
          />
          <div className="footer-actions">
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalAiSidebar;
