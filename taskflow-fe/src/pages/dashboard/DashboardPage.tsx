import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin, message } from 'antd';
import {
  ProjectOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import { useTranslation } from '../../utils/i18n';
import './DashboardPage.scss';

interface DashboardData {
  stats: {
    total_projects: number;
    active_tasks: number;
    overdue_tasks: number;
    completed_tasks: number;
  };
  my_tasks: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    project_name: string;
    project_color: string;
    due_date: string | null;
    is_overdue: boolean;
    assignee_initials: string;
  }>;
  activities: Array<{
    id: number;
    user_name: string;
    user_photo: string | null;
    action: string;
    details: string;
    task_title: string;
    task_id: number;
    project_name: string;
    created_at: string;
  }>;
  project_progress: Array<{
    id: number;
    name: string;
    color: string;
    progress: number;
    total_tasks: number;
    done_tasks: number;
  }>;
  upcoming_deadlines: Array<{
    id: number;
    title: string;
    due_date: string;
    is_today: boolean;
    is_tomorrow: boolean;
    project_name: string;
    project_color: string;
  }>;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  const isVi = lang === 'vi';

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [meRes, dashRes] = await Promise.all([
          api.getMe(),
          api.getDashboardStats(),
        ]);
        if (meRes) setProfile(meRes);
        if (dashRes?.success) setData(dashRes.data);
      } catch (err) {
        console.error('Dashboard load error:', err);
        message.error(t('dashboard.load_error' as any) || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const getGreetingText = () => {
      const hour = new Date().getHours();
      const name = profile?.name ? (profile.name.split(' ').pop() || profile.name) : (isVi ? 'bạn' : 'User');
      
      let greetings: string[] = [];
      if (isVi) {
        if (hour >= 5 && hour < 12) {
          greetings = [
            `Chào buổi sáng, ${name} 👋`,
            `Chào ngày mới tốt lành, ${name}! ☀️`,
            `Ngày mới làm việc đầy năng lượng nhé, ${name}! 🚀`,
            `Chúc ${name} một buổi sáng tuyệt vời! ✨`
          ];
        } else if (hour >= 12 && hour < 14) {
          greetings = [
            `Chào buổi trưa, ${name} 👋`,
            `Chúc ${name} buổi trưa vui vẻ và thư giãn! ☕`,
            `Chúc ${name} có một giờ nghỉ trưa dễ chịu! 🍀`,
            `Buổi trưa vui vẻ nhé, ${name}! ✨`
          ];
        } else if (hour >= 14 && hour < 18) {
          greetings = [
            `Chào buổi chiều, ${name} 👋`,
            `Chúc ${name} buổi chiều tốt lành! ☀️`,
            `Buổi chiều làm việc thật năng suất nhé, ${name}! 🚀`,
            `Chúc ${name} hoàn thành tốt công việc chiều nay! ✨`
          ];
        } else {
          greetings = [
            `Chào buổi tối, ${name} 👋`,
            `Chúc ${name} có một buổi tối vui vẻ! 🌙`,
            `Đã đến tối rồi, nghỉ ngơi thôi nào ${name}! ☕`,
            `Chúc ${name} buổi tối ấm áp bên gia đình! ✨`
          ];
        }
      } else {
        if (hour >= 5 && hour < 12) {
          greetings = [
            `Good morning, ${name} 👋`,
            `Have a great morning, ${name}! ☀️`,
            `Rise and shine, ${name}! 🚀`,
            `Wishing you a wonderful morning, ${name}! ✨`
          ];
        } else if (hour >= 12 && hour < 14) {
          greetings = [
            `Good day, ${name} 👋`,
            `Hope your day is going well, ${name}! ☕`,
            `Have a pleasant afternoon, ${name}! 🍀`,
            `Enjoy your lunch break, ${name}! ✨`
          ];
        } else if (hour >= 14 && hour < 18) {
          greetings = [
            `Good afternoon, ${name} 👋`,
            `Hope you're having a productive afternoon, ${name}! 🚀`,
            `Almost there! Have a great afternoon, ${name}! ☀️`,
            `Wishing you a nice afternoon, ${name}! ✨`
          ];
        } else {
          greetings = [
            `Good evening, ${name} 👋`,
            `Hope you're having a relaxing evening, ${name}! 🌙`,
            `Have a peaceful evening, ${name}! ☕`,
            `Wishing you a cozy evening, ${name}! ✨`
          ];
        }
      }
      const randomIndex = Math.floor(Math.random() * greetings.length);
      return greetings[randomIndex];
    };

    setGreeting(getGreetingText());
  }, [profile, isVi]);

  // Format relative time
  const timeAgo = (iso: string): string => {
    const now = Date.now();
    const diff = now - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return lang === 'vi' ? 'Vừa xong' : 'Just now';
    if (mins < 60) return lang === 'vi' ? `${mins} phút trước` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return lang === 'vi' ? `${hrs} giờ trước` : `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return lang === 'vi' ? `${days} ngày trước` : `${days}d ago`;
  };

  // Format due date for display
  const formatDueDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: 'short' });
  };

  // Translate activity action
  const translateAction = (action: string): string => {
    const actionMap: Record<string, string> = lang === 'vi' ? {
      created: 'đã tạo',
      updated: 'đã cập nhật',
      updated_status: 'đã đổi trạng thái',
      updated_assignee: 'đã giao lại',
      commented: 'đã bình luận vào',
      deleted: 'đã xóa',
    } : {
      created: 'created',
      updated: 'updated',
      updated_status: 'changed status of',
      updated_assignee: 'reassigned',
      commented: 'commented on',
      deleted: 'deleted',
    };
    return actionMap[action] || action;
  };

  // Get avatar color from name
  const getAvatarColor = (name: string): string => {
    const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#3b82f6'];
    const charSum = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return colors[charSum % colors.length];
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const stats = data?.stats;

  const statCards = [
    { key: 'projects', label: t('dashboard.total_projects'), value: stats?.total_projects ?? 0, icon: <ProjectOutlined />, iconClass: 'projects' },
    { key: 'active', label: t('dashboard.active_tasks'), value: stats?.active_tasks ?? 0, icon: <ThunderboltOutlined />, iconClass: 'active' },
    { key: 'overdue', label: t('dashboard.overdue'), value: stats?.overdue_tasks ?? 0, icon: <ClockCircleOutlined />, iconClass: 'overdue' },
    { key: 'completed', label: t('dashboard.completed'), value: stats?.completed_tasks ?? 0, icon: <CheckCircleOutlined />, iconClass: 'completed' },
  ];

  const greetingName = profile?.name?.split(' ')[0] || 'User';

  return (
    <div className="dashboard">
      {/* Greeting */}
      <div className="dashboard__greeting">
        <h1>{greeting || t('dashboard.greeting', { name: greetingName })}</h1>
        <p>{t('dashboard.sub_greeting', { count: stats?.active_tasks ?? 0 })}</p>
      </div>

      {/* Stat Cards */}
      <div className="dashboard__stats">
        {statCards.map((stat) => (
          <div key={stat.key} className={`dashboard__stat-card dashboard__stat-card--${stat.key}`} onClick={() => navigate(stat.key === 'projects' ? '/projects' : '/my-tasks')}>
            <div className="dashboard__stat-card-header">
              <div className={`dashboard__stat-card-icon dashboard__stat-card-icon--${stat.iconClass}`}>
                {stat.icon}
              </div>
              {stat.key === 'overdue' && stat.value > 0 && (
                <span className="dashboard__stat-card-trend down">
                  <ArrowDownOutlined /> {stat.value}
                </span>
              )}
              {stat.key === 'completed' && stat.value > 0 && (
                <span className="dashboard__stat-card-trend up">
                  <ArrowUpOutlined /> {stat.value}
                </span>
              )}
            </div>
            <div className="dashboard__stat-card-value">{stat.value}</div>
            <div className="dashboard__stat-card-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="dashboard__grid">
        {/* Left: My Tasks */}
        <div>
          <div className="dashboard__widget">
            <div className="dashboard__widget-header">
              <h3>{t('tasks.title')}</h3>
              <button className="view-all" onClick={() => navigate('/my-tasks')}>{t('dashboard.view_all')} →</button>
            </div>
            <div className="dashboard__task-list">
              {(!data?.my_tasks || data.my_tasks.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {lang === 'vi' ? 'Chưa có công việc nào' : 'No tasks assigned'}
                </div>
              ) : (
                data.my_tasks.map((task) => (
                  <div key={task.id} className="dashboard__task-item" onClick={() => navigate('/my-tasks')}>
                    <div className={`dashboard__task-item-priority dashboard__task-item-priority--${task.priority}`} />
                    <div className={`dashboard__task-item-status dashboard__task-item-status--${task.status?.replace('_', '-')}`}>
                      {task.status === 'done' && '✓'}
                    </div>
                    <div className="dashboard__task-item-content">
                      <div className="dashboard__task-item-title">{task.title}</div>
                      <div className="dashboard__task-item-meta">
                        <span className="dashboard__task-item-project">
                          <span className="dot" style={{ background: task.project_color }} />
                          {task.project_name}
                        </span>
                      </div>
                    </div>
                    <span className={`dashboard__task-item-date ${task.is_overdue ? 'overdue' : ''}`}>
                      {formatDueDate(task.due_date)}
                    </span>
                    <div className="dashboard__task-item-avatar">{task.assignee_initials}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="dashboard__widget" style={{ marginTop: 20 }}>
            <div className="dashboard__widget-header">
              <h3>{t('dashboard.recent_activity')}</h3>
            </div>
            <div className="dashboard__activity-list">
              {(!data?.activities || data.activities.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {lang === 'vi' ? 'Chưa có hoạt động nào' : 'No recent activity'}
                </div>
              ) : (
                data.activities.map((act) => (
                  <div key={act.id} className="dashboard__activity-item">
                    <div className="dashboard__activity-avatar" style={{ background: getAvatarColor(act.user_name) }}>
                      {act.user_name.charAt(0)}
                    </div>
                    <div className="dashboard__activity-content">
                      <p>
                        <strong>{act.user_name}</strong> {translateAction(act.action)}{' '}
                        <span className="highlight">{act.task_title}</span>
                        {act.details && <span style={{ color: 'var(--text-muted)' }}> — {act.details}</span>}
                      </p>
                      <div className="time">{timeAgo(act.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="dashboard__right">
          {/* Project Progress */}
          <div className="dashboard__widget">
            <div className="dashboard__widget-header">
              <h3>{t('dashboard.project_progress')}</h3>
            </div>
            <div className="dashboard__project-list">
              {(!data?.project_progress || data.project_progress.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {lang === 'vi' ? 'Chưa có dự án nào' : 'No projects yet'}
                </div>
              ) : (
                data.project_progress.map((proj) => (
                  <div key={proj.id} className="dashboard__project-progress" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${proj.id}`)}>
                    <div className="dashboard__project-progress-header">
                      <span className="dashboard__project-progress-name">
                        <span className="dot" style={{ background: proj.color }} />
                        {proj.name}
                      </span>
                      <span className="dashboard__project-progress-percent">{proj.progress}%</span>
                    </div>
                    <div className="dashboard__project-progress-bar">
                      <div
                        className="dashboard__project-progress-bar-fill"
                        style={{ width: `${proj.progress}%`, background: proj.color }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="dashboard__widget">
            <div className="dashboard__widget-header">
              <h3>{t('dashboard.upcoming_deadlines')}</h3>
            </div>
            <div className="dashboard__task-list">
              {(!data?.upcoming_deadlines || data.upcoming_deadlines.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {lang === 'vi' ? 'Không có hạn chót sắp tới' : 'No upcoming deadlines'}
                </div>
              ) : (
                data.upcoming_deadlines.map((task) => (
                  <div key={task.id} className="dashboard__task-item" onClick={() => navigate('/my-tasks')}>
                    <div className="dashboard__task-item-content">
                      <div className="dashboard__task-item-title">{task.title}</div>
                      <div className="dashboard__task-item-meta">
                        <span className="dashboard__task-item-project">
                          <span className="dot" style={{ background: task.project_color }} />
                          {task.project_name}
                        </span>
                      </div>
                    </div>
                    <span className={`dashboard__task-item-date ${task.is_today ? 'overdue' : ''}`}>
                      {task.is_today
                        ? t('dashboard.today')
                        : task.is_tomorrow
                          ? t('dashboard.tomorrow')
                          : formatDueDate(task.due_date)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
