import React, { useRef, useEffect } from 'react';
import { Select, Button, Input, Divider, Tooltip, message } from 'antd';
import { CloseOutlined, DeleteOutlined, InfoCircleOutlined, PlusOutlined, ThunderboltOutlined, LockOutlined, CheckCircleOutlined, UserOutlined, EditOutlined, ArrowRightOutlined, ArrowLeftOutlined } from '@ant-design/icons';

interface Status {
  id: string;
  name: string;
  color: string;
  type?: 'not_started' | 'active' | 'closed' | 'done';
}

interface Member {
  id: string | number;
  name: string;
  photo?: string;
  email?: string;
}

interface Transition {
  id: string;
  name: string;
  from: string;
  to: string;
  allowed_roles: string[];
  rules?: any[];
}

interface GlobalTransition {
  id: string;
  name: string;
  to: string;
  allowed_roles: string[];
  rules?: any[];
}

interface WorkflowSidebarProps {
  selectedNodeId: string | null;
  selectedTransitionId: string | null;
  lastSelectedNodeId?: string | null;
  statuses: Status[];
  members?: Member[];
  projectLabels?: any[];
  transitions: Transition[];
  globalTransitions: GlobalTransition[];
  initialStatusId: string;
  setInitialStatusId: (id: string) => void;
  onUpdateTransition: (id: string, updated: Partial<Transition>) => void;
  onDeleteTransition: (id: string, silent?: boolean) => void;
  onUpdateGlobalTransition: (id: string, updated: Partial<GlobalTransition>) => void;
  onDeleteGlobalTransition: (id: string, silent?: boolean) => void;
  onAddTransitionClick: (fromId: string) => void;
  onAddGlobalTransition: (toId: string) => void;
  onOpenRulesModal: (transitionId: string, isGlobal: boolean, ruleIndex?: number | null) => void;
  onDeleteRule: (transitionId: string, ruleIndex: number, isGlobal: boolean) => void;
  onClose: () => void;
  t: (key: string, options?: any) => string;
  onSelectNode: (id: string | null) => void;
  onSelectTransition: (id: string | null, fromCanvas?: boolean) => void;
}

export const WorkflowSidebar: React.FC<WorkflowSidebarProps> = ({
  selectedNodeId,
  selectedTransitionId,
  lastSelectedNodeId,
  statuses,
  members = [],
  projectLabels = [],
  transitions,
  globalTransitions,
  initialStatusId,
  setInitialStatusId,
  onUpdateTransition,
  onDeleteTransition,
  onUpdateGlobalTransition,
  onDeleteGlobalTransition,
  onAddTransitionClick,
  onAddGlobalTransition,
  onOpenRulesModal,
  onDeleteRule,
  onClose,
  t,
  onSelectNode,
  onSelectTransition
}) => {
  // Find selected status
  const selectedStatus = statuses.find(s => s.id === selectedNodeId);

  // Find selected transition
  const selectedTransition = transitions.find(t => t.id === selectedTransitionId);
  const selectedGlobalTransition = globalTransitions.find(gt => gt.id === selectedTransitionId);

  const nameInputRef = useRef<any>(null);

  useEffect(() => {
    if (selectedTransition && nameInputRef.current) {
      setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
          if (nameInputRef.current.select) {
            nameInputRef.current.select();
          }
        }
      }, 50);
    }
  }, [selectedTransition?.id]);

  const getCategoryLabel = (type?: string) => {
    switch (type) {
      case 'not_started':
        return t('projects.status.group_not_started');
      case 'closed':
        return t('projects.status.group_closed');
      default:
        return t('projects.status.group_active');
    }
  };

  const getCategoryColor = (type?: string) => {
    switch (type) {
      case 'not_started':
        return '#94a3b8';
      case 'closed':
        return '#22c55e';
      default:
        return '#3b82f6';
    }
  };

  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getFieldNameLabel = (field: string) => {
    switch (field) {
      case 'priority': return t('tasks.group.priority') || 'Độ ưu tiên';
      case 'assignee_id': return t('tasks.panel.assignee') || 'Người thực hiện';
      case 'creator_id': return t('tasks.panel.reporter') || 'Người báo cáo';
      case 'description': return t('tasks.panel.description') || 'Mô tả';
      case 'labels': return t('tasks.panel.labels') || 'Nhãn';
      case 'start_date': return t('tasks.panel.start_date') || 'Ngày bắt đầu';
      case 'title': return t('tasks.panel.title') || 'Tiêu đề';
      default: return field;
    }
  };

  const getFieldValueLabel = (field: string, value: any) => {
    if (!value || value === '0' || value === '') {
      if (field === 'assignee_id' || field === 'creator_id') return t('tasks.panel.assignee_placeholder') || 'Chưa phân công';
      if (field === 'labels') return t('workflow.rules.labels.none') || 'Không có nhãn';
      return t('workflow.sidebar.empty_field') || 'Trống';
    }
    if (field === 'priority') {
      switch (value) {
        case 'urgent': return t('tasks.priority.urgent') || 'Khẩn cấp';
        case 'high': return t('tasks.priority.high') || 'Cao';
        case 'medium': return t('tasks.priority.medium') || 'Trung bình';
        case 'low': return t('tasks.priority.low') || 'Thấp';
        default: return value;
      }
    }
    if (field === 'assignee_id' || field === 'creator_id') {
      const member = members.find(m => String(m.id) === String(value));
      return member ? member.name : value;
    }
    if (field === 'labels') {
      const label = projectLabels?.find(l => String(l.id) === String(value));
      return label ? label.name : value;
    }
    return value;
  };

  const getRuleDescription = (rule: any) => {
    switch (rule.type) {
      case 'restrict_role': {
        const type = rule.config.type ?? 'manager';
        if (type === 'manager') return `🔒 ${t('workflow.transition_roles')}: ${t('workflow.rules.restrict_role.only_manager')}`;
        if (type === 'all') return `🔒 ${t('workflow.transition_roles')}: ${t('workflow.rules.restrict_role.all_members')}`;
        const userIds = rule.config.userIds || [];
        const names = userIds.map((uid: any) => members.find(m => String(m.id) === String(uid))?.name).filter(Boolean);
        return `🔒 ${t('workflow.transition_roles')}: ${t('workflow.rules.restrict_role.flexible')} (${names.join(', ') || t('tasks.panel.unassigned')})`;
      }
      case 'restrict_subtasks': {
        const statusName = statuses.find(s => s.id === rule.config.status)?.name || rule.config.status;
        return `🔒 ${t('workflow.rules.restrict_subtasks.require_status')} "${statusName}"`;
      }
      case 'restrict_field': {
        const fieldName = getFieldNameLabel(rule.config.field);
        const val = getFieldValueLabel(rule.config.field, rule.config.value);
        return `🔒 ${t('workflow.rules.restrict_field.field_to_check')} "${fieldName}" ➔ "${val}"`;
      }
      case 'assign_user':
        return `👤 ${t('workflow.rule.assign_user.title')}: ${rule.config.to === 'current_user' ? t('workflow.rules.assign_user.current_user') : t('workflow.rules.assign_user.clear')}`;
      case 'update_field': {
        const fieldName = getFieldNameLabel(rule.config.field);
        const val = getFieldValueLabel(rule.config.field, rule.config.value);
        return `✏️ ${t('workflow.rule.update_field.field_to_update')} "${fieldName}" ➔ "${val}"`;
      }
      case 'restrict_parent_status': {
        const statusName = statuses.find(s => s.id === rule.config.status)?.name || rule.config.status;
        return `🔒 ${t('workflow.rules.restrict_parent_status.parent_status')} "${statusName}"`;
      }
      case 'restrict_history_status': {
        const statusName = statuses.find(s => s.id === rule.config.status)?.name || rule.config.status;
        return `🔒 ${t('workflow.rules.restrict_history_status.history_status')} "${statusName}"`;
      }
      default:
        return `⚡ ${t('workflow.rules.add')}: ${rule.type}`;
    }
  };

  // Render Status Details
  if (selectedStatus) {
    const isInitial = selectedStatus.id === initialStatusId;
    const incoming = transitions.filter(tr => tr.to === selectedStatus.id);
    const outgoing = transitions.filter(tr => tr.from === selectedStatus.id);
    const hasGlobal = globalTransitions.some(gt => gt.to === selectedStatus.id);

    return (
      <div className="workflow-sidebar">
        <div className="sidebar-header">
          <h3>{t('projects.status.status_field')}</h3>
          <CloseOutlined className="close-sidebar" onClick={onClose} />
        </div>
        <div className="sidebar-content">
          {/* Status Name */}
          <div className="sidebar-section">
            <label>{t('workflow.status_name')}</label>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 14px', 
              background: 'rgba(120, 120, 120, 0.03)', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)', 
              fontWeight: 600,
              fontSize: '13px'
            }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: selectedStatus.color }} />
              {selectedStatus.name}
            </div>
          </div>

          {/* Category */}
          <div className="sidebar-section">
            <label>{t('workflow.sidebar.status_group')}</label>
            <div>
              <span className="node-category" style={{
                background: `${getCategoryColor(selectedStatus.type)}15`,
                color: getCategoryColor(selectedStatus.type),
                fontSize: '11px',
                fontWeight: 700,
                padding: '5px 12px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                display: 'inline-block',
                border: `1px solid ${getCategoryColor(selectedStatus.type)}30`
              }}>
                {getCategoryLabel(selectedStatus.type)}
              </span>
            </div>
          </div>

          {/* Initial Status Config Card */}
          <div className="sidebar-section">
            <label>{t('workflow.sidebar.status_setup')}</label>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px', 
              padding: '14px', 
              background: 'rgba(120, 120, 120, 0.02)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="initialStatusCheck"
                  checked={isInitial}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setInitialStatusId(selectedStatus.id);
                    }
                  }}
                  disabled={isInitial}
                  style={{ cursor: isInitial ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                />
                <label htmlFor="initialStatusCheck" style={{ margin: 0, fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', cursor: isInitial ? 'not-allowed' : 'pointer', textTransform: 'none', letterSpacing: 'normal' }}>
                  {t('workflow.sidebar.initial_status_check')}
                </label>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                <InfoCircleOutlined style={{ marginTop: '2px', color: 'var(--text-tertiary)' }} />
                <span>{t('workflow.sidebar.initial_status_desc')}</span>
              </div>
            </div>
          </div>
          <Divider style={{ margin: '8px 0' }} />

          {/* Transitions Block */}
          {(() => {
            const outgoingList = transitions
              .filter(tr => tr.from === selectedStatus.id)
              .map(tr => ({ ...tr, isGlobal: false, type: 'outgoing' as const }));

            const incomingList = transitions
              .filter(tr => tr.to === selectedStatus.id)
              .map(tr => ({ ...tr, isGlobal: false, type: 'incoming' as const }));

            const globalList = globalTransitions
              .filter(gt => gt.to === selectedStatus.id)
              .map(gt => ({ ...gt, isGlobal: true, type: 'global' as const, from: 'any' }));

            const allConnectedTransitions = [...outgoingList, ...incomingList, ...globalList];

            return (
              <div className="sidebar-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                    {t('workflow.transitions_title')} ({allConnectedTransitions.length})
                  </label>
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined style={{ fontSize: '12px' }} />}
                    onClick={() => onAddTransitionClick(selectedStatus.id)}
                    style={{ color: 'var(--primary)', padding: '0 4px', height: '20px', display: 'flex', alignItems: 'center' }}
                  />
                </div>
                
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '12px' }}>
                  {t('workflow.sidebar.transitions_help')}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {allConnectedTransitions.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', background: 'rgba(120, 120, 120, 0.01)' }}>
                      {t('workflow.sidebar.no_transitions')}
                    </div>
                  ) : (
                    allConnectedTransitions.map(tr => {
                      const fromNode = tr.isGlobal ? null : statuses.find(s => s.id === (tr as any).from);
                      const toNode = statuses.find(s => s.id === tr.to);
                      const isSelected = selectedTransitionId === tr.id;

                      return (
                        <div
                          key={tr.id}
                          onClick={() => onSelectTransition(tr.id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'rgba(120, 120, 120, 0.02)',
                            border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          className="sidebar-transition-card"
                        >
                          {tr.name && (
                            <div>
                              <span style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                background: 'rgba(99, 102, 241, 0.08)',
                                color: 'var(--primary-light)',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                border: '1px solid rgba(99, 102, 241, 0.15)',
                                display: 'inline-block'
                              }}>
                                {tr.name}
                              </span>
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
                            {tr.isGlobal ? (
                              <span style={{ 
                                color: 'var(--text-secondary)', 
                                fontWeight: 600,
                                background: 'rgba(120, 120, 120, 0.05)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                fontSize: '10px'
                              }}>
                                {t('workflow.global_transitions_help')}
                              </span>
                            ) : fromNode ? (
                              <span style={{
                                background: `${fromNode.color}15`,
                                color: fromNode.color,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                border: `1px solid ${fromNode.color}25`,
                                textTransform: 'uppercase',
                                fontSize: '10px'
                              }}>
                                {fromNode.name}
                              </span>
                            ) : null}

                            <ArrowRightOutlined style={{ color: 'var(--text-muted)', fontSize: '10px' }} />

                            {toNode ? (
                              <span style={{
                                background: `${toNode.color}15`,
                                color: toNode.color,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                border: `1px solid ${toNode.color}25`,
                                textTransform: 'uppercase',
                                fontSize: '10px'
                              }}>
                                {toNode.name}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {!hasGlobal && (
                    <Button
                      type="dashed"
                      block
                      icon={<PlusOutlined />}
                      onClick={() => onAddGlobalTransition(selectedStatus.id)}
                      style={{ height: '32px', borderRadius: '8px', fontSize: '12px', fontWeight: 500 }}
                    >
                      {t('workflow.add_global_transition')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  if (selectedTransition || selectedGlobalTransition) {
    const isGlobal = !!selectedGlobalTransition;
    const currentTransition = selectedTransition || selectedGlobalTransition!;
    const fromNode = isGlobal ? null : statuses.find(s => s.id === (currentTransition as Transition).from);
    const toNode = statuses.find(s => s.id === currentTransition.to);

    const allowedRoles = currentTransition.allowed_roles || [];
    const rules = currentTransition.rules || [];

    const handleNameChange = (val: string) => {
      if (isGlobal) {
        onUpdateGlobalTransition(currentTransition.id, { name: val });
      } else {
        onUpdateTransition(currentTransition.id, { name: val });
      }
    };

    const handleRolesChange = (roles: string[]) => {
      if (isGlobal) {
        onUpdateGlobalTransition(currentTransition.id, { allowed_roles: roles });
      } else {
        onUpdateTransition(currentTransition.id, { allowed_roles: roles });
      }
    };

    const handleDelete = (silent?: boolean) => {
      const isSilent = silent === true;
      if (isGlobal) {
        onDeleteGlobalTransition(currentTransition.id, isSilent);
      } else {
        onDeleteTransition(currentTransition.id, isSilent);
      }
    };

    return (
      <div className="workflow-sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={() => {
              if (lastSelectedNodeId) {
                onSelectNode(lastSelectedNodeId);
              } else if (currentTransition) {
                const statusToSelect = (currentTransition as any).from || currentTransition.to;
                if (statusToSelect && statusToSelect !== 'any') {
                  onSelectNode(statusToSelect);
                } else {
                  onSelectNode(currentTransition.to);
                }
              }
            }}
          >
            <ArrowLeftOutlined style={{ fontSize: '14px', color: 'var(--text-secondary)' }} />
            <h3 style={{ margin: 0 }}>{t('workflow.sidebar.transition_detail')}</h3>
          </div>
          <CloseOutlined className="close-sidebar" onClick={onClose} style={{ marginLeft: 'auto' }} />
        </div>
        <div className="sidebar-content">
          {/* Path */}
          <div className="sidebar-section">
            <label>{t('workflow.sidebar.transition_path')}</label>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '12px', 
              padding: '12px 14px', 
              background: 'rgba(120, 120, 120, 0.02)', 
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '13px'
            }}>
              {isGlobal ? (
                <>
                  <span style={{ fontStyle: 'italic', color: 'var(--primary)', fontWeight: 600 }}>🌐 {t('workflow.global_transitions_help')}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 700 }}>➔</span>
                  <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: toNode?.color }} />
                    {toNode?.name}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: fromNode?.color }} />
                    {fromNode?.name}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 700 }}>➔</span>
                  <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: toNode?.color }} />
                    {toNode?.name}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Transition Label Name */}
          {!isGlobal && (
            <div className="sidebar-section">
              <label>{t('workflow.transition_name')}</label>
              <Input
                ref={nameInputRef}
                value={currentTransition.name}
                placeholder={t('workflow.rules.placeholder_example')}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={(e) => {
                  if (!e.target.value || e.target.value.trim() === '') {
                    handleDelete(true);
                    message.warning(t('workflow.toast.transition_name_required'));
                  }
                }}
                style={{ height: '36px', borderRadius: '6px' }}
              />
              <div className="section-desc">
                {t('workflow.transition_name_desc')}
              </div>
            </div>
          )}

          {/* Advanced Rules Section */}
          <div className="sidebar-section">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <ThunderboltOutlined style={{ color: '#f59e0b' }} />
              {t('workflow.rules.sidebar_title')} ({rules.length})
            </label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rules.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '8px', background: 'rgba(120, 120, 120, 0.01)' }}>
                  {t('workflow.rules.empty_desc')}
                </div>
              ) : (
                rules.map((rule, idx) => {
                  let icon = <ThunderboltOutlined style={{ color: 'var(--primary)' }} />;
                  let iconBg = 'rgba(99, 102, 241, 0.08)';
                  let title = '';
                  let details: React.ReactNode = '';

                  switch (rule.type) {
                    case 'restrict_role': {
                      const type = rule.config.type ?? 'manager';
                      icon = <LockOutlined style={{ color: '#ff4d4f' }} />;
                      iconBg = 'rgba(255, 77, 79, 0.08)';
                      title = t('workflow.rule.restrict_role.title');
                      
                      if (type === 'manager') {
                        details = `${t('members.modal.role_label')}: ${t('workflow.rules.restrict_role.only_manager')}`;
                      } else if (type === 'all') {
                        details = `${t('members.modal.role_label')}: ${t('workflow.rules.restrict_role.all_members')}`;
                      } else {
                        const userIds = rule.config.userIds || [];
                        const selectedUsers = userIds.map((uid: any) => members.find(m => String(m.id) === String(uid))).filter(Boolean);
                        
                        details = (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {selectedUsers.slice(0, 5).map((user: any, uIdx: number) => (
                                <Tooltip key={user.id} title={user.name}>
                                  <div style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: '#6366f1',
                                    border: '1px solid var(--bg-card)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontWeight: 600,
                                    fontSize: '7px',
                                    marginLeft: uIdx > 0 ? '-5px' : '0',
                                    zIndex: selectedUsers.length - uIdx,
                                    position: 'relative',
                                    overflow: 'hidden'
                                  }}>
                                    {user.photo ? (
                                      <img src={user.photo} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      getInitials(user.name)
                                    )}
                                  </div>
                                </Tooltip>
                              ))}
                              {selectedUsers.length > 5 && (
                                <div style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: 'rgba(120, 120, 120, 0.2)',
                                  border: '1px solid var(--border-color)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--text-secondary)',
                                  fontWeight: 600,
                                  fontSize: '7px',
                                  marginLeft: '-5px',
                                  zIndex: 0
                                }}>
                                  +{selectedUsers.length - 5}
                                </div>
                              )}
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              ({selectedUsers.length})
                            </span>
                          </div>
                        );
                      }
                      break;
                    }
                    case 'restrict_subtasks': {
                      const statusName = statuses.find(s => s.id === rule.config.status)?.name || rule.config.status;
                      icon = <LockOutlined style={{ color: '#ff4d4f' }} />;
                      iconBg = 'rgba(255, 77, 79, 0.08)';
                      title = t('workflow.rule.restrict_subtasks.title');
                      details = `${t('workflow.rules.restrict_subtasks.require_status')} ${statusName}`;
                      break;
                    }
                    case 'restrict_field': {
                      const fieldName = getFieldNameLabel(rule.config.field);
                      const val = getFieldValueLabel(rule.config.field, rule.config.value);
                      icon = <LockOutlined style={{ color: '#ff4d4f' }} />;
                      iconBg = 'rgba(255, 77, 79, 0.08)';
                      title = t('workflow.rule.restrict_field.title');
                      details = `${t('workflow.rules.restrict_field.field_to_check')} ${fieldName} ➔ ${val}`;
                      break;
                    }
                    case 'assign_user':
                      icon = <UserOutlined style={{ color: '#1890ff' }} />;
                      iconBg = 'rgba(24, 144, 255, 0.08)';
                      title = t('workflow.rule.assign_user.title');
                      details = rule.config.to === 'current_user' ? t('workflow.rules.assign_user.current_user') : t('workflow.rules.assign_user.clear');
                      break;
                    case 'update_field': {
                      const fieldName = getFieldNameLabel(rule.config.field);
                      const val = getFieldValueLabel(rule.config.field, rule.config.value);
                      icon = <EditOutlined style={{ color: '#1890ff' }} />;
                      iconBg = 'rgba(24, 144, 255, 0.08)';
                      title = t('workflow.rule.update_field.title');
                      details = `${t('workflow.rules.update_field.field_to_update')} ${fieldName} ➔ ${val}`;
                      break;
                    }
                    case 'restrict_parent_status': {
                      const statusName = statuses.find(s => s.id === rule.config.status)?.name || rule.config.status;
                      icon = <LockOutlined style={{ color: '#ff4d4f' }} />;
                      iconBg = 'rgba(255, 77, 79, 0.08)';
                      title = t('workflow.rule.restrict_parent_status.title');
                      details = `${t('workflow.rules.restrict_parent_status.parent_status')} ${statusName}`;
                      break;
                    }
                    case 'restrict_history_status': {
                      const statusName = statuses.find(s => s.id === rule.config.status)?.name || rule.config.status;
                      icon = <LockOutlined style={{ color: '#ff4d4f' }} />;
                      iconBg = 'rgba(255, 77, 79, 0.08)';
                      title = t('workflow.rule.restrict_history_status.title');
                      details = `${t('workflow.rules.restrict_history_status.history_status')} ${statusName}`;
                      break;
                    }
                    default:
                      title = t('workflow.rules.sidebar_title');
                      details = rule.type;
                  }

                  return (
                    <div 
                      key={idx} 
                      className="rule-item-card"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        background: 'rgba(120, 120, 120, 0.02)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px', 
                        padding: '10px 12px', 
                        position: 'relative',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => onOpenRulesModal(currentTransition.id, isGlobal, idx)}
                    >
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: iconBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        flexShrink: 0
                      }}>
                        {icon}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {title}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {details}
                        </span>
                      </div>
                      <Button 
                        type="text" 
                        danger 
                        size="small" 
                        icon={<CloseOutlined style={{ fontSize: '10px' }} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRule(currentTransition.id, idx, isGlobal);
                        }}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          padding: 0
                        }}
                      />
                    </div>
                  );
                })
              )}

              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                onClick={() => onOpenRulesModal(currentTransition.id, isGlobal)}
                style={{ height: '36px', borderRadius: '8px', fontSize: '12px', fontWeight: 500 }}
              >
                {t('workflow.rules.add')}
              </Button>
            </div>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* Action Delete */}
          <div className="sidebar-section">
            <Button
              danger
              type="primary"
              ghost
              icon={<DeleteOutlined />}
              onClick={() => handleDelete()}
              style={{ width: '100%', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {t('workflow.sidebar.delete_transition')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render Empty State
  return (
    <div className="workflow-sidebar">
      <div className="sidebar-header">
        <h3>{t('workflow.sidebar.flow_properties')}</h3>
        <CloseOutlined className="close-sidebar" onClick={onClose} />
      </div>
      <div className="empty-sidebar-state">
        <div className="empty-icon">🔀</div>
        <h4>{t('workflow.sidebar.no_object_selected')}</h4>
        <p>{t('workflow.sidebar.empty_desc')}</p>
      </div>
    </div>
  );
};
