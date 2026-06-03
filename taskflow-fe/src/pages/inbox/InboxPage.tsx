import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin, message } from 'antd';
import { CheckSquareOutlined, CommentOutlined, UserAddOutlined, ClockCircleOutlined, StarOutlined, InboxOutlined, LikeOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useTranslation } from '../../utils/i18n';
import './InboxPage.scss';

interface NotificationItem {
  id: number;
  user: string;
  photo?: string | null;
  avatar: string;
  color: string;
  action: string;
  target: string;
  extra: string | null;
  time: string;
  read: boolean;
  type: string;
  task_id: number | null;
  project_id: number | null;
}

const typeIcons: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
  task_assigned: { icon: <UserAddOutlined />, bg: 'rgba(168,85,247,0.1)', color: '#a855f7' },
  status_changed: { icon: <CheckSquareOutlined />, bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  comment: { icon: <CommentOutlined />, bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  mention: { icon: <CommentOutlined />, bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  reply: { icon: <CommentOutlined />, bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  reaction: { icon: <LikeOutlined />, bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  deadline: { icon: <ClockCircleOutlined />, bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
  evaluation: { icon: <StarOutlined />, bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
  project_added: { icon: <UserAddOutlined />, bg: 'rgba(99,102,241,0.1)', color: '#6366f1' },
};

const InboxPage: React.FC = () => {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();

  const [tab, setTab] = useState('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const updateUnreadCount = (count: number | ((prev: number) => number)) => {
    setUnreadCount(prev => {
      const next = typeof count === 'function' ? count(prev) : count;
      window.dispatchEvent(new CustomEvent('unread-count-changed', { detail: { count: next } }));
      return next;
    });
  };
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Translate action keys
  const translateAction = (action: string): string => {
    const map: Record<string, string> = lang === 'vi' ? {
      'assigned you a task': 'đã giao cho bạn công việc',
      'commented on': 'đã bình luận vào',
      'mentioned you on': 'đã nhắc đến bạn trong',
      'replied to your comment on': 'đã trả lời bình luận của bạn trong',
      'replied to a comment on': 'đã trả lời một bình luận trong',
      'reacted to your comment on': 'đã bày tỏ cảm xúc về bình luận của bạn trong',
      'changed status of': 'đã thay đổi trạng thái',
      'added you to project': 'đã thêm bạn vào dự án',
      'published performance evaluation': 'đã công bố kết quả đánh giá',
    } : {};
    return map[action] || action;
  };

  // Format relative time
  const timeAgo = (iso: string): string => {
    const now = Date.now();
    const diff = now - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('common.just_now');
    if (mins < 60) return t('common.time.minutes_ago', { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('common.time.hours_ago', { n: hrs });
    const days = Math.floor(hrs / 24);
    return t('common.time.days_ago', { n: days });
  };

  const fetchNotifications = useCallback(async (currentTab: string, pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      const res = await api.getNotifications({ tab: currentTab, page: pageNum });
      if (res?.success) {
        if (append) {
          setNotifications(prev => [...prev, ...(res.data || [])]);
        } else {
          setNotifications(res.data || []);
        }
        updateUnreadCount(res.unread_count || 0);
        setHasMore(res.pagination?.has_more || false);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('Notifications load error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    setHasMore(false);
    fetchNotifications(tab, 1, false);
  }, [tab, fetchNotifications]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      fetchNotifications(tab, page + 1, true);
    }
  };

  useEffect(() => {
    const handleNotificationReceived = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const n = customEvent.detail;
        const actorName = n.actor?.name || 'System';
        const actorPhoto = n.actor?.photo || null;
        const initials = actorName.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
        
        const newItem: NotificationItem = {
          id: n.id,
          user: actorName,
          photo: actorPhoto,
          avatar: n.type === 'deadline' ? '⏰' : initials,
          color: n.type === 'deadline' ? '#ef4444' : '#6366f1',
          action: n.action,
          target: n.target,
          extra: n.extra,
          time: n.created_at,
          read: !!n.read,
          type: n.type,
          task_id: n.task_id,
          project_id: n.project_id
        };

        setNotifications(prev => {
          if (prev.some(item => item.id === newItem.id)) return prev;
          return [newItem, ...prev];
        });
      }
    };

    window.addEventListener('notification-received-global', handleNotificationReceived);
    return () => {
      window.removeEventListener('notification-received-global', handleNotificationReceived);
    };
  }, []);

  const markAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      updateUnreadCount(0);
      message.success(t('inbox.mark_all_read'));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const markOneRead = async (id: number) => {
    try {
      await api.markNotificationsRead([id]);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      updateUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.read) {
      await markOneRead(n.id);
    }
    if (n.type === 'evaluation') {
      navigate('/evaluations');
    } else if (n.task_id && n.project_id) {
      navigate(`/projects/${n.project_id}?task_id=${n.task_id}`);
    } else if (n.project_id) {
      navigate(`/projects/${n.project_id}`);
    }
  };

  return (
    <div className="inbox-page">
      <div className="inbox-page__header">
        <h1>{t('inbox.title')}</h1>
        <p>{t('inbox.sub_title', { count: unreadCount })}</p>
      </div>
      <div className="inbox-page__tabs">
        <div className="inbox-page__tabs-left">
          {[
            { key: 'all', label: t('inbox.filter.all') },
            { key: 'unread', label: t('inbox.filter.unread'), badge: unreadCount },
            { key: 'mentions', label: t('inbox.filter.mentions') },
            { key: 'assigned', label: t('inbox.filter.assigned') }
          ].map((tItem) => (
            <div key={tItem.key} className={`tab ${tab === tItem.key ? 'active' : ''}`} onClick={() => setTab(tItem.key)}>
              {tItem.label}{tItem.badge ? <span className="badge">{tItem.badge}</span> : null}
            </div>
          ))}
        </div>
        <button className="mark-read" onClick={markAllRead}>{t('inbox.action.mark_read')}</button>
      </div>
      <div className="inbox-page__list" ref={listRef} onScroll={handleScroll} style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}><Spin size="large" /></div>
        ) : notifications.length === 0 ? (
          <div className="inbox-page__empty">
            <InboxOutlined />
            <h3>{t('inbox.empty.title')}</h3>
            <p>{t('inbox.empty.desc')}</p>
          </div>
        ) : (
          <>
            {notifications.map((n) => {
              const ti = typeIcons[n.type] || typeIcons['task_assigned'];
              return (
                <div
                  key={n.id}
                  className={`inbox-page__item ${!n.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div 
                    className="avatar" 
                    style={{ 
                      background: n.photo ? 'transparent' : n.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    {n.photo ? (
                      <img src={n.photo} alt={n.user} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      n.avatar
                    )}
                  </div>
                  <div className="content">
                    <div className="text">
                      <strong>{n.user}</strong> {translateAction(n.action)} <span className="highlight">{n.target}</span>
                      {n.extra && ` — ${n.extra}`}
                    </div>
                    <div className="time">{timeAgo(n.time)}</div>
                  </div>
                  <div className="type-icon" style={{ background: ti.bg, color: ti.color }}>{ti.icon}</div>
                </div>
              );
            })}
            {loadingMore && <div style={{ textAlign: 'center', padding: '16px' }}><Spin size="small" /></div>}
            {!hasMore && notifications.length > 0 && <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', padding: '12px' }}>{t('inbox.all_loaded')}</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default InboxPage;
