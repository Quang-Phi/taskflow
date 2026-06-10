import React, { useState, useEffect } from 'react';
import { message, Modal, Button } from 'antd';
import { BellOutlined, BgColorsOutlined, SettingOutlined, FileTextOutlined } from '@ant-design/icons';
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

  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [isTemplatesPreviewVisible, setIsTemplatesPreviewVisible] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  // Keep state in sync with global language changes
  useEffect(() => {
    setLanguageState(lang);
  }, [lang]);

  const navItems = [
    { key: 'notifications', label: t('settings.tab.notifications'), icon: <BellOutlined /> },
    { key: 'appearance', label: t('settings.tab.appearance'), icon: <BgColorsOutlined /> },
    { key: 'workspace', label: t('settings.tab.workspace'), icon: <SettingOutlined /> },
    { key: 'templates', label: t('settings.tab.templates') || 'Mẫu công việc', icon: <FileTextOutlined /> },
  ];

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.getTaskTemplates();
      if (res.success) {
        setTemplates(res.data || []);
      }
    } catch (err) {
      console.error(err);
      message.error('Không thể tải danh sách mẫu công việc.');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    try {
      const res = await api.deleteTaskTemplate(id);
      if (res.success) {
        message.success(t('tasks.template.success_delete' as any) || 'Đã xóa mẫu công việc.');
        fetchTemplates();
      }
    } catch (err) {
      console.error(err);
      message.error('Không thể xóa mẫu công việc.');
    }
  };

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplates();
    }
  }, [activeTab]);

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

    message.success(t('settings.toast.theme_changed', { label: themeLabel }));

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
                    <option value="ja">日本語 (Japanese)</option>
                  </select>
                </div>
              </div>
              <button className="settings-page__save-btn" onClick={handleSaveWorkspace}>{t('settings.workspace.save')}</button>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="settings-page__section">
              <h3>{t('settings.tab.templates') || 'Mẫu công việc'}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', marginTop: '-10px' }}>
                Quản lý các mẫu công việc được lưu để khởi tạo nhanh công việc kèm checklists và công việc con.
              </p>
              
              {loadingTemplates ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>Đang tải...</div>
              ) : templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  <FileTextOutlined style={{ fontSize: '36px', marginBottom: '12px', color: 'var(--text-secondary)', opacity: 0.5 }} />
                  <p>{t('tasks.template.no_templates') || 'Chưa có mẫu công việc nào.'}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {templates.map((tpl) => {
                    const checklistCount = tpl.checklist_template?.length || 0;
                    const subtaskCount = tpl.subtask_template?.length || 0;
                    return (
                      <div
                        key={tpl.id}
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '14px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'rgba(255, 255, 255, 0.02)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{tpl.name}</span>
                            {tpl.is_public ? (
                              <span style={{ fontSize: '10px', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
                                {t('tasks.template.scope_global') || 'Toàn cục'}
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
                                {t('tasks.template.scope_project') || 'Dự án'}
                              </span>
                            )}
                          </div>
                          
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                            <span>{t('tasks.template.checklists_count') || 'Checklist'}: <strong>{checklistCount}</strong></span>
                            <span>{t('tasks.template.subtasks_count') || 'Công việc con'}: <strong>{subtaskCount}</strong></span>
                            {tpl.creator && (
                              <span>Người tạo: <strong>{tpl.creator.name}</strong></span>
                            )}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button
                            size="small"
                            onClick={() => {
                              setPreviewTemplate(tpl);
                              setIsTemplatesPreviewVisible(true);
                            }}
                          >
                            Xem trước
                          </Button>
                          <Button
                            size="small"
                            type="text"
                            danger
                            onClick={() => {
                              Modal.confirm({
                                title: 'Xác nhận xóa',
                                content: `Bạn có chắc chắn muốn xóa mẫu "${tpl.name}" không?`,
                                okText: 'Xóa',
                                cancelText: 'Hủy',
                                okButtonProps: { danger: true },
                                onOk: () => handleDeleteTemplate(tpl.id),
                              });
                            }}
                          >
                            Xóa
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        title={t('tasks.template.preview_title') || 'Xem trước mẫu công việc'}
        open={isTemplatesPreviewVisible}
        onCancel={() => {
          setIsTemplatesPreviewVisible(false);
          setPreviewTemplate(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setIsTemplatesPreviewVisible(false);
            setPreviewTemplate(null);
          }}>
            Đóng
          </Button>
        ]}
        width={600}
      >
        {previewTemplate && (
          <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px', marginTop: '16px' }}>
            <div style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{previewTemplate.name}</h4>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Loại: <strong style={{ color: 'var(--text-primary)' }}>{previewTemplate.type || 'task'}</strong></span>
                <span>Độ ưu tiên: <strong style={{ color: 'var(--text-primary)' }}>{previewTemplate.priority || 'medium'}</strong></span>
                {previewTemplate.estimated_hours && (
                  <span>Ước lượng: <strong style={{ color: 'var(--text-primary)' }}>{previewTemplate.estimated_hours}h</strong></span>
                )}
              </div>
            </div>

            {previewTemplate.description && (
              <div style={{ marginBottom: '16px' }}>
                <h5 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Mô tả</h5>
                <div style={{
                  background: 'var(--bg-input)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid var(--border-color)'
                }}>
                  {previewTemplate.description}
                </div>
              </div>
            )}

            {/* Checklists template */}
            {previewTemplate.checklist_template && previewTemplate.checklist_template.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Checklists</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {previewTemplate.checklist_template.map((cl: any, clIdx: number) => (
                    <div key={clIdx} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                        📋 {cl.name}
                      </div>
                      {cl.items && cl.items.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '8px' }}>
                          {cl.items.map((item: any, itemIdx: number) => (
                            <div key={itemIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              <input type="checkbox" checked={item.is_checked} readOnly style={{ pointerEvents: 'none' }} />
                              <span>{item.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', paddingLeft: '8px' }}>Không có mục nào</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subtasks template */}
            {previewTemplate.subtask_template && previewTemplate.subtask_template.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Công việc con</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {previewTemplate.subtask_template.map((sub: any, subIdx: number) => (
                    <div key={subIdx} style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                          ↳ {sub.title}
                        </div>
                        {sub.description && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {sub.description}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: sub.priority === 'high' ? 'rgba(239, 68, 68, 0.1)' : sub.priority === 'medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                          color: sub.priority === 'high' ? '#ef4444' : sub.priority === 'medium' ? '#f59e0b' : '#3b82f6',
                        }}>
                          {sub.priority}
                        </span>
                        {sub.estimated_hours && (
                          <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}>
                            {sub.estimated_hours}h
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SettingsPage;
