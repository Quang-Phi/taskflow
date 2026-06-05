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

  // Extract inline follow-up suggestions from AI reply text.
  // Handles:
  //   ["Suggestion A", "Suggestion B"]
  //   - ["Suggestion A"]
  //   [Display Text](command:some_tool(args))
  const extractInlineActions = (reply: string): { cleanedReply: string; actions: string[] } => {
    const found: string[] = [];
    let cleaned = reply;

    // ── Pattern 1: ["abc", "def"] blocks ───────────────────────────────────────
    const blockRegex = /\[([^\[\]]+)\]/g;
    let blockMatch;
    while ((blockMatch = blockRegex.exec(reply)) !== null) {
      const inner = blockMatch[1];
      const quotedRegex = /["\u201c\u201d\u2018\u2019]([^"\u201c\u201d\u2018\u2019]+)["\u201c\u201d\u2018\u2019]/g;
      let qm;
      while ((qm = quotedRegex.exec(inner)) !== null) {
        const s = qm[1].trim();
        if (s.length > 3 && s.length < 120) found.push(s);
      }
    }

    // ── Pattern 2: [Display Text](command:...) markdown links ─────────────────
    const cmdLinkRegex = /\[([^\]]+)\]\(command:[^)]+\)/g;
    let cmdMatch;
    while ((cmdMatch = cmdLinkRegex.exec(reply)) !== null) {
      const label = cmdMatch[1].trim();
      if (label.length > 2 && label.length < 120 && !found.includes(label)) {
        found.push(label);
      }
    }
    // Strip [text](command:...) from cleaned reply entirely
    cleaned = cleaned.replace(/\[([^\]]+)\]\(command:[^)]*\)/g, '');

    if (found.length === 0) return { cleanedReply: reply, actions: [] };

    // Remove lines that are purely follow-up label or ["..."] bullets
    cleaned = cleaned
      .split('\n')
      .filter(line => {
        const t = line.trim();
        if (/^[-*]?\s*\[["\u201c][^\]]+["\u201d]\]\s*$/.test(t)) return false;
        if (/^(C\u00e1c g\u1ee3i \u00fd|G\u1ee3i \u00fd ti\u1ebfp theo|Follow.up|Next steps?):?\s*$/i.test(t)) return false;
        return true;
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { cleanedReply: cleaned, actions: found };
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
        // Extract any inline follow-up suggestions embedded in the reply text
        const { cleanedReply, actions: inlineActions } = extractInlineActions(response.reply || '');

        setMessages(prev => [
          ...prev,
          { role: 'ai', content: cleanedReply }
        ]);

        // Prefer explicit actions from API, fallback to inline-extracted ones
        const finalActions = (response.actions && response.actions.length > 0)
          ? response.actions
          : inlineActions;
        if (finalActions.length > 0) {
          setActions(finalActions);
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
    let inTable = false;
    let tableRows: string[][] = [];
    let tableHeader: string[] | null = null;
    const elements: React.ReactNode[] = [];

    const parseInline = (inlineText: string) => {
      // Match: **bold**, `code`, [text](url)
      const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
      const splitParts = inlineText.split(regex);
      return splitParts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} style={{ background: 'rgba(120,120,120,0.15)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '90%' }}>
              {part.slice(1, -1)}
            </code>
          );
        }
        // Markdown link [text](url)
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const label = linkMatch[1];
          const href = linkMatch[2];
          // command: links → clickable action chip (calls handleSendMessage with the label)
          if (href.startsWith('command:')) {
            return (
              <button
                key={i}
                className="md-cmd-chip"
                onClick={() => handleSendMessage(label)}
                title={href}
              >
                ↗ {label}
              </button>
            );
          }
          // Regular http(s) links → external anchor
          if (href.startsWith('http')) {
            return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="md-link">{label}</a>;
          }
          // Unknown protocol → just show the label
          return <span key={i}>{label}</span>;
        }
        return part;
      });
    };

    const isTableRow = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|');
    const isSeparatorRow = (line: string) => /^\|[\s|:-]+\|$/.test(line.trim());

    const flushList = (key: string) => {
      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={key} className="md-ul">
            {listItems.map((item, lIdx) => <li key={lIdx} className="md-li">{parseInline(item)}</li>)}
          </ul>
        );
        inList = false;
        listItems = [];
      }
    };

    const flushTable = (key: string) => {
      if (inTable && (tableHeader || tableRows.length > 0)) {
        elements.push(
          <div key={key} className="md-table-wrapper">
            <table className="md-table">
              {tableHeader && (
                <thead>
                  <tr>{tableHeader.map((cell, ci) => <th key={ci}>{parseInline(cell.trim())}</th>)}</tr>
                </thead>
              )}
              <tbody>
                {tableRows.map((row, ri) => (
                  <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{parseInline(cell.trim())}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        inTable = false;
        tableRows = [];
        tableHeader = null;
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) return;

      // ── Table handling ─────────────────────────────────────────
      if (isTableRow(trimmed)) {
        flushList(`list-before-table-${idx}`);
        const cells = trimmed.split('|').slice(1, -1); // remove leading/trailing empty from split
        if (isSeparatorRow(trimmed)) {
          // This is the separator row (|---|---|), skip but mark header done
          return;
        }
        if (!inTable) {
          // First row = header
          inTable = true;
          tableHeader = cells;
        } else {
          tableRows.push(cells);
        }
        return;
      } else if (inTable) {
        flushTable(`table-${idx}`);
      }
      // ────────────────────────────────────────────────────────────

      if (trimmed.startsWith('### ')) {
        flushList(`list-${idx}`);
        elements.push(<h4 key={idx} className="md-h4">{parseInline(trimmed.slice(4))}</h4>);
        return;
      }
      if (trimmed.startsWith('## ')) {
        flushList(`list-${idx}`);
        elements.push(<h3 key={idx} className="md-h3">{parseInline(trimmed.slice(3))}</h3>);
        return;
      }
      if (trimmed.startsWith('# ')) {
        flushList(`list-${idx}`);
        elements.push(<h2 key={idx} className="md-h2">{parseInline(trimmed.slice(2))}</h2>);
        return;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) { inList = true; listItems = []; }
        listItems.push(trimmed.slice(2));
        return;
      } else {
        flushList(`list-${idx}`);
      }

      if (trimmed === '') {
        elements.push(<div key={idx} style={{ height: '8px' }} />);
      } else {
        elements.push(<p key={idx} className="md-p">{parseInline(trimmed)}</p>);
      }
    });

    flushList('list-trailing');
    flushTable('table-trailing');

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
