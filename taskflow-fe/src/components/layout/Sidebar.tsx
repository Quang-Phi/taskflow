import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tooltip } from 'antd';
import {
  HomeOutlined,
  ProjectOutlined,
  CheckSquareOutlined,
  InboxOutlined,
  BarChartOutlined,
  StarOutlined,
  TeamOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  RightOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import { renderProjectIcon } from '../projects/ProjectIconPicker';
import { useTranslation } from '../../utils/i18n';
import './Sidebar.scss';

interface NavItem {
  key: string;
  icon: React.ReactNode;
  labelKey: string;
  path: string;
  badge?: number;
}

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onCollapse }) => {
  const { t } = useTranslation();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [inboxBadge, setInboxBadge] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const dashboardItem: NavItem = { key: 'dashboard', icon: <HomeOutlined />, labelKey: 'nav.dashboard', path: '/' };

  const mainNav: NavItem[] = [
    { key: 'my-tasks', icon: <CheckSquareOutlined />, labelKey: 'nav.my_tasks', path: '/my-tasks' },
    { key: 'timesheet', icon: <ClockCircleOutlined />, labelKey: 'nav.timesheet', path: '/timesheet' },
    { key: 'inbox', icon: <InboxOutlined />, labelKey: 'nav.inbox', path: '/inbox', badge: inboxBadge || undefined },
  ];

  const manageNav: NavItem[] = [
    { key: 'analytics', icon: <BarChartOutlined />, labelKey: 'nav.analytics', path: '/analytics' },
    { key: 'evaluations', icon: <StarOutlined />, labelKey: 'nav.evaluations', path: '/evaluations' },
    { key: 'members', icon: <TeamOutlined />, labelKey: 'nav.members', path: '/members' },
    { key: 'settings', icon: <SettingOutlined />, labelKey: 'nav.settings', path: '/settings' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const fetchProjects = async () => {
    try {
      const res = await api.getProjects();
      if (res.success) {
        setProjects(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load projects for sidebar', err);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await api.getUnreadCount();
      if (res?.success) {
        setInboxBadge(res.count || 0);
      }
    } catch (err) {
      // silently fail
    }
  };

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects();
    }
    fetchUnreadCount();
  }, [location.pathname, projects.length]);

  useEffect(() => {
    const handleProjectsChanged = () => {
      fetchProjects();
    };
    const handleUnreadCountChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail !== undefined) {
        setInboxBadge(customEvent.detail.count);
      } else {
        fetchUnreadCount();
      }
    };

    window.addEventListener('projects-changed', handleProjectsChanged);
    window.addEventListener('unread-count-changed', handleUnreadCountChanged);
    return () => {
      window.removeEventListener('projects-changed', handleProjectsChanged);
      window.removeEventListener('unread-count-changed', handleUnreadCountChanged);
    };
  }, []);

  const renderNavItem = (item: NavItem) => {
    const label = t(item.labelKey as any);
    const content = (
      <div
        key={item.key}
        className={`sidebar__nav-item ${isActive(item.path) ? 'active' : ''}`}
        onClick={() => {
          if (!item.path.startsWith('/projects')) {
            setProjectsExpanded(false);
          }
          navigate(item.path);
        }}
      >
        <span className="sidebar__nav-icon">{item.icon}</span>
        <span className="sidebar__nav-label">{label}</span>
        {item.badge && <span className="sidebar__nav-badge">{item.badge}</span>}
      </div>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.key} title={label} placement="right">
          {content}
        </Tooltip>
      );
    }
    return content;
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon" style={{ width: "27px", height: "27px" }}>T</div>
        <span className="sidebar__logo-text">TaskFlow</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {/* Dashboard Section */}
        <div className="sidebar__section">
          {renderNavItem(dashboardItem)}
        </div>

        {/* Projects Section */}
        <div className="sidebar__section">
          <div
            className={`sidebar__nav-item ${isActive('/projects') ? 'active' : ''}`}
            onClick={() => navigate('/projects')}
          >
            <span className="sidebar__nav-icon"><ProjectOutlined /></span>
            <span className="sidebar__nav-label">{t('nav.projects')}</span>
            <RightOutlined
              className={`sidebar__nav-arrow ${projectsExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setProjectsExpanded(!projectsExpanded);
              }}
            />
          </div>

          {projectsExpanded && !collapsed && (
            <div className="sidebar__projects">
              {projects.map((project) => {
                const activeTasks = project.tasks?.filter((t: any) => t.status !== 'done').length || 0;
                return (
                  <div
                    key={project.id}
                    className={`sidebar__project-item ${location.pathname === `/projects/${project.id}` ? 'active' : ''}`}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <div className="sidebar__project-icon-wrapper" style={{
                      background: project.icon && project.icon.startsWith('data:image/') ? 'transparent' : project.color,
                      width: '14px',
                      height: '14px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {renderProjectIcon(project.icon, project.color, project.name, 14, { color: '#ffffff', fontSize: '7px' })}
                    </div>
                    <span className="sidebar__project-name">{project.name}</span>
                    <span className="sidebar__project-badge">{activeTasks}</span>
                  </div>
                );
              })}
              <div className="sidebar__add-project" onClick={() => navigate('/projects?create=true')}>
                <PlusOutlined style={{ fontSize: 12 }} />
                <span>{t('nav.new_project')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Nav (My Tasks, Inbox) */}
        <div className="sidebar__section">
          {mainNav.map(renderNavItem)}
        </div>

        {/* Management Nav */}
        <div className="sidebar__section">
          <div className="sidebar__section-title">{t('nav.management')}</div>
          {manageNav.map(renderNavItem)}
        </div>
      </nav>

      {/* Collapse Button */}
      <div className="sidebar__footer">
        <button
          className="sidebar__collapse-btn"
          onClick={() => onCollapse(!collapsed)}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          {!collapsed && <span>{t('nav.collapse')}</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
