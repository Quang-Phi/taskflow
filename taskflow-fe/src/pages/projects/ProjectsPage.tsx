import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Dropdown, Modal, Tooltip, message, Spin, Empty, Select, Button, Popover, Input } from 'antd';
import EditProjectModal, { EditProjectFormData } from '../../components/projects/EditProjectModal';
import CreateProjectModal from '../../components/projects/CreateProjectModal';
import {
  PlusOutlined,
  SearchOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  MoreOutlined,
  ClockCircleOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useTranslation } from '../../utils/i18n';
import ProjectIconPicker, { renderProjectIcon } from '../../components/projects/ProjectIconPicker';
import { useDeleteConfirm } from '../../components/tasks/DeleteConfirmModal';
import './ProjectsPage.scss';

interface DebouncedSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}

const DebouncedSearchInput: React.FC<DebouncedSearchInputProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  return (
    <input
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
    />
  );
};

const ProjectsPage: React.FC = () => {
  const { t, lang, locale } = useTranslation();
  const { showDeleteConfirm, DeleteConfirmComponent } = useDeleteConfirm();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalProjects, setTotalProjects] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const [me, setMe] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    description: '',
    color: '',
    icon: null as string | null,
    status: '',
    startDate: '',
    endDate: '',
  });

  const fetchMe = async () => {
    try {
      const res = await api.getMe();
      if (res) {
        setMe(res);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await api.getLocalUsers();
      if (res?.success) {
        setAllUsers(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch local users for Project creation', err);
    }
  };

  useEffect(() => {
    fetchMe();
    fetchAllUsers();
  }, []);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const fetchProjects = async (pageNum: number = 1, isReset: boolean = true) => {
    try {
      if (isReset) {
        setLoading(true);
      }
      const res = await api.getProjects({
        search: debouncedSearch.trim(),
        status: statusFilter,
        page: pageNum,
        per_page: 12,
      });
      if (res.success) {
        const fetchedData = res.data || [];
        if (isReset) {
          setProjects(fetchedData);
        } else {
          setProjects(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newItems = fetchedData.filter((p: any) => !existingIds.has(p.id));
            return [...prev, ...newItems];
          });
        }
        if (res.pagination) {
          setHasMore(res.pagination.has_more);
          setTotalProjects(res.pagination.total);
        } else {
          setHasMore(fetchedData.length === 12);
          setTotalProjects(fetchedData.length);
        }
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
      message.error(t('projects.toast.load_err'));
    } finally {
      setLoading(false);
    }
  };

  // Reset and fetch page 1 when search or status filters change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchProjects(1, true);
  }, [debouncedSearch, statusFilter]);

  // Fetch next page when page changes (if page > 1)
  useEffect(() => {
    if (page > 1) {
      fetchProjects(page, false);
    }
  }, [page]);

  // Infinite Scroll Window Listener
  useEffect(() => {
    const handleScroll = () => {
      if (loading || !hasMore) return;

      const threshold = 150; // pixels from the bottom of the page
      const totalHeight = document.documentElement.scrollHeight;
      const scrollPosition = window.innerHeight + window.scrollY;

      if (totalHeight - scrollPosition < threshold) {
        setPage(prev => prev + 1);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore]);

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);





  const handleDeleteProject = async (id: number | string) => {
    showDeleteConfirm({
      title: t('projects.confirm.delete_title'),
      content: t('projects.confirm.delete_content'),
      okText: t('projects.edit.delete_btn'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          const res = await api.deleteProject(id);
          if (res.success) {
            message.success(t('projects.toast.delete_success'));
            fetchProjects();
            window.dispatchEvent(new Event('projects-changed'));
          }
        } catch (err) {
          console.error(err);
          message.error(t('projects.toast.delete_err'));
          throw err;
        }
      }
    });
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatDeadline = (dateStr: string | null) => {
    if (!dateStr) return t('projects.no_deadline');
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getProjectStats = (p: any) => {
    const total = p.tasks?.length || 0;
    const completed = p.tasks?.filter((tItem: any) => tItem.status === 'done').length || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, progress };
  };

  const filteredProjects = projects;

  const canEditProject = (project: any) => {
    if (!me || !project) return false;
    if (me.role === 'admin') return true;
    if (project.created_by === me.id) return true;
    const isManager = project.members?.some(
      (m: any) => m.id === me.id && m.pivot?.role === 'manager'
    );
    return !!isManager;
  };

  const canDeleteProject = (project: any) => {
    if (!me || !project) return false;
    if (me.role === 'admin') return true;
    if (project.created_by === me.id) return true;
    return false;
  };

  const cardMenuItems = (project: any) => {
    const items = [];
    if (canEditProject(project)) {
      items.push({
        key: 'edit',
        icon: <EditOutlined />,
        label: t('projects.edit.title'),
        onClick: ({ domEvent }: any) => {
          domEvent.stopPropagation();
          setEditForm({
            id: project.id,
            name: project.name,
            description: project.description || '',
            color: project.color,
            icon: project.icon || null,
            status: project.status,
            startDate: project.start_date ? project.start_date.substring(0, 10) : '',
            endDate: project.end_date ? project.end_date.substring(0, 10) : '',
          });
          setShowEditModal(true);
        }
      });
    }
    if (canEditProject(project) && canDeleteProject(project)) {
      items.push({ type: 'divider' as const });
    }
    if (canDeleteProject(project)) {
      items.push({
        key: 'delete',
        icon: <DeleteOutlined />,
        label: t('projects.edit.delete_btn'),
        danger: true,
        onClick: ({ domEvent }: any) => {
          domEvent.stopPropagation();
          handleDeleteProject(project.id);
        }
      });
    }
    return items;
  };

  const getStatusLabel = (projectStatus: string) => {
    if (projectStatus === 'active') return t('projects.status.active');
    if (projectStatus === 'on-hold' || projectStatus === 'on_hold') return t('projects.status.on_hold');
    if (projectStatus === 'completed') return t('projects.status.completed');
    return t('projects.status.planning');
  };

  const renderGridView = () => (
    <div className="projects-page__grid">
      {filteredProjects.map((project) => {
        const { total, completed, progress } = getProjectStats(project);
        const projectStatus = project.status === 'on_hold' ? 'on-hold' : project.status;
        const members = project.members || [];
        return (
          <div key={project.id} className="projects-page__card" onClick={() => navigate(`/projects/${project.id}`)}>
            <div className="projects-page__card-accent" style={{ background: project.color }} />
            <div className="projects-page__card-body">
              <div className="projects-page__card-header">
                <div className="projects-page__card-title-row">
                  <div className="projects-page__card-icon" style={{
                    background: project.icon && project.icon.startsWith('data:image/') ? 'transparent' : `${project.color}20`,
                    color: project.color,
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    {renderProjectIcon(project.icon, project.color, project.name, 36)}
                  </div>
                  <div className="projects-page__card-info">
                    <div className="projects-page__card-name">{project.name}</div>
                    <div className="projects-page__card-id">#{project.id}</div>
                  </div>
                </div>
              </div>

              <div className="projects-page__card-desc">{project.description || t('projects.no_desc')}</div>

              <div className="projects-page__card-progress">
                <div className="projects-page__card-progress-header">
                  <span>{t('projects.progress')}</span>
                  <span>{progress}%</span>
                </div>
                <div className="projects-page__card-progress-bar">
                  <div className="projects-page__card-progress-bar-fill"
                    style={{ width: `${progress}%`, background: project.color }} />
                </div>
              </div>

              <div className="projects-page__card-footer">
                <div className="projects-page__card-members">
                  {members.slice(0, 3).map((m: any, i: number) => (
                    <div key={i} className="member-avatar" style={{ background: project.color }}>
                      {m.photo ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : getInitials(m.name)}
                    </div>
                  ))}
                  {members.length > 3 && (
                    <div className="member-more">+{members.length - 3}</div>
                  )}
                </div>
                <div className="projects-page__card-meta">
                  <span className="projects-page__card-meta-item">
                    <CheckSquareOutlined /> {completed}/{total}
                  </span>
                  <span className="projects-page__card-meta-item">
                    <ClockCircleOutlined />{' '}
                    {project.end_date ? (
                      formatDeadline(project.end_date)
                    ) : (
                      <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        {t('projects.no_deadline')}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
            {canEditProject(project) && (
              <div className="projects-page__card-actions" onClick={(e) => e.stopPropagation()}>
                <Tooltip title={t('projects.edit.title')}>
                  <button className="projects-page__card-action-btn edit-btn" onClick={() => {
                    setEditForm({
                      id: project.id,
                      name: project.name,
                      description: project.description || '',
                      color: project.color,
                      icon: project.icon || null,
                      status: project.status,
                      startDate: project.start_date ? project.start_date.substring(0, 10) : '',
                      endDate: project.end_date ? project.end_date.substring(0, 10) : '',
                    });
                    setShowEditModal(true);
                  }}><EditOutlined /></button>
                </Tooltip>
              </div>
            )}
            <span className={`projects-page__card-status projects-page__card-status--${projectStatus}`}>
              {getStatusLabel(projectStatus)}
            </span>
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="projects-page__list">
      <div className="projects-page__list-header">
        <span>{t('projects.title')}</span>
        <span>{t('projects.progress')}</span>
        <span>{t('projects.edit.status')}</span>
        <span>{t('members.table.member')}</span>
        <span>{t('eval.drawer.table.deadline')}</span>
        <span></span>
      </div>
      {filteredProjects.map((project) => {
        const { total, completed, progress } = getProjectStats(project);
        const projectStatus = project.status === 'on_hold' ? 'on-hold' : project.status;
        const members = project.members || [];
        return (
          <div key={project.id} className="projects-page__list-row" onClick={() => navigate(`/projects/${project.id}`)}>
            <div className="projects-page__list-name">
              <div className="projects-page__list-icon-wrapper" style={{
                background: project.icon && project.icon.startsWith('data:image/') ? 'transparent' : project.color,
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                {renderProjectIcon(project.icon, project.color, project.name, 24, { color: '#ffffff', fontSize: '11px' })}
              </div>
              <span className="name">{project.name}</span>
              <span className="id-text">#{project.id}</span>
            </div>
            <div className="projects-page__list-progress">
              <div className="projects-page__list-progress-bar">
                <div className="projects-page__list-progress-bar-fill"
                  style={{ width: `${progress}%`, background: project.color }} />
              </div>
              <span className="projects-page__list-progress-text">{progress}%</span>
            </div>
            <div className="projects-page__list-status">
              <span className={projectStatus}>{getStatusLabel(projectStatus)}</span>
            </div>
            <div className="projects-page__list-members">
              {members.slice(0, 4).map((m: any, i: number) => (
                <div key={i} className="member-avatar" style={{ background: project.color }}>
                  {m.photo ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : getInitials(m.name)}
                </div>
              ))}
              {members.length > 4 && (
                <div className="member-more">+{members.length - 4}</div>
              )}
            </div>
            <div className="projects-page__list-deadline">
              {project.end_date ? (
                formatDeadline(project.end_date)
              ) : (
                <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                  {t('projects.no_deadline')}
                </span>
              )}
            </div>
            {(canEditProject(project) || canDeleteProject(project)) && (
              <div className="projects-page__list-actions" onClick={(e) => e.stopPropagation()}>
                <Dropdown menu={{ items: cardMenuItems(project) }} trigger={['click']} placement="bottomRight">
                  <button><MoreOutlined /></button>
                </Dropdown>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (loading && projects.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" description={t('projects.loading')} />
      </div>
    );
  }

  return (
    <div className="projects-page">
      {/* Header */}
      <div className="projects-page__header">
        <div className="projects-page__header-left">
          <h1>{t('projects.title')}</h1>
          <p>{t('projects.subtitle', { count: totalProjects })}</p>
        </div>
        <div className="projects-page__header-right">
          <button className="projects-page__create-btn" onClick={() => setShowCreateModal(true)}>
            <PlusOutlined /> {t('projects.create_btn')}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="projects-page__toolbar">
        <div className="projects-page__search">
          <SearchOutlined className="projects-page__search-icon" />
          <DebouncedSearchInput placeholder={t('projects.search_placeholder')} value={searchText} onChange={setSearchText} />
        </div>
        <div className="projects-page__filters">
          {[
            { key: 'all', label: t('projects.filter.all') },
            { key: 'active', label: t('projects.filter.active') },
            { key: 'on-hold', label: t('projects.filter.on_hold') },
            { key: 'completed', label: t('projects.filter.completed') }
          ].map((item) => (
            <button key={item.key}
              className={`projects-page__filter-btn ${statusFilter === item.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(item.key)}>
              {item.label}
            </button>
          ))}
          <div className="projects-page__view-toggle">
            <Tooltip title={t('projects.view.grid')}>
              <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}>
                <AppstoreOutlined />
              </button>
            </Tooltip>
            <Tooltip title={t('projects.view.list')}>
              <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
                <UnorderedListOutlined />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredProjects.length === 0 ? (
        <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--divider)' }}>
          {loading ? <Spin size="large" description={t('projects.loading')} /> : <Empty description={t('projects.empty')} />}
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {loading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(1px)',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px'
            }}>
              <Spin size="large" />
            </div>
          )}
          {viewMode === 'grid' ? renderGridView() : renderListView()}
          {loading && page > 1 && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spin size="default" description={t('projects.loading_more')} />
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchProjects}
          allUsers={allUsers}
        />
      )}

      {/* Shared Edit Project Modal */}
      {showEditModal && (
        <EditProjectModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          project={editForm as EditProjectFormData}
          onSaved={() => fetchProjects()}
          onDeleted={() => fetchProjects()}
        />
      )}
      <DeleteConfirmComponent />
    </div>
  );
};

export default ProjectsPage;
