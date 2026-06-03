import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, FolderOpenOutlined, FileTextOutlined, UserOutlined, ArrowRightOutlined, LoadingOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useTranslation } from '../../utils/i18n';
import './SearchModal.scss';
import TaskTypeBadge from '../tasks/TaskTypeBadge';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string | number;
  type: 'project' | 'task' | 'member';
  title: string;
  subtitle?: string;
  url: string;
  original: any;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    projects: any[];
    tasks: any[];
    members: any[];
  }>({ projects: [], tasks: [], members: [] });
  
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults({ projects: [], tasks: [], members: [] });
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search fetch
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults({ projects: [], tasks: [], members: [] });
      return;
    }

    const handler = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await api.search(query.trim());
        if (res.success) {
          setResults(res.data || { projects: [], tasks: [], members: [] });
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [query]);

  // Flatten results for keyboard navigation
  const getFlatItems = (): SearchItem[] => {
    const flat: SearchItem[] = [];
    
    results.projects.forEach((p) => {
      flat.push({
        id: p.id,
        type: 'project',
        title: p.name,
        subtitle: p.description,
        url: `/projects/${p.id}`,
        original: p,
      });
    });

    results.tasks.forEach((task) => {
      flat.push({
        id: task.id,
        type: 'task',
        title: task.title,
        subtitle: task.project?.name ? `#${task.id} - ${task.project.name}` : `#${task.id}`,
        url: `/projects/${task.project_id}?task_id=${task.id}`,
        original: task,
      });
    });

    results.members.forEach((m) => {
      flat.push({
        id: m.id,
        type: 'member',
        title: m.name,
        subtitle: m.work_position || m.email,
        url: `/members?user_id=${m.id}`,
        original: m,
      });
    });

    return flat;
  };

  const flatItems = getFlatItems();

  // Keyboard navigation handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          navigate(flatItems[selectedIndex].url);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatItems, selectedIndex, onClose, navigate]);

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Input header */}
        <div className="search-modal-header">
          <SearchOutlined className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder={t('search.modal.placeholder' as any) || "Tìm kiếm công việc, dự án, thành viên..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading ? (
            <LoadingOutlined className="loading-icon" />
          ) : (
            <span className="esc-badge">ESC</span>
          )}
        </div>

        {/* Results body */}
        <div className="search-modal-body">
          {query.trim().length < 2 ? (
            <div className="search-modal-empty-state">
              <p>{t('search.modal.start_typing' as any) || "Nhập từ khóa để bắt đầu tìm kiếm..."}</p>
              <div className="search-modal-shortcuts-guide">
                <div><span>↑↓</span> {t('search.modal.shortcut.navigate' as any) || "di chuyển"}</div>
                <div><span>Enter</span> {t('search.modal.shortcut.select' as any) || "lựa chọn"}</div>
                <div><span>Esc</span> {t('search.modal.shortcut.close' as any) || "đóng"}</div>
              </div>
            </div>
          ) : flatItems.length === 0 && !loading ? (
            <div className="search-modal-empty-state">
              <p>{t('search.modal.no_results' as any, { query }) || `Không tìm thấy kết quả phù hợp cho "${query}"`}</p>
            </div>
          ) : (
            <div className="search-results-list">
              {results.projects.length > 0 && (
                <div className="search-results-group">
                  <div className="group-title">{t('search.modal.group.projects' as any, { count: results.projects.length }) || `Dự án (${results.projects.length})`}</div>
                  {results.projects.map((p) => {
                    const flatIdx = flatItems.findIndex((item) => item.type === 'project' && item.id === p.id);
                    const isSelected = flatIdx === selectedIndex;
                    return (
                      <div
                        key={`project-${p.id}`}
                        className={`search-result-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          navigate(`/projects/${p.id}`);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                      >
                        <FolderOpenOutlined className="item-icon project" />
                        <div className="item-details">
                          <span className="item-title">{p.name}</span>
                          {p.description && <span className="item-subtitle">{p.description}</span>}
                        </div>
                        {isSelected && <ArrowRightOutlined className="arrow-icon" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {results.tasks.length > 0 && (
                <div className="search-results-group">
                  <div className="group-title">{t('search.modal.group.tasks' as any, { count: results.tasks.length }) || `Công việc (${results.tasks.length})`}</div>
                  {results.tasks.map((task) => {
                    const flatIdx = flatItems.findIndex((item) => item.type === 'task' && item.id === task.id);
                    const isSelected = flatIdx === selectedIndex;
                    return (
                      <div
                        key={`task-${task.id}`}
                        className={`search-result-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          navigate(`/projects/${task.project_id}?task_id=${task.id}`);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                      >
                        <TaskTypeBadge type={task.type || 'task'} size="badge" />
                        <div className="item-details">
                          <span className="item-title">{task.title}</span>
                          <span className="item-subtitle">
                            #{task.id} {task.project?.name ? `• ${task.project.name}` : ''}
                            {task.assignee?.name ? ` • ${t('search.modal.task.assignee' as any, { name: task.assignee.name }) || `Giao cho: ${task.assignee.name}`}` : ''}
                          </span>
                        </div>
                        {isSelected && <ArrowRightOutlined className="arrow-icon" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {results.members.length > 0 && (
                <div className="search-results-group">
                  <div className="group-title">{t('search.modal.group.members' as any, { count: results.members.length }) || `Thành viên (${results.members.length})`}</div>
                  {results.members.map((m) => {
                    const flatIdx = flatItems.findIndex((item) => item.type === 'member' && item.id === m.id);
                    const isSelected = flatIdx === selectedIndex;
                    return (
                      <div
                        key={`member-${m.id}`}
                        className={`search-result-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          navigate(`/members?user_id=${m.id}`);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                      >
                        {m.photo ? (
                          <img src={m.photo} alt={m.name} className="item-avatar" />
                        ) : (
                          <UserOutlined className="item-icon member" />
                        )}
                        <div className="item-details">
                          <span className="item-title">{m.name}</span>
                          <span className="item-subtitle">{m.work_position || m.email}</span>
                        </div>
                        {isSelected && <ArrowRightOutlined className="arrow-icon" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
