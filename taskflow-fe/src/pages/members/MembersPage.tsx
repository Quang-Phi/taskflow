import React, { useState, useEffect } from 'react';
import { Dropdown, Modal, Select, Spin, message, Pagination, Tooltip, Empty } from 'antd';
import { SearchOutlined, PlusOutlined, MoreOutlined, CloseOutlined, MailOutlined, PhoneOutlined, CalendarOutlined, EditOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useTranslation } from '../../utils/i18n';
import { useSearchParams } from 'react-router-dom';
import './MembersPage.scss';

interface Member {
  id: string | number;
  local_id: number | null;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  photo: string | null;
  department_ids: (string | number)[];
  active: boolean;
  work_position: string;
  role: 'admin' | 'manager' | 'employee';
}

interface Department {
  id: string | number;
  name: string;
  parent_id: string | number | null;
  head_user_id: string | number | null;
  sort: number;
}

const statusColors: Record<string, string> = { backlog: '#6b7084', todo: '#9ca0b0', 'in-progress': '#3b82f6', 'in-review': '#a855f7', done: '#22c55e' };

const MembersPage: React.FC = () => {
  const { t, lang, locale } = useTranslation();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');

  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  // Profile Drawer state
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [drawerTab, setDrawerTab] = useState('tasks');
  const [memberTasks, setMemberTasks] = useState<any[]>([]);
  const [memberTasksLoading, setMemberTasksLoading] = useState(false);
  const [memberEvaluations, setMemberEvaluations] = useState<any[]>([]);
  const [memberEvaluationsLoading, setMemberEvaluationsLoading] = useState(false);
  const [memberTaskCounts, setMemberTaskCounts] = useState<Record<string, { done: number; total: number }>>({});

  // Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [editDepts, setEditDepts] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const savedLimit = localStorage.getItem('taskflow_members_limit');
    return savedLimit ? parseInt(savedLimit, 10) : 10;
  });
  const [total, setTotal] = useState(0);

  const isAdmin = currentUser?.role === 'admin';
  const isSuperAdmin = currentUser && Number(currentUser.id) === 632;


  const getRating = (score: number, t: any) => {
    if (score >= 9) return { emoji: '⭐', label: t('eval.rating.excellent'), color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
    if (score >= 7) return { emoji: '✅', label: t('eval.rating.good'), color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
    if (score >= 5) return { emoji: '🔵', label: t('eval.rating.fair'), color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
    if (score >= 3) return { emoji: '🟡', label: t('eval.rating.average'), color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
    return { emoji: '🔴', label: t('eval.rating.poor'), color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
  };

  const fetchMemberTasks = async (member: Member) => {
    try {
      setMemberTasksLoading(true);
      const localId = member.local_id;
      if (!localId) {
        setMemberTasks([]);
        return;
      }
      const res = await api.getTasks({ assignee_id: localId });
      if (res.success) {
        setMemberTasks(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch member tasks', err);
      setMemberTasks([]);
    } finally {
      setMemberTasksLoading(false);
    }
  };

  const fetchMemberEvaluations = async (member: Member) => {
    try {
      setMemberEvaluationsLoading(true);
      const localId = member.local_id;
      if (!localId) {
        setMemberEvaluations([]);
        return;
      }
      const res = await api.getEvaluations({ employee_id: localId, status: 'published' });
      if (res.success) {
        setMemberEvaluations(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch member evaluations', err);
      setMemberEvaluations([]);
    } finally {
      setMemberEvaluationsLoading(false);
    }
  };

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    setDrawerTab('tasks');
    fetchMemberTasks(member);
    fetchMemberEvaluations(member);
  };

  // Debounce search value
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter, deptFilter]);

  // Load metadata on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        const [meRes, deptsRes] = await Promise.all([
          api.getMe(),
          api.getDepartments(),
        ]);

        if (meRes) {
          setCurrentUser(meRes);
        }
        if (deptsRes.success) {
          setDepartments(deptsRes.data);
        }
      } catch (err: any) {
        message.error(t('members.toast.meta_err') + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    const userId = searchParams.get('user_id');
    if (userId) {
      api.getUser(parseInt(userId, 10))
        .then((res) => {
          if (res && res.success && res.data) {
            handleSelectMember(res.data);
          }
        })
        .catch(console.error);
    }
  }, [searchParams]);

  // Fetch paginated members list
  const fetchMembers = async () => {
    try {
      setMembersLoading(true);
      const res = await api.getUsers({
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch.trim(),
        role: roleFilter,
        department_id: deptFilter,
        scope: 'managed',
      });
      if (res.success) {
        setMembers(res.data);
        setTotal(res.meta?.total ?? 0);

        // Fetch task counts for each member
        const counts: Record<string, { done: number; total: number }> = {};
        await Promise.all(
          (res.data || []).map(async (m: Member) => {
            try {
              const localId = m.local_id;
              if (!localId) {
                counts[String(m.id)] = { total: 0, done: 0 };
                return;
              }
              const taskRes = await api.getTasks({ assignee_id: localId });
              if (taskRes.success) {
                const tasks = taskRes.data || [];
                counts[String(m.id)] = {
                  total: tasks.length,
                  done: tasks.filter((t: any) => t.status === 'done').length,
                };
              }
            } catch {
              counts[String(m.id)] = { total: 0, done: 0 };
            }
          })
        );
        setMemberTaskCounts(prev => ({ ...prev, ...counts }));
      }
    } catch (err: any) {
      message.error(t('members.toast.fetch_err') + (err.response?.data?.message || err.message));
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      fetchMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, roleFilter, deptFilter, loading]);

  const handleOpenEdit = (member: Member, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingMember(member);
    setEditRole(member.role);
    setEditDepts(member.department_ids.map(Number));
    setIsEditModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingMember) return;
    try {
      setSaving(true);
      const res = await api.updateUser(Number(editingMember.id), {
        role: editRole === 'admin' ? 'admin' : 'employee',
      });

      if (res.success) {
        message.success(t('members.toast.save_success'));

        const updatedRole = res.data?.role || editRole;
        // Update local state
        setMembers((prev) =>
          prev.map((m) =>
            Number(m.id) === Number(editingMember.id)
              ? { ...m, role: updatedRole }
              : m
          )
        );

        if (selectedMember && Number(selectedMember.id) === Number(editingMember.id)) {
          setSelectedMember((prev) => prev ? { ...prev, role: updatedRole } : null);
        }

        setIsEditModalOpen(false);
        setEditingMember(null);
      }
    } catch (err: any) {
      message.error(t('members.toast.save_err') + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const renderAvatar = (member: Member, size: number = 36) => {
    if (member.photo) {
      return (
        <img
          src={member.photo}
          alt={member.name}
          className="avatar-img"
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
        />
      );
    }

    const initials = member.name
      ? member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
      : 'U';

    const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#3b82f6'];
    const charCodeSum = member.name ? member.name.split('').reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0) : 0;
    const color = colors[charCodeSum % colors.length];

    return (
      <div
        className="avatar"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          color: '#fff',
          fontSize: size > 40 ? '16px' : '12px'
        }}
      >
        {initials}
      </div>
    );
  };

  const renderDepartmentTags = (deptIds: any) => {
    const ids = Array.isArray(deptIds) ? deptIds.map(Number) : [];
    if (ids.length === 0) return <span className="dept-tag none">{t('members.dept.none')}</span>;

    // Resolve all department names
    const resolvedDepts = ids.map(id => {
      const d = departments.find((dept) => Number(dept.id) === id);
      return d ? d.name : t('members.dept.id_fallback', { id });
    });

    const visibleIds = ids.slice(0, 2);
    const hiddenDepts = resolvedDepts.slice(2);

    return (
      <div className="dept-tags-container">
        {visibleIds.map((id: number, idx: number) => (
          <span key={id} className="dept-tag" title={resolvedDepts[idx]}>
            <span className="dept-dot" style={{ background: '#6366f1' }} />
            <span className="dept-name-text">{resolvedDepts[idx]}</span>
          </span>
        ))}
        {ids.length > 2 && (
          <Tooltip title={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {hiddenDepts.map((name, i) => (
                <div key={i} style={{ fontSize: '12px' }}>• {name}</div>
              ))}
            </div>
          }>
            <span className="dept-tag more" style={{ cursor: 'pointer' }}>+{ids.length - 2}</span>
          </Tooltip>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="members-page-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" description={t('members.loading.meta')} />
      </div>
    );
  }

  const resolvedRole = (role: string) => {
    if (role === 'admin') return t('members.filter.admin');
    if (role === 'manager') return t('members.filter.manager');
    return t('members.filter.employee');
  };

  return (
    <div className="members-page">
      <div className="members-page__header">
        <div>
          <h1>{t('members.title')}</h1>
          <p>{t('members.sub_title', { count: total })}</p>
        </div>
      </div>

      <div className="members-page__toolbar">
        <div className="members-page__search">
          <SearchOutlined className="icon" />
          <input placeholder={t('members.search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button className="clear-btn" onClick={() => setSearch('')} title="Clear">
              <CloseOutlined />
            </button>
          )}
        </div>
        <div className="members-page__filters">
          {/* Department Filter */}
          <select className="members-page__filter-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="all">{t('members.filter.dept_all')}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Role Filter */}
          <select className="members-page__filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">{t('members.filter.role_all')}</option>
            <option value="admin">{t('members.filter.admin')}</option>
            <option value="manager">{t('members.filter.manager')}</option>
            <option value="employee">{t('members.filter.employee')}</option>
          </select>
        </div>
      </div>

      <div className="members-page__table">
        <div className="members-page__table-header">
          <span>{t('members.table.member')}</span>
          <span>{t('members.table.dept')}</span>
          <span>{t('members.table.role')}</span>
          <span>{t('members.table.tasks')}</span>
          <span>{t('members.table.status')}</span>
          <span></span>
        </div>
        {membersLoading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Spin size="large" description={t('members.loading.data')} />
          </div>
        ) : members.length === 0 ? (
          <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center', background: 'var(--bg-card)', borderRadius: '8px' }}>
            <Empty description={t('members.empty')} />
          </div>
        ) : (
          members.map((m) => (
            <div key={m.id} className="members-page__table-row" onClick={() => handleSelectMember(m)}>
              <div className="members-page__member-info">
                {renderAvatar(m, 36)}
                <div className="info">
                  <div className="name">{m.name}</div>
                  <div className="email">{m.email || t('members.drawer.no_email')}</div>
                </div>
              </div>
              <div className="members-page__department">
                {renderDepartmentTags(m.department_ids)}
              </div>
              <div className="members-page__role">
                <span className={m.role}>
                  {resolvedRole(m.role)}
                </span>
              </div>
              <div className="members-page__tasks-count">
                {(() => {
                  const tc = memberTaskCounts[String(m.id)];
                  const total = tc?.total ?? 0;
                  const done = tc?.done ?? 0;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (<>
                    <div className="bar"><div className="bar-fill" style={{ width: `${pct}%`, background: '#6366f1' }} /></div>
                    <span className="count">{done}/{total}</span>
                  </>);
                })()}
              </div>
              <div className="members-page__status">
                <span className={m.active ? 'active' : 'inactive'}>
                  <span className="dot" />
                  {m.active ? t('members.status.active') : t('members.status.inactive')}
                </span>
              </div>
              <div className="members-page__row-actions" onClick={(e) => e.stopPropagation()}>
                <Dropdown
                  menu={{
                    items: [
                      { key: 'view', label: t('members.action.view'), onClick: () => handleSelectMember(m) },
                      ...(isSuperAdmin && Number(m.id) !== 632 ? [
                        { key: 'edit', label: t('members.action.edit' as any || 'Edit'), onClick: (info: any) => handleOpenEdit(m, info.domEvent) }
                      ] : [])
                    ]
                  }}
                  trigger={['click']}
                >
                  <button><MoreOutlined /></button>
                </Dropdown>
              </div>
            </div>
          ))
        )}

        {!membersLoading && total > 0 && (
          <div className="members-page__pagination" style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px', borderTop: '1px solid var(--divider)' }}>
            <Pagination
              total={total}
              current={currentPage}
              pageSize={pageSize}
              onChange={(page, size) => {
                setCurrentPage(page);
                if (size !== pageSize) {
                  setPageSize(size);
                  localStorage.setItem('taskflow_members_limit', String(size));
                }
              }}
              showSizeChanger
              pageSizeOptions={['10', '20', '50', '100']}
              showTotal={(totalCount, range) => t('members.pagination.total', { range: `${range[0]}-${range[1]}`, total: totalCount })}
            />
          </div>
        )}
      </div>

      {/* Selected Member Detail Drawer */}
      {selectedMember && (
        <>
          <div className="members-page__backdrop" onClick={() => setSelectedMember(null)} />
          <div className="members-page__drawer">
            <div className="members-page__drawer-header">
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('members.drawer.title')}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {isSuperAdmin && Number(selectedMember.id) !== 632 && (
                  <button
                    className="edit-btn-header"
                    style={{
                      background: 'var(--primary-color)',
                      color: '#fff',
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 500
                    }}
                    onClick={(e) => handleOpenEdit(selectedMember, e)}
                  >
                    <EditOutlined /> {t('members.action.edit' as any || 'Edit')}
                  </button>
                )}
                <button className="close-btn" onClick={() => setSelectedMember(null)}><CloseOutlined /></button>
              </div>
            </div>
            <div className="members-page__drawer-profile">
              {renderAvatar(selectedMember, 64)}
              <div className="info">
                <h2>{selectedMember.name}</h2>
                <div className="email">{selectedMember.email || t('members.drawer.no_email')}</div>
                <div className="meta">
                  <span><MailOutlined /> {selectedMember.email || t('members.drawer.no_email')}</span>
                  <span><PhoneOutlined /> {selectedMember.phone || t('members.drawer.no_phone')}</span>
                  <span><CalendarOutlined /> {t('members.drawer.joined')}</span>
                </div>
              </div>
            </div>

            <div className="members-page__drawer-stats">
              {(() => {
                const totalTasks = memberTasks.length;
                const activeTasks = memberTasks.filter(t => t.status !== 'done').length;
                const doneTasks = memberTasks.filter(t => t.status === 'done').length;
                const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                return (<>
                  <div className="stat-card"><div className="value">{totalTasks}</div><div className="label">{t('members.drawer.total_tasks')}</div></div>
                  <div className="stat-card"><div className="value">{activeTasks}</div><div className="label">{t('members.drawer.active_tasks')}</div></div>
                  <div className="stat-card"><div className="value" style={{ color: '#22c55e' }}>{completionPct}%</div><div className="label">{t('members.drawer.on_time')}</div></div>
                  <div className="stat-card"><div className="value" style={{ color: '#f59e0b' }}>{doneTasks}</div><div className="label">{t('members.drawer.done_tasks' as any)}</div></div>
                </>);
              })()}
            </div>

            <div className="members-page__drawer-tabs">
              <div className={`tab ${drawerTab === 'tasks' ? 'active' : ''}`} onClick={() => setDrawerTab('tasks')}>
                {t('members.drawer.tab.tasks')}
              </div>
              <div className={`tab ${drawerTab === 'evaluations' ? 'active' : ''}`} onClick={() => setDrawerTab('evaluations')}>
                {t('members.drawer.tab.evals')}
              </div>
            </div>
            <div className="members-page__drawer-content">
              {drawerTab === 'tasks' && (
                memberTasksLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}><Spin /></div>
                ) : memberTasks.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={t('members.drawer.no_tasks' as any)} /></div>
                ) : (
                  memberTasks.map((tItem, i) => {
                    const statusKey = (tItem.status || '').replace('_', '-');
                    const dueDate = tItem.due_date ? new Date(tItem.due_date).toLocaleDateString(locale, { day: '2-digit', month: 'short' }) : '';
                    return (
                      <div key={tItem.id || i} className="members-page__task-list-item">
                        <div className="left">
                          <span className="status-dot" style={{ background: statusColors[statusKey] || '#6b7084' }} />
                          <span className="task-name">{tItem.title}</span>
                        </div>
                        <div className="right">
                          <span className="project-tag">{tItem.project?.name || ''}</span>
                          <span className="date">{dueDate}</span>
                        </div>
                      </div>
                    );
                  })
                )
              )}
              {drawerTab === 'evaluations' && (
                memberEvaluationsLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}><Spin /></div>
                ) : memberEvaluations.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={t('members.drawer.no_evaluations')} /></div>
                ) : (
                  memberEvaluations.map((ev, i) => {
                    const rating = getRating(ev.total_score, t);
                    const formattedDate = ev.published_at ? new Date(ev.published_at).toLocaleDateString(locale, { month: 'short', year: 'numeric' }) : '';
                    return (
                      <div key={ev.id || i} className="members-page__eval-item">
                        <div className="left">
                          <div className="period">{ev.period}</div>
                          <div className="date">{formattedDate}</div>
                        </div>
                        <div className="right">
                          <span className="score" style={{ color: rating.color }}>{ev.total_score}/10</span>
                          <span className="rating" style={{ background: rating.bg, color: rating.color }}>
                            {rating.emoji} {rating.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit Role Modal */}
      {editingMember && (
        <Modal
          title={
            <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
              {t('members.modal.title', { name: editingMember.name })}
            </div>
          }
          open={isEditModalOpen}
          onOk={handleSaveUser}
          onCancel={() => { setIsEditModalOpen(false); setEditingMember(null); }}
          confirmLoading={saving}
          okText={t('members.modal.save')}
          cancelText={t('members.modal.cancel')}
          className="dark-theme-modal"
          styles={{
            body: { background: 'var(--bg-modal)', color: 'var(--text-primary)', padding: '20px 0' },
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* App Role Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('members.modal.role_label')}
              </label>
              <Select
                value={editRole === 'admin' ? 'admin' : 'employee'}
                onChange={(val) => setEditRole(val as any)}
                style={{ width: '100%' }}
                options={[
                  { value: 'admin', label: t('members.modal.role.admin') },
                  { value: 'employee', label: t('members.modal.role.employee') },
                ]}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {t('members.modal.role_note')}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MembersPage;
