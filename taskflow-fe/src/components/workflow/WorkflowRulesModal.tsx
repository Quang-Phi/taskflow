import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Button, Space, Checkbox, Radio, Tooltip, Popover, Divider } from 'antd';
import { SearchOutlined, LockOutlined, CheckCircleOutlined, ArrowRightOutlined, LeftOutlined, CloseOutlined, CheckOutlined, PlusOutlined, UserOutlined, FileTextOutlined, TagOutlined, CalendarOutlined, FontSizeOutlined, SwapOutlined, AppstoreOutlined } from '@ant-design/icons';

interface Status {
  id: string;
  name: string;
  color: string;
}

interface Member {
  id: string | number;
  name: string;
  photo?: string;
  email?: string;
}

interface WorkflowRulesModalProps {
  open: boolean;
  onClose: () => void;
  onAddRule: (type: string, config: any, editIndex?: number | null) => void;
  statuses: Status[];
  members?: Member[];
  projectLabels?: any[];
  t: (key: string) => string;
  existingRules?: any[];
  editRuleIndex?: number | null;
}

interface RuleTemplate {
  type: string;
  category: 'restrict' | 'validate' | 'perform';
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
}

const FlagIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

export const WorkflowRulesModal: React.FC<WorkflowRulesModalProps> = ({
  open,
  onClose,
  onAddRule,
  statuses,
  members = [],
  projectLabels = [],
  t,
  existingRules = [],
  editRuleIndex = null
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'restrict' | 'validate' | 'perform'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);

  // Configuration States
  const [restrictRoleType, setRestrictRoleType] = useState<'manager' | 'all' | 'flexible'>('manager');
  const [restrictRoleUsers, setRestrictRoleUsers] = useState<any[]>([]);
  const [showUserSelectorPopover, setShowUserSelectorPopover] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');

  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  const [subtaskStatus, setSubtaskStatus] = useState<string>(statuses[statuses.length - 1]?.id || 'done');
  const [restrictFieldField, setRestrictFieldField] = useState<string>('priority');
  const [restrictFieldValue, setRestrictFieldValue] = useState<string>('high');
  const [assigneeTarget, setAssigneeTarget] = useState<'current_user' | 'clear'>('current_user');
  const [updateFieldField, setUpdateFieldField] = useState<string>('priority');
  const [updateFieldValue, setUpdateFieldValue] = useState<string>('high');
  const [parentStatus, setParentStatus] = useState<string>(statuses[0]?.id || '');
  const [historyStatus, setHistoryStatus] = useState<string>(statuses[0]?.id || '');
  const [requiredPermissions, setRequiredPermissions] = useState<string[]>(['assignee']);

  const ruleTemplates: RuleTemplate[] = [
    {
      type: 'restrict_role',
      category: 'restrict',
      title: t('workflow.rule.restrict_role.title'),
      description: t('workflow.rule.restrict_role.desc'),
      icon: <LockOutlined style={{ color: '#ff4d4f' }} />,
      iconBg: 'rgba(255, 77, 79, 0.1)'
    },
    {
      type: 'restrict_subtasks',
      category: 'restrict',
      title: t('workflow.rule.restrict_subtasks.title'),
      description: t('workflow.rule.restrict_subtasks.desc'),
      icon: <LockOutlined style={{ color: '#ff4d4f' }} />,
      iconBg: 'rgba(255, 77, 79, 0.1)'
    },
    {
      type: 'restrict_field',
      category: 'restrict',
      title: t('workflow.rule.restrict_field.title'),
      description: t('workflow.rule.restrict_field.desc'),
      icon: <LockOutlined style={{ color: '#ff4d4f' }} />,
      iconBg: 'rgba(255, 77, 79, 0.1)'
    },
    {
      type: 'assign_user',
      category: 'perform',
      title: t('workflow.rule.assign_user.title'),
      description: t('workflow.rule.assign_user.desc'),
      icon: <ArrowRightOutlined style={{ color: '#1890ff' }} />,
      iconBg: 'rgba(24, 144, 255, 0.1)'
    },
    {
      type: 'update_field',
      category: 'perform',
      title: t('workflow.rule.update_field.title'),
      description: t('workflow.rule.update_field.desc'),
      icon: <ArrowRightOutlined style={{ color: '#1890ff' }} />,
      iconBg: 'rgba(24, 144, 255, 0.1)'
    },
    {
      type: 'restrict_parent_status',
      category: 'restrict',
      title: t('workflow.rule.restrict_parent_status.title'),
      description: t('workflow.rule.restrict_parent_status.desc'),
      icon: <LockOutlined style={{ color: '#ff4d4f' }} />,
      iconBg: 'rgba(255, 77, 79, 0.1)'
    },
    {
      type: 'restrict_history_status',
      category: 'restrict',
      title: t('workflow.rule.restrict_history_status.title'),
      description: t('workflow.rule.restrict_history_status.desc'),
      icon: <LockOutlined style={{ color: '#ff4d4f' }} />,
      iconBg: 'rgba(255, 77, 79, 0.1)'
    }
  ];

  useEffect(() => {
    if (open) {
      setActiveCategory('all');
      setSearchQuery('');

      if (editRuleIndex !== null && editRuleIndex !== undefined && editRuleIndex >= 0 && existingRules && existingRules[editRuleIndex]) {
        const ruleToEdit = existingRules[editRuleIndex];
        const template = ruleTemplates.find(t => t.type === ruleToEdit.type) || null;
        setSelectedTemplate(template);

        if (ruleToEdit.type === 'restrict_role') {
          setRestrictRoleType(ruleToEdit.config.type || 'manager');
          setRestrictRoleUsers(ruleToEdit.config.userIds || []);
        } else if (ruleToEdit.type === 'restrict_subtasks') {
          setSubtaskStatus(ruleToEdit.config.status || statuses[statuses.length - 1]?.id || 'done');
        } else if (ruleToEdit.type === 'restrict_field') {
          setRestrictFieldField(ruleToEdit.config.field || 'priority');
          setRestrictFieldValue(ruleToEdit.config.value || 'high');
        } else if (ruleToEdit.type === 'assign_user') {
          setAssigneeTarget(ruleToEdit.config.to || 'current_user');
        } else if (ruleToEdit.type === 'update_field') {
          setUpdateFieldField(ruleToEdit.config.field || 'priority');
          setUpdateFieldValue(ruleToEdit.config.value || 'high');
        } else if (ruleToEdit.type === 'restrict_parent_status') {
          setParentStatus(ruleToEdit.config.status || statuses[0]?.id || '');
        } else if (ruleToEdit.type === 'restrict_history_status') {
          setHistoryStatus(ruleToEdit.config.status || statuses[0]?.id || '');
        }
      } else {
        setSelectedTemplate(null);
        setRestrictRoleType('manager');
        setRestrictRoleUsers([]);
        setShowUserSelectorPopover(false);
        setUserSearchText('');
        setSubtaskStatus(statuses[statuses.length - 1]?.id || 'done');
        setRestrictFieldField('priority');
        setRestrictFieldValue('high');
        setAssigneeTarget('current_user');
        setUpdateFieldField('priority');
        setUpdateFieldValue('high');
        setParentStatus(statuses[0]?.id || '');
        setHistoryStatus(statuses[0]?.id || '');
        setRequiredPermissions(['assignee']);
      }
    }
  }, [open, statuses, editRuleIndex, existingRules]);

  // Filtering templates
  const filteredTemplates = ruleTemplates.filter(template => {
    const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());

    const alreadyConfigured = existingRules && existingRules.some((r, idx) => r.type === template.type && idx !== editRuleIndex);

    return matchesCategory && matchesSearch && !alreadyConfigured;
  });

  const handleAdd = () => {
    if (!selectedTemplate) return;

    let config = {};
    if (selectedTemplate.type === 'restrict_role') {
      config = {
        type: restrictRoleType,
        userIds: restrictRoleType === 'flexible' ? restrictRoleUsers : [],
        roles: restrictRoleType === 'manager' ? ['manager'] : []
      };
    } else if (selectedTemplate.type === 'restrict_subtasks') {
      config = { status: subtaskStatus };
    } else if (selectedTemplate.type === 'restrict_field') {
      config = { field: restrictFieldField, value: restrictFieldValue };
    } else if (selectedTemplate.type === 'assign_user') {
      config = { to: assigneeTarget };
    } else if (selectedTemplate.type === 'update_field') {
      config = { field: updateFieldField, value: updateFieldValue };
    } else if (selectedTemplate.type === 'restrict_parent_status') {
      config = { status: parentStatus };
    } else if (selectedTemplate.type === 'restrict_history_status') {
      config = { status: historyStatus };
    }

    onAddRule(selectedTemplate.type, config, editRuleIndex);
    setSelectedTemplate(null);
    onClose();
  };

  const renderConfigForm = () => {
    if (!selectedTemplate) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
        <div style={{ padding: '16px', background: 'rgba(120, 120, 120, 0.04)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>{selectedTemplate.title}</h4>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedTemplate.description}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          {selectedTemplate.type === 'restrict_role' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('workflow.rules.restrict_role.select_who')}
              </span>
              <Select
                value={restrictRoleType}
                onChange={(value) => setRestrictRoleType(value)}
                style={{ width: '100%' }}
              >
                <Select.Option value="manager">{t('workflow.rules.restrict_role.only_manager')}</Select.Option>
                <Select.Option value="all">{t('workflow.rules.restrict_role.all_members')}</Select.Option>
                <Select.Option value="flexible">{t('workflow.rules.restrict_role.flexible')}</Select.Option>
              </Select>

              {restrictRoleType === 'flexible' && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t('workflow.rules.restrict_role.select_specific')}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {/* Selected members avatar stack */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {restrictRoleUsers.slice(0, 10).map((userId, index) => {
                        const u = members.find(user => String(user.id) === String(userId));
                        if (!u) return null;
                        return (
                          <Tooltip title={`${u.name} (${u.email || ''}) - ${t('workflow.rules.click_to_delete')}`} key={u.id}>
                            <div
                              onClick={() => {
                                setRestrictRoleUsers(prev => prev.filter(id => String(id) !== String(userId)));
                              }}
                              className="selected-avatar-item"
                              style={{
                                position: 'relative',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#6366f1',
                                border: '2px solid var(--bg-card, #fff)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 600,
                                marginLeft: index > 0 ? '-10px' : '0',
                                zIndex: 10 - index,
                                cursor: 'pointer',
                                overflow: 'visible',
                              }}
                            >
                              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
                                {u.photo ? (
                                  <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  getInitials(u.name)
                                )}
                              </div>
                              <div
                                className="avatar-delete-icon"
                                style={{
                                  position: 'absolute',
                                  top: '-4px',
                                  right: '-4px',
                                  background: '#ef4444',
                                  color: '#fff',
                                  borderRadius: '50%',
                                  width: '14px',
                                  height: '14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '8px',
                                  border: '1px solid #fff',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                }}
                              >
                                <CloseOutlined style={{ fontSize: '7px' }} />
                              </div>
                            </div>
                          </Tooltip>
                        );
                      })}

                      {restrictRoleUsers.length > 10 && (
                        <Popover
                          trigger="click"
                          placement="bottom"
                          title={<span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('projects.create.other_members')}</span>}
                          content={
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '220px', padding: '4px 0' }}>
                              {restrictRoleUsers.slice(10).map(id => {
                                const u = members.find(user => String(user.id) === String(id));
                                if (!u) return null;
                                return (
                                  <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: '#6366f1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontSize: '9px',
                                        fontWeight: 600,
                                        overflow: 'hidden',
                                      }}>
                                        {u.photo ? <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(u.name)}
                                      </div>
                                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }} title={u.email}>{u.name}</span>
                                    </div>
                                    <Button
                                      type="text"
                                      size="small"
                                      danger
                                      icon={<CloseOutlined style={{ fontSize: '10px' }} />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRestrictRoleUsers(prev => prev.filter(mid => String(mid) !== String(id)));
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          }
                        >
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'var(--border-color, #e5e7eb)',
                              border: '2px solid var(--bg-card, #fff)',
                              color: 'var(--text-secondary, #4b5563)',
                              fontSize: '11px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginLeft: '-10px',
                              zIndex: 4,
                              cursor: 'pointer',
                            }}
                          >
                            +{restrictRoleUsers.length - 10}
                          </div>
                        </Popover>
                      )}
                    </div>

                    {/* Popover trigger button to select members */}
                    <Popover
                      trigger="click"
                      placement="bottomLeft"
                      open={showUserSelectorPopover}
                      onOpenChange={(open) => setShowUserSelectorPopover(open)}
                      content={
                        <div style={{ width: '280px', padding: '4px' }}>
                          <Input
                            placeholder={t('members.search_placeholder') || 'Tìm kiếm theo tên hoặc email...'}
                            prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                            value={userSearchText}
                            onChange={(e) => setUserSearchText(e.target.value)}
                            size="middle"
                            style={{ marginBottom: '8px' }}
                            allowClear
                          />
                          <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {members
                              .filter(u =>
                                u.name.toLowerCase().includes(userSearchText.toLowerCase()) ||
                                (u.email && u.email.toLowerCase().includes(userSearchText.toLowerCase()))
                              )
                              .map((u) => {
                                const isSelected = restrictRoleUsers.some(uid => String(uid) === String(u.id));
                                return (
                                  <div
                                    key={u.id}
                                    onClick={() => {
                                      const updatedUsers = isSelected
                                        ? restrictRoleUsers.filter(id => String(id) !== String(u.id))
                                        : [...restrictRoleUsers, u.id];
                                      setRestrictRoleUsers(updatedUsers);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '8px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                      transition: 'all 0.2s',
                                    }}
                                    className="member-selector-item status-item-hover"
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: '#6366f1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        overflow: 'hidden',
                                        flexShrink: 0
                                      }}>
                                        {u.photo ? <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(u.name)}
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{u.email || ''}</span>
                                      </div>
                                    </div>
                                    {isSelected && <CheckOutlined style={{ color: '#6366f1', fontSize: '12px' }} />}
                                  </div>
                                );
                              })}
                            {members.filter(u =>
                              u.name.toLowerCase().includes(userSearchText.toLowerCase()) ||
                              (u.email && u.email.toLowerCase().includes(userSearchText.toLowerCase()))
                            ).length === 0 && (
                                <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                                  {t('members.empty') || 'Không tìm thấy thành viên nào.'}
                                </div>
                              )}
                          </div>
                        </div>
                      }
                    >
                      <Button
                        type="dashed"
                        shape="circle"
                        icon={<PlusOutlined />}
                        style={{
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          cursor: 'pointer',
                        }}
                      />
                    </Popover>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedTemplate.type === 'restrict_subtasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('workflow.rules.restrict_subtasks.require_status')}
              </span>
              <Select
                value={subtaskStatus}
                onChange={setSubtaskStatus}
                style={{ width: '100%' }}
              >
                {statuses.map(s => (
                  <Select.Option key={s.id} value={s.id}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                      {s.name}
                    </span>
                  </Select.Option>
                ))}
              </Select>
            </div>
          )}

          {selectedTemplate.type === 'restrict_field' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t('workflow.rules.restrict_field.field_to_check')}
                </span>
                <Select value={restrictFieldField} onChange={(val) => { setRestrictFieldField(val); setRestrictFieldValue(''); }} style={{ width: '100%' }}>
                  <Select.Option value="assignee_id">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <UserOutlined />
                      <span>{t('tasks.panel.assignee') || 'Người thực hiện'}</span>
                    </span>
                  </Select.Option>
                  <Select.Option value="description">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <FileTextOutlined />
                      <span>{t('tasks.panel.description') || 'Mô tả'}</span>
                    </span>
                  </Select.Option>
                  <Select.Option value="priority">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <SwapOutlined style={{ transform: 'rotate(90deg)' }} />
                      <span>{t('tasks.panel.priority') || 'Độ ưu tiên'}</span>
                    </span>
                  </Select.Option>
                  <Select.Option value="creator_id">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <UserOutlined />
                      <span>{t('tasks.panel.reporter') || 'Người báo cáo'}</span>
                    </span>
                  </Select.Option>
                  <Select.Option value="start_date">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarOutlined />
                      <span>{t('tasks.panel.start_date') || 'Ngày bắt đầu'}</span>
                    </span>
                  </Select.Option>
                  <Select.Option value="title">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <FontSizeOutlined />
                      <span>{t('tasks.panel.title') || 'Tiêu đề'}</span>
                    </span>
                  </Select.Option>
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t('workflow.rules.restrict_field.required_value')}
                </span>
                {restrictFieldField === 'priority' && (
                  <Select value={restrictFieldValue} onChange={setRestrictFieldValue} style={{ width: '100%' }}>
                    <Select.Option value="urgent">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <FlagIcon color="#ef4444" size={14} />
                        <span>{t('tasks.priority.urgent') || 'Khẩn cấp'}</span>
                      </span>
                    </Select.Option>
                    <Select.Option value="high">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <FlagIcon color="#f97316" size={14} />
                        <span>{t('tasks.priority.high') || 'Cao'}</span>
                      </span>
                    </Select.Option>
                    <Select.Option value="medium">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <FlagIcon color="#f59e0b" size={14} />
                        <span>{t('tasks.priority.medium') || 'Trung bình'}</span>
                      </span>
                    </Select.Option>
                    <Select.Option value="low">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <FlagIcon color="#3b82f6" size={14} />
                        <span>{t('tasks.priority.low') || 'Thấp'}</span>
                      </span>
                    </Select.Option>
                  </Select>
                )}
                {(restrictFieldField === 'assignee_id' || restrictFieldField === 'creator_id') && (
                  <Select value={restrictFieldValue || '0'} onChange={setRestrictFieldValue} style={{ width: '100%' }}>
                    <Select.Option value="0">{t('tasks.panel.unassigned') || 'Chưa phân công'}</Select.Option>
                    {members.map(m => (
                      <Select.Option key={m.id} value={String(m.id)}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: '#6366f1',
                            color: '#fff',
                            fontSize: '8px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                          }}>
                            {m.photo ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.name)}
                          </div>
                          <span>{m.name}</span>
                        </span>
                      </Select.Option>
                    ))}
                  </Select>
                )}
                {restrictFieldField === 'start_date' && (
                  <Input
                    type="date"
                    value={restrictFieldValue}
                    onChange={(e) => setRestrictFieldValue(e.target.value)}
                    style={{ width: '100%' }}
                  />
                )}
                {restrictFieldField === 'description' && (
                  <Input.TextArea
                    placeholder={t('workflow.rules.restrict_field.desc_placeholder')}
                    value={restrictFieldValue}
                    onChange={(e) => setRestrictFieldValue(e.target.value)}
                    rows={3}
                  />
                )}
                {restrictFieldField === 'title' && (
                  <Input
                    placeholder={t('workflow.rules.restrict_field.title_placeholder')}
                    value={restrictFieldValue}
                    onChange={(e) => setRestrictFieldValue(e.target.value)}
                  />
                )}
              </div>
            </div>
          )}

          {selectedTemplate.type === 'assign_user' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('workflow.rules.assign_user.user_to_assign')}
              </span>
              <Select value={assigneeTarget} onChange={setAssigneeTarget} style={{ width: '100%' }}>
                <Select.Option value="current_user">{t('workflow.rules.assign_user.current_user')}</Select.Option>
                <Select.Option value="clear">{t('workflow.rules.assign_user.clear')}</Select.Option>
              </Select>
            </div>
          )}

          {selectedTemplate.type === 'update_field' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t('workflow.rules.update_field.field_to_update')}
                </span>
                <Select value={updateFieldField} onChange={(val) => { setUpdateFieldField(val); setUpdateFieldValue(''); }} style={{ width: '100%' }}>
                  <Select.Option value="assignee_id">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <UserOutlined />
                      <span>{t('tasks.panel.assignee') || 'Người thực hiện'}</span>
                    </span>
                  </Select.Option>
                  <Select.Option value="description">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <FileTextOutlined />
                      <span>{t('tasks.panel.description') || 'Mô tả'}</span>
                    </span>
                  </Select.Option>
                  <Select.Option value="priority">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <SwapOutlined style={{ transform: 'rotate(90deg)' }} />
                      <span>{t('tasks.panel.priority') || 'Độ ưu tiên'}</span>
                    </span>
                  </Select.Option>
                  <Select.Option value="creator_id">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <UserOutlined />
                      <span>{t('tasks.panel.reporter') || 'Người báo cáo'}</span>
                    </span>
                  </Select.Option>
                  <Select.Option value="start_date">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarOutlined />
                      <span>{t('tasks.panel.start_date') || 'Ngày bắt đầu'}</span>
                    </span>
                  </Select.Option>
                  <Select.Option value="title">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <FontSizeOutlined />
                      <span>{t('tasks.panel.title') || 'Tiêu đề'}</span>
                    </span>
                  </Select.Option>
                </Select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t('workflow.rules.update_field.new_value')}
                </span>
                {updateFieldField === 'priority' && (
                  <Select value={updateFieldValue} onChange={setUpdateFieldValue} style={{ width: '100%' }}>
                    <Select.Option value="urgent">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <FlagIcon color="#ef4444" size={14} />
                        <span>{t('tasks.priority.urgent') || 'Khẩn cấp'}</span>
                      </span>
                    </Select.Option>
                    <Select.Option value="high">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <FlagIcon color="#f97316" size={14} />
                        <span>{t('tasks.priority.high') || 'Cao'}</span>
                      </span>
                    </Select.Option>
                    <Select.Option value="medium">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <FlagIcon color="#f59e0b" size={14} />
                        <span>{t('tasks.priority.medium') || 'Trung bình'}</span>
                      </span>
                    </Select.Option>
                    <Select.Option value="low">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <FlagIcon color="#3b82f6" size={14} />
                        <span>{t('tasks.priority.low') || 'Thấp'}</span>
                      </span>
                    </Select.Option>
                  </Select>
                )}
                {(updateFieldField === 'assignee_id' || updateFieldField === 'creator_id') && (
                  <Select value={updateFieldValue || '0'} onChange={setUpdateFieldValue} style={{ width: '100%' }}>
                    <Select.Option value="0">{t('tasks.panel.unassigned') || 'Chưa phân công'}</Select.Option>
                    {members.map(m => (
                      <Select.Option key={m.id} value={String(m.id)}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: '#6366f1',
                            color: '#fff',
                            fontSize: '8px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                          }}>
                            {m.photo ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.name)}
                          </div>
                          <span>{m.name}</span>
                        </span>
                      </Select.Option>
                    ))}
                  </Select>
                )}
                {updateFieldField === 'start_date' && (
                  <Input
                    type="date"
                    value={updateFieldValue}
                    onChange={(e) => setUpdateFieldValue(e.target.value)}
                    style={{ width: '100%' }}
                  />
                )}
                {updateFieldField === 'description' && (
                  <Input.TextArea
                    placeholder={t('workflow.rules.update_field.desc_placeholder')}
                    value={updateFieldValue}
                    onChange={(e) => setUpdateFieldValue(e.target.value)}
                    rows={3}
                  />
                )}
                {updateFieldField === 'title' && (
                  <Input
                    placeholder={t('workflow.rules.update_field.title_placeholder')}
                    value={updateFieldValue}
                    onChange={(e) => setUpdateFieldValue(e.target.value)}
                  />
                )}
              </div>
            </div>
          )}

          {selectedTemplate.type === 'restrict_parent_status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('workflow.rules.restrict_parent_status.parent_status')}
              </span>
              <Select
                value={parentStatus}
                onChange={setParentStatus}
                style={{ width: '100%' }}
              >
                {statuses.map(s => (
                  <Select.Option key={s.id} value={s.id}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                      {s.name}
                    </span>
                  </Select.Option>
                ))}
              </Select>
            </div>
          )}

          {selectedTemplate.type === 'restrict_history_status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('workflow.rules.restrict_history_status.history_status')}
              </span>
              <Select
                value={historyStatus}
                onChange={setHistoryStatus}
                style={{ width: '100%' }}
              >
                {statuses.map(s => (
                  <Select.Option key={s.id} value={s.id}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                      {s.name}
                    </span>
                  </Select.Option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={
        selectedTemplate ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <LeftOutlined
              style={{ cursor: 'pointer', fontSize: '14px', marginRight: '2px', color: 'var(--text-color)' }}
              onClick={() => setSelectedTemplate(null)}
            />
            {t('workflow.rules.modal_title_config')}
          </span>
        ) : (
          t('workflow.rules.modal_title')
        )
      }
      open={open}
      onCancel={() => { setSelectedTemplate(null); onClose(); }}
      width={720}
      zIndex={1100}
      footer={[
        <Button key="cancel" onClick={() => { setSelectedTemplate(null); onClose(); }}>
          {t('workflow.rules.cancel')}
        </Button>,
        selectedTemplate && (
          <Button key="add" type="primary" onClick={handleAdd}>
            {editRuleIndex !== null && editRuleIndex !== undefined && editRuleIndex >= 0
              ? t('workflow.rules.update')
              : t('workflow.rules.add')}
          </Button>
        )
      ]}
      destroyOnHidden
    >
      {!selectedTemplate ? (
        <div className="rules-modal-layout" style={{ display: 'flex', gap: '20px', height: '480px', marginTop: '10px' }}>
          {/* Left Navigation bar */}
          <div className="rules-modal-sidebar" style={{ width: '200px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '15px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              {t('workflow.rules.category_title')}
            </span>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li
                onClick={() => setActiveCategory('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                  background: activeCategory === 'all' ? 'var(--primary, #6366f1)' : 'transparent',
                  color: activeCategory === 'all' ? '#fff' : 'var(--text-primary, #94a3b8)',
                }}
                className={activeCategory !== 'all' ? 'status-item-hover' : ''}
              >
                <AppstoreOutlined style={{ fontSize: '16px' }} />
                <span>{t('workflow.rules.category_all')}</span>
              </li>
              <Divider style={{ margin: '8px 0' }} />
              <li
                onClick={() => setActiveCategory('restrict')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                  background: activeCategory === 'restrict' ? 'var(--primary, #6366f1)' : 'transparent',
                  color: activeCategory === 'restrict' ? '#fff' : 'var(--text-primary, #94a3b8)',
                }}
                className={activeCategory !== 'restrict' ? 'status-item-hover' : ''}
              >
                <LockOutlined style={{ fontSize: '16px' }} />
                <span>{t('workflow.rules.category_restrict')}</span>
              </li>
              <li
                onClick={() => setActiveCategory('validate')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                  background: activeCategory === 'validate' ? 'var(--primary, #6366f1)' : 'transparent',
                  color: activeCategory === 'validate' ? '#fff' : 'var(--text-primary, #94a3b8)',
                }}
                className={activeCategory !== 'validate' ? 'status-item-hover' : ''}
              >
                <CheckCircleOutlined style={{ fontSize: '16px' }} />
                <span>{t('workflow.rules.category_validate')}</span>
              </li>
              <li
                onClick={() => setActiveCategory('perform')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                  background: activeCategory === 'perform' ? 'var(--primary, #6366f1)' : 'transparent',
                  color: activeCategory === 'perform' ? '#fff' : 'var(--text-primary, #94a3b8)',
                }}
                className={activeCategory !== 'perform' ? 'status-item-hover' : ''}
              >
                <ArrowRightOutlined style={{ fontSize: '16px' }} />
                <span>{t('workflow.rules.category_perform')}</span>
              </li>
            </ul>
          </div>

          {/* Right Rules List */}
          <div className="rules-modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
              placeholder={t('workflow.rules.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px' }}>
              {filteredTemplates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {t('workflow.rules.no_results')}
                </div>
              ) : (
                filteredTemplates.map(template => (
                  <div
                    key={template.type}
                    className="rule-template-card"
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: 'var(--bg-card)',
                      transition: 'border-color 0.15s, box-shadow 0.15s'
                    }}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '6px',
                      background: template.iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      flexShrink: 0
                    }}>
                      {template.icon}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: 1.3 }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {template.title}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {template.description}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        renderConfigForm()
      )}
    </Modal>
  );
};
