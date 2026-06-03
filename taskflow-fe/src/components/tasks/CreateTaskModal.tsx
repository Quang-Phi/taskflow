import React, { useState, useEffect } from 'react';
import { Modal, Select, Input, message, Button, Tooltip, Popover, DatePicker, Dropdown } from 'antd';
import {
  ProjectOutlined,
  UserOutlined,
  CalendarOutlined,
  FlagOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  DownOutlined,
  CheckOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import { useTranslation } from '../../utils/i18n';
import './CreateTaskModal.scss';

// Flag Icon Component
const FlagIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const PRIORITIES = [
  { id: 'urgent', name: 'Khẩn cấp', nameEn: 'Urgent', color: '#ef4444' },
  { id: 'high', name: 'Cao', nameEn: 'High', color: '#f97316' },
  { id: 'medium', name: 'Trung bình', nameEn: 'Medium', color: '#f59e0b' },
  { id: 'low', name: 'Thấp', nameEn: 'Low', color: '#3b82f6' },
];

// Priority Picker Component
const PriorityPicker: React.FC<{
  value: string;
  disabled?: boolean;
  onChange: (val: string) => void;
}> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = PRIORITIES.find(p => p.id === value) || PRIORITIES[2];

  const content = (
    <div style={{ width: '200px', padding: '4px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px 6px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
        {t('tasks.panel.priority')}
      </div>
      {PRIORITIES.map(p => (
        <div
          key={p.id}
          onClick={() => { if (!disabled) { onChange(p.id); setOpen(false); } }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 8px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
            background: p.id === value ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
            transition: 'background 0.15s',
          }}
          className="status-item-hover"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FlagIcon color={p.color} size={15} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: p.id === value ? 'var(--primary)' : 'var(--text-primary)' }}>
              {t(`tasks.priority.${p.id}` as any)}
            </span>
          </div>
          {p.id === value && <CheckOutlined style={{ color: 'var(--primary)', fontSize: '11px' }} />}
        </div>
      ))}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger={disabled ? ([] as any) : 'click'}
      open={disabled ? false : open}
      onOpenChange={setOpen}
      placement="bottomLeft"
    >
      <button
        disabled={disabled}
        style={{
          background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px',
          display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', height: '30px',
          cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none', transition: 'all 0.2s',
          opacity: disabled ? 0.8 : 1,
        }}
        className="status-item-hover"
      >
        <FlagIcon color={current.color} size={14} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: current.color }}>
          {t(`tasks.priority.${current.id}` as any)}
        </span>
        <DownOutlined style={{ fontSize: '8px', color: 'var(--text-muted)' }} />
      </button>
    </Popover>
  );
};

const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return isNaN(r) || isNaN(g) || isNaN(b) ? '156, 160, 176' : `${r}, ${g}, ${b}`;
};

// Status Picker Component
const ClickUpStatusPicker: React.FC<{
  currentStatusId: string;
  projectStatuses: any[];
  onChange: (val: string) => void;
  disabled?: boolean;
  hideCheckButton?: boolean;
}> = ({ currentStatusId, projectStatuses, onChange, disabled, hideCheckButton = false }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const statuses = projectStatuses && projectStatuses.length > 0 ? projectStatuses : [
    { id: 'todo', name: t('tasks.status.todo'), color: '#9ca0b0', type: 'not_started' },
    { id: 'doing', name: t('tasks.status.in_progress'), color: '#3b82f6', type: 'active' },
    { id: 'done', name: t('tasks.status.done'), color: '#22c55e', type: 'closed' }
  ];

  const currentStatus = statuses.find(s => s.id === currentStatusId) || {
    id: currentStatusId,
    name: currentStatusId?.toUpperCase(),
    color: '#9ca0b0'
  };

  const currentIndex = statuses.findIndex(s => s.id === currentStatus.id);
  const isLastStatus = currentIndex === statuses.length - 1;

  const handleNextStep = () => {
    if (disabled) return;
    if (currentIndex >= 0 && currentIndex < statuses.length - 1) {
      onChange(statuses[currentIndex + 1].id);
    }
  };

  const checkColor = currentStatus.color || '#9ca0b0';

  const filtered = {
    not_started: statuses.filter(s => s.type === 'not_started' && s.name.toLowerCase().includes(searchTerm.toLowerCase())),
    active: statuses.filter(s => (s.type === 'active' || s.type === 'done' || !s.type) && s.name.toLowerCase().includes(searchTerm.toLowerCase())),
    closed: statuses.filter(s => s.type === 'closed' && s.name.toLowerCase().includes(searchTerm.toLowerCase())),
  };

  const renderGroup = (title: string, list: any[]) => {
    if (list.length === 0) return null;
    return (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px 6px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
          {title} ({list.length})
        </div>
        {list.map(st => (
          <div
            key={st.id}
            onClick={() => {
              onChange(st.id);
              setOpen(false);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '7px 10px', borderRadius: '6px', cursor: 'pointer',
              background: st.id === currentStatusId ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
            }}
            className="status-item-hover"
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: st.color || '#9ca0b0' }} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: st.id === currentStatusId ? 'var(--primary)' : 'var(--text-primary)' }}>
              {st.name}
            </span>
            {st.id === currentStatusId && <CheckOutlined style={{ marginLeft: 'auto', color: 'var(--primary)', fontSize: '11px' }} />}
          </div>
        ))}
      </div>
    );
  };

  const popoverContent = (
    <div style={{ width: '240px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Input
        size="small"
        placeholder={t('tasks.panel.status_search_placeholder')}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        allowClear
      />
      <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
        {renderGroup(t('tasks.status_group.not_started'), filtered.not_started)}
        {renderGroup(t('tasks.status_group.active'), filtered.active)}
        {renderGroup(t('tasks.status_group.closed'), filtered.closed)}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', background: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {!isLastStatus && !hideCheckButton && (
        <Tooltip title={t('tasks.panel.next_status_tooltip')}>
          <button
            onClick={handleNextStep}
            disabled={disabled}
            style={{
              background: 'var(--bg-card, #2a2a2a)',
              border: 'none',
              color: checkColor,
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 10px',
              fontSize: '14px',
              height: '28px',
              transition: 'all 0.2s',
              outline: 'none',
            }}
            className="clickup-status-checkbox"
          >
            <CheckOutlined style={{ color: checkColor }} />
          </button>
        </Tooltip>
      )}

      <Popover
        content={popoverContent}
        trigger={disabled ? ([] as any) : 'click'}
        open={disabled ? false : open}
        onOpenChange={setOpen}
        placement="bottomLeft"
      >
        <button
          disabled={disabled}
          className="status-badge"
          style={{
            border: 'none',
            background: `rgba(${hexToRgb(currentStatus.color || '#9ca0b0')}, 0.12)`,
            color: currentStatus.color || '#9ca0b0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: (!isLastStatus && !hideCheckButton) ? '0 4px 4px 0' : '4px',
            fontWeight: 600,
            fontSize: '11px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            height: '28px',
            outline: 'none',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentStatus.color || '#9ca0b0' }} />
          {currentStatus.name} <DownOutlined style={{ fontSize: '8px', marginLeft: '2px' }} />
        </button>
      </Popover>
    </div>
  );
};

export interface CreateTaskModalOpenDetail {
  title?: string;
  projectId?: number;
  checklistId?: number;
  checklistItemId?: number;
  onSuccess?: (createdTask: any) => void;
  startDate?: string;
  dueDate?: string;
}

const CreateTaskModal: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Prefilled / Context IDs
  const [checklistItemId, setChecklistItemId] = useState<number | undefined>(undefined);
  const [checklistId, setChecklistId] = useState<number | undefined>(undefined);
  const [onSuccessCallback, setOnSuccessCallback] = useState<((createdTask: any) => void) | undefined>(undefined);

  // Form Fields State
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<any[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [assigneeId, setAssigneeId] = useState<number | undefined>(undefined);
  const [priority, setPriority] = useState<string>('medium');
  const [taskType, setTaskType] = useState<'task' | 'bug'>('task');
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);

  // Load projects list
  const loadProjects = async () => {
    try {
      const res = await api.getProjects({ per_page: 1000 });
      if (res.success) {
        setProjects(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load projects inside CreateTaskModal', err);
    }
  };

  // Load project details (members, statuses) when selectedProjectId changes
  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!selectedProjectId) {
        setProjectMembers([]);
        setProjectStatuses([]);
        return;
      }
      try {
        const res = await api.getProject(selectedProjectId);
        if (res.success) {
          setProjectMembers(res.data.members || []);
          const statuses = res.data.statuses || [];
          setProjectStatuses(statuses);
          // Set default status if present
          if (statuses.length > 0) {
            // Find todo or first status
            const todo = statuses.find((s: any) => s.id === 'todo' || s.type === 'not_started');
            setStatus(todo ? todo.id : statuses[0].id);
          } else {
            setStatus('todo');
          }
        }
      } catch (err) {
        console.error('Failed to fetch project details inside CreateTaskModal', err);
      }
    };
    fetchProjectDetails();
  }, [selectedProjectId]);

  // Listen to the custom window event to open
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<CreateTaskModalOpenDetail>;
      const detail = customEvent.detail || {};
      console.log('detail inside handleOpen:', detail);

      // Reset states
      setTitle(detail.title || '');
      setDescription('');
      setSelectedProjectId(detail.projectId);
      setChecklistItemId(detail.checklistItemId);
      setChecklistId(detail.checklistId);
      setOnSuccessCallback(() => detail.onSuccess);

      // Default other fields
      setAssigneeId(undefined);
      setPriority('medium');
      setTaskType('task');
      setStartDate(detail.startDate ? dayjs(detail.startDate) : null);
      setDueDate(detail.dueDate ? dayjs(detail.dueDate) : null);

      // Open Modal
      setIsOpen(true);

      // Fetch projects
      loadProjects();
    };

    window.addEventListener('open-create-task-modal', handleOpen);
    return () => {
      window.removeEventListener('open-create-task-modal', handleOpen);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTitle('');
    setDescription('');
    setSelectedProjectId(undefined);
    setChecklistItemId(undefined);
    setChecklistId(undefined);
    setOnSuccessCallback(undefined);
    setAssigneeId(undefined);
    setPriority('medium');
    setTaskType('task');
    setStartDate(null);
    setDueDate(null);
  };

  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleCreate = async () => {
    if (!selectedProjectId) {
      message.error(t('tasks.create_modal.project_required'));
      return;
    }
    if (!title.trim()) {
      message.error(t('tasks.create_modal.title_required'));
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        project_id: selectedProjectId,
        title: title.trim(),
        description: description.trim() || null,
        status: status,
        priority: priority,
        type: taskType,
        assignee_id: assigneeId || null,
        start_date: startDate ? startDate.toISOString() : null,
        due_date: dueDate ? dueDate.toISOString() : null,
      };

      const res = await api.createTask(payload);
      if (res.success) {
        message.success(t('tasks.create_modal.create_success'));

        // Delete checklist item if we are converting
        if (checklistItemId) {
          try {
            await api.deleteChecklistItem(checklistItemId);
          } catch (err) {
            console.error('Failed to delete checklist item after task creation:', err);
          }
        }

        // Trigger onSuccess callback if present
        if (onSuccessCallback) {
          onSuccessCallback(res.data);
        }

        // Fire global event to notify lists/boards to refresh
        window.dispatchEvent(new Event('task-created-global'));

        handleClose();
      }
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || t('tasks.create_modal.create_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={handleClose}
      footer={null}
      width={540}
      closable={false}
      className="create-task-modal-v2"
      destroyOnHidden
      zIndex={1100}
    >
      <div className="create-task-modal-v2__wrapper">
        {/* Header */}
        <div className="create-task-modal-v2__header">
          <div className="header-left">
            <Select
              className="project-selector"
              placeholder={t('tasks.create_modal.select_project')}
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              suffixIcon={<ProjectOutlined />}
              bordered={false}
              popupClassName="project-selector-dropdown"
              showSearch
              optionLabelProp="label"
              popupMatchSelectWidth={false}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {projects.map((proj) => (
                <Select.Option key={proj.id} value={proj.id} label={proj.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="proj-dot" style={{ background: proj.color || '#6366f1' }} />
                    <span className="proj-name">{proj.name}</span>
                  </div>
                </Select.Option>
              ))}
            </Select>
            <span className="slash-divider">/</span>
            <Select
              value={taskType}
              onChange={(val) => setTaskType(val)}
              bordered={false}
              popupClassName="task-type-selector-dropdown"
              style={{ minWidth: 130 }}
              dropdownStyle={{ minWidth: 140 }}
              optionLabelProp="label"
            >
              <Select.Option value="task" label={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6366f1', fontWeight: 600, fontSize: '13px' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="#6366f1" opacity="0.15" stroke="#6366f1" strokeWidth="1.3" /><path d="M4.5 8L7 10.5L11.5 5.5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {t('task.type.task')}
                </span>
              }>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: '#6366f1', fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="#6366f1" opacity="0.15" stroke="#6366f1" strokeWidth="1.3" /><path d="M4.5 8L7 10.5L11.5 5.5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {t('task.type.task')}
                </span>
              </Select.Option>
              <Select.Option value="bug" label={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 600, fontSize: '13px' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="9" r="4.5" fill="#ef4444" /><path d="M6 4.5C6 3.4 6.9 2.5 8 2.5s2 .9 2 2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" fill="none" /><path d="M5 6.5L3 5M11 6.5L13 5" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /><path d="M4 9H2M12 9h2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /><path d="M5 11.5L3 13M11 11.5L13 13" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /><ellipse cx="8" cy="9" rx="2" ry="2.5" fill="#fca5a5" opacity="0.4" /></svg>
                  {t('task.type.bug')}
                </span>
              }>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: '#ef4444', fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="9" r="4.5" fill="#ef4444" /><path d="M6 4.5C6 3.4 6.9 2.5 8 2.5s2 .9 2 2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" fill="none" /><path d="M5 6.5L3 5M11 6.5L13 5" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /><path d="M4 9H2M12 9h2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /><path d="M5 11.5L3 13M11 11.5L13 13" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /><ellipse cx="8" cy="9" rx="2" ry="2.5" fill="#fca5a5" opacity="0.4" /></svg>
                  {t('task.type.bug')}
                </span>
              </Select.Option>
            </Select>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <CloseOutlined />
          </button>
        </div>

        {/* Body */}
        <div className="create-task-modal-v2__body">
          {/* Task Name */}
          <div className="task-title-input-wrapper">
            <Input
              className="task-title-input"
              placeholder={t('tasks.create_modal.task_placeholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              bordered={false}
            />
          </div>

          {/* Description */}
          <div className="task-desc-textarea-wrapper">
            <Input.TextArea
              className="task-desc-textarea"
              placeholder={t('tasks.create_modal.desc_placeholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoSize={{ minRows: 3, maxRows: 8 }}
              bordered={false}
            />
          </div>

          {/* Properties Grid - 1 Column Layout for Modal */}
          <div className="properties-grid" style={{ marginTop: '12px' }}>
            {/* 1. Trạng thái */}
            <div className="property-field">
              <span className="field-label">
                <CheckCircleOutlined style={{ fontSize: '14px', color: 'var(--text-muted)' }} /> {t('tasks.panel.status')}
              </span>
              <div className="field-value">
                <ClickUpStatusPicker
                  currentStatusId={status}
                  projectStatuses={projectStatuses.length > 0 ? projectStatuses : [
                    { id: 'todo', name: t('tasks.status.todo'), color: '#8c8c8c' },
                    { id: 'in_progress', name: t('tasks.status.in_progress'), color: '#1890ff' },
                    { id: 'done', name: t('tasks.status.done'), color: '#52c41a' }
                  ]}
                  onChange={setStatus}
                  hideCheckButton={true}
                  disabled={!selectedProjectId}
                />
              </div>
            </div>

            {/* 2. Người thực hiện */}
            <div className="property-field">
              <span className="field-label">
                <UserOutlined style={{ fontSize: '14px', color: 'var(--text-muted)' }} /> {t('tasks.panel.assignee')}
              </span>
              <div className="field-value">
                <Dropdown
                  disabled={!selectedProjectId}
                  trigger={['click']}
                  popupRender={() => (
                    <div style={{ background: 'var(--bg-card, #1e1e1e)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.25)', minWidth: '200px' }} className="assignee-dropdown-container">
                      <div style={{ fontSize: '11px', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('tasks.panel.assignee')}</div>
                      <div
                        onClick={() => setAssigneeId(undefined)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          background: !assigneeId ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          color: !assigneeId ? '#6366f1' : 'var(--text-primary)',
                        }}
                        className="status-item-hover"
                      >
                        <UserOutlined style={{ fontSize: '12px' }} />
                        <span style={{ fontSize: '12px' }}>{t('tasks.panel.assignee_placeholder')}</span>
                      </div>
                      {projectMembers.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => setAssigneeId(m.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            background: m.id === assigneeId ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                            color: m.id === assigneeId ? '#6366f1' : 'var(--text-primary)',
                          }}
                          className="status-item-hover"
                        >
                          <div style={{ background: '#6366f1', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '9px', fontWeight: 600, overflow: 'hidden', flexShrink: 0 }}>
                            {m.photo ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.name)}
                          </div>
                          <span style={{ fontSize: '12.5px' }}>{m.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                >
                  <div style={{ cursor: !selectedProjectId ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                    {assigneeId ? (
                      (() => {
                        const currentAssignee = projectMembers.find(m => m.id === assigneeId);
                        if (!currentAssignee) return null;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ background: '#6366f1', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '9px', fontWeight: 600, overflow: 'hidden' }}>
                              {currentAssignee.photo ? (
                                <img src={currentAssignee.photo} alt={currentAssignee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                getInitials(currentAssignee.name)
                              )}
                            </div>
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                              {currentAssignee.name}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <Tooltip title={t('tasks.panel.assignee_placeholder')}>
                        <div style={{ width: '22px', height: '22px', border: '1px dashed var(--text-muted, #9ca0b0)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
                          <UserOutlined style={{ color: 'var(--text-muted, #9ca0b0)', fontSize: '10px' }} />
                        </div>
                      </Tooltip>
                    )}
                  </div>
                </Dropdown>
              </div>
            </div>

            {/* 3. Độ ưu tiên */}
            <div className="property-field">
              <span className="field-label">
                <FlagOutlined style={{ fontSize: '14px', color: 'var(--text-muted)' }} /> {t('tasks.panel.priority')}
              </span>
              <div className="field-value">
                <PriorityPicker
                  value={priority}
                  onChange={setPriority}
                />
              </div>
            </div>

            {/* 4. Thời gian */}
            <div className="property-field">
              <span className="field-label">
                <CalendarOutlined style={{ fontSize: '14px', color: 'var(--text-muted)' }} /> {t('tasks.panel.time')}
              </span>
              <div className="field-value">
                <div className="premium-date-picker-group">
                  <DatePicker
                    showTime
                    format="DD/MM/YYYY HH:mm"
                    placeholder={t('tasks.panel.start_date_placeholder')}
                    value={startDate}
                    onChange={setStartDate}
                    className="premium-date-picker"
                    variant="borderless"
                  />
                  <span className="date-arrow">→</span>
                  <DatePicker
                    showTime
                    format="DD/MM/YYYY HH:mm"
                    placeholder={t('tasks.panel.due_date_placeholder')}
                    value={dueDate}
                    onChange={setDueDate}
                    className="premium-date-picker"
                    variant="borderless"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="create-task-modal-v2__footer">
          <div className="footer-left-hint">
            {checklistItemId && (
              <span className="convert-hint">
                🔄 {t('tasks.create_modal.converting')}
              </span>
            )}
          </div>
          <div className="footer-actions">
            <Button className="cancel-btn-v2" onClick={handleClose}>
              {t('tasks.create_modal.cancel')}
            </Button>
            <Button
              className="create-btn-v2"
              type="primary"
              onClick={handleCreate}
              loading={submitting}
              disabled={!title.trim() || !selectedProjectId}
            >
              {t('tasks.create_modal.create')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CreateTaskModal;
