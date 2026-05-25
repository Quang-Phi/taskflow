import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, MenuProps, Modal, Popover, Button, Progress, notification } from 'antd';
import {
  SearchOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  PlusOutlined,
  FileOutlined,
  ProjectOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import { getEcho } from '../../services/echo';
import { useTranslation } from '../../utils/i18n';
import './Header.scss';

interface HeaderProps {
  sidebarCollapsed: boolean;
  aiSidebarOpen?: boolean;
}

const myFormatDuration = (seconds: number): string => {
  const total = Math.abs(seconds || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};

const formatSeconds = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const Header: React.FC<HeaderProps> = ({ sidebarCollapsed, aiSidebarOpen }) => {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [runningTimer, setRunningTimer] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [todayEntries, setTodayEntries] = useState<any[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchTimerData = async () => {
    try {
      const resTimer = await api.getRunningTimer();
      if (resTimer.success) {
        setRunningTimer(resTimer.data);
      }
      const resEntries = await api.getTodayTimeEntries();
      if (resEntries.success) {
        setTodayEntries(resEntries.data);
      }
    } catch (err) {
      console.error('Failed to fetch timer data', err);
    }
  };

  useEffect(() => {
    fetchTimerData();

    const handleUpdate = () => {
      fetchTimerData();
    };

    window.addEventListener('timer-updated', handleUpdate);
    return () => {
      window.removeEventListener('timer-updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchTimerData, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await api.getUnreadCount();
        if (res?.success) {
          setUnreadCount(res.count || 0);
        }
      } catch (err) {
        // silently fail
      }
    };
    fetchUnreadCount();

    const handleUnreadCountChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail !== undefined) {
        setUnreadCount(customEvent.detail.count);
      } else {
        fetchUnreadCount();
      }
    };

    window.addEventListener('unread-count-changed', handleUnreadCountChanged);
    return () => {
      window.removeEventListener('unread-count-changed', handleUnreadCountChanged);
    };
  }, []);

  useEffect(() => {
    if (!runningTimer) {
      setElapsed(0);
      return;
    }
    const started = new Date(runningTimer.started_at).getTime();
    const updateElapsed = () => {
      const diffSec = Math.floor((Date.now() - started) / 1000);
      setElapsed(diffSec > 0 ? diffSec : 0);
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [runningTimer]);

  const handleStopTimer = async () => {
    if (!runningTimer) return;
    try {
      const res = await api.stopTimer(runningTimer.task_id);
      if (res.success) {
        window.dispatchEvent(new Event('timer-updated'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartTimer = async (taskId: number) => {
    try {
      const res = await api.startTimer(taskId);
      if (res.success) {
        window.dispatchEvent(new Event('timer-updated'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    try {
      const res = await api.deleteTimeEntry(entryId);
      if (res.success) {
        window.dispatchEvent(new Event('timer-updated'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.getMe();
        if (res) {
          setUser(res);
          // Sync settings from DB user profile to local storage & UI state
          if (res.theme) {
            const currentTheme = localStorage.getItem('taskflow_theme');
            if (currentTheme !== res.theme) {
              localStorage.setItem('taskflow_theme', res.theme);
              window.dispatchEvent(new Event('theme-changed'));
            }
          }
          if (res.timezone) {
            localStorage.setItem('taskflow_timezone', res.timezone);
          }
          if (res.workspace_name) {
            localStorage.setItem('taskflow_workspace_name', res.workspace_name);
          }
          if (res.language) {
            const currentLang = localStorage.getItem('taskflow_lang');
            if (currentLang !== res.language) {
              localStorage.setItem('taskflow_lang', res.language);
              window.dispatchEvent(new Event('language-changed'));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load user for header', err);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const echo = getEcho();
    const channel = echo.private(`App.Models.User.${user.id}`);

    channel.listen('.notification.received', (data: { notification: any }) => {
      console.log('[Echo] Notification received:', data);
      
      // Increment unread count
      setUnreadCount(prev => prev + 1);

      // Trigger custom window event to update notifications list (in Inbox page if open)
      window.dispatchEvent(new CustomEvent('notification-received-global', { detail: data.notification }));

      // Dispatch global unread-count-changed event
      window.dispatchEvent(new CustomEvent('unread-count-changed', { detail: { count: unreadCount + 1 } }));

      // Show browser/app notification banner
      const actorName = data.notification.actor?.name || 'System';
      const actionText = data.notification.action || '';
      const targetText = data.notification.target || '';
      
      notification.info({
        message: lang === 'vi' ? 'Thông báo mới' : 'New Notification',
        description: `${actorName} ${actionText} "${targetText}"`,
        placement: 'bottomRight',
        duration: 5,
      });
    });

    return () => {
      channel.stopListening('.notification.received');
      echo.leaveChannel(`App.Models.User.${user.id}`);
    };
  }, [user, unreadCount, lang]);

  const createMenuItems: MenuProps['items'] = [
    {
      key: 'task',
      icon: <FileOutlined />,
      label: t('header.new_task'),
      onClick: () => window.dispatchEvent(new CustomEvent('open-create-task-modal')),
    },
    {
      key: 'project',
      icon: <ProjectOutlined />,
      label: t('header.new_project'),
      onClick: () => navigate('/projects?create=true'),
    },
    {
      key: 'member',
      icon: <TeamOutlined />,
      label: t('header.invite_member'),
      onClick: () => navigate('/members'),
    },
  ];

  const profileMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: t('header.my_profile'),
      onClick: () => setIsProfileOpen(true),
    },
    {
      key: 'settings',
      label: t('header.system_settings'),
      onClick: () => navigate('/settings'),
    },
  ];

  const resolvedRole = (role: string) => {
    if (role === 'admin') return t('settings.profile.role.admin');
    if (role === 'manager') return t('settings.profile.role.manager');
    return t('settings.profile.role.employee');
  };

  const getInitials = () => {
    if (user?.name) {
      return user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <header className={`header ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${aiSidebarOpen ? 'ai-sidebar-open' : ''}`}>
      {/* Left - Breadcrumb */}
      <div className="header__left">
        <div className="header__breadcrumb">
          <span>{t('nav.dashboard')}</span>
        </div>
      </div>

      {/* Center - Search */}
      <div className="header__search">
        <div className="header__search-input" onClick={() => window.dispatchEvent(new Event('open-global-search'))} style={{ cursor: 'pointer' }}>
          <SearchOutlined className="search-icon" />
          <span>{t('header.search')}</span>
          <span className="search-shortcut">⌘K</span>
        </div>
      </div>

      {/* Right - Actions */}
      <div className="header__right">
        <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
          <button className="header__create-btn">
            <PlusOutlined />
            <span>{t('header.new')}</span>
          </button>
        </Dropdown>        <div className="header__divider" />

        <style>{`
          @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.6; }
            50% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.6; }
          }
          .header-timer-trigger:hover {
            border-color: var(--text-muted) !important;
            background: var(--bg-hover) !important;
          }
          .header-timer-trigger.active:hover {
            border-color: #ef4444 !important;
            box-shadow: 0 0 8px rgba(239, 68, 68, 0.2);
          }
          .timer-entry-item:hover {
            background: var(--bg-hover) !important;
          }
        `}</style>

        <Popover
          content={
            <div style={{ width: '320px', padding: '4px' }}>
              {/* Target Progress */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {lang === 'vi' ? 'Hôm nay' : 'Today'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {((todayEntries.reduce((sum: number, entry: any) => sum + Math.abs(entry.duration || 0), 0) + (runningTimer ? elapsed : 0)) / 3600).toFixed(2)}h / 8.0h
                </span>
              </div>
              <Progress
                percent={Math.min(100, Math.round(((todayEntries.reduce((sum: number, entry: any) => sum + Math.abs(entry.duration || 0), 0) + (runningTimer ? elapsed : 0)) / 28800) * 100))}
                showInfo={false}
                strokeColor="linear-gradient(135deg, #10b981, #059669)"
                style={{ marginBottom: '16px' }}
              />

              {/* Active Timer Info */}
              <div style={{ background: 'var(--bg-tag)', borderRadius: '8px', padding: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                {runningTimer ? (
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                      {lang === 'vi' ? 'Đang chạy' : 'Running'}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px', wordBreak: 'break-all' }}>
                      {runningTimer.task?.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      {runningTimer.task?.project?.name || 'No Project'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatSeconds(elapsed)}
                      </span>
                      <Button
                        type="primary"
                        danger
                        shape="round"
                        size="small"
                        onClick={handleStopTimer}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {lang === 'vi' ? 'Dừng' : 'Stop'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {lang === 'vi' ? 'Không có bộ đếm thời gian đang chạy' : 'No running timer'}
                  </div>
                )}
              </div>

              {/* Today Logs list */}
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
                  {lang === 'vi' ? 'Lịch sử hôm nay' : "Today's logs"}
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '16px' }}>
                  {todayEntries.filter((entry: any) => !(runningTimer && runningTimer.id === entry.id)).length > 0 ? (
                    todayEntries
                      .filter((entry: any) => !(runningTimer && runningTimer.id === entry.id))
                      .map((entry: any) => {
                        return (
                          <div
                            key={entry.id}
                            className="timer-entry-item"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              marginBottom: '4px',
                              background: 'transparent',
                              border: 'none',
                              transition: 'background 0.2s'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {entry.task?.title}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {entry.task?.project?.name || 'No Project'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                {myFormatDuration(entry.duration)}
                              </span>
                              <Button
                                type="text"
                                size="small"
                                icon={<PlayCircleOutlined style={{ color: '#10b981' }} />}
                                onClick={() => handleStartTimer(entry.task_id)}
                                style={{ padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              />
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleDeleteEntry(entry.id)}
                                style={{ padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              />
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 0' }}>
                      {lang === 'vi' ? 'Chưa có log thời gian hôm nay.' : 'No time entries for today.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Navigation */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <Button type="link" size="small" onClick={() => { setPopoverOpen(false); navigate('/'); }} style={{ padding: 0 }}>
                  {lang === 'vi' ? 'Trang chủ' : 'Dashboard'}
                </Button>
                <Button type="link" size="small" onClick={() => { setPopoverOpen(false); navigate('/my-tasks'); }} style={{ padding: 0 }}>
                  {lang === 'vi' ? 'Công việc của tôi' : 'My Tasks'}
                </Button>
              </div>
            </div>
          }
          trigger="click"
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          placement="bottomRight"
        >
          {runningTimer ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '20px',
                padding: '4px 12px',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
              className="header-timer-trigger active"
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#ef4444', fontSize: '13px' }}>
                {formatSeconds(elapsed)}
              </span>
              <button
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginLeft: '4px',
                  fontSize: '8px',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStopTimer();
                }}
              >
                ■
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-tag)',
                border: '1px solid var(--border-color)',
                borderRadius: '20px',
                padding: '4px 12px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'all 0.3s',
              }}
              className="header-timer-trigger"
            >
              <ClockCircleOutlined />
              <span style={{ fontSize: '12px', fontWeight: 500 }}>
                {lang === 'vi' ? 'Bắt đầu bấm giờ' : 'Start Timer'}
              </span>
            </div>
          )}
        </Popover>

        <div className="header__divider" />

        <button className="header__icon-btn" onClick={() => navigate('/inbox')}>
          <BellOutlined />
          {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
        </button>        {/* <button className="header__icon-btn" onClick={() => navigate('/settings')}>
          <QuestionCircleOutlined />
        </button> */}

        <div className="header__divider" />

        <Dropdown menu={{ items: profileMenuItems }} trigger={['click']} placement="bottomRight">
          <div className="header__avatar" style={{ cursor: 'pointer' }}>
            {user?.photo ? (
              <img src={user.photo} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              getInitials()
            )}
          </div>
        </Dropdown>
      </div>

      <Modal
        title={t('settings.profile.title')}
        open={isProfileOpen}
        onCancel={() => setIsProfileOpen(false)}
        footer={null}
        width={420}
        destroyOnClose
        className="profile-modal"
      >
        {user ? (
          <div className="profile-modal-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' }}>
            {user.photo ? (
              <img src={user.photo} alt={user.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold', color: '#fff' }}>
                {getInitials()}
              </div>
            )}
            <h3 style={{ marginTop: 16, marginBottom: 4, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</h3>
            <div style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '4px', fontSize: '12px', background: 'var(--bg-tag)', color: 'var(--text-accent)', fontWeight: 'bold', marginBottom: 20 }}>
              {resolvedRole(user.role)}
            </div>

            <div style={{ width: '100%', background: 'var(--bg-accent-subtle)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-accent)', fontSize: '13px', color: 'var(--text-accent)', marginBottom: 20 }}>
              💡 {t('settings.profile.sync_note')}
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{t('settings.profile.email')}</span>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: 4, fontWeight: 500 }}>{user.email}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{t('settings.profile.phone')}</span>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: 4, fontWeight: 500 }}>{user.phone || t('members.drawer.no_phone')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 8 }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{t('settings.profile.work_position')}</span>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: 4, fontWeight: 500 }}>{user.work_position || t('settings.profile.role.employee')}</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>No profile data loaded.</div>
        )}
      </Modal>
    </header>
  );
};

export default Header;
