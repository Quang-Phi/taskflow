import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { BellOutlined, BgColorsOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useTranslation, Language } from '../../utils/i18n';
import './SettingsPage.scss';

const SettingsPage: React.FC = () => {
  const { t, lang, changeLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useState('notifications');
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('taskflow_theme') || 'dark';
  });
  


  const [notifs, setNotifs] = useState({
    taskAssigned: true,
    taskComment: true,
    deadline: true,
    evaluation: true,
    projectUpdate: false
  });

  const [workspaceName, setWorkspaceName] = useState('TaskFlow Inc.');
  const [timezone, setTimezone] = useState(() => {
    return localStorage.getItem('taskflow_timezone') || 'Asia/Ho_Chi_Minh (UTC+7)';
  });
  const [language, setLanguageState] = useState<Language>(lang);

  // Keep state in sync with global language changes
  useEffect(() => {
    setLanguageState(lang);
  }, [lang]);

  const navItems = [
    { key: 'notifications', label: t('settings.tab.notifications'), icon: <BellOutlined /> },
    { key: 'appearance', label: t('settings.tab.appearance'), icon: <BgColorsOutlined /> },
    { key: 'workspace', label: t('settings.tab.workspace'), icon: <SettingOutlined /> },
  ];

  const fetchProfile = async () => {
    try {
      const res = await api.getMe();
      if (res) {
        if (res.theme) {
          setThemeState(res.theme);
          localStorage.setItem('taskflow_theme', res.theme);
          window.dispatchEvent(new Event('theme-changed'));
        }
        if (res.timezone) {
          setTimezone(res.timezone);
          localStorage.setItem('taskflow_timezone', res.timezone);
        }
        if (res.language) {
          setLanguageState(res.language);
          changeLanguage(res.language);
        }
        if (res.workspace_name) {
          setWorkspaceName(res.workspace_name);
          localStorage.setItem('taskflow_workspace_name', res.workspace_name);
        }
        if (res.notification_settings) {
          setNotifs(res.notification_settings);
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
      message.error(t('settings.toast.profile_load_err'));
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleThemeChange = async (newTheme: string) => {
    setThemeState(newTheme);
    localStorage.setItem('taskflow_theme', newTheme);
    window.dispatchEvent(new Event('theme-changed'));
    
    let themeLabel = '';
    if (newTheme === 'light') themeLabel = t('settings.appearance.light');
    else if (newTheme === 'dark') themeLabel = t('settings.appearance.dark');
    else themeLabel = t('settings.appearance.system');

    message.success(lang === 'vi' ? `Đã chuyển giao diện sang: ${themeLabel}` : `Theme changed to: ${themeLabel}`);

    try {
      await api.updateSettings({ theme: newTheme });
    } catch (err) {
      console.error('Failed to save theme setting to DB', err);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      const res = await api.updateSettings({ notification_settings: notifs });
      if (res.success) {
        message.success(t('settings.toast.notif_saved'));
      }
    } catch (err) {
      message.error(t('settings.toast.profile_load_err'));
    }
  };

  const handleSaveWorkspace = async () => {
    try {
      const res = await api.updateSettings({
        language,
        timezone,
        workspace_name: workspaceName
      });
      if (res.success) {
        // Save language setting globally
        changeLanguage(language);
        // Save timezone setting
        localStorage.setItem('taskflow_timezone', timezone);
        // Save workspace name
        localStorage.setItem('taskflow_workspace_name', workspaceName);
        
        message.success(t('settings.toast.workspace_saved'));
      }
    } catch (err) {
      message.error(t('settings.toast.profile_load_err'));
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.sub_title')}</p>
      </div>
      <div className="settings-page__layout">
        <div className="settings-page__nav">
          {navItems.map((n) => (
            <div
              key={n.key}
              className={`nav-item ${activeTab === n.key ? 'active' : ''}`}
              onClick={() => setActiveTab(n.key)}
            >
              {n.icon} {n.label}
            </div>
          ))}
        </div>
        <div className="settings-page__content">


          {activeTab === 'notifications' && (
            <div className="settings-page__section">
              <h3>{t('settings.notif.title')}</h3>
              {[
                { key: 'taskAssigned', label: t('settings.notif.taskAssigned.label'), desc: t('settings.notif.taskAssigned.desc') },
                { key: 'taskComment', label: t('settings.notif.taskComment.label'), desc: t('settings.notif.taskComment.desc') },
                { key: 'deadline', label: t('settings.notif.deadline.label'), desc: t('settings.notif.deadline.desc') },
                { key: 'evaluation', label: t('settings.notif.evaluation.label'), desc: t('settings.notif.evaluation.desc') },
                { key: 'projectUpdate', label: t('settings.notif.projectUpdate.label'), desc: t('settings.notif.projectUpdate.desc') },
              ].map((n) => (
                <div key={n.key} className="settings-page__toggle">
                  <div className="info">
                    <div className="label">{n.label}</div>
                    <div className="desc">{n.desc}</div>
                  </div>
                  <div
                    className={`switch ${(notifs as any)[n.key] ? 'on' : ''}`}
                    onClick={() => setNotifs((p) => ({ ...p, [n.key]: !(p as any)[n.key] }))}
                  />
                </div>
              ))}
              <button className="settings-page__save-btn" onClick={handleSaveNotifications}>{t('settings.notif.save')}</button>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="settings-page__section">
              <h3>{t('settings.appearance.title')}</h3>
              <div className="settings-page__theme-options">
                {[
                  { key: 'light', icon: '☀️', label: t('settings.appearance.light') },
                  { key: 'dark', icon: '🌙', label: t('settings.appearance.dark') },
                  { key: 'system', icon: '💻', label: t('settings.appearance.system') }
                ].map((tItem) => (
                  <div
                    key={tItem.key}
                    className={`theme-btn ${theme === tItem.key ? 'active' : ''}`}
                    onClick={() => handleThemeChange(tItem.key)}
                  >
                    <span className="icon">{tItem.icon}</span>
                    <span className="label">{tItem.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'workspace' && (
            <div className="settings-page__section">
              <h3>{t('settings.workspace.title')}</h3>
              <div className="settings-page__field">
                <label>{t('settings.workspace.name')}</label>
                <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
              </div>
              <div className="settings-page__field-row">
                <div className="settings-page__field">
                  <label>{t('settings.workspace.timezone')}</label>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    <option value="Asia/Ho_Chi_Minh (UTC+7)">Asia/Ho_Chi_Minh (UTC+7)</option>
                    <option value="America/New_York (UTC-5)">America/New_York (UTC-5)</option>
                    <option value="Europe/London (UTC+0)">Europe/London (UTC+0)</option>
                  </select>
                </div>
                <div className="settings-page__field">
                  <label>{t('settings.workspace.language')}</label>
                  <select value={language} onChange={(e) => setLanguageState(e.target.value as Language)}>
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
              <button className="settings-page__save-btn" onClick={handleSaveWorkspace}>{t('settings.workspace.save')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
