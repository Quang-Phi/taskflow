import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Dropdown, Modal, Tooltip, message, Spin, Empty, Select, Button, Popconfirm } from 'antd';
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
} from '@ant-design/icons';
import { useTranslation } from '../../utils/i18n';
import './ProjectsPage.scss';

const colorOptions = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

const ProjectsPage: React.FC = () => {
  const { t, lang } = useTranslation();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    status: 'active',
    startDate: '',
    endDate: '',
  });

  const [me, setMe] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    description: '',
    color: '',
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

  useEffect(() => {
    fetchMe();
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
        } else {
          setHasMore(fetchedData.length === 12);
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

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      message.error(t('projects.toast.required_name'));
      return;
    }
    if (newProject.startDate && newProject.endDate) {
      if (new Date(newProject.endDate) < new Date(newProject.startDate)) {
        message.error(t('projects.toast.date_err'));
        return;
      }
    }

    try {
      const res = await api.createProject({
        name: newProject.name,
        description: newProject.description,
        color: newProject.color,
        status: newProject.status as any,
        start_date: newProject.startDate || undefined,
        end_date: newProject.endDate || undefined,
      });
      if (res.success) {
        message.success(t('projects.toast.create_success', { name: newProject.name }));
        setShowCreateModal(false);
        setNewProject({ name: '', description: '', color: '#6366f1', status: 'active', startDate: '', endDate: '' });
        fetchProjects();
        window.dispatchEvent(new Event('projects-changed'));
      }
    } catch (err) {
      console.error(err);
      message.error(t('projects.toast.create_err'));
    }
  };

  const handleUpdateProject = async () => {
    if (!editForm.name.trim()) {
      message.error(t('projects.toast.required_name'));
      return;
    }
    if (editForm.startDate && editForm.endDate) {
      if (new Date(editForm.endDate) < new Date(editForm.startDate)) {
        message.error(t('projects.toast.date_err'));
        return;
      }
    }
    try {
      const res = await api.updateProject(editForm.id, {
        name: editForm.name,
        description: editForm.description,
        color: editForm.color,
        status: editForm.status,
        start_date: editForm.startDate || null,
        end_date: editForm.endDate || null,
      });
      if (res.success) {
        message.success(t('projects.toast.update_success', { name: editForm.name }));
        setShowEditModal(false);
        fetchProjects();
        window.dispatchEvent(new Event('projects-changed'));
      }
    } catch (err) {
      console.error(err);
      message.error(t('projects.toast.update_err'));
    }
  };

  const handleDeleteProject = async (id: number | string) => {
    Modal.confirm({
      title: t('projects.confirm.delete_title'),
      content: t('projects.confirm.delete_content'),
      okText: t('projects.edit.delete_btn'),
      okType: 'danger',
      cancelText: lang === 'vi' ? 'Hủy' : 'Cancel',
      onOk: async () => {
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
    return date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
                  <div className="projects-page__card-icon" style={{ background: `${project.color}20`, color: project.color }}>
                    {project.name.charAt(0)}
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
                    <ClockCircleOutlined /> {formatDeadline(project.end_date)}
                  </span>
                </div>
              </div>
            </div>
            {(canEditProject(project) || canDeleteProject(project)) && (
              <div className="projects-page__card-actions" onClick={(e) => e.stopPropagation()}>
                {canEditProject(project) && (
                  <Tooltip title={t('projects.edit.title')}>
                    <button className="projects-page__card-action-btn edit-btn" onClick={() => {
                      setEditForm({
                        id: project.id,
                        name: project.name,
                        description: project.description || '',
                        color: project.color,
                        status: project.status,
                        startDate: project.start_date ? project.start_date.substring(0, 10) : '',
                        endDate: project.end_date ? project.end_date.substring(0, 10) : '',
                      });
                      setShowEditModal(true);
                    }}><EditOutlined /></button>
                  </Tooltip>
                )}
                {canDeleteProject(project) && (
                  <Tooltip title={t('projects.edit.delete_btn')}>
                    <button className="projects-page__card-action-btn delete-btn" onClick={() => handleDeleteProject(project.id)}><DeleteOutlined /></button>
                  </Tooltip>
                )}
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
              <span className="dot" style={{ background: project.color }} />
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
            <div className="projects-page__list-deadline">{formatDeadline(project.end_date)}</div>
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" tip={lang === 'vi' ? 'Đang tải danh sách dự án...' : 'Loading projects...'} />
      </div>
    );
  }

  return (
    <div className="projects-page">
      {/* Header */}
      <div className="projects-page__header">
        <div className="projects-page__header-left">
          <h1>{t('projects.title')}</h1>
          <p>{t('projects.subtitle', { count: filteredProjects.length })}</p>
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
          <input placeholder={t('projects.search_placeholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
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
          <Empty description={t('projects.empty')} />
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? renderGridView() : renderListView()}
          {loading && page > 1 && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spin size="default" tip={lang === 'vi' ? 'Đang tải thêm...' : 'Loading more...'} />
            </div>
          )}
        </>
      )}

      {/* Create Project Modal */}
      <Modal open={showCreateModal} onCancel={() => setShowCreateModal(false)} footer={null} width={560} closable={false} className="create-project-modal">
        <div className="create-project-modal__header">
          <h2>{t('projects.create.title')}</h2>
          <button className="close-btn" onClick={() => setShowCreateModal(false)}><CloseOutlined /></button>
        </div>
        <div className="create-project-modal__body">
          <div className="create-project-modal__field">
            <label>{t('projects.create.color')}</label>
            <div className="create-project-modal__color-picker">
              {colorOptions.map((c) => (
                <div key={c} className={`color-option ${newProject.color === c ? 'selected' : ''}`}
                  style={{ background: c }} onClick={() => setNewProject({ ...newProject, color: c })} />
              ))}
            </div>
          </div>
          <div className="create-project-modal__field">
            <label>{t('projects.create.name')} <span className="required">*</span></label>
            <input placeholder={t('projects.create.name_placeholder')} value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} />
          </div>
          <div className="create-project-modal__field">
            <label>{t('projects.create.desc')}</label>
            <textarea placeholder={t('projects.create.desc_placeholder')} value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} />
          </div>
          <div className="create-project-modal__row">
            <div className="create-project-modal__field">
              <label>{t('projects.create.start_date')}</label>
              <input type="date" value={newProject.startDate}
                onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })} />
            </div>
            <div className="create-project-modal__field">
              <label>{t('projects.create.end_date')}</label>
              <input type="date" value={newProject.endDate}
                onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="create-project-modal__footer">
          <button className="cancel-btn" onClick={() => setShowCreateModal(false)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</button>
          <button className="submit-btn" onClick={handleCreateProject} disabled={!newProject.name.trim()}>{t('projects.create_btn')}</button>
        </div>
      </Modal>

      {/* Local Edit Project Modal */}
      <Modal open={showEditModal} onCancel={() => setShowEditModal(false)} footer={null} width={560} closable={false} className="create-project-modal">
        <div className="create-project-modal__header">
          <h2>{t('projects.edit.title')}</h2>
          <button className="close-btn" onClick={() => setShowEditModal(false)}><CloseOutlined /></button>
        </div>
        <div className="create-project-modal__body">
          <div className="create-project-modal__field">
            <label>{t('projects.create.color')}</label>
            <div className="create-project-modal__color-picker">
              {colorOptions.map((c) => (
                <div key={c} className={`color-option ${editForm.color === c ? 'selected' : ''}`}
                  style={{ background: c }} onClick={() => setEditForm({ ...editForm, color: c })} />
              ))}
            </div>
          </div>
          <div className="create-project-modal__field">
            <label>{t('projects.create.name')} <span className="required">*</span></label>
            <input placeholder={t('projects.create.name_placeholder')} value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="create-project-modal__field">
            <label>{t('projects.create.desc')}</label>
            <textarea placeholder={t('projects.create.desc_placeholder')} value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </div>
          <div className="create-project-modal__row">
            <div className="create-project-modal__field">
              <label>{t('projects.create.start_date')}</label>
              <input type="date" value={editForm.startDate}
                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
            </div>
            <div className="create-project-modal__field">
              <label>{t('projects.create.end_date')}</label>
              <input type="date" value={editForm.endDate}
                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
            </div>
          </div>
          <div className="create-project-modal__field">
            <label>{t('projects.edit.status')}</label>
            <Select
              style={{ width: '100%' }}
              value={editForm.status}
              onChange={(val) => setEditForm({ ...editForm, status: val })}
            >
              <Select.Option value="planning">{t('projects.status.planning')}</Select.Option>
              <Select.Option value="active">{t('projects.status.active')}</Select.Option>
              <Select.Option value="on_hold">{t('projects.status.on_hold')}</Select.Option>
              <Select.Option value="completed">{t('projects.status.completed')}</Select.Option>
            </Select>
          </div>

          <div style={{ borderTop: '1px solid var(--divider)', paddingTop: '16px', marginTop: '16px' }}>
            <h4 style={{ color: '#ef4444', margin: '0 0 8px 0', fontSize: '14px' }}>{t('projects.edit.danger_zone')}</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 12px 0' }}>{t('projects.edit.danger_desc')}</p>
            <Popconfirm
              title={t('projects.edit.delete_btn')}
              description={t('projects.confirm.delete_title')}
              onConfirm={async () => {
                const res = await api.deleteProject(editForm.id);
                if (res.success) {
                  message.success(t('projects.toast.delete_success'));
                  setShowEditModal(false);
                  fetchProjects();
                  window.dispatchEvent(new Event('projects-changed'));
                }
              }}
              okText={lang === 'vi' ? 'Xóa' : 'Delete'}
              cancelText={lang === 'vi' ? 'Hủy' : 'Cancel'}
              okType="danger"
            >
              <Button type="primary" danger>{t('projects.edit.delete_btn')}</Button>
            </Popconfirm>
          </div>
        </div>
        <div className="create-project-modal__footer">
          <button className="cancel-btn" onClick={() => setShowEditModal(false)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</button>
          <button className="submit-btn" onClick={handleUpdateProject} disabled={!editForm.name.trim()}>{lang === 'vi' ? 'Lưu thay đổi' : 'Save Changes'}</button>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
