

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Dropdown, message, Modal, Select, Button, Timeline, Tooltip, Spin, Popover, Input, DatePicker, InputNumber, Segmented } from 'antd';
import dayjs from 'dayjs';
import {
  RightOutlined,
  MoreOutlined,
  CloseOutlined,
  DeleteOutlined,
  PaperClipOutlined,
  CheckOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  SendOutlined,
  MessageOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  UserOutlined,
  FlagOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  CalendarOutlined,
  DownOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
  LockOutlined,
  GroupOutlined,
  BranchesOutlined,
  CopyOutlined,
  LinkOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useTranslation } from '../../utils/i18n';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import './MyTasksPage.scss';
import { TaskDetailPanel } from '../../components/tasks/TaskDetailPanel';
import { WorkflowTransitionModal } from '../../components/tasks/WorkflowTransitionModal';
import { TaskCalendar } from '../../components/tasks/TaskCalendar';
import ManualTimeLogModal from '../../components/tasks/ManualTimeLogModal';
import TaskTypeBadge from '../../components/tasks/TaskTypeBadge';

interface User {
  id: number;
  name: string;
  email: string;
  photo?: string;
  role?: string;
}

interface Project {
  id: number;
  name: string;
  color?: string;
  title?: string;
  members?: User[];
  statuses?: any[];
  labels?: any[];
}

interface TaskComment {
  id: number;
  comment: string;
  attachment_path?: string;
  created_at: string;
  user?: User;
  reactions?: { id: number; comment_id: number; user_id: number; reaction: string }[];
  parent_id?: number | null;
}

interface TaskActivity {
  id: number;
  action: string;
  details?: string;
  created_at: string;
  user?: User;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  type?: string;
  project_id: number;
  project?: Project;
  assignee_id?: number;
  assignee?: User;
  creator_id?: number;
  creator?: User;
  estimated_hours?: number;
  actual_hours?: number;
  start_date?: string;
  due_date?: string;
  labels?: { name: string; color: string; bg: string }[];
  comments?: TaskComment[];
  activities?: TaskActivity[];
  watcher_ids?: number[];
  subtasks?: Task[];
  parent_task_id?: number;
  time_entries?: any[];
}

const getFallbackStatusColumn = (task: Task) => {
  const statusId = task.status;
  const projectStatuses = task.project?.statuses || [];
  const statusObj = projectStatuses.find((s: any) => s.id === statusId);
  if (!statusObj) {
    if (statusId === 'done') return 'done';
    if (['in_progress', 'review'].includes(statusId)) return 'in_progress';
    return 'todo';
  }
  const type = statusObj.type;
  if (type === 'closed') return 'done';
  if (type === 'not_started') return 'todo';
  return 'in_progress';
};

const getFallbackStatusObj = (task: Task) => {
  const statusId = task.status;
  const projectStatuses = task.project?.statuses || [];
  const statusObj = projectStatuses.find((s: any) => s.id === statusId);
  if (statusObj) return statusObj;

  const defaults: Record<string, { id: string; name: string; color: string; type: string }> = {
    backlog: { id: 'backlog', name: 'BACKLOG', color: '#6b7084', type: 'not_started' },
    todo: { id: 'todo', name: 'TO DO', color: '#9ca0b0', type: 'not_started' },
    in_progress: { id: 'in_progress', name: 'IN PROGRESS', color: '#3b82f6', type: 'active' },
    review: { id: 'review', name: 'REVIEW', color: '#a855f7', type: 'active' },
    done: { id: 'done', name: 'COMPLETE', color: '#22c55e', type: 'closed' },
  };
  return defaults[statusId] || { id: statusId, name: statusId.toUpperCase().replace('_', ' '), color: '#9ca0b0', type: 'active' };
};

const ClickUpStatusPicker: React.FC<{
  currentStatusId: string;
  projectStatuses: any[];
  onChange: (val: string) => void;
  disabled?: boolean;
}> = ({
  currentStatusId,
  projectStatuses,
  onChange,
  disabled
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [open, setOpen] = useState(false);

    // Default statuses if project has none
    const statuses = projectStatuses.length > 0 ? projectStatuses : [
      { id: 'todo', name: 'TO DO', color: '#9ca0b0', type: 'not_started', position: 0 },
      { id: 'in_progress', name: 'IN PROGRESS', color: '#3b82f6', type: 'active', position: 1 },
      { id: 'review', name: 'REVIEW', color: '#a855f7', type: 'active', position: 2 },
      { id: 'done', name: 'COMPLETE', color: '#22c55e', type: 'closed', position: 3 },
    ];

    const currentStatus = statuses.find(s => s.id === currentStatusId) || statuses[0];
    const isClosed = currentStatus?.type === 'closed';

    const toggleComplete = () => {
      if (disabled) return;
      const closedStatus = statuses.find(s => s.type === 'closed') || statuses[statuses.length - 1];
      const notStartedStatus = statuses.find(s => s.type === 'not_started') || statuses[0];
      onChange(isClosed ? notStartedStatus?.id : closedStatus?.id);
    };

    const groupedStatuses = {
      not_started: statuses.filter(s => s.type === 'not_started' && s.name.toLowerCase().includes(searchTerm.toLowerCase())),
      active: statuses.filter(s => (s.type === 'active' || s.type === 'done' || !s.type) && s.name.toLowerCase().includes(searchTerm.toLowerCase())),
      closed: statuses.filter(s => s.type === 'closed' && s.name.toLowerCase().includes(searchTerm.toLowerCase())),
    };

    const popoverContent = (
      <div style={{ width: '240px', padding: '4px' }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          placeholder="Tìm kiếm trạng thái..."
          variant="filled"
          size="small"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ marginBottom: '8px' }}
          autoFocus
        />
        <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(groupedStatuses).map(([groupKey, list]) => {
            if (list.length === 0) return null;
            const groupTitle = groupKey === 'not_started' ? 'Cần làm' : groupKey === 'active' ? 'Đang làm' : 'Hoàn thành';
            return (
              <div key={groupKey}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 8px 4px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
                  {groupTitle}
                </div>
                {list.map((st: any) => {
                  const isSelected = st.id === currentStatusId;
                  let bullet = null;
                  if (st.type === 'closed') {
                    bullet = <CheckCircleOutlined style={{ color: st.color, fontSize: '14px' }} />;
                  } else if (st.type === 'not_started') {
                    bullet = <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px dashed ${st.color}`, display: 'inline-block' }} />;
                  } else {
                    bullet = <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${st.color}`, display: 'inline-block' }} />;
                  }

                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        onChange(st.id);
                        setOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        transition: 'background 0.2s',
                      }}
                      className="status-item-hover"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {bullet}
                        <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                          {st.name}
                        </span>
                      </div>
                      {isSelected && <CheckOutlined style={{ color: 'var(--primary)', fontSize: '12px' }} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1px', background: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden', width: 'fit-content', border: '1px solid var(--border-color)' }}>
        <Tooltip title={isClosed ? "Mở lại công việc" : "Hoàn thành công việc"}>
          <button
            onClick={toggleComplete}
            disabled={disabled}
            style={{
              background: isClosed ? '#22c55e' : 'var(--bg-card)',
              border: 'none',
              color: isClosed ? '#fff' : 'var(--text-muted)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 10px',
              fontSize: '14px',
              height: '30px',
              transition: 'all 0.2s',
              outline: 'none',
            }}
            className="clickup-status-checkbox"
          >
            {isClosed ? <CheckOutlined /> : <CheckCircleOutlined />}
          </button>
        </Tooltip>

        <Popover
          content={popoverContent}
          trigger={disabled ? [] as any : 'click'}
          open={disabled ? false : open}
          onOpenChange={setOpen}
          placement="bottomLeft"
        >
          <button
            disabled={disabled}
            style={{
              background: currentStatus?.color || '#9ca0b0',
              border: 'none',
              color: '#fff',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              height: '30px',
              outline: 'none',
            }}
          >
            {currentStatus?.name} <DownOutlined style={{ fontSize: '9px' }} />
          </button>
        </Popover>
      </div>
    );
  };

// ===== PRIORITY CONFIG =====
const MY_PRIORITIES = [
  { id: 'urgent', name: 'Khẩn cấp', color: '#ef4444' },
  { id: 'high', name: 'Cao', color: '#f97316' },
  { id: 'medium', name: 'Trung bình', color: '#f59e0b' },
  { id: 'low', name: 'Thấp', color: '#3b82f6' },
];

const MyFlagIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const MyPriorityPicker: React.FC<{ value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const current = MY_PRIORITIES.find(p => p.id === value) || MY_PRIORITIES[2];

  return (
    <Popover
      content={
        <div style={{ width: '200px', padding: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px 6px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>Độ ưu tiên</div>
          {MY_PRIORITIES.map(p => (
            <div key={p.id} onClick={() => { onChange(p.id); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 8px', borderRadius: '6px', cursor: 'pointer', background: p.id === value ? 'rgba(59,130,246,0.08)' : 'transparent' }} className="status-item-hover">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MyFlagIcon color={p.color} size={15} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: p.id === value ? 'var(--primary)' : 'var(--text-primary)' }}>{p.name}</span>
              </div>
              {p.id === value && <CheckOutlined style={{ color: 'var(--primary)', fontSize: '11px' }} />}
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '4px', paddingTop: '4px' }}>
            <div onClick={() => { onChange('medium'); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px' }} className="status-item-hover">
              <CloseOutlined style={{ fontSize: '11px' }} /> Xóa ưu tiên
            </div>
          </div>
        </div>
      }
      trigger={disabled ? ([] as any) : 'click'}
      open={disabled ? false : open}
      onOpenChange={setOpen}
      placement="bottomLeft"
    >
      <button disabled={disabled} style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', height: '30px', cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none' }} className="status-item-hover">
        <MyFlagIcon color={current.color} size={14} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: current.color }}>{current.name}</span>
        <DownOutlined style={{ fontSize: '8px', color: 'var(--text-muted)' }} />
      </button>
    </Popover>
  );
};

// ===== DEBOUNCED SEARCH INPUT COMPONENT =====
interface DebouncedSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  style?: React.CSSProperties;
  className?: string;
  variant?: 'outlined' | 'borderless' | 'filled';
}

const DebouncedSearchInput: React.FC<DebouncedSearchInputProps> = ({
  value,
  onChange,
  placeholder,
  style,
  className,
  variant
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
    <Input
      prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
      placeholder={placeholder}
      variant={variant}
      allowClear
      value={localValue}
      onChange={e => setLocalValue(e.target.value || '')}
      style={style}
      className={className}
    />
  );
};

// ===== MY TASKS FILTER POPOVER COMPONENT =====
interface MyTasksFilterPopoverProps {
  taskList: any[];
  counts: { all: number; active: number; today: number; this_week: number; overdue: number; done: number; no_date: number };
  t: any;
  // Parent state values
  filter: string;
  typeFilter: string;
  priorityFilter: string[];
  projectFilter: number[];
  // Parent update functions
  setFilter: (val: string) => void;
  setTypeFilter: (val: string) => void;
  setPriorityFilter: (val: string[]) => void;
  setProjectFilter: (val: number[]) => void;
  handleFilterChange: (val: string) => void;
}

const MyTasksFilterPopover: React.FC<MyTasksFilterPopoverProps> = ({
  taskList,
  counts,
  t,
  filter,
  typeFilter,
  priorityFilter,
  projectFilter,
  setFilter,
  setTypeFilter,
  setPriorityFilter,
  setProjectFilter,
  handleFilterChange,
}) => {
  const [open, setOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('type');

  // Local state for filters
  const [localFilter, setLocalFilter] = useState(filter);
  const [localTypeFilter, setLocalTypeFilter] = useState(typeFilter);
  const [localPriorityFilter, setLocalPriorityFilter] = useState(priorityFilter);
  const [localProjectFilter, setLocalProjectFilter] = useState(projectFilter);

  // Sync external changes (e.g. clear filters)
  useEffect(() => {
    setLocalFilter(filter);
    setLocalTypeFilter(typeFilter);
    setLocalPriorityFilter(priorityFilter);
    setLocalProjectFilter(projectFilter);
  }, [filter, typeFilter, priorityFilter, projectFilter]);

  // Propagate to parent helper
  const propagateFilters = useCallback((filters: {
    filter: string;
    typeFilter: string;
    priorityFilter: string[];
    projectFilter: number[];
  }) => {
    if (filters.filter !== filter) {
      handleFilterChange(filters.filter);
    }
    setTypeFilter(filters.typeFilter);
    setPriorityFilter(filters.priorityFilter);
    setProjectFilter(filters.projectFilter);
  }, [filter, handleFilterChange, setTypeFilter, setPriorityFilter, setProjectFilter]);

  // Debounced apply
  useEffect(() => {
    const timer = setTimeout(() => {
      propagateFilters({
        filter: localFilter,
        typeFilter: localTypeFilter,
        priorityFilter: localPriorityFilter,
        projectFilter: localProjectFilter
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [localFilter, localTypeFilter, localPriorityFilter, localProjectFilter, propagateFilters]);

  // Force propagation on close
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      propagateFilters({
        filter: localFilter,
        typeFilter: localTypeFilter,
        priorityFilter: localPriorityFilter,
        projectFilter: localProjectFilter
      });
    }
  };

  const handleLocalClear = () => {
    setLocalFilter('all');
    setLocalTypeFilter('all');
    setLocalPriorityFilter([]);
    setLocalProjectFilter([]);
    // also clear parent
    handleFilterChange('all');
    setTypeFilter('all');
    setPriorityFilter([]);
    setProjectFilter([]);
  };

  const activeCount =
    (localFilter !== 'all' ? 1 : 0) +
    (localTypeFilter !== 'all' ? 1 : 0) +
    (localPriorityFilter.length > 0 ? 1 : 0) +
    (localProjectFilter.length > 0 ? 1 : 0);
  const hasFilter = activeCount > 0;

  const filterCategories = [
    { key: 'type', label: t('task.type.label'), badge: localTypeFilter !== 'all' },
    { key: 'status', label: t('tasks.group.status'), badge: localFilter !== 'all' },
    { key: 'priority', label: t('tasks.filter.priority' as any) || 'Độ ưu tiên', badge: localPriorityFilter.length > 0 },
    { key: 'project', label: t('tasks.filter.project' as any) || 'Dự án', badge: localProjectFilter.length > 0 },
  ] as const;

  const typeOptions = [
    { value: 'task', label: t('task.type.task'), icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="#6366f1" opacity="0.15" stroke="#6366f1" strokeWidth="1.3" /><path d="M4.5 8L7 10.5L11.5 5.5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> },
    { value: 'bug', label: t('task.type.bug'), icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="9" r="4.5" fill="#ef4444" /><path d="M6 4.5C6 3.4 6.9 2.5 8 2.5s2 .9 2 2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" fill="none" /><path d="M5 6.5L3 5M11 6.5L13 5" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /><path d="M4 9H2M12 9h2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /><path d="M5 11.5L3 13M11 11.5L13 13" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /></svg> },
  ] as const;

  const statusOptions = [
    { value: 'all', label: t('tasks.filter.all') || 'Tất cả', count: counts.all },
    { value: 'active', label: t('tasks.filter.active') || 'Đang thực hiện', count: counts.active },
    { value: 'today', label: t('tasks.filter.today' as any) || 'Hôm nay', count: counts.today },
    { value: 'this_week', label: t('tasks.filter.this_week' as any) || 'Tuần này', count: counts.this_week },
    { value: 'overdue', label: t('tasks.filter.overdue') || 'Quá hạn', count: counts.overdue },
    { value: 'done', label: t('tasks.filter.done') || 'Đã xong', count: counts.done },
    { value: 'no_date', label: t('tasks.filter.no_date' as any) || 'Không thời hạn', count: counts.no_date },
  ] as const;

  const priorityOptions = [
    { value: 'urgent', label: t('tasks.priority.urgent'), color: '#ef4444' },
    { value: 'high', label: t('tasks.priority.high'), color: '#f97316' },
    { value: 'medium', label: t('tasks.priority.medium'), color: '#f59e0b' },
    { value: 'low', label: t('tasks.priority.low'), color: '#6b7084' },
  ] as const;

  const projectOptions = Array.from(
    new Map(taskList.filter(t => t.project).map(t => [t.project_id, t.project])).entries()
  ).map(([id, proj]) => ({ id: id as number, name: (proj as any)?.name || `#${id}`, color: (proj as any)?.color || '#6366f1' }));

  const CheckRow = ({ checked, onClick, icon, label, count, dotColor }: {
    checked: boolean; onClick: () => void; icon?: React.ReactNode;
    label: string; count?: number; dotColor?: string;
  }) => (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 10px', borderRadius: '7px', cursor: 'pointer',
      background: checked ? 'rgba(99,102,241,0.08)' : 'transparent',
      transition: 'background 0.12s',
    }} className="status-item-hover">
      <span style={{
        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
        border: checked ? '2px solid var(--primary)' : '2px solid var(--border-color)',
        background: checked ? 'var(--primary)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s',
      }}>
        {checked && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      {dotColor && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />}
      {icon}
      <span style={{ flex: 1, fontSize: '13px', fontWeight: checked ? 600 : 400, color: 'var(--text-primary)' }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 7px', borderRadius: '10px' }}>{count}</span>}
    </div>
  );

  const filterPanel = (
    <div style={{ width: 480, display: 'flex', flexDirection: 'column', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
      <div style={{ display: 'flex', minHeight: 300 }}>
        <div style={{ width: 160, borderRight: '1px solid var(--border-color)', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
          {filterCategories.map(cat => {
            const isActive = cat.key === filterCategory;
            return (
              <div key={cat.key} onClick={() => setFilterCategory(cat.key)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'rgba(99,102,241,0.10)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'all 0.12s',
              }}>
                <span>{cat.label}</span>
                {cat.badge && (
                  <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: 700, padding: '1px 6px', minWidth: '18px', textAlign: 'center' }}>✓</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', maxHeight: 360 }}>
          {filterCategory === 'type' && typeOptions.map(opt => (
            <CheckRow key={opt.value}
              checked={localTypeFilter === opt.value}
              onClick={() => setLocalTypeFilter(localTypeFilter === opt.value ? 'all' : opt.value)}
              icon={opt.icon} label={opt.label}
            />
          ))}

          {filterCategory === 'status' && statusOptions.map(opt => (
            <CheckRow key={opt.value}
              checked={localFilter === opt.value}
              onClick={() => setLocalFilter(opt.value)}
              label={opt.label} count={opt.count}
            />
          ))}

          {filterCategory === 'priority' && priorityOptions.map(opt => (
            <CheckRow key={opt.value}
              checked={localPriorityFilter.includes(opt.value)}
              onClick={() => setLocalPriorityFilter(prev =>
                prev.includes(opt.value) ? prev.filter(p => p !== opt.value) : [...prev, opt.value]
              )}
              dotColor={opt.color} label={opt.label}
              count={taskList.filter(t => t.priority === opt.value).length}
            />
          ))}

          {filterCategory === 'project' && (
            projectOptions.length === 0
              ? <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>{t('tasks.no_project')}</div>
              : projectOptions.map(proj => (
                <CheckRow key={proj.id}
                  checked={localProjectFilter.includes(proj.id)}
                  onClick={() => setLocalProjectFilter(prev =>
                    prev.includes(proj.id) ? prev.filter(id => id !== proj.id) : [...prev, proj.id]
                  )}
                  icon={<span style={{ width: '8px', height: '8px', borderRadius: '50%', background: proj.color, flexShrink: 0 }} />}
                  label={proj.name}
                  count={taskList.filter(t => t.project_id === proj.id).length}
                />
              ))
          )}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
      }}>
        <button
          onClick={handleLocalClear}
          style={{ background: 'transparent', border: 'none', color: hasFilter ? '#ef4444' : 'var(--text-muted)', cursor: hasFilter ? 'pointer' : 'default', fontSize: '12px', fontWeight: 500, padding: 0 }}
        >
          {t('common.clear_filter')}
        </button>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {activeCount > 0 ? t('task.filter.active_count', { count: activeCount }) : t('task.filter.all_types')}
        </span>
      </div>
    </div>
  );

  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      overlayStyle={{ padding: 0 }}
      overlayInnerStyle={{ padding: 0, borderRadius: '10px', overflow: 'hidden' }}
      content={filterPanel}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <button style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
        border: hasFilter ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
        background: hasFilter ? 'rgba(99,102,241,0.10)' : 'var(--bg-card)',
        color: hasFilter ? 'var(--primary)' : 'var(--text-secondary)',
        fontSize: '13px', fontWeight: 500, outline: 'none', transition: 'all 0.15s',
      }}>
        <FilterOutlined style={{ fontSize: '13px' }} />
        {t('common.filter')}
        {hasFilter && (
          <span style={{
            background: 'var(--primary)', color: '#fff',
            borderRadius: '10px', fontSize: '10px', fontWeight: 700,
            padding: '1px 6px', minWidth: '18px', textAlign: 'center',
          }}>
            {activeCount}
          </span>
        )}
      </button>
    </Popover>
  );
};

// ===== TIME TRACKER FOR MY TASKS =====
const myFormatDuration = (seconds: number): string => {
  const total = Math.abs(seconds || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};

const calculateWorkingMinutes = (start: string, due: string): number => {
  if (!start || !due) return 0;
  const startDate = new Date(start);
  const dueVal = new Date(due);
  if (isNaN(startDate.getTime()) || isNaN(dueVal.getTime()) || dueVal <= startDate) return 0;

  const ICT_OFFSET = 7 * 60 * 60 * 1000;
  const startIctMs = startDate.getTime() + ICT_OFFSET;
  const dueIctMs = dueVal.getTime() + ICT_OFFSET;

  const getIctDateKey = (ms: number) => {
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dt = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  };

  const getWorkingMinutesForDay = (dayOfWeek: number, startMin: number, endMin: number): number => {
    if (dayOfWeek === 0) return 0;
    if (dayOfWeek === 6) {
      return Math.max(0, Math.min(endMin, 720) - Math.max(startMin, 480));
    }
    const overlap1 = Math.max(0, Math.min(endMin, 720) - Math.max(startMin, 480));
    const overlap2 = Math.max(0, Math.min(endMin, 1020) - Math.max(startMin, 780));
    return overlap1 + overlap2;
  };

  const startDateKey = getIctDateKey(startIctMs);
  const dueDateKey = getIctDateKey(dueIctMs);

  if (startDateKey === dueDateKey) {
    const d = new Date(startIctMs);
    const dayOfWeek = d.getUTCDay();
    const startMin = d.getUTCHours() * 60 + d.getUTCMinutes();
    
    const dDue = new Date(dueIctMs);
    const dueMin = dDue.getUTCHours() * 60 + dDue.getUTCMinutes();

    return getWorkingMinutesForDay(dayOfWeek, startMin, dueMin);
  }

  let totalMinutes = 0;
  const startMidnight = new Date(startDateKey + 'T00:00:00Z').getTime();
  const dueMidnight = new Date(dueDateKey + 'T00:00:00Z').getTime();

  const oneDayMs = 24 * 60 * 60 * 1000;
  for (let currentMidnight = startMidnight; currentMidnight <= dueMidnight; currentMidnight += oneDayMs) {
    const currentIctDate = new Date(currentMidnight);
    const dayOfWeek = currentIctDate.getUTCDay();
    const currentDateKey = getIctDateKey(currentMidnight);

    let startMin = 0;
    let endMin = 24 * 60;

    if (currentDateKey === startDateKey) {
      const dStart = new Date(startIctMs);
      startMin = dStart.getUTCHours() * 60 + dStart.getUTCMinutes();
    }
    if (currentDateKey === dueDateKey) {
      const dDue = new Date(dueIctMs);
      endMin = dDue.getUTCHours() * 60 + dDue.getUTCMinutes();
    }

    totalMinutes += getWorkingMinutesForDay(dayOfWeek, startMin, endMin);
  }

  return totalMinutes;
};

const calculateEstimateHours = (start: string, due: string): number | null => {
  if (!start || !due) return null;
  const totalWorkingMinutes = calculateWorkingMinutes(start, due);
  return Math.round(totalWorkingMinutes / 60);
};
const formatEstimate = (start: string, due: string): string => {
  if (!start || !due) return '—';
  const totalWorkingMinutes = calculateWorkingMinutes(start, due);
  if (totalWorkingMinutes <= 0) return '—';

  const hours = Math.floor(totalWorkingMinutes / 60);
  const minutes = totalWorkingMinutes % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0) parts.push(`${minutes} phút`);
  return parts.length > 0 ? parts.join(' ') : '< 1 phút';
};
const MyTimeTracker: React.FC<{ taskId: number; timeEntries: any[]; onUpdate: () => void; disabled?: boolean }> = ({ taskId, timeEntries = [], onUpdate, disabled }) => {
  const [running, setRunning] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [manualDate, setManualDate] = useState<any>(null);
  const [manualDesc, setManualDesc] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (showManualAdd) {
      setManualDate(dayjs());
    } else {
      setManualHours(0);
      setManualMinutes(0);
      setManualDesc('');
      setManualDate(null);
    }
  }, [showManualAdd]);

  useEffect(() => {
    const r = timeEntries.find((e: any) => !e.ended_at);
    setRunning(r || null);
    if (r) {
      const started = new Date(r.started_at).getTime();
      const offset = Number(localStorage.getItem('taskflow_server_time_offset') || 0);
      setElapsed(Math.max(0, Math.floor((Date.now() + offset - started) / 1000)));
    }
  }, [timeEntries]);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        const started = new Date(running.started_at).getTime();
        const offset = Number(localStorage.getItem('taskflow_server_time_offset') || 0);
        setElapsed(Math.max(0, Math.floor((Date.now() + offset - started) / 1000)));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  const totalTracked = timeEntries.filter((e: any) => e.ended_at).reduce((sum: number, e: any) => sum + Math.abs(e.duration || 0), 0);
  const hasTimeLogs = timeEntries.length > 0;
  const handleStart = async () => {
    try {
      await api.startTimer(taskId);
      window.dispatchEvent(new Event('timer-updated'));
      onUpdate();
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.detail_toast.timer_start_err'));
    }
  };

  const handleStop = async () => {
    try {
      await api.stopTimer(taskId);
      window.dispatchEvent(new Event('timer-updated'));
      onUpdate();
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.detail_toast.timer_stop_err'));
    }
  };

  const handleAddManual = async () => {
    const totalSec = (manualHours * 3600) + (manualMinutes * 60);
    if (totalSec <= 0) {
      message.warning(t('tasks.panel.invalid_time'));
      return;
    }
    try {
      const payload: any = {
        duration: totalSec,
        description: manualDesc || undefined,
      };
      if (manualDate) {
        payload.started_at = manualDate.toISOString();
      }
      await api.addManualTime(taskId, payload);
      setManualHours(0);
      setManualMinutes(0);
      setManualDate(null);
      setManualDesc('');
      setShowManualAdd(false);
      window.dispatchEvent(new Event('timer-updated'));
      onUpdate();
      message.success(t('tasks.detail_toast.time_added'));
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.detail_toast.time_add_err'));
    }
  };

  const manualAddContent = (
    <div className="manual-time-container">
      <div className="manual-time-header">
        <ClockCircleOutlined className="header-icon" />
        <span>{t('tasks.panel.add_manual_time')}</span>
      </div>

      <div className="manual-time-section">
        <span className="section-label">{t('tasks.panel.time')}</span>
        <div className="manual-time-duration-grid">
          <div className="manual-time-duration-card">
            <input
              type="number"
              min={0}
              placeholder="0"
              value={manualHours || ''}
              onChange={e => setManualHours(Math.max(0, Number(e.target.value) || 0))}
            />
            <span className="duration-unit">h</span>
          </div>
          <div className="manual-time-duration-card">
            <input
              type="number"
              min={0}
              max={59}
              placeholder="0"
              value={manualMinutes || ''}
              onChange={e => setManualMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
            />
            <span className="duration-unit">m</span>
          </div>
        </div>
      </div>

      <div className="manual-time-section">
        <span className="section-label">{t('tasks.panel.start_time')}</span>
        <div className="manual-time-datepicker">
          <DatePicker
            showTime
            format="DD/MM/YYYY HH:mm"
            value={manualDate}
            onChange={setManualDate}
            placeholder={t('tasks.panel.start_time')}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div className="manual-time-section">
        <span className="section-label">{t('tasks.panel.time_tracking_note_placeholder')}</span>
        <Input.TextArea
          rows={2}
          placeholder={t('tasks.panel.time_tracking_note_placeholder')}
          value={manualDesc}
          onChange={e => setManualDesc(e.target.value)}
          className="manual-time-textarea"
        />
      </div>

      <div className="manual-time-actions">
        <button className="btn-cancel" onClick={() => setShowManualAdd(false)}>
          {t('tasks.panel.cancel')}
        </button>
        <button className="btn-save" onClick={handleAddManual}>
          {t('tasks.panel.save_short')}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(120, 120, 120, 0.05)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '4px 12px', width: 'fit-content' }}>
      {/* Play/Stop Trigger */}
      {running ? (
        <Tooltip title={t('tasks.panel.stop_timer')}>
          <button
            onClick={handleStop}
            disabled={disabled}
            style={{ background: 'none', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0, outline: 'none' }}
          >
            <PauseCircleOutlined style={{ fontSize: '16px' }} />
          </button>
        </Tooltip>
      ) : (
        <Tooltip title={t('tasks.panel.start_timer')}>
          <button
            onClick={handleStart}
            disabled={disabled}
            style={{ background: 'none', border: 'none', color: '#22c55e', display: 'flex', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer', padding: 0, outline: 'none' }}
          >
            <PlayCircleOutlined style={{ fontSize: '16px' }} />
          </button>
        </Tooltip>
      )}

      <span style={{ width: '1px', height: '12px', background: 'var(--border-color)' }} />

      {/* Time Display & Add trigger linked to Popover */}
      <Popover
        trigger={disabled ? [] as any : "click"}
        open={disabled ? false : showManualAdd}
        onOpenChange={(open) => !disabled && setShowManualAdd(open)}
        placement="bottomLeft"
        content={manualAddContent}
        overlayClassName="manual-time-popover"
      >
        <div style={{ display: 'flex', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer' }}>
          {running ? (
            <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span className="timer-dot-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              {myFormatDuration(elapsed)}
            </span>
          ) : hasTimeLogs ? (
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {myFormatDuration(totalTracked)}
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: disabled ? 'var(--text-secondary)' : 'var(--primary)', fontWeight: 600 }}>
              {t('tasks.panel.add_time')}
            </span>
          )}
        </div>
      </Popover>
    </div>
  );
};

const MyTasksPage: React.FC = () => {
  const { t, lang, locale } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isTaskDone = (t: Task) => {
    const projectStatuses = t.project?.statuses || [];
    const statusObj = projectStatuses.find((s: any) => s.id === t.status);
    if (statusObj) return statusObj.type === 'closed';
    return t.status === 'done';
  };

  const isTaskActive = (t: Task) => {
    const projectStatuses = t.project?.statuses || [];
    const statusObj = projectStatuses.find((s: any) => s.id === t.status);
    if (statusObj) return statusObj.type !== 'closed';
    return !['done', 'backlog'].includes(t.status);
  };
  const [me, setMe] = useState<User | null>(null);
  const [runningTimer, setRunningTimer] = useState<any>(null);

  const fetchRunningTimer = async () => {
    try {
      const res = await api.getRunningTimer();
      if (res && res.success) {
        setRunningTimer(res.data);
      } else {
        setRunningTimer(null);
      }
    } catch (err) {
      console.error(err);
      setRunningTimer(null);
    }
  };

  useEffect(() => {
    fetchRunningTimer();
    window.addEventListener('timer-updated', fetchRunningTimer);
    return () => {
      window.removeEventListener('timer-updated', fetchRunningTimer);
    };
  }, []);

  const handleStartTimer = async (taskId: string | number) => {
    try {
      await api.startTimer(taskId);
      window.dispatchEvent(new Event('timer-updated'));
      message.success(t('tasks.detail_toast.timer_start_success') || 'Bắt đầu tính giờ');
      refreshTasks();
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.detail_toast.timer_start_err'));
    }
  };

  const handleStopTimer = async (taskId: string | number) => {
    try {
      await api.stopTimer(taskId);
      window.dispatchEvent(new Event('timer-updated'));
      message.success(t('tasks.detail_toast.timer_stop_success') || 'Đã dừng tính giờ');
      refreshTasks();
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.detail_toast.timer_stop_err'));
    }
  };

  const handleCloneTask = async (taskId: string | number) => {
    try {
      const res = await api.cloneTask(taskId);
      if (res.success) {
        message.success(res.message || t('tasks.detail_toast.clone_success') || 'Nhân bản công việc thành công');
        refreshTasks();
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.detail_toast.clone_err') || 'Không thể nhân bản công việc');
    }
  };

  const getTaskMenuItems = (task: Task) => {
    const editPerm = canEditTask(task);
    const deletePerm = canDeleteTask(task);
    const menuItems: any[] = [];

    // 1. Details
    menuItems.push({
      key: 'details',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <InfoCircleOutlined style={{ fontSize: '13px' }} />
          {t('tasks.panel.view_details')}
        </span>
      ),
      onClick: () => setSelectedTask(task)
    });

    // 2. Add subtask (if editable)
    if (editPerm) {
      menuItems.push({
        key: 'add_subtask',
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusOutlined style={{ fontSize: '13px' }} />
            {t('tasks.panel.add_subtask')}
          </span>
        ),
        onClick: () => setSelectedTask(task)
      });
    }

    // 3. Mark Done / Log Time / Reassign (specific to My Tasks)
    if (editPerm) {
      if (!isTaskDone(task)) {
        menuItems.push({
          key: 'done',
          label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircleOutlined style={{ fontSize: '13px' }} />
              {t('tasks.action.mark_done' as any)}
            </span>
          ),
          onClick: () => handleMarkDone(task.id)
        });
        menuItems.push({
          key: 'logtime',
          label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClockCircleOutlined style={{ fontSize: '13px' }} />
              {t('tasks.panel.log_time')}
            </span>
          ),
          onClick: () => setLogTimeTaskId(task.id)
        });
      }
      menuItems.push({
        key: 'reassign',
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserOutlined style={{ fontSize: '13px' }} />
            {t('tasks.action.reassign' as any)}
          </span>
        ),
        onClick: () => handleReassignOpen(task.id, task.assignee_id, task.project_id)
      });
    }

    // 4. Copy Link
    menuItems.push({
      key: 'copy_link',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LinkOutlined style={{ fontSize: '13px' }} />
          {t('tasks.panel.copy_url')}
        </span>
      ),
      onClick: () => {
        const link = `${window.location.origin}/projects/${task.project_id}?task_id=${task.id}`;
        navigator.clipboard.writeText(link);
        message.success(t('tasks.detail_toast.copy_url_success'));
      }
    });

    // 5. Copy ID
    menuItems.push({
      key: 'copy_id',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CopyOutlined style={{ fontSize: '13px' }} />
          {t('tasks.panel.copy_id')}
        </span>
      ),
      onClick: () => {
        navigator.clipboard.writeText(`#${task.id}`);
        message.success(t('tasks.detail_toast.copy_id_success'));
      }
    });

    // 6. Open in New Tab
    menuItems.push({
      key: 'new_tab',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExportOutlined style={{ fontSize: '13px' }} />
          {t('tasks.panel.new_tab')}
        </span>
      ),
      onClick: () => {
        const link = `${window.location.origin}/projects/${task.project_id}?task_id=${task.id}`;
        window.open(link, '_blank');
      }
    });

    // 7. Watch/Unwatch
    const isWatching = me?.id && task.watcher_ids?.includes(me.id);
    if (Number(task.assignee_id) !== Number(me?.id)) {
      menuItems.push({
        key: 'toggle_watch',
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isWatching ? (
              <EyeInvisibleOutlined style={{ fontSize: '13px' }} />
            ) : (
              <EyeOutlined style={{ fontSize: '13px' }} />
            )}
            {isWatching ? t('tasks.panel.unwatch') : t('tasks.panel.watch')}
          </span>
        ),
        onClick: () => handleToggleWatchTask(task.id)
      });
    }

    // 8. Start/Stop Timer
    const isTimerRunning = runningTimer && Number(runningTimer.task_id) === Number(task.id);
    menuItems.push({
      key: 'toggle_timer',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isTimerRunning ? (
            <PauseCircleOutlined style={{ fontSize: '13px', color: '#ef4444' }} />
          ) : (
            <PlayCircleOutlined style={{ fontSize: '13px', color: '#22c55e' }} />
          )}
          {isTimerRunning ? t('tasks.panel.stop_timer') : t('tasks.panel.start_timer')}
        </span>
      ),
      onClick: () => isTimerRunning ? handleStopTimer(task.id) : handleStartTimer(task.id)
    });

    // 9. Duplicate (if editable)
    if (editPerm) {
      menuItems.push({
        key: 'duplicate',
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BranchesOutlined style={{ fontSize: '13px' }} />
            {t('tasks.panel.duplicate')}
          </span>
        ),
        onClick: () => handleCloneTask(task.id)
      });
    }

    // 10. Delete (if deletable)
    if (deletePerm) {
      menuItems.push({ type: 'divider' });
      menuItems.push({
        key: 'delete',
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
            <DeleteOutlined style={{ fontSize: '13px' }} />
            {t('tasks.panel.delete')}
          </span>
        ),
        danger: true,
        onClick: () => handleDeleteTask(task.id)
      });
    }

    return menuItems;
  };
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [taskSource, setTaskSource] = useState<'assigned_to_me' | 'delegated_by_me'>('assigned_to_me');
  const [selectedProjectForReassign, setSelectedProjectForReassign] = useState<any>(null);

  // Workflow guided transition states
  const [wfModalOpen, setWfModalOpen] = useState(false);
  const [wfTask, setWfTask] = useState<any>(null);
  const [wfTargetStatus, setWfTargetStatus] = useState<string>('');
  const [wfTargetStatusName, setWfTargetStatusName] = useState<string>('');
  const [wfFailedRules, setWfFailedRules] = useState<any[]>([]);
  const [onWfSuccessCallback, setOnWfSuccessCallback] = useState<((updatedTask: any) => void) | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Grouping
  const [filter, setFilter] = useState(() => searchParams.get('filter') || 'all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState('priority');
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar'>('list');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    todo: true,
    in_progress: true,
    review: true,
    done: true,
    urgent: true,
    high: true,
    medium: true,
    low: true,
    none: true,
  });

  // Action Modals State
  const [actionTaskId, setActionTaskId] = useState<number | null>(null);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [newAssigneeId, setNewAssigneeId] = useState<number | undefined>(undefined);
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [newDeadlineDate, setNewDeadlineDate] = useState('');

  // Manual time logging states
  const [logTimeTaskId, setLogTimeTaskId] = useState<number | null>(null);

  // Drag & drop
  const draggedTaskRef = useRef<number | null>(null);

  // Slide-in Task Detail Panel State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<string>('todo');
  const [editPriority, setEditPriority] = useState<string>('medium');
  const [editAssigneeId, setEditAssigneeId] = useState<number | null>(null);
  const [editEstHours, setEditEstHours] = useState<number | null>(null);
  const [editActHours, setEditActHours] = useState<number | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskAssigneeId, setSubtaskAssigneeId] = useState<number | undefined>(undefined);
  const [subtaskPriority, setSubtaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [panelTab, setPanelTab] = useState<'comments' | 'history'>('comments');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentFile, setNewCommentFile] = useState<File | null>(null);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);

  // Pagination state for comments & activities
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [activitiesHasMore, setActivitiesHasMore] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Mentions, reactions & emoji states
  const [commentFilePreview, setCommentFilePreview] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);

  // Reply states
  const [replyingToCommentId, setReplyingToCommentId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replyFilePreview, setReplyFilePreview] = useState<string | null>(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Record<number, boolean>>({});

  const getReactionEmoji = (type: string) => {
    switch (type) {
      case 'like': return '👍';
      case 'love': return '❤️';
      case 'haha': return '😆';
      case 'wow': return '😮';
      case 'sad': return '😢';
      case 'angry': return '😡';
      default: return '👍';
    }
  };

  const getReactionLabel = (type: string) => {
    switch (type) {
      case 'like': return 'Thích';
      case 'love': return 'Yêu thích';
      case 'haha': return 'Haha';
      case 'wow': return 'Wow';
      case 'sad': return 'Buồn';
      case 'angry': return 'Phẫn nộ';
      default: return 'Thích';
    }
  };

  const handleReactComment = async (commentId: number, reactionType: string) => {
    try {
      const res = await api.reactToComment(commentId, reactionType);
      if (res.success) {
        setComments(prev => prev.map(c => {
          if (c.id === commentId) {
            return { ...c, reactions: res.data };
          }
          return c;
        }));
      }
    } catch (err) {
      console.error('Failed to react to comment', err);
    }
  };

  const insertEmoji = (emoji: string) => {
    const textarea = document.getElementById('comment-textarea') as HTMLTextAreaElement;
    if (!textarea) {
      setNewCommentText(prev => prev + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);
    setNewCommentText(before + emoji + after);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewCommentText(val);

    const selectionStart = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, selectionStart);

    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    if (lastAtIdx !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIdx + 1);
      if (!textAfterAt.includes(' ')) {
        setShowMentions(true);
        setMentionTriggerIndex(lastAtIdx);

        const query = textAfterAt.toLowerCase();
        const matches = projectMembers.filter(m =>
          m.name.toLowerCase().includes(query) ||
          m.email?.toLowerCase().includes(query)
        );
        setMentionSuggestions(matches);
        return;
      }
    }

    setShowMentions(false);
    setMentionSuggestions([]);
  };

  const selectMention = (member: User) => {
    if (mentionTriggerIndex === -1) return;
    const before = newCommentText.substring(0, mentionTriggerIndex);
    const after = newCommentText.substring(mentionTriggerIndex + 1);
    const nextSpaceIdx = after.indexOf(' ');
    const rest = nextSpaceIdx === -1 ? '' : after.substring(nextSpaceIdx);

    const newText = `${before}@[${member.name}]${rest || ' '}`;
    setNewCommentText(newText);
    setShowMentions(false);
    setMentionSuggestions([]);
    setMentionTriggerIndex(-1);

    const textarea = document.getElementById('comment-textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  };

  const handleCommentFileChange = (file: File | null) => {
    setNewCommentFile(file);
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCommentFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setCommentFilePreview(null);
    }
  };

  const renderCommentText = (text: string) => {
    if (!text) return '';
    const tokenRegex = /(https?:\/\/[^\s]+|@\[[^\]]+\])/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, index) => {
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a key={index} href={part} target="_blank" rel="noreferrer" style={{ color: '#6366f1', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {part}
          </a>
        );
      }
      if (part.startsWith('@[') && part.endsWith(']')) {
        const name = part.substring(2, part.length - 1);
        return (
          <span key={index} style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '12px' }}>
            @{name}
          </span>
        );
      }
      return part;
    });
  };

  const renderCommentReactions = (comment: TaskComment) => {
    const list = comment.reactions || [];
    if (list.length === 0) return null;

    const grouped = list.reduce((acc, curr) => {
      acc[curr.reaction] = (acc[curr.reaction] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <div className="comment-reactions-display" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '12px', marginLeft: 'auto' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          {Object.keys(grouped).map(type => (
            <span key={type} title={getReactionLabel(type)}>{getReactionEmoji(type)}</span>
          ))}
        </div>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{list.length}</span>
      </div>
    );
  };

  const reactionMenu = (commentId: number) => (
    <div style={{ display: 'flex', gap: '8px', padding: '4px' }}>
      {['like', 'love', 'haha', 'wow', 'sad', 'angry'].map(type => (
        <button
          key={type}
          onClick={() => handleReactComment(commentId, type)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            transition: 'transform 0.1s ease',
          }}
          title={getReactionLabel(type)}
        >
          {getReactionEmoji(type)}
        </button>
      ))}
    </div>
  );

  // searchParams is declared at the top of the component

  // Initial Load
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        const meRes = await api.getMe();
        setMe(meRes);

        const usersRes = await api.getLocalUsers();
        setUsers(usersRes.data || []);
      } catch (err) {
        console.error('Error fetching tasks data:', err);
        message.error(t('tasks.toast.load_err' as any));
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  const canEditTask = (task: any) => {
    if (!me || !task) return false;
    if (me.role === 'admin') return true;
    if (task.project?.created_by === me.id) return true;
    const isManager = task.project?.members?.some(
      (m: any) => m.id === me.id && m.pivot?.role === 'manager'
    );
    if (isManager) return true;
    const isMember = task.project?.members?.some((m: any) => m.id === me.id);
    const isOwnTask = task.creator_id === me.id || task.assignee_id === me.id;
    return !!(isMember && isOwnTask);
  };

  const canDeleteTask = (task: any) => {
    if (!me || !task) return false;
    if (me.role === 'admin') return true;
    if (task.project?.created_by === me.id) return true;
    const isManager = task.project?.members?.some(
      (m: any) => m.id === me.id && m.pivot?.role === 'manager'
    );
    if (isManager) return true;
    return task.creator_id === me.id;
  };

  useEffect(() => {
    const taskId = searchParams.get('task_id');
    if (taskId) {
      api.getTask(parseInt(taskId, 10))
        .then((res) => {
          if (res && res.success) {
            setSelectedTask(res.data);
          }
        })
        .catch(console.error);
    }
  }, [searchParams]);

  useEffect(() => {
    const filterParam = searchParams.get('filter');
    setFilter(filterParam || 'all');
  }, [searchParams]);

  useLayoutEffect(() => {
    // Restore display styles of original cards that React reused/reconciled
    const hiddenCards = document.querySelectorAll('.drag-original-hidden');
    hiddenCards.forEach(el => {
      (el as HTMLElement).style.display = '';
      el.classList.remove('drag-original-hidden');
    });

    // Remove temporary clone placeholders
    const clones = document.querySelectorAll('.drag-clone-placeholder');
    clones.forEach(el => el.remove());

    // Clear all drag highlighting classes from columns/groups
    cleanupDragClasses();
  }, [taskList]);

  const refreshTasks = useCallback(async () => {
    if (!me?.id) return;
    try {
      if (taskSource === 'assigned_to_me') {
        const tasksRes = await api.getTasks({ assignee_id: me.id });
        setTaskList(tasksRes.data || []);
      } else {
        const tasksRes = await api.getTasks({ creator_id: me.id });
        const delegated = (tasksRes.data || []).filter((t: any) => 
          t.assignee_id !== null && 
          t.assignee_id !== undefined && 
          Number(t.assignee_id) !== Number(me.id)
        );
        setTaskList(delegated);
      }
    } catch (err) {
      console.error('Error refreshing tasks:', err);
    }
  }, [me, taskSource]);

  useEffect(() => {
    if (me?.id) {
      refreshTasks();
    }
  }, [taskSource, me, refreshTasks]);

  useEffect(() => {
    const handleClosePanels = () => {
      setSelectedTask(null);
      setReassignModalOpen(false);
      setDeadlineModalOpen(false);
    };
    const handleTaskCreatedGlobal = () => {
      refreshTasks();
    };
    window.addEventListener('trigger-close-panels', handleClosePanels);
    window.addEventListener('task-created-global', handleTaskCreatedGlobal);
    return () => {
      window.removeEventListener('trigger-close-panels', handleClosePanels);
      window.removeEventListener('task-created-global', handleTaskCreatedGlobal);
    };
  }, [refreshTasks]);

  // Change filter tab and refresh data from API
  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    const nextParams = new URLSearchParams(searchParams);
    if (newFilter && newFilter !== 'all') {
      nextParams.set('filter', newFilter);
    } else {
      nextParams.delete('filter');
    }
    setSearchParams(nextParams, { replace: true });
    refreshTasks();
  };

  // Helper Initials
  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Helper date formatted
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  const formatTaskDateRange = (startDateStr?: string, dueDateStr?: string) => {
    if (!startDateStr && !dueDateStr) {
      return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>{t('tasks.no_deadline' as any)}</span>;
    }

    const formatSingle = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    };

    if (startDateStr && dueDateStr) {
      return `${formatSingle(startDateStr)} - ${formatSingle(dueDateStr)}`;
    }
    if (startDateStr) {
      const prefix = lang === 'vi' ? 'Bắt đầu' : lang === 'ja' ? '開始' : 'Start';
      return `${prefix}: ${formatSingle(startDateStr)}`;
    }
    return formatSingle(dueDateStr!);
  };

  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const normalized = dateStr.substring(0, 10);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return normalized === todayStr;
  };

  const checkIsOverdue = (dateStr?: string, status?: string, task?: Task) => {
    if (!dateStr) return false;
    if (task) {
      if (isTaskDone(task)) return false;
    } else if (status === 'done') {
      return false;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d.getTime() < Date.now();
  };

  const checkIsThisWeek = (dateStr?: string) => {
    if (!dateStr) return false;
    const normalized = dateStr.substring(0, 10);
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const startStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
    const endStr = `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfWeek.getDate()).padStart(2, '0')}`;
    return normalized >= startStr && normalized <= endStr;
  };

  // Map DB status values to CSS class names
  const statusToCssClass = (status: string) => {
    const map: Record<string, string> = {
      backlog: 'backlog',
      todo: 'todo',
      in_progress: 'in-progress',
      review: 'in-review',
      done: 'done',
    };
    return map[status] || status;
  };

  // Sequential Status transition validator
  const allowedTransition = (oldStatus: string, nextStatus: string) => {
    if (oldStatus === nextStatus) return true;
    const allowed: Record<string, string[]> = {
      todo: ['in_progress'],
      in_progress: ['review'],
      review: ['done'],
      done: []
    };
    return allowed[oldStatus]?.includes(nextStatus) || false;
  };

  // Inline Checklist checkbox Click Cycle
  const toggleStatus = async (id: number, currentStatus: string, task?: Task) => {
    const projectStatuses = task?.project?.statuses || [];
    let nextStatus = '';
    if (projectStatuses.length > 0) {
      const idx = projectStatuses.findIndex((s: any) => s.id === currentStatus);
      if (idx !== -1) {
        const nextObj = projectStatuses[(idx + 1) % projectStatuses.length];
        nextStatus = nextObj.id;
      } else {
        nextStatus = projectStatuses[0].id;
      }
    } else {
      const order = ['todo', 'in_progress', 'review', 'done'];
      const idx = order.indexOf(currentStatus as any);
      nextStatus = idx !== -1 ? order[(idx + 1) % order.length] : 'todo';
    }

    try {
      const res = await api.updateTaskStatus(id, { status: nextStatus as any });
      if (res.success) {
        message.success(t('tasks.toast.status_updated' as any));
        setTaskList(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
        if (selectedTask && selectedTask.id === id) {
          setEditStatus(nextStatus);
        }
      }
    } catch (err: any) {
      if (err.response?.data?.workflow_error && err.response?.data?.failed_rules) {
        const statusObj = task?.project?.statuses?.find((s: any) => s.id === nextStatus);
        const statusName = statusObj ? statusObj.name : nextStatus;
        setWfTask(taskList.find(t => t.id === id) || task);
        setWfTargetStatus(nextStatus);
        setWfTargetStatusName(statusName);
        setWfFailedRules(err.response.data.failed_rules);
        setOnWfSuccessCallback(() => (updatedTask: any) => {
          setTaskList(prev => prev.map(t => t.id === id ? updatedTask : t));
          if (selectedTask && selectedTask.id === id) {
            setEditStatus(nextStatus);
          }
        });
        setWfModalOpen(true);
      } else {
        message.error(err.response?.data?.message || t('tasks.toast.status_err' as any));
      }
    }
  };

  // Actions
  const handleMarkDone = async (id: number) => {
    const task = taskList.find(t => t.id === id);
    if (!task) return;

    try {
      const res = await api.updateTaskStatus(id, { status: 'done' });
      if (res.success) {
        message.success(t('tasks.toast.mark_done' as any));
        setTaskList(prev => prev.map(t => t.id === id ? { ...t, status: 'done' } : t));
        if (selectedTask && selectedTask.id === id) {
          setEditStatus('done');
        }
      }
    } catch (err: any) {
      if (err.response?.data?.workflow_error && err.response?.data?.failed_rules) {
        const statusObj = task?.project?.statuses?.find((s: any) => s.id === 'done');
        const statusName = statusObj ? statusObj.name : 'Done';
        setWfTask(task);
        setWfTargetStatus('done');
        setWfTargetStatusName(statusName);
        setWfFailedRules(err.response.data.failed_rules);
        setOnWfSuccessCallback(() => (updatedTask: any) => {
          setTaskList(prev => prev.map(t => t.id === id ? updatedTask : t));
          if (selectedTask && selectedTask.id === id) {
            setEditStatus('done');
          }
        });
        setWfModalOpen(true);
      } else {
        message.error(err.response?.data?.message || t('tasks.toast.mark_done_err' as any));
      }
    }
  };

  const handleToggleWatchTask = async (id: number | string) => {
    try {
      const res = await api.toggleWatchTask(id);
      if (res.success) {
        setTaskList(prev => prev.map(t => t.id === id ? { ...t, watcher_ids: res.watcher_ids } : t));
        if (selectedTask && selectedTask.id === id) {
          setSelectedTask(prev => prev ? { ...prev, watcher_ids: res.watcher_ids } : null);
        }
        message.success(res.watched ? 'Đang theo dõi công việc' : 'Đã bỏ theo dõi công việc');
        refreshTasks();
      }
    } catch (err) {
      console.error('Failed to toggle watch status', err);
      message.error('Không thể cập nhật trạng thái theo dõi');
    }
  };

  const handleReassignOpen = async (id: number, currentAssigneeId?: number, projectId?: number) => {
    setActionTaskId(id);
    setNewAssigneeId(currentAssigneeId);
    setReassignModalOpen(true);
    setSelectedProjectForReassign(null);
    // Fetch project members for the reassign dropdown
    if (projectId) {
      try {
        const projRes = await api.getProject(projectId);
        if (projRes.success) {
          setProjectMembers(projRes.data.members || []);
          setSelectedProjectForReassign(projRes.data);
        }
      } catch (e) {
        console.error('Error fetching project members:', e);
      }
    }
  };

  const handleReassignSubmit = async () => {
    if (!actionTaskId) return;
    try {
      const res = await api.updateTask(actionTaskId, { assignee_id: newAssigneeId || null });
      if (res.success) {
        message.success(t('tasks.toast.reassign_success' as any));
        setTaskList(prev => prev.map(t => t.id === actionTaskId ? { ...t, assignee_id: newAssigneeId, assignee: users.find(u => u.id === newAssigneeId) } : t));
        if (selectedTask && selectedTask.id === actionTaskId) {
          setEditAssigneeId(newAssigneeId || null);
        }
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.toast.reassign_err' as any));
    } finally {
      setReassignModalOpen(false);
      setActionTaskId(null);
    }
  };

  const handleDeadlineOpen = (id: number, currentDueDate?: string) => {
    setActionTaskId(id);
    setNewDeadlineDate(currentDueDate || '');
    setDeadlineModalOpen(true);
  };

  const handleDeadlineSubmit = async () => {
    if (!actionTaskId) return;
    try {
      const res = await api.updateTask(actionTaskId, { due_date: newDeadlineDate || null });
      if (res.success) {
        message.success(t('tasks.toast.deadline_success' as any));
        setTaskList(prev => prev.map(t => t.id === actionTaskId ? { ...t, due_date: newDeadlineDate || undefined } : t));
        if (selectedTask && selectedTask.id === actionTaskId) {
          setEditDueDate(newDeadlineDate || '');
        }
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.toast.deadline_err' as any));
    } finally {
      setDeadlineModalOpen(false);
      setActionTaskId(null);
    }
  };

  const handleDeleteTask = async (id: number) => {
    Modal.confirm({
      title: t('project_detail.confirm.delete_task') || 'Xóa công việc',
      content: t('project_detail.confirm.delete_task_content') || 'Bạn có chắc chắn muốn xóa công việc này? Hành động này không thể hoàn tác.',
      okText: t('project_detail.confirm.delete_btn') || 'Xóa',
      cancelText: t('tasks.modal.cancel') || 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await api.deleteTask(id);
          if (res.success) {
            message.success(t('tasks.toast.delete_success' as any));
            setTaskList(prev => prev.filter(t => t.id !== id));
            if (selectedTask && selectedTask.id === id) {
              setSelectedTask(null);
            }
          }
        } catch (err) {
          message.error(t('tasks.toast.delete_err' as any));
        }
      }
    });
  };

  const cleanupDragClasses = () => {
    console.log('[DragDnD MyTasks] cleanupDragClasses executing...');
    const draggedCards = document.querySelectorAll('.project-detail__task-card.dragging, .my-tasks__task-row.dragging');
    console.log('[DragDnD MyTasks] Found dragged cards:', draggedCards.length);
    draggedCards.forEach(el => el.classList.remove('dragging'));

    const colElements = document.querySelectorAll('.project-detail__column');
    console.log('[DragDnD MyTasks] Found columns to clean:', colElements.length);
    colElements.forEach(el => {
      const dataStatus = el.getAttribute('data-status');
      const hasDragActive = el.classList.contains('drag-active');
      const hasDropAllowed = el.classList.contains('drop-allowed');
      if (hasDragActive || hasDropAllowed) {
        console.log(`[DragDnD MyTasks] Cleaning column [${dataStatus}]: had drag-active = ${hasDragActive}, drop-allowed = ${hasDropAllowed}`);
      }
      el.classList.remove('drag-active', 'column-self', 'drop-allowed', 'drop-disallowed');
    });
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    draggedTaskRef.current = id;
    e.dataTransfer.effectAllowed = 'move';

    // Add dragging class to the dragged element after the drag image is captured
    const cardEl = e.currentTarget as HTMLElement;
    setTimeout(() => {
      cardEl.classList.add('dragging');
    }, 0);

    const task = taskList.find(t => t.id === id);
    if (task) {
      // Highlight columns
      const colElements = document.querySelectorAll('.project-detail__column');
      colElements.forEach(el => {
        const colKey = el.getAttribute('data-status');
        if (!colKey) return;
        el.classList.add('drag-active');
        if (colKey === task.status) {
          el.classList.add('column-self');
        } else {
          el.classList.add('drop-allowed');
        }
      });
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    draggedTaskRef.current = null;
    cleanupDragClasses();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: 'todo' | 'in_progress' | 'review' | 'done') => {
    e.preventDefault();
    const taskId = draggedTaskRef.current;
    console.log('[DragDnD MyTasks] handleDrop called. taskId:', taskId, 'newStatus:', newStatus);
    if (taskId === null) {
      console.warn('[DragDnD MyTasks] handleDrop: taskId is null, aborting');
      return;
    }

    const task = taskList.find(t => String(t.id) === String(taskId));
    console.log('[DragDnD MyTasks] task:', task);
    if (!task) {
      console.warn('[DragDnD MyTasks] handleDrop: task is null/undefined, aborting');
      return;
    }

    if (!canEditTask(task)) {
      message.error(t('project_detail.toast.no_edit_permission' as any) || 'Bạn không có quyền chỉnh sửa công việc này!');
      cleanupDragClasses();
      draggedTaskRef.current = null;
      return;
    }

    const projectStatuses = task.project?.statuses || [];
    let resolvedStatus: string = newStatus;
    if (projectStatuses.length > 0) {
      if (newStatus === 'done') {
        const closed = projectStatuses.find((s: any) => s.type === 'closed');
        if (closed) resolvedStatus = closed.id;
      } else if (newStatus === 'todo') {
        const notStarted = projectStatuses.find((s: any) => s.type === 'not_started');
        if (notStarted) resolvedStatus = notStarted.id;
      } else if (newStatus === 'review') {
        const activeReview = projectStatuses.find((s: any) => s.type === 'active' && s.id.includes('review')) || projectStatuses.find((s: any) => s.type === 'active');
        if (activeReview) resolvedStatus = activeReview.id;
      } else {
        const active = projectStatuses.find((s: any) => s.type === 'active');
        if (active) resolvedStatus = active.id;
      }
    }

    if (task.status === resolvedStatus) {
      cleanupDragClasses();
      draggedTaskRef.current = null;
      return;
    }

    // Clone card and hide original to avoid React "removeChild" crashes
    const cardEl = document.querySelector(`.project-detail__task-card[data-task-id="${taskId}"]`) as HTMLElement;
    if (cardEl) {
      const clone = cardEl.cloneNode(true) as HTMLElement;
      clone.classList.add('drag-clone-placeholder');

      // Hide original card and mark it with a class for later visibility restoration
      cardEl.style.display = 'none';
      cardEl.classList.add('drag-original-hidden');

      const draggedIndex = taskList.findIndex(t => String(t.id) === String(taskId));

      const targetColBody = document.querySelector(`.project-detail__column--${newStatus} .project-detail__column-body`) as HTMLElement;
      if (targetColBody) {
        // Find all existing cards in this column
        const cards = Array.from(targetColBody.querySelectorAll('.project-detail__task-card')) as HTMLElement[];
        const existingCards = cards.filter(el => !el.classList.contains('drag-clone-placeholder'));

        let insertBeforeEl: HTMLElement | null = null;
        for (const card of existingCards) {
          const cardTaskId = card.getAttribute('data-task-id');
          if (cardTaskId) {
            const cardIndex = taskList.findIndex(t => String(t.id) === String(cardTaskId));
            if (cardIndex > draggedIndex) {
              insertBeforeEl = card;
              break;
            }
          }
        }

        if (insertBeforeEl) {
          targetColBody.insertBefore(clone, insertBeforeEl);
        } else {
          const controlEl = targetColBody.querySelector(':scope > :not(.project-detail__task-card):not(.drag-clone-placeholder)');
          if (controlEl) {
            targetColBody.insertBefore(clone, controlEl);
          } else {
            targetColBody.appendChild(clone);
          }
        }
      }
    }

    cleanupDragClasses();
    draggedTaskRef.current = null;

    // Defer state update using setTimeout to let the browser paint the clone immediately!
    setTimeout(async () => {
      console.log('[DragDnD MyTasks] Defer execution starts inside setTimeout');
      cleanupDragClasses();
      // Optimistic Update
      const prevTaskList = [...taskList];
      console.log('[DragDnD MyTasks] Triggering optimistic update setTaskList for taskId:', taskId);
      setTaskList((prev) => {
        const next = prev.map((t) => {
          if (String(t.id) === String(taskId)) {
            console.log('[DragDnD MyTasks] Optimistic match! Task ID:', t.id, 'status changed from:', t.status, 'to:', resolvedStatus);
            return { ...t, status: resolvedStatus };
          }
          return t;
        });
        return next;
      });

      try {
        console.log('[DragDnD MyTasks] Calling api.updateTaskStatus for taskId:', taskId, 'to resolvedStatus:', resolvedStatus);
        const res = await api.updateTaskStatus(taskId, { status: resolvedStatus as any });
        console.log('[DragDnD MyTasks] API response:', res);
        if (res.success) {
          message.success(t('tasks.toast.status_updated' as any));
        } else {
          console.warn('[DragDnD MyTasks] API success is false, reverting taskList');
          setTaskList(prevTaskList);
        }
      } catch (err: any) {
        console.error('[DragDnD MyTasks] API error, reverting taskList:', err);
        setTaskList(prevTaskList);
        if (err.response?.data?.workflow_error && err.response?.data?.failed_rules) {
          const statusId = resolvedStatus;
          const statusObj = task.project?.statuses?.find((s: any) => s.id === statusId);
          const statusName = statusObj ? statusObj.name : statusId;

          setWfTask(task);
          setWfTargetStatus(statusId);
          setWfTargetStatusName(statusName);
          setWfFailedRules(err.response.data.failed_rules);
          setOnWfSuccessCallback(() => (updatedTask: any) => {
            setTaskList(prev => prev.map(t => String(t.id) === String(updatedTask.id) ? updatedTask : t));
          });
          setWfModalOpen(true);
        } else {
          message.error(err.response?.data?.message || t('tasks.toast.status_err' as any));
        }
      }
    }, 50);
  };

  // Task Details Panel open & load
  const handleSelectTask = async (task: Task) => {
    try {
      setSelectedTask(task);
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setEditStatus(task.status);
      setEditPriority(task.priority);
      setEditAssigneeId(task.assignee_id || null);
      setEditEstHours(task.estimated_hours || null);
      setEditActHours(task.actual_hours || null);
      setEditStartDate(task.start_date || '');
      setEditDueDate(task.due_date || '');
      setComments([]);
      setActivities([]);
      setProjectMembers([]);
      setPanelTab('comments');
      setCommentsPage(1);
      setActivitiesPage(1);
      setCommentsHasMore(false);
      setActivitiesHasMore(false);
      // Fetch full task details
      const fullTaskRes = await api.getTask(task.id);
      if (fullTaskRes.success) {
        const fullTask = fullTaskRes.data;
        setSelectedTask(fullTask);
        setComments(fullTask.comments || []);
        setCommentsHasMore((fullTask.comments || []).length < (fullTask.comments_count || 0));
        const sortedActs = [...(fullTask.activities || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setActivities(sortedActs);
        setActivitiesHasMore((fullTask.activities || []).length < (fullTask.activities_count || 0));
        setEditStartDate(fullTask.start_date ? fullTask.start_date.substring(0, 10) : '');
        setEditDueDate(fullTask.due_date ? fullTask.due_date.substring(0, 10) : '');
      }

      // Fetch project members for assignee dropdown
      if (task.project_id) {
        try {
          const projRes = await api.getProject(task.project_id);
          if (projRes.success) {
            setProjectMembers(projRes.data.members || []);
          }
        } catch (e) {
          console.error('Error fetching project members:', e);
        }
      }
    } catch (err) {
      console.error('Error fetching task details:', err);
    }
  };

  const handleAddSubtask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!subtaskTitle.trim() || !selectedTask) return;
    try {
      const res = await api.createTask({
        project_id: selectedTask.project_id,
        title: subtaskTitle.trim(),
        parent_task_id: selectedTask.id,
        status: selectedTask?.project?.statuses?.[0]?.id || 'todo',
        priority: subtaskPriority,
        assignee_id: subtaskAssigneeId,
      });
      if (res.success) {
        message.success(t('tasks.detail_toast.subtask_added'));
        setSubtaskTitle('');
        setSubtaskAssigneeId(undefined);
        setSubtaskPriority('medium');

        // Refresh details of the parent task
        const taskRes = await api.getTask(selectedTask.id);
        if (taskRes.success) {
          setSelectedTask(taskRes.data);
          setComments(taskRes.data.comments || []);
          const sortedActs = [...(taskRes.data.activities || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setActivities(sortedActs);
        }
        // Also refresh the main board tasks
        refreshTasks();
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.subtask_add_err'));
    }
  };

  const handleToggleSubtaskStatus = async (st: any) => {
    if (!selectedTask) return;
    const projectStatuses = selectedTask?.project?.statuses || [];
    const isClosed = projectStatuses.some((s: any) => s.id === st.status && s.type === 'closed') || st.status === 'done';
    const closedStatus = projectStatuses.find((s: any) => s.type === 'closed') || { id: 'done' };
    const notStartedStatus = projectStatuses.find((s: any) => s.type === 'not_started') || { id: 'todo' };
    const newStatus = isClosed ? notStartedStatus.id : closedStatus.id;
    try {
      const res = await api.updateTask(st.id, { status: newStatus });
      if (res.success) {
        message.success(t('tasks.detail_toast.status_updated'));

        // Refresh parent task details
        const taskRes = await api.getTask(selectedTask.id);
        if (taskRes.success) {
          setSelectedTask(taskRes.data);
          setComments(taskRes.data.comments || []);
          const sortedActs = [...(taskRes.data.activities || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setActivities(sortedActs);
        }
        // Also refresh the main board tasks
        refreshTasks();
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.status_update_err'));
    }
  };

  const handleToggleWatch = async () => {
    if (!selectedTask) return;
    try {
      const res = await api.toggleWatchTask(selectedTask.id);
      if (res.success) {
        setSelectedTask(prev => prev ? {
          ...prev,
          watcher_ids: res.watcher_ids
        } : null);
        message.success(res.watched ? 'Đang theo dõi công việc' : 'Đã bỏ theo dõi công việc');
        refreshTasks();
      }
    } catch (err) {
      console.error('Failed to toggle watch status', err);
      message.error('Không thể cập nhật trạng thái theo dõi');
    }
  };
  // Comment & attachment helpers
  const isImageFile = (pathStr: string) => {
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    return extensions.some(ext => pathStr.toLowerCase().endsWith(ext));
  };
  const loadMoreComments = async () => {
    if (!selectedTask || commentsLoading || !commentsHasMore) return;
    setCommentsLoading(true);
    try {
      const nextPage = commentsPage + 1;
      const res = await api.getTaskComments(selectedTask.id, nextPage);
      if (res.success) {
        setComments(prev => [...prev, ...res.data]);
        setCommentsPage(nextPage);
        setCommentsHasMore(res.pagination?.has_more || false);
      }
    } catch (err) {
      console.error('Failed to load more comments', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const loadMoreActivities = async () => {
    if (!selectedTask || activitiesLoading || !activitiesHasMore) return;
    setActivitiesLoading(true);
    try {
      const nextPage = activitiesPage + 1;
      const res = await api.getTaskActivities(selectedTask.id, nextPage);
      if (res.success) {
        const sorted = [...res.data].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setActivities(prev => [...prev, ...sorted]);
        setActivitiesPage(nextPage);
        setActivitiesHasMore(res.pagination?.has_more || false);
      }
    } catch (err) {
      console.error('Failed to load more activities', err);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const handleScrollComments = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      loadMoreComments();
    }
  };

  const handleScrollActivities = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      loadMoreActivities();
    }
  };

  const handlePostComment = async () => {
    if (!selectedTask || !newCommentText.trim()) return;
    try {
      const res = await api.createTaskComment(selectedTask.id, newCommentText, newCommentFile || undefined);
      if (res.success) {
        message.success(t('tasks.toast.comment_added' as any));
        setNewCommentText('');
        setNewCommentFile(null);
        setCommentFilePreview(null);

        // Reload details
        const detailsRes = await api.getTask(selectedTask.id);
        if (detailsRes.success) {
          setSelectedTask(detailsRes.data);
          setComments(detailsRes.data.comments || []);
          setActivities(detailsRes.data.activities || []);
        }
      }
    } catch (err) {
      message.error(t('tasks.toast.comment_err' as any));
    }
  };

  const handlePostReply = async (parentCommentId: number) => {
    if (!selectedTask || !replyText.trim()) return;
    try {
      const res = await api.createTaskComment(selectedTask.id, replyText, replyFile || undefined, parentCommentId);
      if (res.success) {
        message.success(t('tasks.toast.comment_added' as any));
        setReplyText('');
        setReplyFile(null);
        setReplyFilePreview(null);
        setReplyingToCommentId(null);

        // Auto-expand replies for this parent
        setExpandedCommentIds(prev => ({ ...prev, [parentCommentId]: true }));

        // Reload details
        const detailsRes = await api.getTask(selectedTask.id);
        if (detailsRes.success) {
          setSelectedTask(detailsRes.data);
          setComments(detailsRes.data.comments || []);
          setActivities(detailsRes.data.activities || []);
        }
      }
    } catch (err) {
      message.error(t('tasks.toast.comment_err' as any));
    }
  };

  const toggleExpandReplies = (commentId: number) => {
    setExpandedCommentIds(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const insertEmojiToReply = (emoji: string) => {
    const textarea = document.getElementById(`reply-textarea-${replyingToCommentId}`) as HTMLTextAreaElement;
    if (!textarea) {
      setReplyText(prev => prev + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);
    setReplyText(before + emoji + after);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleReplyFileChange = (file: File | null) => {
    setReplyFile(file);
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReplyFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setReplyFilePreview(null);
    }
  };

  // Save edits inside Details Panel
  const handleSaveTaskDetails = async () => {
    if (!selectedTask) return;

    try {
      const res = await api.updateTask(selectedTask.id, {
        title: editTitle,
        description: editDescription,
        status: editStatus,
        priority: editPriority,
        assignee_id: editAssigneeId,
        actual_hours: editActHours,
        start_date: editStartDate || null,
        due_date: editDueDate || null,
      });

      if (res.success) {
        message.success(t('tasks.toast.update_success' as any));
        setSelectedTask(null);
        refreshTasks();
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.toast.update_err' as any));
    }
  };

  // Filtering Logic
  const filtered = taskList.filter((t) => {
    // 1. Search Query Filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchesTitle = t.title.toLowerCase().includes(q);
      const matchesId = String(t.id).includes(q);
      if (!matchesTitle && !matchesId) return false;
    }

    // 2. Type Filter
    if (!(typeFilter === 'all' || t.type === typeFilter || (!t.type && typeFilter === 'task'))) return false;

    // 3. Priority Filter
    if (priorityFilter.length > 0 && !priorityFilter.includes(t.priority)) return false;

    // 4. Project Filter
    if (projectFilter.length > 0 && !projectFilter.includes(t.project_id)) return false;

    // 5. Status/Date Filter
    if (filter === 'all') return true;
    if (filter === 'active') return isTaskActive(t);
    if (filter === 'overdue') return checkIsOverdue(t.due_date, t.status, t);
    if (filter === 'done') return isTaskDone(t);
    if (filter === 'today') return isToday(t.due_date);
    if (filter === 'this_week') return checkIsThisWeek(t.due_date);
    if (filter === 'no_date') return !t.due_date;
    return true;
  });

  // Counts for Filter Buttons
  const counts = {
    all: taskList.length,
    active: taskList.filter((t) => isTaskActive(t)).length,
    overdue: taskList.filter((t) => checkIsOverdue(t.due_date, t.status, t)).length,
    done: taskList.filter((t) => isTaskDone(t)).length,
    today: taskList.filter((t) => isToday(t.due_date)).length,
    this_week: taskList.filter((t) => checkIsThisWeek(t.due_date)).length,
    no_date: taskList.filter((t) => !t.due_date).length,
  };

  // Grouping Logic
  const grouped = (() => {
    const groups: Record<string, Task[]> = {};
    if (groupBy === 'priority') {
      ['urgent', 'high', 'medium', 'low'].forEach((p) => {
        groups[p] = filtered.filter((t) => t.priority === p);
      });
      const other = filtered.filter((t) => !['urgent', 'high', 'medium', 'low'].includes(t.priority));
      if (other.length > 0) groups['none'] = other;
    } else if (groupBy === 'status') {
      ['todo', 'in_progress', 'review', 'done'].forEach((s) => {
        groups[s] = filtered.filter((t) => getFallbackStatusColumn(t) === s);
      });
    } else if (groupBy === 'project') {
      filtered.forEach((task) => {
        const pName = task.project?.name || task.project?.title || task.project?.id || 'N/A';
        if (!groups[pName]) groups[pName] = [];
        groups[pName].push(task);
      });
    } else if (groupBy === 'due_date') {
      filtered.forEach((task) => {
        const dStr = task.due_date || t('tasks.no_due_date' as any);
        if (!groups[dStr]) groups[dStr] = [];
        groups[dStr].push(task);
      });
    } else if (groupBy === 'assignee') {
      filtered.forEach((task) => {
        const aName = task.assignee?.name || t('tasks.panel.unassigned' as any) || 'Unassigned';
        if (!groups[aName]) groups[aName] = [];
        groups[aName].push(task);
      });
    }
    return groups;
  })();

  const priorityConfig: Record<string, { label: string; color: string }> = {
    urgent: { label: t('tasks.priority.urgent') || 'Khẩn cấp', color: '#ef4444' },
    high: { label: t('tasks.priority.high') || 'Cao', color: '#f97316' },
    medium: { label: t('tasks.priority.medium') || 'Trung bình', color: '#f59e0b' },
    low: { label: t('tasks.priority.low') || 'Thấp', color: '#3b82f6' },
    none: { label: t('tasks.priority.none' as any), color: '#6b7084' }
  };

  const statusLabels: Record<string, string> = {
    backlog: t('tasks.status.backlog') || 'Chờ xử lý',
    todo: t('tasks.status.todo') || 'Cần làm',
    in_progress: t('tasks.status.in_progress') || 'Đang làm',
    review: t('tasks.status.in_review') || 'Đang đánh giá',
    done: t('tasks.status.done') || 'Đã xong',
  };

  const getGroupLabel = (key: string) => {
    if (groupBy === 'priority') return priorityConfig[key]?.label || key;
    if (groupBy === 'status') return statusLabels[key] || key;
    if (groupBy === 'due_date' && key !== t('tasks.no_due_date' as any)) return formatDate(key);
    return key;
  };

  const getGroupDot = (key: string) => {
    if (groupBy === 'priority') return priorityConfig[key]?.color || '#6b7084';
    const statusColors: Record<string, string> = { backlog: '#6b7084', todo: '#9ca0b0', in_progress: '#3b82f6', review: '#a855f7', done: '#22c55e' };
    if (groupBy === 'status') return statusColors[key] || '#6b7084';
    if (groupBy === 'assignee') {
      if (key === t('tasks.panel.unassigned' as any)) return '#6b7084';
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
      }
      const h = Math.abs(hash % 360);
      return `hsl(${h}, 70%, 60%)`;
    }
    const matchingTask = taskList.find(t => (t.project?.name || t.project?.title || t.project?.id) === key);
    return matchingTask?.project?.color || '#6b7084';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" description={t('tasks.loading' as any)} />
      </div>
    );
  }

  const columns = [
    { key: 'todo', label: 'CẦN LÀM', color: '#9ca0b0', type: 'not_started' },
    { key: 'in_progress', label: 'ĐANG THỰC HIỆN', color: '#3b82f6', type: 'active' },
    { key: 'done', label: 'HOÀN THÀNH', color: '#22c55e', type: 'closed' }
  ] as const;

  const taskEditable = selectedTask ? canEditTask(selectedTask) : false;

  return (
    <div className="project-detail my-tasks">
      <div className="my-tasks__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>{t('tasks.title')}</h1>
          <p>{t(taskSource === 'assigned_to_me' ? 'tasks.sub_title' : ('tasks.delegated_sub_title' as any), { count: counts.active })}</p>
        </div>
        <div className="my-tasks__source-switcher" style={{ marginRight: '16px' }}>
          <Segmented
            value={taskSource}
            onChange={(val: any) => setTaskSource(val)}
            options={[
              { label: t('tasks.source.assigned_to_me' as any), value: 'assigned_to_me' },
              { label: t('tasks.source.delegated_by_me' as any), value: 'delegated_by_me' },
            ]}
            size="middle"
          />
        </div>
      </div>

      <div className="my-tasks__toolbar">
        <div className="my-tasks__quick-filters" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {/* Search */}
          <DebouncedSearchInput
            placeholder={t('projects.search_tasks_placeholder' as any) || "Tìm kiếm công việc..."}
            value={searchQuery}
            onChange={setSearchQuery}
            style={{ width: '260px', borderRadius: '8px' }}
          />

          {/* ── Filter Button – Jira-style 2-column panel ── */}
          <MyTasksFilterPopover
            taskList={taskList}
            counts={counts}
            t={t}
            filter={filter}
            typeFilter={typeFilter}
            priorityFilter={priorityFilter}
            projectFilter={projectFilter}
            setFilter={setFilter}
            setTypeFilter={setTypeFilter}
            setPriorityFilter={setPriorityFilter}
            setProjectFilter={setProjectFilter}
            handleFilterChange={handleFilterChange}
          />

          {/* ── Group Button – Jira-style ── */}
          {viewMode === 'list' && (() => {
            const groupOptions = [
              { value: 'priority', label: t('tasks.group.priority') },
              { value: 'status', label: t('tasks.group.status') },
              { value: 'project', label: t('tasks.group.project') },
              { value: 'due_date', label: t('tasks.group.due_date' as any) },
              { value: 'assignee', label: t('tasks.group.assignee' as any) || 'Người nhận việc' },
            ] as const;

            const groupPanel = (
              <div style={{ width: 220, borderRadius: '10px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
                <div style={{ padding: '10px 0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 16px 10px' }}>
                    {t('tasks.group.label' as any) || 'Gom nhóm theo'}
                  </div>
                  {groupOptions.map(g => (
                    <div
                      key={g.value}
                      onClick={() => setGroupBy(g.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 16px', cursor: 'pointer',
                        background: groupBy === g.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                        transition: 'background 0.12s',
                      }}
                      className="status-item-hover"
                    >
                      <span style={{
                        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                        border: groupBy === g.value ? '2px solid var(--primary)' : '2px solid var(--border-color)',
                        background: groupBy === g.value ? 'var(--primary)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.12s',
                      }}>
                        {groupBy === g.value && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: groupBy === g.value ? 600 : 400, color: 'var(--text-primary)' }}>{g.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );

            return (
              <Popover
                trigger="click"
                placement="bottomLeft"
                overlayStyle={{ padding: 0 }}
                overlayInnerStyle={{ padding: 0, borderRadius: '10px', overflow: 'hidden' }}
                content={groupPanel}
              >
                <button style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)', color: 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: 500, outline: 'none', transition: 'all 0.15s',
                }}>
                  <GroupOutlined style={{ fontSize: '13px' }} />
                  {t('tasks.group.label' as any) || 'Gom nhóm'}
                </button>
              </Popover>
            );
          })()}
        </div>

        <div className="my-tasks__view-options">
          <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              className={`panel-btn ${viewMode === 'list' ? 'active' : ''}`}
              style={{ background: viewMode === 'list' ? 'var(--primary-bg)' : 'transparent', color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', padding: '8px 12px', cursor: 'pointer' }}
              onClick={() => setViewMode('list')}
              title="Danh sách"
            >
              <UnorderedListOutlined />
            </button>
            <button
              className={`panel-btn ${viewMode === 'board' ? 'active' : ''}`}
              style={{ background: viewMode === 'board' ? 'var(--primary-bg)' : 'transparent', color: viewMode === 'board' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', padding: '8px 12px', cursor: 'pointer' }}
              onClick={() => setViewMode('board')}
              title="Bảng"
            >
              <AppstoreOutlined />
            </button>
            <button
              className={`panel-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              style={{ background: viewMode === 'calendar' ? 'var(--primary-bg)' : 'transparent', color: viewMode === 'calendar' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', padding: '8px 12px', cursor: 'pointer' }}
              onClick={() => setViewMode('calendar')}
              title="Lịch biểu"
            >
              <CalendarOutlined />
            </button>
          </div>
        </div>
      </div>

      {/* View Mode: List view (Grouped) */}
      {viewMode === 'list' && (
        <>
          {(() => {
            const sortedGroups = Object.entries(grouped)
              .filter(([, t]) => t.length > 0)
              .sort(([keyA], [keyB]) => {
                if (groupBy === 'due_date') {
                  const noDateKey = t('tasks.no_due_date' as any);
                  if (keyA === noDateKey) return 1;
                  if (keyB === noDateKey) return -1;
                  return new Date(keyA).getTime() - new Date(keyB).getTime();
                }
                if (groupBy === 'priority') {
                  const priorityOrder = ['urgent', 'high', 'medium', 'low', 'none'];
                  return priorityOrder.indexOf(keyA) - priorityOrder.indexOf(keyB);
                }
                if (groupBy === 'assignee') {
                  const unassignedKey = t('tasks.panel.unassigned' as any);
                  if (keyA === unassignedKey) return 1;
                  if (keyB === unassignedKey) return -1;
                  return keyA.localeCompare(keyB, locale);
                }
                return 0;
              });

            return sortedGroups.map(([key, groupTasks]) => (
              <div key={key} className="my-tasks__group">
                <div className="my-tasks__group-header" onClick={() => setExpanded((p) => ({ ...p, [key]: p[key] === false }))}>
                  <RightOutlined className={`chevron ${expanded[key] !== false ? 'expanded' : ''}`} />
                  <span className="priority-dot" style={{ background: getGroupDot(key) }} />
                  <span className="group-label">{getGroupLabel(key)}</span>
                  <span className="group-count">{groupTasks.length}</span>
                </div>
                {expanded[key] !== false && (
                  <div className="my-tasks__group-body">
                    {groupTasks.map((task) => {
                      const overdue = checkIsOverdue(task.due_date, task.status, task);
                      const today = isToday(task.due_date);
                      const statusObj = getFallbackStatusObj(task);
                      const isClosed = isTaskDone(task);
                      const projectStatuses = task.project?.statuses || [];

                      return (
                        <div key={task.id} className="my-tasks__task-row" onClick={() => handleSelectTask(task)}>
                          <div
                            className={`my-tasks__task-checkbox ${isClosed ? 'done' : ''}`}
                            onClick={(e) => { e.stopPropagation(); if (!isClosed) toggleStatus(task.id, task.status, task); }}
                            style={{
                              borderColor: statusObj.color,
                              backgroundColor: isClosed ? statusObj.color : 'transparent',
                              color: isClosed ? 'white' : 'transparent',
                              cursor: isClosed ? 'default' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0
                            }}
                          >
                            {isClosed ? (
                              <CheckOutlined style={{ fontSize: '10px' }} />
                            ) : (
                              (() => {
                                const statusesList = projectStatuses.length > 0 ? projectStatuses : [
                                  { id: 'backlog', type: 'not_started' },
                                  { id: 'todo', type: 'not_started' },
                                  { id: 'in_progress', type: 'active' },
                                  { id: 'review', type: 'active' },
                                  { id: 'done', type: 'closed' }
                                ];
                                const currentIdx = statusesList.findIndex((s: any) => s.id === statusObj.id);
                                const percentage = statusesList.length > 0 ? ((currentIdx + 1) / statusesList.length) * 100 : 25;
                                return (
                                  <div style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: `conic-gradient(${statusObj.color} 0% ${percentage}%, transparent ${percentage}% 100%)`
                                  }} />
                                );
                              })()
                            )}
                          </div>
                          <div className="my-tasks__task-info">
                            <div className="title" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                              <TaskTypeBadge type={task.type || 'task'} size="icon" />
                              <span style={{ flex: 1, wordBreak: 'break-word', whiteSpace: 'normal' }}>{task.title}</span>
                            </div>
                            <div className="subtitle">
                              <span className="task-id">#{task.id}</span>
                              <span className="project-tag" style={{ '--dot-color': task.project?.color || '#6b7084' } as React.CSSProperties}>
                                {task.project?.name || task.project?.title || t('tasks.no_project' as any)}
                              </span>
                            </div>
                          </div>
                          <div className="my-tasks__task-labels">
                            {task.labels?.map((l, i) => <span key={i} className="label" style={{ background: l.bg, color: l.color }}>{l.name}</span>)}
                          </div>
                          <div className="my-tasks__task-status">
                            <span
                              style={{
                                background: `${statusObj.color}1c`,
                                color: statusObj.color,
                                border: `1px solid ${statusObj.color}2b`
                              }}
                            >
                              {statusObj.name}
                            </span>
                          </div>
                          <div className={`my-tasks__task-date ${overdue ? 'overdue' : ''} ${today ? 'today' : ''}`}>
                            {formatTaskDateRange(task.start_date, task.due_date)}
                          </div>
                          {task.assignee ? (
                            <div className="my-tasks__task-assignee" style={{ background: 'var(--primary)' }}>
                              {task.assignee.photo ? <img src={task.assignee.photo} alt={task.assignee.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : getInitials(task.assignee.name)}
                            </div>
                          ) : (
                            <div className="my-tasks__task-assignee" style={{ border: '1px dashed var(--text-muted, #9ca0b0)', background: 'transparent' }}>
                              <UserOutlined style={{ color: 'var(--text-muted, #9ca0b0)', fontSize: '10px' }} />
                            </div>
                          )}
                           <div className="my-tasks__task-actions" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const menuItems = getTaskMenuItems(task);
                              if (menuItems.length === 0) return null;
                              return (
                                <Dropdown
                                  menu={{ items: menuItems }}
                                  trigger={['click']}
                                >
                                  <button onClick={(e) => e.stopPropagation()}><MoreOutlined /></button>
                                </Dropdown>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ));
          })()}
          {filtered.length === 0 && (
            <div className="my-tasks__empty">
              <h3>{t('tasks.empty.title' as any)}</h3>
              <p>{t('tasks.empty.desc' as any)}</p>
            </div>
          )}
        </>
      )}

      {/* View Mode: Board view (Kanban) */}
      {viewMode === 'board' && (
        <div className="project-detail__board" style={{ height: 'auto', minHeight: '500px' }}>
          {columns.map((col) => {
            const colTasks = filtered.filter(t => getFallbackStatusColumn(t) === col.key);
            return (
              <div
                key={col.key}
                className={`project-detail__column project-detail__column--${col.key}`}
                data-status={col.key}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                <div className="project-detail__column-header" style={{
                  background: (() => {
                    const hex = col.color || '#9ca0b0';
                    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
                    return `rgba(${r},${g},${b},0.12)`;
                  })()
                }}>
                  <div className="project-detail__column-header-left">
                    <span className="status-dot" style={{ background: col.color }} />
                    <span className="status-label">{col.label}</span>
                    <span className="count">{colTasks.length}</span>
                  </div>
                </div>

                <div className="project-detail__column-body" style={{ minHeight: '400px' }}>
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="project-detail__task-card"
                      data-task-id={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleSelectTask(task)}
                    >
                      <div className="project-detail__task-card-top">
                        <span className="project-detail__task-card-id">#{task.id}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                          <div className={`project-detail__task-card-priority project-detail__task-card-priority--${task.priority}`} />
                          {(() => {
                            const menuItems = getTaskMenuItems(task);
                            if (menuItems.length === 0) return null;
                            return (
                              <Dropdown
                                menu={{ items: menuItems }}
                                trigger={['click']}
                              >
                                <button 
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '2px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    outline: 'none',
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreOutlined style={{ fontSize: '14px' }} />
                                </button>
                              </Dropdown>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="project-detail__task-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TaskTypeBadge type={task.type || 'task'} size="icon" />
                        {task.title}
                      </div>
                      <div className="project-detail__task-card-bottom">
                        <div className="project-detail__task-card-meta">
                          {task.due_date && <span className="project-detail__task-card-date">{formatDate(task.due_date)}</span>}
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {task.project?.name || task.project?.title || ''}
                          </span>
                        </div>
                        {task.assignee && (
                          <div className="project-detail__task-card-assignee" style={{ background: 'var(--primary)' }}>
                            {task.assignee.photo ? <img src={task.assignee.photo} alt={task.assignee.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : getInitials(task.assignee.name)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Mode: Calendar view */}
      {viewMode === 'calendar' && (
        <div style={{ marginTop: '16px', background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <TaskCalendar
            tasks={filtered as any}
            onSelectTask={handleSelectTask as any}
            columns={columns as any}
          />
        </div>
      )}

      {/* Task Detail Slide-in Panel */}
      {selectedTask && (
        <TaskDetailPanel
          taskId={selectedTask.id}
          onClose={() => setSelectedTask(null)}
          onUpdate={refreshTasks}
          projectMembers={projectMembers}
        />
      )}

      {/* Workflow Transition Guided Modal */}
      {wfModalOpen && wfTask && (
        <WorkflowTransitionModal
          open={wfModalOpen}
          task={wfTask}
          targetStatus={wfTargetStatus}
          targetStatusName={wfTargetStatusName}
          failedRules={wfFailedRules}
          projectMembers={projectMembers.length > 0 ? projectMembers : (wfTask.project?.members || [])}
          projectLabels={wfTask.project?.labels || []}
          onCancel={() => {
            setWfModalOpen(false);
            setWfTask(null);
          }}
          onSuccess={(updatedTask) => {
            setWfModalOpen(false);
            setWfTask(null);
            refreshTasks();
            if (onWfSuccessCallback) {
              onWfSuccessCallback(updatedTask);
            }
          }}
        />
      )}

      {/* Action Modals */}
      <Modal
        title={t('tasks.modal.reassign_title' as any)}
        open={reassignModalOpen}
        onOk={handleReassignSubmit}
        onCancel={() => setReassignModalOpen(false)}
        okText={t('tasks.modal.reassign_ok' as any)}
        cancelText={t('tasks.modal.cancel' as any)}
      >
        <div style={{ padding: '16px 0' }}>
          <label style={{ display: 'block', marginBottom: '8px' }}>{t('tasks.modal.reassign_label' as any)}</label>
          <Select
            showSearch
            style={{ width: '100%' }}
            placeholder={t('tasks.modal.reassign_placeholder' as any)}
            optionLabelProp="label"
            value={newAssigneeId}
            onChange={(val) => setNewAssigneeId(val)}
            allowClear
            filterOption={(input, option) =>
              String(option?.title ?? '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {projectMembers.filter(u => {
              const taskToReassign = taskList.find(t => t.id === actionTaskId);
              const isSubtask = taskToReassign?.parent_task_id !== null && taskToReassign?.parent_task_id !== undefined;
              
              const userProjectRole = selectedProjectForReassign?.members?.find((pm: any) => pm.id === me?.id)?.pivot?.role || 'member';
              const isProjCreator = selectedProjectForReassign?.created_by === me?.id;
              const isManager = userProjectRole === 'manager' || isProjCreator || me?.role === 'admin';
              
              if (isManager || isSubtask) return true;
              return Number(u.id) === Number(me?.id);
            }).map(u => (
              <Select.Option key={u.id} value={u.id} label={u.name} title={`${u.name} ${u.email}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '11px',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {u.photo ? (
                      <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      getInitials(u.name)
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{u.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{u.email}</span>
                  </div>
                </div>
              </Select.Option>
            ))}
          </Select>
        </div>
      </Modal>

      <Modal
        title={t('tasks.modal.deadline_title' as any)}
        open={deadlineModalOpen}
        onOk={handleDeadlineSubmit}
        onCancel={() => setDeadlineModalOpen(false)}
        okText={t('tasks.modal.deadline_ok' as any)}
        cancelText={t('tasks.modal.cancel' as any)}
      >
        <div style={{ padding: '16px 0' }}>
          <label style={{ display: 'block', marginBottom: '8px' }}>{t('tasks.modal.deadline_label' as any)}</label>
          <input
            type="date"
            style={{ width: '100%', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '8px' }}
            value={newDeadlineDate}
            onChange={(e) => setNewDeadlineDate(e.target.value)}
          />
        </div>
      </Modal>

      {/* Manual Time Logging Modal for Specific Task */}
      {(() => {
        const logTimeTask = taskList.find(t => t.id === logTimeTaskId);
        return (
          <ManualTimeLogModal
            isOpen={logTimeTaskId !== null}
            onClose={() => setLogTimeTaskId(null)}
            onSuccess={refreshTasks}
            tasks={logTimeTask ? [logTimeTask] : []}
            defaultTaskId={logTimeTaskId}
            lockTaskSelection={true}
          />
        );
      })()}
    </div>
  );
};

export default MyTasksPage;
