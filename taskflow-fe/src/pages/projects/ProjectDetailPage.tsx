

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Dropdown, Tooltip, message, Modal, Select, Button, Popconfirm, Spin, Timeline, Popover, Calendar, Input, Tabs, Radio } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import {
  PlusOutlined,
  CloseOutlined,
  DeleteOutlined,
  PaperClipOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  MessageOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CalendarOutlined,
  UserOutlined,
  FlagOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  EditOutlined,
  CheckSquareOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  CheckOutlined,
  DownOutlined,
  HolderOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  MoreOutlined,
  ArrowRightOutlined,
  DashboardOutlined,
  LockOutlined,
  FilterOutlined,
  RightOutlined,
  GroupOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  BranchesOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import { getEcho } from '../../services/echo';
import { useTranslation } from '../../utils/i18n';
import './ProjectDetailPage.scss';
import '../tasks/MyTasksPage.scss';
import { TaskDetailPanel } from '../../components/tasks/TaskDetailPanel';
import { TaskCalendar } from '../../components/tasks/TaskCalendar';
import TaskTypeBadge from '../../components/tasks/TaskTypeBadge';
import { useDeleteConfirm } from '../../components/tasks/DeleteConfirmModal';
import EditProjectModal, { EditProjectFormData } from '../../components/projects/EditProjectModal';
import { renderProjectIcon } from '../../components/projects/ProjectIconPicker';
import { WorkflowEditor } from '../../components/workflow/WorkflowEditor';

// ===== TYPES =====
interface Task {
  id: string | number;
  project_id: string | number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee_id?: number | string;
  assignee?: { id: number; name: string; photo?: string };
  creator_id: number;
  creator?: { name: string };
  estimated_hours?: number;
  actual_hours?: number;
  start_date?: string;
  due_date?: string;
  watcher_ids?: number[];
  subtasks?: Task[];
  parent_task_id?: string | number;
  time_entries?: any[];
  type?: string;
  labels?: any[];
  position?: number;
}

// Priority config matching ClickUp style
const PRIORITIES = [
  { id: 'urgent', name: 'Khẩn cấp', color: '#ef4444', icon: '🚩' },
  { id: 'high', name: 'Cao', color: '#f97316', icon: '🏁' },
  { id: 'medium', name: 'Trung bình', color: '#f59e0b', icon: '🔶' },
  { id: 'low', name: 'Thấp', color: '#3b82f6', icon: '🔽' },
];

const priorityColors: Record<string, string> = { urgent: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6' };

// ===== FLAG SVG for priority =====
const FlagIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

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

// ===== PROJECT FILTER POPOVER COMPONENT =====
interface ProjectFilterPopoverProps {
  projectMembers: any[];
  columns: any[];
  t: any;
  // Parent state values
  filterMyTasks: boolean;
  filterUnassigned: boolean;
  filterAssignees: number[];
  filterStatuses: string[];
  filterPriorities: string[];
  filterTypes: string[];
  // Parent update functions
  setFilterMyTasks: (val: boolean) => void;
  setFilterUnassigned: (val: boolean) => void;
  setFilterAssignees: (val: number[]) => void;
  setFilterStatuses: (val: string[]) => void;
  setFilterPriorities: (val: string[]) => void;
  setFilterTypes: (val: string[]) => void;
  handleClearFilters: () => void;
}

const ProjectFilterPopover: React.FC<ProjectFilterPopoverProps> = ({
  projectMembers,
  columns,
  t,
  filterMyTasks,
  filterUnassigned,
  filterAssignees,
  filterStatuses,
  filterPriorities,
  filterTypes,
  setFilterMyTasks,
  setFilterUnassigned,
  setFilterAssignees,
  setFilterStatuses,
  setFilterPriorities,
  setFilterTypes,
  handleClearFilters,
}) => {
  const [open, setOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('assignee');

  // Local state for filters
  const [localMyTasks, setLocalMyTasks] = useState(filterMyTasks);
  const [localUnassigned, setLocalUnassigned] = useState(filterUnassigned);
  const [localAssignees, setLocalAssignees] = useState(filterAssignees);
  const [localStatuses, setLocalStatuses] = useState(filterStatuses);
  const [localPriorities, setLocalPriorities] = useState(filterPriorities);
  const [localTypes, setLocalTypes] = useState(filterTypes);

  // Sync external changes (e.g. clear filters)
  useEffect(() => {
    setLocalMyTasks(filterMyTasks);
    setLocalUnassigned(filterUnassigned);
    setLocalAssignees(filterAssignees);
    setLocalStatuses(filterStatuses);
    setLocalPriorities(filterPriorities);
    setLocalTypes(filterTypes);
  }, [filterMyTasks, filterUnassigned, filterAssignees, filterStatuses, filterPriorities, filterTypes]);

  // Propagate to parent helper
  const propagateFilters = useCallback((filters: {
    myTasks: boolean;
    unassigned: boolean;
    assignees: number[];
    statuses: string[];
    priorities: string[];
    types: string[];
  }) => {
    setFilterMyTasks(filters.myTasks);
    setFilterUnassigned(filters.unassigned);
    setFilterAssignees(filters.assignees);
    setFilterStatuses(filters.statuses);
    setFilterPriorities(filters.priorities);
    setFilterTypes(filters.types);
  }, [setFilterMyTasks, setFilterUnassigned, setFilterAssignees, setFilterStatuses, setFilterPriorities, setFilterTypes]);

  // Debounced apply
  useEffect(() => {
    const timer = setTimeout(() => {
      propagateFilters({
        myTasks: localMyTasks,
        unassigned: localUnassigned,
        assignees: localAssignees,
        statuses: localStatuses,
        priorities: localPriorities,
        types: localTypes
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [localMyTasks, localUnassigned, localAssignees, localStatuses, localPriorities, localTypes, propagateFilters]);

  // Force propagation on close
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      propagateFilters({
        myTasks: localMyTasks,
        unassigned: localUnassigned,
        assignees: localAssignees,
        statuses: localStatuses,
        priorities: localPriorities,
        types: localTypes
      });
    }
  };

  const handleLocalClear = () => {
    setLocalMyTasks(false);
    setLocalUnassigned(false);
    setLocalAssignees([]);
    setLocalStatuses([]);
    setLocalPriorities([]);
    setLocalTypes([]);
    handleClearFilters();
  };

  const activeCount =
    (localMyTasks ? 1 : 0) +
    (localAssignees.length > 0 ? 1 : 0) +
    (localUnassigned ? 1 : 0) +
    (localStatuses.length > 0 ? 1 : 0) +
    (localPriorities.length > 0 ? 1 : 0) +
    (localTypes.length > 0 ? 1 : 0);
  const hasFilter = activeCount > 0;

  const filterCategories = [
    { key: 'assignee', label: t('tasks.panel.assignee'), badge: localAssignees.length > 0 || localUnassigned || localMyTasks },
    { key: 'status', label: t('tasks.group.status'), badge: localStatuses.length > 0 },
    { key: 'priority', label: t('tasks.filter.priority'), badge: localPriorities.length > 0 },
    { key: 'type', label: t('task.type.label'), badge: localTypes.length > 0 },
  ] as const;

  const typeOptions = [
    { value: 'task', label: t('task.type.task'), icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="#6366f1" opacity="0.15" stroke="#6366f1" strokeWidth="1.3" /><path d="M4.5 8L7 10.5L11.5 5.5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> },
    { value: 'bug', label: t('task.type.bug'), icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="9" r="4.5" fill="#ef4444" /><path d="M6 4.5C6 3.4 6.9 2.5 8 2.5s2 .9 2 2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" fill="none" /><path d="M5 6.5L3 5M11 6.5L13 5" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /><path d="M4 9H2M12 9h2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /><path d="M5 11.5L3 13M11 11.5L13 13" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" /></svg> },
  ] as const;

  const priorityOptions = [
    { value: 'urgent', label: t('tasks.priority.urgent'), color: '#ef4444' },
    { value: 'high', label: t('tasks.priority.high'), color: '#f97316' },
    { value: 'medium', label: t('tasks.priority.medium'), color: '#f59e0b' },
    { value: 'low', label: t('tasks.priority.low'), color: '#3b82f6' },
  ] as const;

  const CheckRow = ({ checked, onClick, icon, label, dotColor }: {
    checked: boolean; onClick: () => void; icon?: React.ReactNode;
    label: string; dotColor?: string;
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
    </div>
  );

  const filterPanel = (
    <div style={{ width: 440, display: 'flex', flexDirection: 'column', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
      <div style={{ display: 'flex', minHeight: 260 }}>
        <div style={{ width: 150, borderRight: '1px solid var(--border-color)', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
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

        <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', maxHeight: 320 }}>
          {filterCategory === 'assignee' && (
            <>
              <CheckRow
                checked={localMyTasks}
                onClick={() => setLocalMyTasks(prev => !prev)}
                icon={<UserOutlined style={{ fontSize: '14px', color: 'var(--text-muted)' }} />}
                label={t('tasks.filter.my_tasks')}
              />
              <CheckRow
                checked={localUnassigned}
                onClick={() => setLocalUnassigned(prev => !prev)}
                icon={<UserOutlined style={{ fontSize: '14px', color: 'var(--text-muted)' }} />}
                label={t('tasks.panel.unassigned')}
              />
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '6px 0' }} />
              {projectMembers.map((m: any) => (
                <CheckRow
                  key={m.id}
                  checked={localAssignees.includes(m.id)}
                  onClick={() => setLocalAssignees(prev =>
                    prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                  )}
                  icon={
                    m.photo ? (
                      <img src={m.photo} alt={m.name} style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                    ) : (
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#6366f1', color: '#fff', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                    )
                  }
                  label={m.name}
                />
              ))}
            </>
          )}

          {filterCategory === 'status' && columns.map((col: any) => (
            <CheckRow
              key={col.key}
              checked={localStatuses.includes(col.key)}
              onClick={() => setLocalStatuses(prev =>
                prev.includes(col.key) ? prev.filter(k => k !== col.key) : [...prev, col.key]
              )}
              dotColor={col.color}
              label={col.label}
            />
          ))}

          {filterCategory === 'priority' && priorityOptions.map(opt => (
            <CheckRow
              key={opt.value}
              checked={localPriorities.includes(opt.value)}
              onClick={() => setLocalPriorities(prev =>
                prev.includes(opt.value) ? prev.filter(p => p !== opt.value) : [...prev, opt.value]
              )}
              dotColor={opt.color}
              label={opt.label}
            />
          ))}

          {filterCategory === 'type' && typeOptions.map(opt => (
            <CheckRow
              key={opt.value}
              checked={localTypes.includes(opt.value)}
              onClick={() => setLocalTypes(prev =>
                prev.includes(opt.value) ? prev.filter(t => t !== opt.value) : [...prev, opt.value]
              )}
              icon={opt.icon}
              label={opt.label}
            />
          ))}
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
        border: hasFilter ? '1px solid var(--primary)' : '1px solid var(--border-color)',
        background: hasFilter ? 'var(--primary-bg)' : 'var(--bg-card)',
        color: hasFilter ? 'var(--primary)' : 'var(--text-secondary)',
        fontSize: '13px', fontWeight: 500, outline: 'none', transition: 'all 0.15s',
      }}>
        <FilterOutlined style={{ fontSize: '13px' }} />
        <span>{t('common.filter')}</span>
        {hasFilter && <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>{activeCount}</span>}
      </button>
    </Popover>
  );
};

// ===== PRIORITY PICKER COMPONENT =====
const PriorityPicker: React.FC<{
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const current = PRIORITIES.find(p => p.id === value) || PRIORITIES[2]; // default medium

  const content = (
    <div style={{ width: '200px', padding: '4px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px 6px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
        {t('tasks.panel.priority')}
      </div>
      {PRIORITIES.map(p => (
        <div
          key={p.id}
          onClick={() => { onChange(p.id); setOpen(false); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 8px', borderRadius: '6px', cursor: 'pointer',
            background: p.id === value ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
            transition: 'background 0.15s',
          }}
          className="status-item-hover"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FlagIcon color={p.color} size={15} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: p.id === value ? 'var(--primary)' : 'var(--text-primary)' }}>{t(`tasks.priority.${p.id}`)}</span>
          </div>
          {p.id === value && <CheckOutlined style={{ color: 'var(--primary)', fontSize: '11px' }} />}
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '4px', paddingTop: '4px' }}>
        <div
          onClick={() => { onChange('medium'); setOpen(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px' }}
          className="status-item-hover"
        >
          <CloseOutlined style={{ fontSize: '11px' }} /> {t('tasks.panel.clear_priority')}
        </div>
      </div>
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
        }}
        className="status-item-hover"
      >
        <FlagIcon color={current.color} size={14} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: current.color }}>{t(`tasks.priority.${current.id}`)}</span>
        <DownOutlined style={{ fontSize: '8px', color: 'var(--text-muted)' }} />
      </button>
    </Popover>
  );
};

// ===== TIME TRACKER COMPONENT =====
const formatDuration = (seconds: number): string => {
  const total = Math.abs(seconds || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};

const TimeTracker: React.FC<{
  taskId: string | number;
  timeEntries: any[];
  onUpdate: () => void;
  disabled?: boolean;
}> = ({ taskId, timeEntries = [], onUpdate, disabled }) => {
  const [running, setRunning] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [manualDesc, setManualDesc] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation();

  // Find running entry
  useEffect(() => {
    const runningEntry = timeEntries.find((e: any) => !e.ended_at);
    setRunning(runningEntry || null);
    if (runningEntry) {
      const started = new Date(runningEntry.started_at).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    }
  }, [timeEntries]);

  // Timer tick
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        const started = new Date(running.started_at).getTime();
        setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  const totalTracked = timeEntries
    .filter((e: any) => e.ended_at)
    .reduce((sum: number, e: any) => sum + Math.abs(e.duration || 0), 0);

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
    if (totalSec <= 0) return;
    try {
      await api.addManualTime(taskId, { duration: totalSec, description: manualDesc || undefined });
      setManualHours(0);
      setManualMinutes(0);
      setManualDesc('');
      setShowManualAdd(false);
      window.dispatchEvent(new Event('timer-updated'));
      onUpdate();
      message.success(t('tasks.detail_toast.time_added'));
    } catch (err: any) {
      message.error(t('tasks.detail_toast.time_add_err'));
    }
  };

  const manualAddContent = (
    <div style={{ width: '220px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('tasks.panel.add_manual_time')}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="number"
          min={0}
          placeholder="0"
          value={manualHours || ''}
          onChange={e => setManualHours(Number(e.target.value) || 0)}
          style={{ width: '60px', textAlign: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
        />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>h</span>
        <input
          type="number"
          min={0}
          max={59}
          placeholder="0"
          value={manualMinutes || ''}
          onChange={e => setManualMinutes(Number(e.target.value) || 0)}
          style={{ width: '60px', textAlign: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
        />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>m</span>
      </div>
      <Input
        placeholder={t('tasks.panel.time_tracking_note_placeholder')}
        value={manualDesc}
        onChange={e => setManualDesc(e.target.value)}
        size="small"
      />
      <Button
        type="primary"
        size="small"
        onClick={handleAddManual}
        style={{ width: '100%', fontSize: '12px' }}
      >
        {t('tasks.panel.save_short')}
      </Button>
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
        trigger="click"
        open={showManualAdd}
        onOpenChange={setShowManualAdd}
        placement="bottomLeft"
        content={manualAddContent}
      >
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          {running ? (
            <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span className="timer-dot-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              {formatDuration(elapsed)}
            </span>
          ) : hasTimeLogs ? (
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatDuration(totalTracked)}
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
              {t('tasks.panel.add_time')}
            </span>
          )}
        </div>
      </Popover>
    </div>
  );
};

const isImageFile = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
};

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

const ClickUpStatusPicker: React.FC<{
  currentStatusId: string;
  projectStatuses: any[];
  onChange: (val: string) => void;
  disabled?: boolean;
  allowedStatusIds?: string[];
}> = ({
  currentStatusId,
  projectStatuses,
  onChange,
  disabled,
  allowedStatusIds
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [open, setOpen] = useState(false);
    const { t } = useTranslation();
    const currentStatus = projectStatuses.find(s => s.id === currentStatusId) || projectStatuses[0];
    const currentIndex = projectStatuses.findIndex(s => s.id === currentStatus?.id);
    const isLastStatus = currentIndex === projectStatuses.length - 1;

    const handleNextStep = () => {
      if (disabled) return;
      // In restricted mode, check if next status is allowed
      const nextStatus = projectStatuses[currentIndex + 1];
      if (currentIndex >= 0 && currentIndex < projectStatuses.length - 1) {
        if (allowedStatusIds && !allowedStatusIds.includes(nextStatus.id)) {
          return; // Blocked by workflow
        }
        onChange(nextStatus.id);
      }
    };

    const groupedStatuses = {
      not_started: projectStatuses.filter(s => s.type === 'not_started' && s.name.toLowerCase().includes(searchTerm.toLowerCase())),
      active: projectStatuses.filter(s => (s.type === 'active' || s.type === 'done' || !s.type) && s.name.toLowerCase().includes(searchTerm.toLowerCase())),
      closed: projectStatuses.filter(s => s.type === 'closed' && s.name.toLowerCase().includes(searchTerm.toLowerCase())),
    };

    const popoverContent = (
      <div style={{ width: '240px', padding: '4px' }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          placeholder={t('tasks.panel.status_search_placeholder')}

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
            const groupTitle = groupKey === 'not_started' ? t('tasks.status.todo') : groupKey === 'active' ? t('tasks.status.in_progress') : t('tasks.status.done');
            return (
              <div key={groupKey}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 8px 4px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
                  {groupTitle}
                </div>
                {list.map((st: any) => {
                  const isSelected = st.id === currentStatusId;
                  const isBlocked = allowedStatusIds && !isSelected && !allowedStatusIds.includes(st.id);
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
                        if (isBlocked) return;
                        onChange(st.id);
                        setOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        cursor: isBlocked ? 'not-allowed' : 'pointer',
                        background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        opacity: isBlocked ? 0.35 : 1,
                        transition: 'background 0.2s, opacity 0.2s',
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
                      {isBlocked && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>🔒</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );

    const checkColor = currentStatus?.color || '#9ca0b0';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1px', background: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden', width: 'fit-content', border: '1px solid var(--border-color)' }}>
        {!isLastStatus && (
          <Tooltip title={t('tasks.panel.next_status_tooltip')}>

            <button
              onClick={handleNextStep}
              disabled={disabled}
              style={{
                background: 'var(--bg-card)',
                border: 'none',
                color: checkColor,
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
              <CheckOutlined style={{ color: checkColor }} />
            </button>
          </Tooltip>
        )}

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

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, lang, locale } = useTranslation();
  const { showDeleteConfirm, DeleteConfirmComponent } = useDeleteConfirm();

  const [project, setProject] = useState<any>(null);
  const [showManageStatusesModal, setShowManageStatusesModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [orphanedStatusesToMap, setOrphanedStatusesToMap] = useState<any[]>([]);
  const [statusMappings, setStatusMappings] = useState<Record<string, string>>({});
  const draggedStatusIdRef = useRef<string | null>(null);

  const columns = useMemo(() => {
    return (project?.statuses || [
      { id: 'todo', name: t('tasks.status.todo'), color: '#9ca0b0', type: 'not_started', position: 0 },
      { id: 'in_progress', name: t('tasks.status.in_progress'), color: '#3b82f6', type: 'active', position: 1 },
      { id: 'review', name: t('tasks.status.in_review'), color: '#a855f7', type: 'active', position: 2 },
      { id: 'done', name: t('tasks.status.done'), color: '#22c55e', type: 'closed', position: 3 },
    ]).map((s: any) => ({
      key: s.id,
      label: s.name,
      color: s.color,
      type: s.type
    }));
  }, [project?.statuses, t]);

  const priorityLabels: Record<string, string> = {
    urgent: t('tasks.priority.urgent'),
    high: t('tasks.priority.high'),
    medium: t('tasks.priority.medium'),
    low: t('tasks.priority.low'),
    none: t('tasks.priority.none'),
  };

  const [tasks, setTasks] = useState<Task[]>([]);

  // Index tasks by parent ID to optimize recursive lookup speeds from O(N) to O(1)
  const tasksByParentId = useMemo(() => {
    const map: Record<string | number, Task[]> = {};
    tasks.forEach(t => {
      if (t.parent_task_id !== undefined && t.parent_task_id !== null) {
        const pId = String(t.parent_task_id);
        if (!map[pId]) map[pId] = [];
        map[pId].push(t);
      }
    });
    return map;
  }, [tasks]);

  const [filterMyTasks, setFilterMyTasks] = useState<boolean>(false);
  const [filterSearch, setFilterSearch] = useState<string>('');
  const searchQuery = useMemo(() => filterSearch?.toLowerCase().trim() || '', [filterSearch]);
  const [filterAssigneeId, setFilterAssigneeId] = useState<number | undefined>(undefined);
  const [filterAssignees, setFilterAssignees] = useState<number[]>([]);
  const [filterUnassigned, setFilterUnassigned] = useState<boolean>(false);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>({});
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar'>('board');
  const [groupBy, setGroupBy] = useState<'status' | 'priority' | 'due_date'>('status');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [inlineCreate, setInlineCreate] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<string>('medium');
  const [newTaskAssignee, setNewTaskAssignee] = useState<number | null>(null);
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const draggedTaskRef = useRef<string | number | null>(null);
  // Tracks the card currently hovered during drag and whether to insert before/after it
  const dropIndicatorRef = useRef<{ taskId: string | number; position: 'before' | 'after' } | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<number[]>([]);

  // Timesheet states
  const [projectTimeEntries, setProjectTimeEntries] = useState<any[]>([]);
  const [loadingTimesheet, setLoadingTimesheet] = useState(false);
  const [timesheetDateFilter, setTimesheetDateFilter] = useState('all'); // all, today, week, month, custom
  const [timesheetStartDate, setTimesheetStartDate] = useState('');
  const [timesheetEndDate, setTimesheetEndDate] = useState('');
  const [timesheetMemberFilter, setTimesheetMemberFilter] = useState<number | 'all'>('all');
  const [showLogTimeModal, setShowLogTimeModal] = useState(false);

  // Log Time form state
  const [logTimeTask, setLogTimeTask] = useState<number | null>(null);
  const [logTimeDate, setLogTimeDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [logTimeHours, setLogTimeHours] = useState<number>(0);
  const [logTimeMinutes, setLogTimeMinutes] = useState<number>(0);
  const [logTimeDescription, setLogTimeDescription] = useState('');

  // Comments and Activities states
  const [comments, setComments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentFile, setNewCommentFile] = useState<File | null>(null);
  const [panelTab, setPanelTab] = useState<'comments' | 'history'>('comments');

  // Pagination state for comments & activities
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [activitiesHasMore, setActivitiesHasMore] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const [me, setMe] = useState<any>(null);
  const [commentFilePreview, setCommentFilePreview] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);

  // Manage statuses states
  const [activeStatuses, setActiveStatuses] = useState<any[]>([]);
  const [statusTemplates, setStatusTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | number | undefined>(undefined);
  const [saveAsNewTemplate, setSaveAsNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [statusColors] = useState(['#9ca0b0', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#ef4444']);
  const [colorPickerOpenId, setColorPickerOpenId] = useState<string | null>(null);
  const [colorPickedIds, setColorPickedIds] = useState<Set<string>>(new Set());
  const [customColorStatusId, setCustomColorStatusId] = useState<string | null>(null);
  const [customColorValue, setCustomColorValue] = useState('#ffffff');

  // Workflow states
  const [workflowConfig, setWorkflowConfig] = useState<any>({ mode: 'unrestricted', transitions: [], global_transitions: [] });
  const [manageStatusTab, setManageStatusTab] = useState<'statuses' | 'workflow'>('statuses');
  const [showWorkflowEditor, setShowWorkflowEditor] = useState(false);
  const [workflowTransitions, setWorkflowTransitions] = useState<any[]>([]);
  const [workflowGlobalTransitions, setWorkflowGlobalTransitions] = useState<any[]>([]);
  const [workflowMode, setWorkflowMode] = useState<'unrestricted' | 'restricted'>('unrestricted');

  // Derived: initial status from workflow config (null = unrestricted, any column allowed)
  const workflowInitialStatus: string | null = workflowConfig?.initial_status || null;

  // Helper: get allowed target status IDs from a given status for current user
  const getAllowedTargetStatuses = (fromStatusId: string): string[] => {
    const transitions = workflowConfig.transitions || [];
    const globalTransitions = workflowConfig.global_transitions || [];
    if (!workflowConfig || workflowConfig.mode === 'unrestricted' || (transitions.length === 0 && globalTransitions.length === 0)) {
      return columns.map((c: any) => c.key).filter((k: string) => k !== fromStatusId);
    }
    const userProjectRole = project?.members?.find((m: any) => m.id === me?.id)?.pivot?.role || 'member';
    const isAdmin = me?.role === 'admin';
    const allowed: string[] = [];
    // Check regular transitions
    (workflowConfig.transitions || []).forEach((t: any) => {
      if (t.from === fromStatusId) {
        if (isAdmin || !t.allowed_roles || t.allowed_roles.length === 0 || t.allowed_roles.includes(userProjectRole)) {
          allowed.push(t.to);
        }
      }
    });
    // Check global transitions
    (workflowConfig.global_transitions || []).forEach((gt: any) => {
      if (isAdmin || !gt.allowed_roles || gt.allowed_roles.length === 0 || gt.allowed_roles.includes(userProjectRole)) {
        if (!allowed.includes(gt.to) && gt.to !== fromStatusId) {
          allowed.push(gt.to);
        }
      }
    });
    return allowed;
  };

  useEffect(() => {
    if (project?.statuses) {
      setActiveStatuses(JSON.parse(JSON.stringify(project.statuses)));
      // Mark existing statuses as already color-picked
      setColorPickedIds(new Set(project.statuses.map((s: any) => s.id)));
    }
  }, [project, showManageStatusesModal]);

  const fetchTemplates = async () => {
    try {
      const res = await api.getStatusTemplates();
      if (res.success) {
        setStatusTemplates(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load status templates', err);
    }
  };

  useEffect(() => {
    if (showManageStatusesModal) {
      fetchTemplates();
    }
  }, [showManageStatusesModal]);

  // Fetch workflow config when project loads or modal opens
  const fetchWorkflow = async () => {
    if (!id) return;
    try {
      const res = await api.getWorkflow(id);
      if (res.success && res.data) {
        const wf = (res.data.workflow && typeof res.data.workflow === 'object' && 'mode' in res.data.workflow)
          ? res.data.workflow
          : (res.data && 'mode' in res.data ? res.data : { mode: 'unrestricted', transitions: [], global_transitions: [] });
        setWorkflowConfig(wf);
        setWorkflowMode(wf.mode || 'unrestricted');
        setWorkflowTransitions(wf.transitions || []);
        setWorkflowGlobalTransitions(wf.global_transitions || []);
      }
    } catch (err) {
      console.error('Failed to load workflow', err);
    }
  };

  useEffect(() => {
    if (project?.id) {
      fetchWorkflow();
    }
  }, [project?.id]);

  const handleApplyTemplate = (templateId: string | number) => {
    const template = statusTemplates.find(t => t.id === templateId);
    if (template && template.statuses) {
      setActiveStatuses(JSON.parse(JSON.stringify(template.statuses)));
    }
  };

  const handleAddStatus = (type: 'not_started' | 'active' | 'closed') => {
    const defaultColor = type === 'not_started' ? '#9ca0b0' : type === 'closed' ? '#22c55e' : '#3b82f6';
    const newId = `${type}_${Date.now()}`;
    const newSt = {
      id: newId,
      name: t('projects.status.new_status'),
      color: defaultColor,
      type: type,
      position: activeStatuses.length
    };
    setActiveStatuses([...activeStatuses, newSt]);
    // Auto-open color picker for new status
    setTimeout(() => setColorPickerOpenId(newId), 100);
  };

  const handleUpdateStatusProp = (id: string, prop: string, val: any) => {
    setActiveStatuses(prev => prev.map(s => s.id === id ? { ...s, [prop]: val } : s));
  };

  const handleDeleteStatus = (id: string) => {
    const sToDelete = activeStatuses.find(s => s.id === id);
    if (!sToDelete) return;
    const sameTypeCount = activeStatuses.filter(s => s.type === sToDelete.type).length;
    if (sameTypeCount <= 1) {
      message.warning(t('projects.status.min_status_warning'));
      return;
    }
    setActiveStatuses(prev => prev.filter(s => s.id !== id));
  };

  const handleMoveStatus = (id: string, direction: 'up' | 'down') => {
    const index = activeStatuses.findIndex(s => s.id === id);
    if (index === -1) return;
    const newStatuses = [...activeStatuses];
    if (direction === 'up' && index > 0) {
      const temp = newStatuses[index];
      newStatuses[index] = newStatuses[index - 1];
      newStatuses[index - 1] = temp;
    } else if (direction === 'down' && index < newStatuses.length - 1) {
      const temp = newStatuses[index];
      newStatuses[index] = newStatuses[index + 1];
      newStatuses[index + 1] = temp;
    }
    newStatuses.forEach((s, idx) => {
      s.position = idx;
    });
    setActiveStatuses(newStatuses);
  };

  const handleSaveStatuses = async (mappings?: Record<string, string>) => {
    if (activeStatuses.length === 0) {
      message.error(t('projects.status.empty_list_error'));
      return;
    }
    const payload = activeStatuses.map((s, idx) => ({
      id: s.id,
      name: s.name.trim(),
      color: s.color,
      type: s.type,
      position: idx
    }));

    try {
      setLoading(true);
      const res = await api.updateProjectStatuses(id!, payload, mappings);
      if (res.success) {
        if (saveAsNewTemplate && newTemplateName.trim()) {
          await api.createStatusTemplate(newTemplateName.trim(), payload);
          setSaveAsNewTemplate(false);
          setNewTemplateName('');
        }
        message.success(t('projects.status.update_success'));
        setShowManageStatusesModal(false);
        setShowMappingModal(false);
        setStatusMappings({});
        setOrphanedStatusesToMap([]);
        fetchProjectData();
      } else if (res.requires_mapping) {
        setOrphanedStatusesToMap(res.orphaned_statuses || []);

        const defaultMap: Record<string, string> = {};
        const firstStatusId = payload[0]?.id || 'todo';
        (res.orphaned_statuses || []).forEach((os: any) => {
          defaultMap[os.id] = firstStatusId;
        });
        setStatusMappings(defaultMap);
        setShowMappingModal(true);
      } else {
        message.error(res.message || t('projects.status.save_error'));
      }
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || t('projects.status.save_error'));

    } finally {
      setLoading(false);
    }
  };

  // Reply states
  const [replyingToCommentId, setReplyingToCommentId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replyFilePreview, setReplyFilePreview] = useState<string | null>(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Record<number, boolean>>({});

  const projectMembers = project?.members || [];

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
    return t(`tasks.reaction.${type}`) || type;
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
        const matches = projectMembers.filter((m: any) =>
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

  const selectMention = (member: any) => {
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

  const renderCommentReactions = (comment: any) => {
    const list = comment.reactions || [];
    if (list.length === 0) return null;

    const grouped = list.reduce((acc: any, curr: any) => {
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

  // Local Task detail form states
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<string>('todo');
  const [editPriority, setEditPriority] = useState<Task['priority']>('medium');
  const [editAssigneeId, setEditAssigneeId] = useState<number | string | undefined>(undefined);
  const [editEstHours, setEditEstHours] = useState<number | null>(null);
  const [editActHours, setEditActHours] = useState<number | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskAssigneeId, setSubtaskAssigneeId] = useState<number | undefined>(undefined);
  const [subtaskPriority, setSubtaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // For project editing modal (if query has ?edit=true)
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState<EditProjectFormData>({
    id: '',
    name: '',
    description: '',
    color: '',
    icon: null,
    status: '',
    startDate: '',
    endDate: '',
  });

  const fetchProjectData = async (silent: boolean = false) => {
    if (!id) return;
    try {
      if (silent !== true) {
        setLoading(true);
      }
      const res = await api.getProject(id);
      if (res.success) {
        setProject(res.data);
        setTasks(res.data.tasks || []);
        setEditProjectForm({
          id: res.data.id,
          name: res.data.name,
          description: res.data.description || '',
          color: res.data.color,
          icon: res.data.icon || null,
          status: res.data.status,
          startDate: res.data.start_date ? res.data.start_date.substring(0, 10) : '',
          endDate: res.data.end_date ? res.data.end_date.substring(0, 10) : '',
        });
      }
      try {
        const resTime = await api.getProjectTimeEntries(id);
        if (resTime?.success) {
          setProjectTimeEntries(resTime.data || []);
        }
      } catch (e) {
        console.error('Failed to load project time entries', e);
      }
    } catch (err) {
      console.error(err);
      message.error(t('project_detail.toast.load_err'));
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaceUsers = async () => {
    try {
      const res = await api.getUsers({ limit: 1000, active: true });
      if (res.success) {
        setAllUsers(res.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const canEditProject = () => {
    if (!project || !me) return false;
    if (me.role === 'admin') return true;
    if (project.created_by === me.id) return true;
    const isManager = project.members?.some(
      (m: any) => m.id === me.id && m.pivot?.role === 'manager'
    );
    return !!isManager;
  };

  const canEditTask = (task: any) => {
    if (!me || !project || !task) return false;
    if (me.role === 'admin') return true;
    if (project.created_by === me.id) return true;
    const isManager = project.members?.some(
      (m: any) => m.id === me.id && m.pivot?.role === 'manager'
    );
    if (isManager) return true;

    // Otherwise, must be task creator or task assignee, and a member of the project
    const isMember = project.members?.some((m: any) => m.id === me.id);
    const isOwnTask = task.creator_id === me.id || task.assignee_id === me.id;
    return !!(isMember && isOwnTask);
  };

  const canDeleteTask = (task: any) => {
    if (!me || !project || !task) return false;
    if (me.role === 'admin') return true;
    if (project.created_by === me.id) return true;
    const isManager = project.members?.some(
      (m: any) => m.id === me.id && m.pivot?.role === 'manager'
    );
    if (isManager) return true;

    return task.creator_id === me.id;
  };

  useEffect(() => {
    fetchProjectData();
    fetchWorkspaceUsers();
    api.getMe().then(res => setMe(res)).catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const echo = getEcho();
    const channel = echo.channel(`project.${id}`);

    // Listen for task changes
    channel.listen('.task.updated', (data: { action: string; taskData?: any }) => {
      console.log('[Echo] Task updated:', data);
      if (!data.taskData) return;

      if (data.action === 'created') {
        setTasks(prev => {
          if (prev.some(t => t.id === data.taskData.id)) return prev;
          return [...prev, data.taskData];
        });
      } else if (data.action === 'updated') {
        setTasks(prev => prev.map(t => t.id === data.taskData.id ? { ...t, ...data.taskData } : t));
        setSelectedTask(prev => (prev && prev.id === data.taskData.id) ? { ...prev, ...data.taskData } : prev);
      } else if (data.action === 'deleted') {
        setTasks(prev => prev.filter(t => t.id !== data.taskData.id));
        setSelectedTask(prev => (prev && prev.id === data.taskData.id) ? null : prev);
      } else if (data.action === 'comment_created') {
        setSelectedTask(prev => {
          if (prev && prev.id === data.taskData.task_id) {
            const comment = data.taskData.comment;
            const updatedComments = (prev as any).comments || [];
            if (updatedComments.some((c: any) => c.id === comment.id)) return prev;
            return {
              ...prev,
              comments: [comment, ...updatedComments],
              comments_count: ((prev as any).comments_count || 0) + 1
            } as any;
          }
          return prev;
        });
      }
    });

    // Listen for timer changes
    channel.listen('.timer.updated', (data: { action: string; userId: number; timeEntry?: any }) => {
      console.log('[Echo] Timer updated:', data);
      // Refresh time entries
      api.getProjectTimeEntries(id).then(resTime => {
        if (resTime?.success) {
          setProjectTimeEntries(resTime.data || []);
        }
      }).catch(console.error);

      // Trigger custom window event to notify global timer component
      window.dispatchEvent(new CustomEvent('timer-sync-global'));
    });

    return () => {
      channel.stopListening('.task.updated');
      channel.stopListening('.timer.updated');
      echo.leaveChannel(`project.${id}`);
    };
  }, [id]);

  useEffect(() => {
    if (searchParams.get('edit') === 'true' && me && project) {
      if (canEditProject()) {
        setShowEditProjectModal(true);
      }
    }
  }, [searchParams, me, project]);

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
    const handleTriggerAddTask = () => {
      setInlineCreate('todo');
    };
    const handleClosePanels = () => {
      setSelectedTask(null);
      setShowEditProjectModal(false);
    };

    window.addEventListener('trigger-add-task', handleTriggerAddTask);
    window.addEventListener('trigger-close-panels', handleClosePanels);

    return () => {
      window.removeEventListener('trigger-add-task', handleTriggerAddTask);
      window.removeEventListener('trigger-close-panels', handleClosePanels);
    };
  }, []);

  useEffect(() => {
    const handleTaskCreatedGlobal = () => {
      fetchProjectData(true);
    };
    window.addEventListener('task-created-global', handleTaskCreatedGlobal);
    return () => {
      window.removeEventListener('task-created-global', handleTaskCreatedGlobal);
    };
  }, [id]);

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
  }, [tasks]);

  const getFinalStatusId = (statusesList: any[]): string => {
    const doneStatus = statusesList.find(s => s.type === 'closed' || s.type === 'done' || s.id === 'done');
    if (doneStatus) return doneStatus.id;
    if (statusesList.length > 0) {
      const sorted = [...statusesList].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      return sorted[sorted.length - 1].id;
    }
    return 'done';
  };

  const getFirstStatusId = (statusesList: any[]): string => {
    const notStarted = statusesList.find(s => s.type === 'not_started' || s.id === 'todo');
    if (notStarted) return notStarted.id;
    if (statusesList.length > 0) {
      const sorted = [...statusesList].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      return sorted[0].id;
    }
    return 'todo';
  };

  const taskMatchesFilters = (t: Task) => {
    if (filterSearch) {
      const query = filterSearch.toLowerCase().trim();
      const matchesTitle = t.title?.toLowerCase().includes(query);
      const matchesId = String(t.id).includes(query);
      if (!matchesTitle && !matchesId) return false;
    }

    if (filterMyTasks && me) {
      if (t.assignee_id !== me.id) return false;
    }

    if (filterAssigneeId !== undefined) {
      if (t.assignee_id !== filterAssigneeId) return false;
    }

    if (filterAssignees.length > 0 || filterUnassigned) {
      const matchesUnassigned = filterUnassigned && !t.assignee_id;
      const matchesAssigneeList = t.assignee_id && filterAssignees.includes(Number(t.assignee_id));
      if (!matchesUnassigned && !matchesAssigneeList) return false;
    }

    if (filterStatuses.length > 0) {
      if (!t.status || !filterStatuses.includes(t.status)) return false;
    }

    if (filterPriorities.length > 0) {
      if (!t.priority || !filterPriorities.includes(t.priority)) return false;
    }

    if (filterTypes.length > 0) {
      const tType = t.type || 'task';
      if (!filterTypes.includes(tType)) return false;
    }

    return true;
  };

  const handleClearFilters = () => {
    setFilterSearch('');
    setFilterMyTasks(false);
    setFilterAssigneeId(undefined);
    setFilterAssignees([]);
    setFilterUnassigned(false);
    setFilterStatuses([]);
    setFilterPriorities([]);
    setFilterTypes([]);
  };

  const hasMatchingSubtasks = (parentId: number): boolean => {
    const children = tasksByParentId[parentId] || [];
    for (const child of children) {
      if (taskMatchesFilters(child)) return true;
      if (hasMatchingSubtasks(Number(child.id))) return true;
    }
    return false;
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter((t) => {
      if (String(t.status) !== String(status) || t.parent_task_id) return false;

      // Show parent if it matches filters or has a subtask that matches filters
      if (taskMatchesFilters(t)) return true;
      if (hasMatchingSubtasks(Number(t.id))) return true;

      return false;
    });
  };
  const boardTasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    columns.forEach((col: any) => {
      const filtered = tasks.filter((t) => {
        if (String(t.status) !== String(col.key) || t.parent_task_id) return false;

        // Show parent if it matches filters or has a subtask that matches filters
        if (taskMatchesFilters(t)) return true;
        if (hasMatchingSubtasks(Number(t.id))) return true;

        return false;
      });
      // Sort by position so manual order is respected
      map[col.key] = [...filtered].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    });
    return map;
  }, [tasks, filterSearch, filterMyTasks, filterAssigneeId, filterAssignees, filterUnassigned, filterStatuses, filterPriorities, filterTypes, me, columns]);

  const listTasksGrouped = useMemo(() => {
    // Only show parent tasks (no parent_task_id) in the grouped view.
    // Subtasks are shown inline under their parent via expand/collapse.
    const filteredTasks = tasks.filter(t => !t.parent_task_id && taskMatchesFilters(t));
    const groups: Record<string, Task[]> = {};
    if (groupBy === 'priority') {
      ['urgent', 'high', 'medium', 'low'].forEach((p) => {
        groups[p] = filteredTasks.filter((t) => t.priority === p);
      });
      const other = filteredTasks.filter((t) => !['urgent', 'high', 'medium', 'low'].includes(t.priority));
      if (other.length > 0) groups['none'] = other;
    } else if (groupBy === 'status') {
      const statusListKeys = columns.map((c: any) => c.key);
      statusListKeys.forEach((s: string) => {
        const statusTasks = filteredTasks.filter((t) => t.status === s);
        // Sort by position for manual ordering
        groups[s] = [...statusTasks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      });
      const other = filteredTasks.filter((t) => !statusListKeys.includes(t.status));
      if (other.length > 0) groups['none'] = other;
    } else if (groupBy === 'due_date') {
      filteredTasks.forEach((task) => {
        const dStr = task.due_date ? task.due_date.substring(0, 10) : t('tasks.no_due_date');
        if (!groups[dStr]) groups[dStr] = [];
        groups[dStr].push(task);
      });
    }
    return groups;
  }, [tasks, filterSearch, filterMyTasks, filterAssigneeId, filterAssignees, filterUnassigned, filterStatuses, filterPriorities, filterTypes, me, groupBy, columns, t]);

  const isTaskDone = (task: Task) => {
    const statusObj = project?.statuses?.find((s: any) => s.id === task.status);
    if (statusObj) return statusObj.type === 'closed';
    return task.status === 'done';
  };

  const getFallbackStatusObj = (task: Task) => {
    const statusObj = project?.statuses?.find((s: any) => s.id === task.status);
    if (statusObj) return statusObj;
    const defaults: Record<string, { id: string; name: string; color: string; type: string }> = {
      todo: { id: 'todo', name: t('tasks.status.todo'), color: '#9ca0b0', type: 'not_started' },
      in_progress: { id: 'in_progress', name: t('tasks.status.in_progress'), color: '#3b82f6', type: 'active' },
      review: { id: 'review', name: t('tasks.status.in_review'), color: '#a855f7', type: 'active' },
      done: { id: 'done', name: t('tasks.status.done'), color: '#22c55e', type: 'closed' },
    };

    return defaults[task.status] || { id: task.status, name: String(task.status).toUpperCase().replace('_', ' '), color: '#9ca0b0', type: 'active' };
  };

  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  const formatDateTimeShort = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = (n: number) => String(n).padStart(2, '0');
    const timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const datePart = d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return `${timePart} ${datePart}`;
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
    const normalized = dateStr.substring(0, 10);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return normalized < todayStr;
  };

  const toggleStatus = async (id: number | string, currentStatus: string, task?: Task) => {
    const projectStatuses = project?.statuses || [];
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
        message.success(t('project_detail.toast.status_updated'));
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
        if (selectedTask && selectedTask.id === id) {
          setEditStatus(nextStatus);
        }
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.toast.status_err'));
    }
  };

  const handleMarkDone = async (id: number | string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    try {
      const res = await api.updateTaskStatus(id, { status: 'done' });
      if (res.success) {
        message.success(t('project_detail.toast.status_updated'));
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done' } : t));
        if (selectedTask && selectedTask.id === id) {
          setEditStatus('done');
        }
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.toast.status_err'));
    }
  };

  const handleToggleWatchTask = async (id: number | string) => {
    try {
      const res = await api.toggleWatchTask(id);
      if (res.success) {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, watcher_ids: res.watcher_ids } : t));
        if (selectedTask && selectedTask.id === id) {
          setSelectedTask(prev => prev ? { ...prev, watcher_ids: res.watcher_ids } : null);
        }
        message.success(res.watched ? t('tasks.detail_toast.watching') : t('tasks.detail_toast.unwatching'));
        fetchProjectData(true);
      }
    } catch (err) {
      console.error('Failed to toggle watch status', err);
      message.error(t('tasks.detail_toast.watcher_err'));
    }
  };

  const cleanupDragClasses = () => {
    console.log('[DragDnD] cleanupDragClasses executing...');
    const draggedCards = document.querySelectorAll('.project-detail__task-card.dragging, .my-tasks__task-row.dragging');
    console.log('[DragDnD] Found dragged cards:', draggedCards.length);
    draggedCards.forEach(el => el.classList.remove('dragging'));

    // Remove all drop indicator lines (board + list)
    document.querySelectorAll(
      '.project-detail__task-card.drop-before, .project-detail__task-card.drop-after, .my-tasks__task-row.drop-before, .my-tasks__task-row.drop-after'
    ).forEach(el => {
      el.classList.remove('drop-before', 'drop-after');
    });
    dropIndicatorRef.current = null;

    const colElements = document.querySelectorAll('.project-detail__column');
    console.log('[DragDnD] Found columns to clean:', colElements.length);
    colElements.forEach(el => {
      const dataStatus = el.getAttribute('data-status');
      const hasDragActive = el.classList.contains('drag-active');
      const hasDropAllowed = el.classList.contains('drop-allowed');
      if (hasDragActive || hasDropAllowed) {
        console.log(`[DragDnD] Cleaning column [${dataStatus}]: had drag-active = ${hasDragActive}, drop-allowed = ${hasDropAllowed}`);
      }
      el.classList.remove('drag-active', 'column-self', 'drop-allowed', 'drop-disallowed');
    });

    const groupElements = document.querySelectorAll('.my-tasks__group');
    groupElements.forEach(el => {
      el.classList.remove('drag-active', 'group-self', 'drop-allowed', 'drop-disallowed');
    });
  };

  const handleDragStart = (e: React.DragEvent, taskId: string | number) => {
    draggedTaskRef.current = taskId;
    e.dataTransfer.effectAllowed = 'move';

    // Add dragging class to the dragged element after the drag image is captured
    const cardEl = e.currentTarget as HTMLElement;
    setTimeout(() => {
      cardEl.classList.add('dragging');
    }, 0);

    const taskToMove = tasks.find(t => t.id === taskId);
    if (taskToMove) {
      const transitions = workflowConfig?.transitions || [];
      const globalTransitions = workflowConfig?.global_transitions || [];
      const hasTransitionsConfigured = transitions.length > 0 || globalTransitions.length > 0;
      const isRestricted = workflowConfig?.mode === 'restricted' && hasTransitionsConfigured;
      const allowed = isRestricted ? getAllowedTargetStatuses(taskToMove.status) : null;

      // Highlight columns
      const colElements = document.querySelectorAll('.project-detail__column');
      colElements.forEach(el => {
        const colKey = el.getAttribute('data-status');
        if (!colKey) return;
        el.classList.add('drag-active');
        if (colKey === taskToMove.status) {
          el.classList.add('column-self');
        } else {
          const isAllowed = !allowed || allowed.includes(colKey);
          if (isAllowed) {
            el.classList.add('drop-allowed');
          } else {
            el.classList.add('drop-disallowed');
          }
        }
      });

      // Highlight list view groups
      const groupElements = document.querySelectorAll('.my-tasks__group');
      groupElements.forEach(el => {
        const groupKey = el.getAttribute('data-status');
        if (!groupKey) return;
        el.classList.add('drag-active');
        if (groupKey === taskToMove.status) {
          el.classList.add('group-self');
        } else {
          const isAllowed = !allowed || allowed.includes(groupKey);
          if (isAllowed) {
            el.classList.add('drop-allowed');
          } else {
            el.classList.add('drop-disallowed');
          }
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
    e.dataTransfer.dropEffect = 'move';
  };

  // Called when dragging over a specific task card – shows the horizontal drop indicator
  const handleCardDragOver = (e: React.DragEvent, overTaskId: string | number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const cardEl = e.currentTarget as HTMLElement;
    const rect = cardEl.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertPosition: 'before' | 'after' = e.clientY < midY ? 'before' : 'after';

    const prev = dropIndicatorRef.current;
    // Avoid unnecessary DOM mutations
    if (prev && prev.taskId === overTaskId && prev.position === insertPosition) return;

    // Clear previous indicator
    document.querySelectorAll('.project-detail__task-card.drop-before, .project-detail__task-card.drop-after').forEach(el => {
      el.classList.remove('drop-before', 'drop-after');
    });

    // Skip showing indicator when hovering the dragged card itself
    if (String(overTaskId) === String(draggedTaskRef.current)) {
      dropIndicatorRef.current = null;
      return;
    }

    cardEl.classList.add(insertPosition === 'before' ? 'drop-before' : 'drop-after');
    dropIndicatorRef.current = { taskId: overTaskId, position: insertPosition };
  };

  const handleCardDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the card/row entirely (not entering a child element)
    const related = e.relatedTarget as HTMLElement | null;
    const card = e.currentTarget as HTMLElement;
    if (related && card.contains(related)) return;
    card.classList.remove('drop-before', 'drop-after');
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = draggedTaskRef.current;
    console.log('[DragDnD] handleDrop called. taskId:', taskId, 'newStatus:', newStatus);
    if (!taskId) {
      console.warn('[DragDnD] handleDrop: taskId is null/undefined, aborting');
      return;
    }

    const taskToMove = tasks.find(t => String(t.id) === String(taskId));
    console.log('[DragDnD] taskToMove:', taskToMove);
    if (!taskToMove) {
      console.warn('[DragDnD] handleDrop: taskToMove is null/undefined, aborting');
      return;
    }

    // Allow same-status drops for reordering within the column
    const isSameStatus = String(taskToMove.status) === String(newStatus);
    const dropIndicator = dropIndicatorRef.current;

    if (isSameStatus && !dropIndicator) {
      console.log('[DragDnD] Task status matches newStatus and no drop indicator, cleaning and aborting');
      cleanupDragClasses();
      draggedTaskRef.current = null;
      return;
    }

    if (!canEditTask(taskToMove)) {
      message.error(t('project_detail.toast.no_edit_permission'));
      cleanupDragClasses();
      draggedTaskRef.current = null;
      return;
    }

    // Workflow validation: check if transition is allowed
    const transitions = workflowConfig.transitions || [];
    const globalTransitions = workflowConfig.global_transitions || [];
    const hasTransitionsConfigured = transitions.length > 0 || globalTransitions.length > 0;

    if (workflowConfig?.mode === 'restricted' && hasTransitionsConfigured && taskToMove.status !== newStatus) {
      const allowed = getAllowedTargetStatuses(taskToMove.status);
      if (!allowed.includes(newStatus)) {
        // Build clear warning message for local block
        const hasTransition = transitions.some((t: any) => t.from === taskToMove.status && t.to === newStatus) ||
          globalTransitions.some((gt: any) => gt.to === newStatus);

        const statusNames = (project?.statuses || []).reduce((acc: any, s: any) => {
          acc[s.id] = s.name;
          return acc;
        }, {} as any);
        const fromName = statusNames[taskToMove.status] || taskToMove.status;
        const toName = statusNames[newStatus] || newStatus;

        if (!hasTransition) {
          message.warning(t('workflow.transition_not_defined', {
            from: fromName,
            to: toName,
            defaultValue: `Quy trình dự án không cho phép chuyển từ trạng thái '${fromName}' sang '${toName}'.`
          }));
        } else {
          message.warning(t('workflow.role_not_allowed', {
            defaultValue: 'Bạn không có vai trò phù hợp để thực hiện chuyển đổi trạng thái này.'
          }));
        }
        cleanupDragClasses();
        draggedTaskRef.current = null;
        return;
      }
    }

    // Clone card and hide original to avoid React "removeChild" crashes
    const cardEl = document.querySelector(`.project-detail__task-card[data-task-id="${taskId}"], .my-tasks__task-row[data-task-id="${taskId}"]`) as HTMLElement;
    if (cardEl) {
      const clone = cardEl.cloneNode(true) as HTMLElement;
      clone.classList.add('drag-clone-placeholder');

      // Hide original card and mark it with a class for later visibility restoration
      cardEl.style.display = 'none';
      cardEl.classList.add('drag-original-hidden');

      const draggedIndex = tasks.findIndex(t => String(t.id) === String(taskId));

      if (viewMode === 'board') {
        const targetColBody = document.querySelector(`.project-detail__column--${newStatus} .project-detail__column-body`) as HTMLElement;
        if (targetColBody) {
          // Find all existing cards in this column
          const cards = Array.from(targetColBody.querySelectorAll('.project-detail__task-card')) as HTMLElement[];
          const existingCards = cards.filter(el => !el.classList.contains('drag-clone-placeholder'));

          let insertBeforeEl: HTMLElement | null = null;
          for (const card of existingCards) {
            const cardTaskId = card.getAttribute('data-task-id');
            if (cardTaskId) {
              const cardIndex = tasks.findIndex(t => String(t.id) === String(cardTaskId));
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
      } else {
        const targetGroupBody = document.querySelector(`.my-tasks__group[data-status="${newStatus}"] .my-tasks__group-body`) as HTMLElement;
        if (targetGroupBody) {
          // Find all existing cards in this group
          const cards = Array.from(targetGroupBody.querySelectorAll('.my-tasks__task-row')) as HTMLElement[];
          const existingCards = cards.filter(el => !el.classList.contains('drag-clone-placeholder'));

          let insertBeforeEl: HTMLElement | null = null;
          for (const card of existingCards) {
            const cardTaskId = card.getAttribute('data-task-id');
            if (cardTaskId) {
              const cardIndex = tasks.findIndex(t => String(t.id) === String(cardTaskId));
              if (cardIndex > draggedIndex) {
                insertBeforeEl = card;
                break;
              }
            }
          }

          if (insertBeforeEl) {
            targetGroupBody.insertBefore(clone, insertBeforeEl);
          } else {
            const controlEl = targetGroupBody.querySelector(':scope > :not(.my-tasks__task-row):not(.drag-clone-placeholder)');
            if (controlEl) {
              targetGroupBody.insertBefore(clone, controlEl);
            } else {
              targetGroupBody.appendChild(clone);
            }
          }
        }
      }
    }

    // Compute the target position index based on drop indicator
    let targetPosition: number | undefined = undefined;
    if (dropIndicator) {
      // Use the correct task list depending on current view
      const sourceTasks = viewMode === 'board'
        ? (boardTasksByStatus[newStatus] || [])
        : (listTasksGrouped[newStatus] || []);
      const overIndex = sourceTasks.findIndex(t => String(t.id) === String(dropIndicator.taskId));
      if (overIndex !== -1) {
        targetPosition = dropIndicator.position === 'before' ? overIndex : overIndex + 1;
      }
    }

    cleanupDragClasses();
    draggedTaskRef.current = null;

    // Defer state update using setTimeout to let the browser paint the clone immediately!
    setTimeout(async () => {
      console.log('[DragDnD] Defer execution starts inside setTimeout');
      cleanupDragClasses();
      // Optimistic Update: reorder tasks array locally
      const prevTasks = [...tasks];
      console.log('[DragDnD] Triggering optimistic update setTasks for taskId:', taskId, 'to position:', targetPosition);
      setTasks((prev) => {
        let next = prev.map((t) => {
          if (String(t.id) === String(taskId)) {
            return { ...t, status: newStatus as Task['status'] };
          }
          return t;
        });
        // Reorder within status if position is specified
        if (targetPosition !== undefined) {
          const sameStatusTasks = next
            .filter(t => String(t.status) === String(newStatus) && !t.parent_task_id)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          // Remove dragged task from sorted list
          const withoutDragged = sameStatusTasks.filter(t => String(t.id) !== String(taskId));
          const draggedTask = next.find(t => String(t.id) === String(taskId));
          if (draggedTask) {
            // Insert at target position
            const clampedPos = Math.min(targetPosition, withoutDragged.length);
            withoutDragged.splice(clampedPos, 0, draggedTask);
            // Assign sequential positions for optimistic render
            withoutDragged.forEach((t, i) => {
              const idx = next.findIndex(nt => String(nt.id) === String(t.id));
              if (idx !== -1) next[idx] = { ...next[idx], position: i };
            });
          }
        }
        return next;
      });

      try {
        console.log('[DragDnD] Calling api.updateTaskStatus for taskId:', taskId, 'to newStatus:', newStatus, 'position:', targetPosition);
        const res = await api.updateTaskStatus(taskId, { status: newStatus as any, position: targetPosition });
        console.log('[DragDnD] API response:', res);
        if (res.success) {
          if (isSameStatus) {
            // For reorder, no status change toast needed
          } else {
            message.success(t('project_detail.toast.status_updated'));
          }
          const updatedTaskFromServer = res.data;
          if (updatedTaskFromServer) {
            console.log('[DragDnD] Updating tasks with server response:', updatedTaskFromServer);
            setTasks(prev => prev.map(t => String(t.id) === String(updatedTaskFromServer.id) ? updatedTaskFromServer : t));
          } else {
            console.log('[DragDnD] res.data is null/undefined. No task update from server response.');
          }
        } else {
          console.warn('[DragDnD] API success is false, reverting tasks');
          setTasks(prevTasks);
        }
      } catch (err: any) {
        console.error('[DragDnD] API error, reverting tasks:', err);
        setTasks(prevTasks);
        const errMsg = err.response?.data?.message ||
          (err.response?.data?.workflow_error ? t('workflow.transition_blocked') : t('tasks.toast.status_err'));
        message.error(errMsg);
      }
    }, 50);
  };

  const handleInlineCreate = async (status: string) => {
    if (!newTaskTitle.trim() || !id) return;
    try {
      const payload: any = {
        project_id: id,
        title: newTaskTitle,
        status: newTaskStatus || status,
        priority: newTaskPriority || 'medium',
      };
      if (newTaskAssignee) payload.assignee_id = newTaskAssignee;
      if (newTaskStartDate) payload.start_date = newTaskStartDate;
      if (newTaskDueDate) payload.due_date = newTaskDueDate;
      const res = await api.createTask(payload);
      if (res.success) {
        message.success(t('project_detail.toast.task_created'));
        setNewTaskTitle('');
        setNewTaskStatus('');
        setNewTaskPriority('medium');
        setNewTaskAssignee(null);
        setNewTaskStartDate('');
        setNewTaskDueDate('');
        setInlineCreate(null);
        fetchProjectData();
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || t('tasks.create_modal.create_failed');
      message.error(errMsg);
    }
  };

  // handleUpdateProject removed, handled by EditProjectModal

  const handleAddMember = async () => {
    if (selectedNewMembers.length === 0 || !id) return;
    try {
      const res = await api.addProjectMember(id, { user_ids: selectedNewMembers.map(Number), role: 'member' });
      if (res.success) {
        message.success(t('project_detail.toast.member_added'));
        setShowAddMemberModal(false);
        setSelectedNewMembers([]);
        fetchProjectData();
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || t('projects.members.add_failed');
      message.error(errMsg);
    }
  };

  const handleRemoveMember = async (userId: number | string) => {
    if (!id) return;
    try {
      const res = await api.removeProjectMember(id, userId);
      if (res.success) {
        message.success(t('project_detail.toast.member_removed'));
        fetchProjectData();
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || t('projects.members.delete_failed');
      message.error(errMsg);
    }
  };

  const filterEntriesByDate = (entries: any[]) => {
    return entries.filter(entry => {
      if (timesheetDateFilter === 'all') return true;
      const entryDate = new Date(entry.started_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (timesheetDateFilter === 'today') {
        return entryDate >= today;
      }
      if (timesheetDateFilter === 'week') {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        return entryDate >= startOfWeek;
      }
      if (timesheetDateFilter === 'month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return entryDate >= startOfMonth;
      }
      if (timesheetDateFilter === 'custom') {
        const start = timesheetStartDate ? new Date(timesheetStartDate) : null;
        const end = timesheetEndDate ? new Date(timesheetEndDate) : null;
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);

        if (start && end) return entryDate >= start && entryDate <= end;
        if (start) return entryDate >= start;
        if (end) return entryDate <= end;
      }
      return true;
    });
  };

  const filterEntriesByMember = (entries: any[]) => {
    return entries.filter(entry => {
      if (timesheetMemberFilter === 'all') return true;
      return Number(entry.user_id) === Number(timesheetMemberFilter);
    });
  };

  const handleAddManualTime = async () => {
    if (!logTimeTask) {
      message.error(t('manual_log.err.select_task'));
      return;
    }
    const durationInSeconds = (logTimeHours * 3600) + (logTimeMinutes * 60);
    if (durationInSeconds <= 0) {
      message.error(t('tasks.panel.invalid_time'));
      return;
    }
    try {
      const data = await api.addManualTime(logTimeTask, {
        duration: durationInSeconds,
        description: logTimeDescription,
        started_at: logTimeDate ? `${logTimeDate} 09:00:00` : undefined
      });
      if (data?.success) {
        message.success(t('manual_log.success'));
        setShowLogTimeModal(false);
        setLogTimeTask(null);
        setLogTimeHours(0);
        setLogTimeMinutes(0);
        setLogTimeDescription('');
        fetchProjectData(true);
      } else {
        message.error(data?.message || t('manual_log.err.generic'));
      }
    } catch (err) {
      console.error(err);
      message.error(t('manual_log.err.generic'));
    }
  };

  const handleDeleteTimeEntry = async (entryId: number) => {
    try {
      const data = await api.deleteTimeEntry(entryId);
      if (data?.success) {
        message.success(t('timesheet.toast.log_deleted'));
        fetchProjectData(true);
      }
    } catch (err) {
      console.error(err);
      message.error(t('timesheet.toast.log_delete_err'));
    }
  };

  const formatSecondsToDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || (h === 0 && m === 0)) parts.push(`${s}s`);
    return parts.join(' ');
  };

  const handleSelectTask = async (task: Task) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditAssigneeId(task.assignee_id ? Number(task.assignee_id) : undefined);
    setEditEstHours(task.estimated_hours || null);
    setEditActHours(task.actual_hours || null);
    setComments([]);
    setActivities([]);
    setCommentsPage(1);
    setActivitiesPage(1);
    setCommentsHasMore(false);
    setActivitiesHasMore(false);
    setNewCommentText('');
    setNewCommentFile(null); try {
      const res = await api.getTask(task.id);
      if (res.success) {
        const fullTask = res.data;
        setSelectedTask(fullTask);
        setComments(fullTask.comments || []);
        setCommentsHasMore((fullTask.comments || []).length < (fullTask.comments_count || 0));
        const sortedActs = [...(fullTask.activities || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setActivities(sortedActs);
        setActivitiesHasMore((fullTask.activities || []).length < (fullTask.activities_count || 0));
        setEditStartDate(fullTask.start_date || '');
        setEditDueDate(fullTask.due_date || '');
      }
    } catch (err) {
      console.error('Failed to load full task details', err);
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
        status: project?.statuses?.[0]?.id || 'todo',
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
        fetchProjectData();
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.subtask_add_err'));
    }
  };

  const handleToggleSubtaskStatus = async (st: any) => {
    if (!selectedTask) return;
    const newStatus = st.status === 'done' ? 'todo' : 'done';
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
        fetchProjectData();
      } else {
        // API returned success:false (e.g. workflow blocked)
        const errMsg = res.message || t('tasks.detail_toast.status_update_err');
        message.error(errMsg);
      }
    } catch (err: any) {
      console.error(err);
      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        null;
      message.error(apiMsg || t('tasks.detail_toast.status_update_err'));
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
        message.success(res.watched ? t('tasks.detail_toast.watching') : t('tasks.detail_toast.unwatching'));
        fetchProjectData();
      }
    } catch (err) {
      console.error('Failed to toggle watch status', err);
      message.error(t('tasks.detail_toast.watch_update_err'));
    }
  };

  const calculateEstimateHours = (start: string, due: string): number | null => {
    if (!start || !due) return null;
    const s = new Date(start).getTime();
    const d = new Date(due).getTime();
    if (isNaN(s) || isNaN(d) || d <= s) return null;
    const diffMs = d - s;
    return Math.round(diffMs / (1000 * 60 * 60));
  };

  const formatEstimate = (start: string, due: string): string => {
    if (!start || !due) return '—';
    const s = new Date(start).getTime();
    const d = new Date(due).getTime();
    if (isNaN(s) || isNaN(d) || d <= s) return '—';
    const diffMs = d - s;
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(t('common.time.days', { count: days }));
    if (hours > 0) parts.push(t('common.time.hours', { count: hours }));
    if (minutes > 0 && days === 0) parts.push(t('common.time.minutes', { count: minutes }));
    return parts.length > 0 ? parts.join(' ') : t('common.time.less_than_minute');
  };

  const autoSaveTaskField = async (fieldName: string, value: any) => {
    if (!selectedTask) return;
    try {
      let calculatedEst = editEstHours;
      if (fieldName === 'start_date' || fieldName === 'due_date') {
        const startVal = fieldName === 'start_date' ? value : editStartDate;
        const dueVal = fieldName === 'due_date' ? value : editDueDate;
        calculatedEst = calculateEstimateHours(startVal, dueVal);
        setEditEstHours(calculatedEst);
      }

      const payload: any = {
        title: fieldName === 'title' ? value : editTitle,
        description: fieldName === 'description' ? value : editDescription,
        status: fieldName === 'status' ? value : editStatus,
        priority: fieldName === 'priority' ? value : editPriority,
        assignee_id: fieldName === 'assignee_id' ? (value || null) : (editAssigneeId || null),
        start_date: fieldName === 'start_date' ? (value || null) : (editStartDate || null),
        due_date: fieldName === 'due_date' ? (value || null) : (editDueDate || null),
      };

      const res = await api.updateTask(selectedTask.id, payload);
      if (res.success) {
        setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...res.data } : t));
        const taskRes = await api.getTask(selectedTask.id);
        if (taskRes.success) {
          const fullTask = taskRes.data;
          setSelectedTask(fullTask);
          setComments(fullTask.comments || []);
          const sortedActs = [...(fullTask.activities || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setActivities(sortedActs);
          setEditTitle(fullTask.title);
          setEditDescription(fullTask.description || '');
          setEditStatus(fullTask.status);
          setEditPriority(fullTask.priority);
          setEditAssigneeId(fullTask.assignee_id ? Number(fullTask.assignee_id) : undefined);
          setEditEstHours(fullTask.estimated_hours || null);
          setEditActHours(fullTask.actual_hours || null);
          setEditStartDate(fullTask.start_date || '');
          setEditDueDate(fullTask.due_date || '');
        }
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || t('tasks.detail_toast.auto_save_err');
      message.error(errMsg);
    }
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
    if (!newCommentText.trim() && !newCommentFile) return;
    try {
      const res = await api.createTaskComment(selectedTask!.id, newCommentText, newCommentFile || undefined);
      if (res.success) {
        message.success(t('project_detail.toast.comment_sent'));
        setNewCommentText('');
        setNewCommentFile(null);
        setCommentFilePreview(null);
        const taskRes = await api.getTask(selectedTask!.id);
        if (taskRes.success) {
          setSelectedTask(taskRes.data);
          setComments(taskRes.data.comments || []);
          const sortedActs = [...(taskRes.data.activities || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setActivities(sortedActs);
        }
      }
    } catch (err) {
      console.error(err);
      message.error(t('project_detail.toast.comment_err'));
    }
  };

  const handlePostReply = async (parentCommentId: number) => {
    if (!selectedTask || !replyText.trim()) return;
    try {
      const res = await api.createTaskComment(selectedTask.id, replyText, replyFile || undefined, parentCommentId);
      if (res.success) {
        message.success(t('project_detail.toast.comment_sent'));
        setReplyText('');
        setReplyFile(null);
        setReplyFilePreview(null);
        setReplyingToCommentId(null);

        // Auto-expand replies for this parent
        setExpandedCommentIds(prev => ({ ...prev, [parentCommentId]: true }));

        const taskRes = await api.getTask(selectedTask.id);
        if (taskRes.success) {
          setSelectedTask(taskRes.data);
          setComments(taskRes.data.comments || []);
          const sortedActs = [...(taskRes.data.activities || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setActivities(sortedActs);
        }
      }
    } catch (err) {
      console.error(err);
      message.error(t('project_detail.toast.comment_err'));
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

  const handleDeleteTask = async (taskId: string | number) => {
    showDeleteConfirm({
      title: t('project_detail.confirm.delete_task'),
      content: t('project_detail.confirm.delete_task_content'),
      okText: t('project_detail.confirm.delete_btn'),
      cancelText: t('tasks.modal.cancel'),
      onConfirm: async () => {
        try {
          const res = await api.deleteTask(taskId);
          if (res.success) {
            message.success(t('project_detail.toast.task_deleted'));
            setSelectedTask(null);
            fetchProjectData();
          }
        } catch (err) {
          console.error(err);
          message.error(t('project_detail.toast.task_delete_err'));
          throw err;
        }
      }
    });
  };

  const SubtaskIcon = () => (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      stroke="currentColor"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, marginRight: '4px' }}
    >
      <path d="M 8 10 v 4 a 2 2 0 0 0 2 2 h 4" />
      <circle cx="8" cy="8" r="2" />
      <circle cx="16" cy="16" r="2" />
    </svg>
  );




  const filteredTimeEntries = filterEntriesByMember(filterEntriesByDate(projectTimeEntries));

  const totalSeconds = filteredTimeEntries.reduce((acc, entry) => acc + (entry.duration || 0), 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);

  const memberTimeMap: Record<number, { name: string; duration: number }> = {};
  filteredTimeEntries.forEach(entry => {
    const uid = entry.user_id;
    const name = entry.user?.name || `User #${uid}`;
    if (!memberTimeMap[uid]) {
      memberTimeMap[uid] = { name, duration: 0 };
    }
    memberTimeMap[uid].duration += (entry.duration || 0);
  });

  let mostActiveMember = '—';
  let maxMemberTime = 0;
  Object.values(memberTimeMap).forEach(m => {
    if (m.duration > maxMemberTime) {
      maxMemberTime = m.duration;
      mostActiveMember = m.name;
    }
  });

  const taskTimeMap: Record<number, { title: string; duration: number }> = {};
  filteredTimeEntries.forEach(entry => {
    const tid = entry.task_id;
    const title = entry.task?.title || `Task #${tid}`;
    if (!taskTimeMap[tid]) {
      taskTimeMap[tid] = { title, duration: 0 };
    }
    taskTimeMap[tid].duration += (entry.duration || 0);
  });

  let mostLoggedTask = '—';
  let maxTaskTime = 0;
  Object.values(taskTimeMap).forEach(t => {
    if (t.duration > maxTaskTime) {
      maxTaskTime = t.duration;
      mostLoggedTask = t.title;
    }
  });

  const memberChartData = Object.values(memberTimeMap).map(m => ({
    name: m.name,
    hours: parseFloat((m.duration / 3600).toFixed(2)),
  })).sort((a, b) => b.hours - a.hours);

  const taskChartData = Object.values(taskTimeMap).map(t => ({
    name: t.title.length > 20 ? t.title.substring(0, 20) + '...' : t.title,
    value: parseFloat((t.duration / 3600).toFixed(2)),
  })).sort((a, b) => b.value - a.value).slice(0, 7);

  const tabs = [
    { key: 'tasks', label: t('project_detail.tab.tasks'), badge: tasks.filter(t => !t.parent_task_id).length },
    { key: 'timesheet', label: t('project_detail.tab.timesheet'), badge: projectTimeEntries.length },
    { key: 'members', label: t('project_detail.tab.members'), badge: project?.members?.length || 0 },
  ];
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" description={t('projects.toast.loading_details')} />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h3>{t('projects.toast.project_not_found')}</h3>
        <Button onClick={() => navigate('/projects')}>{t('projects.toast.back_to_list')}</Button>
      </div>
    );
  }


  const renderStatusRow = (s: any, index: number) => {
    return (
      <div
        key={s.id}
        className="status-manage__row"
        draggable
        onDragStart={(e) => {
          draggedStatusIdRef.current = s.id;
          e.dataTransfer.effectAllowed = 'move';
          const rowEl = e.currentTarget as HTMLElement;
          setTimeout(() => {
            rowEl.classList.add('dragging');
          }, 0);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = draggedStatusIdRef.current;
          if (!draggedId || draggedId === s.id) return;
          const fromIdx = activeStatuses.findIndex(st => st.id === draggedId);
          const toIdx = activeStatuses.findIndex(st => st.id === s.id);
          if (fromIdx === -1 || toIdx === -1) return;
          const newList = [...activeStatuses];
          const [moved] = newList.splice(fromIdx, 1);
          newList.splice(toIdx, 0, moved);
          newList.forEach((st, i) => { st.position = i; });
          setActiveStatuses(newList);
          draggedStatusIdRef.current = null;
          document.querySelectorAll('.status-manage__row').forEach(el => el.classList.remove('dragging'));
        }}
        onDragEnd={(e) => {
          draggedStatusIdRef.current = null;
          document.querySelectorAll('.status-manage__row').forEach(el => el.classList.remove('dragging'));
        }}
      >
        {/* Drag handle */}
        <HolderOutlined style={{ color: 'var(--text-muted)', fontSize: '14px', cursor: 'grab', flexShrink: 0 }} />

        <Popover
          content={
            <div style={{ padding: '4px', minWidth: '170px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', padding: '2px 4px 8px', textTransform: 'uppercase' }}>Color</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: customColorStatusId === s.id ? '10px' : '0' }}>
                {statusColors.map(c => (
                  <div
                    key={c}
                    onClick={() => {
                      handleUpdateStatusProp(s.id, 'color', c);
                      setColorPickerOpenId(null);
                      setColorPickedIds(prev => new Set(prev).add(s.id));
                      setCustomColorStatusId(null);
                    }}
                    style={{
                      background: c, width: '24px', height: '24px', borderRadius: '50%',
                      cursor: 'pointer', border: s.color === c ? '2px solid var(--primary)' : '1px solid transparent',
                      transition: 'transform 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  />
                ))}
                {/* Custom color button */}
                <div
                  onClick={() => {
                    setCustomColorStatusId(customColorStatusId === s.id ? null : s.id);
                    setCustomColorValue(s.color);
                  }}
                  style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    cursor: 'pointer',
                    border: '1px dashed var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', color: 'var(--text-muted)', fontWeight: 700,
                    background: !statusColors.includes(s.color) ? s.color : 'transparent',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  title="Custom color"
                >
                  {statusColors.includes(s.color) ? '+' : ''}
                </div>
              </div>

              {/* Custom color picker panel */}
              {customColorStatusId === s.id && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={customColorValue}
                      onChange={e => setCustomColorValue(e.target.value)}
                      style={{ width: '32px', height: '32px', border: 'none', cursor: 'pointer', padding: 0, background: 'transparent' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>HEX</span>
                      <input
                        value={customColorValue}
                        onChange={e => setCustomColorValue(e.target.value)}
                        style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '3px 6px', color: 'var(--text-primary)', fontSize: '11px', outline: 'none', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleUpdateStatusProp(s.id, 'color', customColorValue);
                      setColorPickerOpenId(null);
                      setColorPickedIds(prev => new Set(prev).add(s.id));
                      setCustomColorStatusId(null);
                    }}
                    style={{ width: '100%', padding: '5px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          }
          trigger="click"
          placement="bottomLeft"
          open={colorPickerOpenId === s.id}
          onOpenChange={(open) => { setColorPickerOpenId(open ? s.id : null); if (!open) setCustomColorStatusId(null); }}
        >
          <div
            style={{ width: '12px', height: '12px', borderRadius: '50%', background: s.color, cursor: 'pointer', flexShrink: 0 }}
            title={t('projects.status.choose_color')}
          />
        </Popover>

        <Input
          value={s.name}
          onChange={e => handleUpdateStatusProp(s.id, 'name', e.target.value)}
          variant="borderless"
          size="small"
          style={{
            padding: '2px 8px',
            fontWeight: 700,
            fontSize: '13px',
            color: '#fff',
            background: s.color,
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
          }}
          onClick={e => e.stopPropagation()}
          onFocus={() => { if (!colorPickedIds.has(s.id)) setColorPickerOpenId(s.id); }}
        />

        <button
          onClick={() => handleDeleteStatus(s.id)}
          style={{
            border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer',
            fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2px', borderRadius: '4px', flexShrink: 0,
          }}
          className="delete-status-btn-hover"
          title={t('tasks.panel.delete')}
        >
          ×
        </button>
      </div>
    );
  };

  const nonProjectUsers = allUsers.filter(u => {
    const isMember = project.members?.some((m: any) => Number(m.id) === Number(u.id));
    return !isMember;
  });

  const taskEditable = selectedTask ? canEditTask(selectedTask) : false;

  return (
    <div className="project-detail">
      {/* Header */}
      <div className="project-detail__header">
        <div className="project-detail__header-left">
          <button style={{ background: 'none', border: 'none', color: '#9ca0b0', cursor: 'pointer', fontSize: 16 }} onClick={() => navigate('/projects')}>
            <ArrowLeftOutlined />
          </button>
          <div className="project-icon" style={{
            background: project.icon && project.icon.startsWith('data:image/') ? 'transparent' : `${project.color}20`,
            color: project.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {renderProjectIcon(project.icon, project.color, project.name, 40)}
          </div>
          <div className="project-info">
            <h1>{project.name}</h1>
            <span className="project-id">#{project.id}</span>
          </div>
        </div>
        {canEditProject() && (
          <div className="project-detail__header-right" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Tooltip title={t('projects.status.manage_btn')} placement="bottom">
              <Button
                shape="circle"
                icon={<SettingOutlined />}
                onClick={() => setShowManageStatusesModal(true)}
              />
            </Tooltip>
            <Tooltip title={t('workflow.edit_title')} placement="bottom">
              <Button
                shape="circle"
                icon={<BranchesOutlined />}
                onClick={() => setShowWorkflowEditor(true)}
              />
            </Tooltip>
            <Tooltip title={t('project_detail.edit_btn')} placement="bottom">
              <Button
                shape="circle"
                type="primary"
                icon={<EditOutlined />}
                onClick={() => setShowEditProjectModal(true)}
              />
            </Tooltip>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="project-detail__tabs">
        {tabs.map((tab) => (
          <div key={tab.key} className={`tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
            {tab.badge !== undefined && <span className="tab-badge">{tab.badge}</span>}
          </div>
        ))}
      </div>

      {/* Render tabs content */}
      {activeTab === 'tasks' && (
        <>
          {/* Board Toolbar */}
          <div className="project-detail__toolbar">
            <div className="project-detail__toolbar-left">
              <span style={{ color: '#9ca0b0', fontSize: '13px' }}>{project.description || t('projects.no_desc')}</span>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div
            className="project-detail__filter-toolbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '12px 24px',
              background: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginBottom: '16px',
              flexWrap: 'wrap'
            }}
          >
            <div className="project-detail__filter-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '240px', flexWrap: 'wrap' }}>
              <DebouncedSearchInput
                placeholder={t('projects.search_tasks_placeholder')}
                variant="filled"
                value={filterSearch}
                onChange={setFilterSearch}
                style={{ maxWidth: '320px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)' }}
                className='search-task-board-input'
              />

              {/* Lọc Popover */}
              <ProjectFilterPopover
                projectMembers={projectMembers}
                columns={columns}
                t={t}
                filterMyTasks={filterMyTasks}
                filterUnassigned={filterUnassigned}
                filterAssignees={filterAssignees}
                filterStatuses={filterStatuses}
                filterPriorities={filterPriorities}
                filterTypes={filterTypes}
                setFilterMyTasks={setFilterMyTasks}
                setFilterUnassigned={setFilterUnassigned}
                setFilterAssignees={setFilterAssignees}
                setFilterStatuses={setFilterStatuses}
                setFilterPriorities={setFilterPriorities}
                setFilterTypes={setFilterTypes}
                handleClearFilters={handleClearFilters}
              />

              {/* Group By selector (List view only) */}
              {viewMode === 'list' && (() => {
                const groupOptions = [
                  { value: 'status', label: t('tasks.group.status') },
                  { value: 'priority', label: t('tasks.group.priority') },
                  { value: 'due_date', label: t('tasks.group.due_date') },
                ] as const;

                const groupPanel = (
                  <div style={{ width: 200, borderRadius: '10px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
                    <div style={{ padding: '10px 0' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 16px 10px' }}>
                        {t('tasks.group.label')}
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
                      {t('tasks.group.label')}
                    </button>
                  </Popover>
                );
              })()}
            </div>

            <div className="project-detail__view-toggles" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                <button
                  className={`panel-btn ${viewMode === 'list' ? 'active' : ''}`}
                  style={{ background: viewMode === 'list' ? 'var(--primary-bg)' : 'transparent', color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', padding: '8px 12px', cursor: 'pointer' }}
                  onClick={() => setViewMode('list')}
                  title={t('projects.view.list')}
                >
                  <UnorderedListOutlined />
                </button>
                <button
                  className={`panel-btn ${viewMode === 'board' ? 'active' : ''}`}
                  style={{ background: viewMode === 'board' ? 'var(--primary-bg)' : 'transparent', color: viewMode === 'board' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', padding: '8px 12px', cursor: 'pointer' }}
                  onClick={() => setViewMode('board')}
                  title={t('project_detail.tab.board')}
                >
                  <AppstoreOutlined />
                </button>
                <button
                  className={`panel-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                  style={{ background: viewMode === 'calendar' ? 'var(--primary-bg)' : 'transparent', color: viewMode === 'calendar' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', padding: '8px 12px', cursor: 'pointer' }}
                  onClick={() => setViewMode('calendar')}
                  title={t('project_detail.tab.calendar')}
                >
                  <CalendarOutlined />
                </button>
              </div>
            </div>
          </div>

          {/* View Mode: Board (Kanban) */}
          {viewMode === 'board' && (
            <div className="project-detail__board">
              {columns.map((col: any) => {
                const colTasks: Task[] = boardTasksByStatus[col.key] || [];
                return (
                  <div key={col.key} className={`project-detail__column project-detail__column--${col.key}`}
                    data-status={col.key}
                    onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.key)}
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
                      {(!workflowInitialStatus || col.key === workflowInitialStatus) && (
                        <button className="add-btn" onClick={() => {
                          setInlineCreate(col.key);
                          setNewTaskTitle('');
                          setNewTaskStatus(col.key);
                          setNewTaskPriority('medium');
                          setNewTaskAssignee(null);
                          setNewTaskStartDate('');
                          setNewTaskDueDate('');
                        }}>
                          <PlusOutlined />
                        </button>
                      )}
                    </div>

                    <div className="project-detail__column-body">
                      {/* Task Cards */}
                      {colTasks.map((task: Task) => (
                        <div key={task.id} className="project-detail__task-card" data-task-id={task.id}
                          draggable onDragStart={(e) => handleDragStart(e, task.id)} onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleCardDragOver(e, task.id)}
                          onDragLeave={handleCardDragLeave}
                          onClick={() => handleSelectTask(task)}>
                          <div className="project-detail__task-card-top">
                            <span className="project-detail__task-card-id">#{task.id}</span>
                            <FlagIcon color={priorityColors[task.priority] || '#f59e0b'} size={14} />
                          </div>
                          <div className="project-detail__task-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TaskTypeBadge type={task.type || 'task'} size="icon" />
                            {task.title}
                          </div>
                          <div className="project-detail__task-card-bottom">
                            <div className="project-detail__task-card-meta">
                              <span className="project-detail__task-card-date">
                                {task.due_date ? formatDateTime(task.due_date) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>{t('tasks.no_deadline')}</span>}
                              </span>
                            </div>
                            {task.assignee ? (
                              <div className="project-detail__task-card-assignee" style={{ background: project.color }}>
                                {task.assignee.photo ? <img src={task.assignee.photo} alt={task.assignee.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : getInitials(task.assignee.name)}
                              </div>
                            ) : (
                              <div className="project-detail__task-card-assignee" style={{ border: '1px dashed var(--text-muted, #9ca0b0)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <UserOutlined style={{ color: 'var(--text-muted, #9ca0b0)', fontSize: '10px' }} />
                              </div>
                            )}
                          </div>

                          {/* Nested Subtasks */}
                          {(() => {
                            const renderSubtasksTree = (parentTaskId: number, depth = 0): React.ReactNode => {
                              let children = tasks.filter(t => Number(t.parent_task_id) === Number(parentTaskId));

                              const isFilterActive = !!(filterSearch || filterMyTasks || filterAssigneeId !== undefined);
                              if (isFilterActive) {
                                children = children.filter(child => taskMatchesFilters(child) || hasMatchingSubtasks(Number(child.id)));
                              }

                              if (children.length === 0) return null;

                              return (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    marginTop: depth === 0 ? '8px' : '4px',
                                    marginLeft: depth > 0 ? '12px' : '0px',
                                    borderLeft: depth > 0 ? '1px dashed var(--border-color)' : 'none',
                                    paddingLeft: depth > 0 ? '8px' : '0px'
                                  }}
                                >
                                  {children.map((st) => {
                                    const finalStatusId = getFinalStatusId(project?.statuses || []);
                                    const firstStatusId = getFirstStatusId(project?.statuses || []);
                                    const isStDone = st.status === finalStatusId;
                                    const subtaskEditable = canEditTask(st);
                                    return (
                                      <React.Fragment key={st.id}>
                                        <div
                                          key={st.id}
                                          onClick={() => handleSelectTask(st)}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: 'var(--bg-body)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '4px',
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            gap: '8px',
                                          }}
                                          className="project-detail__subtask-card"
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                                            <input
                                              type="checkbox"
                                              checked={isStDone}
                                              disabled={!subtaskEditable}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={async (e) => {
                                                e.stopPropagation();
                                                if (!subtaskEditable) return;
                                                const newStatus = isStDone ? firstStatusId : finalStatusId;
                                                try {
                                                  const res = await api.updateTask(st.id, { status: newStatus });
                                                  if (res.success) {
                                                    fetchProjectData(true);
                                                  }
                                                } catch {
                                                  message.error(t('tasks.detail_toast.status_update_err'));
                                                }
                                              }}
                                              style={{ width: '12px', height: '12px', cursor: subtaskEditable ? 'pointer' : 'not-allowed', accentColor: '#10b981', flexShrink: 0 }}
                                            />
                                            <span
                                              style={{
                                                color: isStDone ? 'var(--text-muted)' : 'var(--text-primary)',
                                                textDecoration: isStDone ? 'line-through' : 'none',
                                                fontWeight: 500,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                              }}
                                            >
                                              {st.title}
                                            </span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                            {st.assignee && (
                                              <Tooltip title={st.assignee.name}>
                                                <div style={{ background: '#6366f1', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '7px', fontWeight: 600, overflow: 'hidden' }}>
                                                  {st.assignee.photo ? <img src={st.assignee.photo} alt={st.assignee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(st.assignee.name)}
                                                </div>
                                              </Tooltip>
                                            )}
                                            <FlagIcon color={priorityColors[st.priority] || '#f59e0b'} size={10} />
                                          </div>
                                        </div>
                                        {/* Recursive render child subtasks */}
                                        {renderSubtasksTree(Number(st.id), depth + 1)}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              );
                            };

                            // Get all direct subtasks first
                            const directSubtasks = tasks.filter(t => Number(t.parent_task_id) === Number(task.id));
                            if (directSubtasks.length === 0) return null;

                            // Compute total/completed subtasks count recursively (to show progress on the parent task card)
                            const getRecursiveSubtasks = (parentId: number): Task[] => {
                              const children = tasks.filter(t => Number(t.parent_task_id) === Number(parentId));
                              let all: Task[] = [...children];
                              for (const child of children) {
                                all = [...all, ...getRecursiveSubtasks(Number(child.id))];
                              }
                              return all;
                            };

                            const allSubtasksRecursive = getRecursiveSubtasks(Number(task.id));
                            const totalCount = allSubtasksRecursive.length;
                            const finalStatusId = getFinalStatusId(project?.statuses || []);
                            const doneCount = allSubtasksRecursive.filter(st => st.status === finalStatusId).length;

                            const isExpanded = !!expandedTasks[Number(task.id)];

                            return (
                              <div
                                style={{
                                  marginTop: '10px',
                                  paddingTop: '8px',
                                  borderTop: '1px solid var(--border-color)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div
                                  onClick={() => {
                                    setExpandedTasks(prev => ({
                                      ...prev,
                                      [Number(task.id)]: !prev[Number(task.id)]
                                    }));
                                  }}
                                  style={{
                                    fontSize: '10px',
                                    color: 'var(--text-muted)',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    marginBottom: '2px',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                  }}
                                >
                                  <SubtaskIcon />
                                  <span>{t('project_detail.subtask_title_with_count', { done: doneCount, total: totalCount })}</span>
                                </div>
                                {isExpanded && renderSubtasksTree(Number(task.id))}
                              </div>
                            );
                          })()}
                        </div>
                      ))}

                      {/* ClickUp-style Inline Create Bar */}
                      {inlineCreate === col.key && (() => {
                        const currentStatus = columns.find((c: any) => c.key === (newTaskStatus || col.key));
                        const currentPri = PRIORITIES.find(p => p.id === newTaskPriority) || PRIORITIES[2];
                        const currentAssignee = projectMembers.find((m: any) => m.id === newTaskAssignee);

                        return (
                          <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                            marginBottom: '8px'
                          }}>
                            {/* Top row: status checkbox + title input */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
                              {/* Status indicator - locked to current column */}
                              <Tooltip title={currentStatus?.label || col.label}>
                                <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${currentStatus?.color || col.color || '#9ca0b0'}`, background: 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {currentStatus?.type === 'closed' && <CheckOutlined style={{ fontSize: '9px', color: currentStatus.color }} />}
                                </div>
                              </Tooltip>

                              {/* Title input */}
                              <input
                                autoFocus
                                placeholder={t('project_detail.task_name_placeholder')}
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleInlineCreate(col.key); if (e.key === 'Escape') setInlineCreate(null); }}
                                onFocus={(e) => {
                                  const container = e.target.closest('.project-detail__column-body');
                                  if (container) {
                                    setTimeout(() => {
                                      container.scrollTo({
                                        top: container.scrollHeight,
                                        behavior: 'smooth'
                                      });
                                    }, 80);
                                  }
                                }}
                                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, padding: 0 }}
                              />
                            </div>

                            {/* Bottom toolbar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(120,120,120,0.03)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {/* Assignee picker - avatar only */}
                                <Popover
                                  trigger="click"
                                  placement="bottomLeft"
                                  content={
                                    <div style={{ width: '200px', padding: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px 6px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>{t('tasks.panel.assign_to')}</div>
                                      <div onClick={() => setNewTaskAssignee(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: !newTaskAssignee ? 'rgba(59,130,246,0.08)' : 'transparent' }} className="status-item-hover">
                                        <UserOutlined style={{ fontSize: '12px', color: 'var(--text-muted)' }} />
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('tasks.panel.unassigned')}</span>
                                      </div>
                                      {projectMembers.map((m: any) => (
                                        <div key={m.id} onClick={() => setNewTaskAssignee(m.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: newTaskAssignee === m.id ? 'rgba(59,130,246,0.08)' : 'transparent' }} className="status-item-hover">
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '8px', fontWeight: 700, overflow: 'hidden' }}>
                                              {m.photo ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.name)}
                                            </div>
                                            <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{m.name}</span>
                                          </div>
                                          {newTaskAssignee === m.id && <CheckOutlined style={{ color: 'var(--primary)', fontSize: '10px' }} />}
                                        </div>
                                      ))}
                                    </div>
                                  }
                                >
                                  <Tooltip title={currentAssignee ? currentAssignee.name : t('tasks.panel.assign_to')}>
                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: currentAssignee ? 'none' : '1px dashed var(--border-color)', background: currentAssignee ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: currentAssignee ? '#fff' : 'var(--text-muted)', fontSize: currentAssignee ? '7px' : '10px', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }} className="status-item-hover">
                                      {currentAssignee ? (currentAssignee.photo ? <img src={currentAssignee.photo} alt={currentAssignee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(currentAssignee.name)) : <UserOutlined />}
                                    </div>
                                  </Tooltip>
                                </Popover>

                                {/* Date/Time picker */}
                                <Popover
                                  trigger="click"
                                  placement="bottomLeft"
                                  content={
                                    <div style={{ width: '260px', padding: '8px' }}>
                                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 4px 6px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>{t('tasks.panel.time_range')}</div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '55px' }}>{t('tasks.panel.start_date_label')}</span>
                                          <input type="datetime-local" value={newTaskStartDate} onChange={(e) => setNewTaskStartDate(e.target.value)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '55px' }}>{t('tasks.panel.due_date_label')}</span>
                                          <input type="datetime-local" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }} />
                                        </div>
                                      </div>
                                    </div>
                                  }
                                >
                                  <Tooltip title={t('tasks.panel.select_time')}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', width: '22px', height: '22px', borderRadius: '4px', color: (newTaskStartDate || newTaskDueDate) ? 'var(--primary)' : 'var(--text-muted)', fontSize: '12px', flexShrink: 0 }} className="status-item-hover">
                                      <CalendarOutlined />
                                    </div>
                                  </Tooltip>
                                </Popover>

                                {/* Priority flag */}
                                <Popover
                                  trigger="click"
                                  placement="bottomLeft"
                                  content={
                                    <div style={{ width: '180px', padding: '4px' }}>
                                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px 6px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>{t('tasks.panel.priority')}</div>
                                      {PRIORITIES.map(p => (
                                        <div key={p.id} onClick={() => setNewTaskPriority(p.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: newTaskPriority === p.id ? 'rgba(59,130,246,0.08)' : 'transparent' }} className="status-item-hover">
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <FlagIcon color={p.color} size={13} />
                                            <span style={{ fontSize: '12px', fontWeight: 600, color: p.color }}>{t(`tasks.priority.${p.id}`)}</span>
                                          </div>
                                          {newTaskPriority === p.id && <CheckOutlined style={{ color: 'var(--primary)', fontSize: '10px' }} />}
                                        </div>
                                      ))}
                                    </div>
                                  }
                                >
                                  <Tooltip title={t('tasks.panel.set_priority')}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', width: '24px', height: '24px', borderRadius: '4px' }} className="status-item-hover">
                                      <FlagIcon color={currentPri.color} size={14} />
                                    </div>
                                  </Tooltip>
                                </Popover>
                              </div>

                              {/* Right: Cancel + Save */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button onClick={() => setInlineCreate(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '4px 8px' }}>
                                  {t('project_detail.cancel_btn')}
                                </button>
                                <button onClick={() => handleInlineCreate(col.key)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {t('tasks.panel.save_short')} ↵
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Add card button — hidden for non-initial columns when WF restricted */}
                      {inlineCreate !== col.key && (
                        !workflowInitialStatus || col.key === workflowInitialStatus
                      ) && (
                        <div className="project-detail__add-card" onClick={() => {
                          setInlineCreate(col.key);
                          setNewTaskTitle('');
                          setNewTaskStatus(col.key);
                          setNewTaskPriority('medium');
                          setNewTaskAssignee(null);
                          setNewTaskStartDate('');
                          setNewTaskDueDate('');
                        }}>
                          <PlusOutlined /> {t('project_detail.add_task')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* View Mode: List */}
          {viewMode === 'list' && (() => {
            const filteredTasks = tasks.filter(taskMatchesFilters);

            const grouped: Record<string, Task[]> = listTasksGrouped;

            const getGroupLabel = (key: string) => {
              if (groupBy === 'priority') return priorityLabels[key] || key;
              if (groupBy === 'status') {
                const col = columns.find((c: any) => c.key === key);
                return col ? col.label : key;
              }
              if (groupBy === 'due_date' && key !== t('tasks.no_due_date')) return formatDate(key);
              return key;
            };

            const getGroupDot = (key: string) => {
              if (groupBy === 'priority') return priorityColors[key] || '#6b7084';
              if (groupBy === 'status') {
                const col = columns.find((c: any) => c.key === key);
                return col ? col.color : '#6b7084';
              }
              return '#6b7084';
            };

            const sortedGroups = Object.entries(grouped)
              .filter(([, gTasks]) => gTasks.length > 0)
              .sort(([keyA], [keyB]) => {
                if (groupBy === 'due_date') {
                  const noDateKey = t('tasks.no_due_date');
                  if (keyA === noDateKey) return 1;
                  if (keyB === noDateKey) return -1;
                  return new Date(keyA).getTime() - new Date(keyB).getTime();
                }
                if (groupBy === 'priority') {
                  const priorityOrder = ['urgent', 'high', 'medium', 'low', 'none'];
                  return priorityOrder.indexOf(keyA) - priorityOrder.indexOf(keyB);
                }
                return 0;
              });

            return (
              <div className="my-tasks project-detail__tasks-list-view">
                <div className="my-tasks__container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {sortedGroups.map(([key, groupTasks]) => (
                    <div
                      key={key}
                      className="my-tasks__group"
                      data-status={groupBy === 'status' ? key : undefined}
                      onDragOver={groupBy === 'status' ? handleDragOver : undefined}
                      onDrop={groupBy === 'status' ? (e) => handleDrop(e, key) : undefined}
                    >
                      <div className="my-tasks__group-header" onClick={() => setExpandedGroups(p => ({ ...p, [key]: p[key] === false }))}>
                        <RightOutlined className={`chevron ${expandedGroups[key] !== false ? 'expanded' : ''}`} />
                        <span className="priority-dot" style={{ background: getGroupDot(key) }} />
                        <span className="group-label">{getGroupLabel(key)}</span>
                        <span className="group-count">{groupTasks.length}</span>
                      </div>
                      {expandedGroups[key] !== false && (
                        <div className="my-tasks__group-body">
                          {groupTasks.map((task: Task) => {
                            const overdue = checkIsOverdue(task.due_date, task.status, task);
                            const today = isToday(task.due_date);
                            const statusObj = getFallbackStatusObj(task);
                            const isClosed = isTaskDone(task);
                            const projectStatuses = project?.statuses || [];
                            const taskEditable = canEditTask(task);

                            // ── Subtask section for list view ────────────────────────────────
                            const getRecursiveSubtasksFlat = (parentId: number): Task[] => {
                              const children = tasks.filter(t => Number(t.parent_task_id) === Number(parentId));
                              let all: Task[] = [...children];
                              for (const child of children) all = [...all, ...getRecursiveSubtasksFlat(Number(child.id))];
                              return all;
                            };
                            const directSubtasksOfTask = tasks.filter(t => Number(t.parent_task_id) === Number(task.id));
                            const allSubtasksFlat = directSubtasksOfTask.length > 0 ? getRecursiveSubtasksFlat(Number(task.id)) : [];
                            const finalStatusIdForList = getFinalStatusId(project?.statuses || []);
                            const firstStatusIdForList = getFirstStatusId(project?.statuses || []);
                            const doneSubtaskCount = allSubtasksFlat.filter(st => st.status === finalStatusIdForList).length;
                            const isListTaskExpanded = !!expandedTasks[Number(task.id)];

                            const renderSubtaskRowInList = (st: Task, depth = 0): React.ReactNode => {
                              const stStatusObj = getFallbackStatusObj(st);
                              const stIsDone = st.status === finalStatusIdForList;
                              const stEditable = canEditTask(st);
                              const stChildren = tasks.filter(c => Number(c.parent_task_id) === Number(st.id));
                              return (
                                <React.Fragment key={st.id}>
                                  <div
                                    className="my-tasks__subtask-list-row"
                                    style={{ marginLeft: `${32 + depth * 20}px` }}
                                    onClick={() => handleSelectTask(st)}
                                  >
                                    <div
                                      className={`my-tasks__task-checkbox ${stIsDone ? 'done' : ''}`}
                                      style={{ borderColor: stStatusObj.color, backgroundColor: stIsDone ? stStatusObj.color : 'transparent', color: stIsDone ? 'white' : 'transparent', cursor: stEditable ? 'pointer' : 'not-allowed', display:'flex',alignItems:'center',justifyContent:'center',padding:0,flexShrink:0 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!stEditable) return;
                                        const newSt = stIsDone ? firstStatusIdForList : finalStatusIdForList;
                                        api.updateTask(st.id, { status: newSt }).then(r => { if (r.success) fetchProjectData(true); });
                                      }}
                                    >
                                      {stIsDone ? <CheckOutlined style={{ fontSize: '9px' }} /> : (
                                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: `conic-gradient(${stStatusObj.color} 0% 60%, transparent 60% 100%)` }} />
                                      )}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontSize: '13px', fontWeight: 500, color: stIsDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: stIsDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display:'flex', alignItems:'center', gap:'5px' }}>
                                        <TaskTypeBadge type={st.type || 'task'} size="icon" />
                                        {st.title}
                                      </div>
                                      <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'1px' }}>#{st.id}</div>
                                    </div>
                                    <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: `${stStatusObj.color}1c`, color: stStatusObj.color, border: `1px solid ${stStatusObj.color}2b`, whiteSpace:'nowrap', flexShrink: 0 }}>
                                      {stStatusObj.name}
                                    </span>
                                    {st.assignee ? (
                                      <div className="my-tasks__task-assignee" style={{ background: 'var(--primary)', flexShrink: 0 }}>
                                        {st.assignee.photo ? <img src={st.assignee.photo} alt={st.assignee.name} style={{ width:'100%',height:'100%',borderRadius:'50%' }} /> : getInitials(st.assignee.name)}
                                      </div>
                                    ) : (
                                      <div className="my-tasks__task-assignee" style={{ border: '1px dashed var(--text-muted)', background: 'transparent', flexShrink: 0 }}>
                                        <UserOutlined style={{ color: 'var(--text-muted)', fontSize: '10px' }} />
                                      </div>
                                    )}
                                  </div>
                                  {stChildren.length > 0 && isListTaskExpanded && stChildren.map(c => renderSubtaskRowInList(c, depth + 1))}
                                </React.Fragment>
                              );
                            };
                            // ─────────────────────────────────────────────────────────────────

                            return (
                              <React.Fragment key={task.id}>
                                <div
                                  className="my-tasks__task-row"
                                  data-task-id={task.id}
                                  onClick={() => handleSelectTask(task)}
                                  draggable={taskEditable}
                                  onDragStart={(e) => handleDragStart(e, task.id)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={groupBy === 'status' ? (e) => handleCardDragOver(e, task.id) : undefined}
                                  onDragLeave={groupBy === 'status' ? handleCardDragLeave : undefined}
                                >
                                  <div
                                    className={`my-tasks__task-checkbox ${isClosed ? 'done' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!taskEditable) {
                                        message.error(t('project_detail.toast.no_edit_permission'));
                                        return;
                                      }
                                      toggleStatus(task.id, task.status, task);
                                    }}
                                    style={{
                                      borderColor: statusObj.color,
                                      backgroundColor: isClosed ? statusObj.color : 'transparent',
                                      color: isClosed ? 'white' : 'transparent',
                                      cursor: taskEditable ? 'pointer' : 'not-allowed',
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
                                    <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <TaskTypeBadge type={task.type || 'task'} size="icon" />
                                      {task.title}
                                    </div>
                                    <div className="subtitle">
                                      <span className="task-id">#{task.id}</span>
                                      <span className="project-tag" style={{ '--dot-color': priorityColors[task.priority] || '#6b7084' } as React.CSSProperties}>
                                        {priorityLabels[task.priority] || t('tasks.priority.none')}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="my-tasks__task-labels">
                                    {task.labels?.map((l: any, i: number) => (
                                      <span key={i} className="label" style={{ background: l.bg, color: l.color }}>
                                        {l.name}
                                      </span>
                                    ))}
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
                                    {task.start_date || task.due_date ? (
                                      task.start_date && task.due_date ? (
                                        `${formatDateTimeShort(task.start_date)} - ${formatDateTimeShort(task.due_date)}`
                                      ) : task.start_date ? (
                                        `${t('tasks.start_date')} ${formatDateTimeShort(task.start_date)}`
                                      ) : (
                                        `${t('tasks.panel.deadline')} ${formatDateTimeShort(task.due_date)}`
                                      )
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>{t('tasks.no_deadline')}</span>
                                    )}
                                  </div>
                                  {task.assignee ? (
                                    <div className="my-tasks__task-assignee" style={{ background: 'var(--primary)' }}>
                                      {task.assignee.photo ? (
                                        <img src={task.assignee.photo} alt={task.assignee.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                      ) : (
                                        getInitials(task.assignee.name)
                                      )}
                                    </div>
                                  ) : (
                                    <div className="my-tasks__task-assignee" style={{ border: '1px dashed var(--text-muted, #9ca0b0)', background: 'transparent' }}>
                                      <UserOutlined style={{ color: 'var(--text-muted, #9ca0b0)', fontSize: '10px' }} />
                                    </div>
                                  )}
                                  <div className="my-tasks__task-actions" onClick={(e) => e.stopPropagation()}>
                                    {(() => {
                                      const editPerm = canEditTask(task);
                                      const deletePerm = canDeleteTask(task);
                                      const menuItems: any[] = [];

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

                                      if (deletePerm) {
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

                                {/* ── Subtask expand toggle & rows ─────────────────────────── */}
                                {allSubtasksFlat.length > 0 && (
                                  <>
                                    <div
                                      className="my-tasks__subtask-toggle"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedTasks(prev => ({ ...prev, [Number(task.id)]: !prev[Number(task.id)] }));
                                      }}
                                    >
                                      <SubtaskIcon />
                                      <span>{t('project_detail.subtask_title_with_count', { done: doneSubtaskCount, total: allSubtasksFlat.length })}</span>
                                      <RightOutlined className={`chevron ${isListTaskExpanded ? 'expanded' : ''}`} style={{ fontSize: '9px', marginLeft: '2px' }} />
                                    </div>
                                    {isListTaskExpanded && directSubtasksOfTask.map(st => renderSubtaskRowInList(st))}
                                  </>
                                )}
                                {/* ──────────────────────────────────────────────────────────── */}
                              </React.Fragment>
                            );
                          })}


                          {/* ClickUp-style Inline Create Bar for List View */}
                          {inlineCreate === key && (() => {
                            const currentStatus = columns.find((c: any) => c.key === (newTaskStatus || (groupBy === 'status' ? key : 'todo')));
                            const currentPri = PRIORITIES.find(p => p.id === (newTaskPriority || (groupBy === 'priority' ? key : 'medium'))) || PRIORITIES[2];
                            const currentAssignee = projectMembers.find((m: any) => m.id === newTaskAssignee);

                            return (
                              <div style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                marginBottom: '8px',
                                marginTop: '4px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
                                  <Tooltip title={currentStatus?.label || t('tasks.status.todo')}>
                                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${currentStatus?.color || '#9ca0b0'}`, background: 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {currentStatus?.type === 'closed' && <CheckOutlined style={{ fontSize: '9px', color: currentStatus.color }} />}
                                    </div>
                                  </Tooltip>

                                  <input
                                    autoFocus
                                    placeholder={t('project_detail.task_name_placeholder')}
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleInlineCreate(groupBy === 'status' ? key : 'todo');
                                      }
                                      if (e.key === 'Escape') {
                                        setInlineCreate(null);
                                      }
                                    }}
                                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, padding: 0 }}
                                  />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(120,120,120,0.03)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Popover
                                      trigger="click"
                                      placement="bottomLeft"
                                      content={
                                        <div style={{ width: '200px', padding: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px 6px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>{t('tasks.panel.assign_to')}</div>
                                          <div onClick={() => setNewTaskAssignee(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: !newTaskAssignee ? 'rgba(59,130,246,0.08)' : 'transparent' }} className="status-item-hover">
                                            <UserOutlined style={{ fontSize: '12px', color: 'var(--text-muted)' }} />
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('tasks.panel.unassigned')}</span>
                                          </div>
                                          {projectMembers.map((m: any) => (
                                            <div key={m.id} onClick={() => setNewTaskAssignee(m.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: newTaskAssignee === m.id ? 'rgba(59,130,246,0.08)' : 'transparent' }} className="status-item-hover">
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '8px', fontWeight: 700, overflow: 'hidden' }}>
                                                  {m.photo ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.name)}
                                                </div>
                                                <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{m.name}</span>
                                              </div>
                                              {newTaskAssignee === m.id && <CheckOutlined style={{ color: 'var(--primary)', fontSize: '10px' }} />}
                                            </div>
                                          ))}
                                        </div>
                                      }
                                    >
                                      <Tooltip title={currentAssignee ? currentAssignee.name : t('tasks.panel.assign_to')}>
                                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: currentAssignee ? 'none' : '1px dashed var(--border-color)', background: currentAssignee ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: currentAssignee ? '#fff' : 'var(--text-muted)', fontSize: currentAssignee ? '7px' : '10px', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }} className="status-item-hover">
                                          {currentAssignee ? (currentAssignee.photo ? <img src={currentAssignee.photo} alt={currentAssignee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(currentAssignee.name)) : <UserOutlined />}
                                        </div>
                                      </Tooltip>
                                    </Popover>

                                    <Popover
                                      trigger="click"
                                      placement="bottomLeft"
                                      content={
                                        <div style={{ width: '260px', padding: '8px' }}>
                                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 4px 6px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>{t('tasks.panel.time_range')}</div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '55px' }}>{t('tasks.panel.start_date_label')}</span>
                                              <input type="datetime-local" value={newTaskStartDate} onChange={(e) => setNewTaskStartDate(e.target.value)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }} />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '55px' }}>{t('tasks.panel.due_date_label')}</span>
                                              <input type="datetime-local" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 6px', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }} />
                                            </div>
                                          </div>
                                        </div>
                                      }
                                    >
                                      <Tooltip title={t('tasks.panel.select_time')}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', width: '22px', height: '22px', borderRadius: '4px', color: (newTaskStartDate || newTaskDueDate) ? 'var(--primary)' : 'var(--text-muted)', fontSize: '12px', flexShrink: 0 }} className="status-item-hover">
                                          <CalendarOutlined />
                                        </div>
                                      </Tooltip>
                                    </Popover>

                                    <Popover
                                      trigger="click"
                                      placement="bottomLeft"
                                      content={
                                        <div style={{ width: '180px', padding: '4px' }}>
                                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 8px 6px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>{t('tasks.panel.priority')}</div>
                                          {PRIORITIES.map(p => (
                                            <div key={p.id} onClick={() => setNewTaskPriority(p.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: newTaskPriority === p.id ? 'rgba(59,130,246,0.08)' : 'transparent' }} className="status-item-hover">
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <FlagIcon color={p.color} size={13} />
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: p.color }}>{t(`tasks.priority.${p.id}`)}</span>
                                              </div>
                                              {newTaskPriority === p.id && <CheckOutlined style={{ color: 'var(--primary)', fontSize: '10px' }} />}
                                            </div>
                                          ))}
                                        </div>
                                      }
                                    >
                                      <Tooltip title={t('tasks.panel.set_priority')}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', width: '24px', height: '24px', borderRadius: '4px' }} className="status-item-hover">
                                          <FlagIcon color={currentPri.color} size={14} />
                                        </div>
                                      </Tooltip>
                                    </Popover>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <button onClick={() => setInlineCreate(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '4px 8px' }}>
                                      {t('project_detail.cancel_btn')}
                                    </button>
                                    <button
                                      onClick={() => handleInlineCreate(groupBy === 'status' ? key : 'todo')}
                                      style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      {t('tasks.panel.save_short')} ↵
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Add card button — hidden for non-initial groups when WF restricted + grouped by status */}
                          {inlineCreate !== key && (
                            groupBy !== 'status' || !workflowInitialStatus || key === workflowInitialStatus
                          ) && (
                            <div
                              onClick={() => {
                                setInlineCreate(key);
                                setNewTaskTitle('');
                                setNewTaskStatus(groupBy === 'status' ? key : (workflowInitialStatus || project?.statuses?.[0]?.id || 'todo'));
                                setNewTaskPriority(groupBy === 'priority' ? key : 'medium');
                                setNewTaskAssignee(null);
                                setNewTaskStartDate('');
                                setNewTaskDueDate(groupBy === 'due_date' && key !== t('tasks.no_due_date') ? `${key}T18:00` : '');
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                border: '1px dashed var(--border-color)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                fontSize: '13px',
                                transition: 'all 0.2s',
                                marginTop: '4px'
                              }}
                              className="status-item-hover"
                            >
                              <PlusOutlined style={{ fontSize: '12px' }} />
                              <span>{t('project_detail.add_task')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredTasks.length === 0 && (
                    <div className="my-tasks__empty" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <h3 style={{ color: 'var(--text-muted)' }}>{t('tasks.empty.title')}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('tasks.empty.desc')}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* View Mode: Calendar */}
          {viewMode === 'calendar' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '8px', padding: '24px', border: '1px solid var(--border-color)', marginTop: '16px' }} className="project-detail__calendar-container">
              <TaskCalendar tasks={tasks.filter(taskMatchesFilters)} onSelectTask={handleSelectTask} columns={columns} projectId={project?.id} />
            </div>
          )}
        </>
      )}

      {activeTab === 'members' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '8px', padding: '24px', border: '1px solid var(--border-color)', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px' }}>{t('project_detail.members_title')}</h3>
            {canEditProject() && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAddMemberModal(true)}>{t('project_detail.add_member')}</Button>
            )}
          </div>

          <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <table className="timesheet-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Avatar</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('common.name')}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Email</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('common.role_in_project')}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('common.active_tasks')}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('common.date_joined')}</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {project.members?.map((m: any) => {
                  const tasksCount = tasks.filter(t => Number(t.assignee_id) === Number(m.id)).length;
                  const isOwner = Number(m.id) === Number(project.created_by);

                  const formatJoinedDate = (dateStr?: string) => {
                    if (!dateStr) return '-';
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return dateStr;
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
                  };

                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-primary)' }} className="timesheet-row-hover">
                      {/* Avatar */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{
                          background: project.color || '#6366f1',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderRadius: '50%',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '11px',
                          overflow: 'hidden'
                        }}>
                          {m.photo ? (
                            <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            getInitials(m.name)
                          )}
                        </div>
                      </td>

                      {/* Tên */}
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                        {m.name}
                      </td>

                      {/* Email */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {m.email}
                      </td>

                      {/* Role trong project */}
                      <td style={{ padding: '12px 16px' }}>
                        {isOwner ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{t('project_detail.owner')}</span>
                        ) : canEditProject() ? (
                          <Select
                            value={m.pivot?.role || 'member'}
                            onChange={async (newRole) => {
                              try {
                                const res = await api.addProjectMember(project.id, { user_ids: [Number(m.id)], role: newRole });
                                if (res.success) {
                                  message.success(t('project_detail.toast.role_updated'));
                                  fetchProjectData();
                                }
                              } catch (err) {
                                console.error(err);
                                message.error(t('project_detail.toast.role_update_failed'));
                              }
                            }}
                            size="small"
                            style={{ width: '110px' }}
                          >
                            <Select.Option value="manager">Manager</Select.Option>
                            <Select.Option value="member">Member</Select.Option>
                          </Select>
                        ) : (
                          <span style={{ color: '#6366f1', textTransform: 'capitalize', fontSize: '13px' }}>
                            {m.pivot?.role || 'member'}
                          </span>
                        )}
                      </td>

                      {/* Task đang có */}
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {tasksCount}
                      </td>

                      {/* Ngày thêm */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {formatJoinedDate(m.pivot?.joined_at)}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {!isOwner ? (
                          canEditProject() ? (
                            <Dropdown
                              menu={{
                                items: [
                                  {
                                    key: 'remove',
                                    label: (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <DeleteOutlined style={{ fontSize: '13px' }} />
                                        {t('project_detail.remove_member_label')}
                                      </span>
                                    ),
                                    danger: true,
                                    onClick: () => {
                                      Modal.confirm({
                                        title: t('common.delete_confirm'),
                                        content: t('project_detail.confirm_remove_member_name', { name: m.name }),
                                        okText: t('common.delete'),
                                        cancelText: t('common.cancel'),
                                        okButtonProps: { danger: true },
                                        onOk: () => handleRemoveMember(m.id)
                                      });
                                    }
                                  }
                                ]
                              }}
                              trigger={['click']}
                            >
                              <Button type="text" icon={<MoreOutlined />} size="small" />
                            </Dropdown>
                          ) : null
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'timesheet' && (
        <div className="project-detail__timesheet" style={{ marginTop: '16px' }}>
          {/* Toolbar Filters */}
          <div className="timesheet-filters" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('common.timeframe')}</label>
              <Select value={timesheetDateFilter} onChange={(val) => setTimesheetDateFilter(val)} style={{ width: '140px' }}>
                <Select.Option value="all">{t('common.all')}</Select.Option>
                <Select.Option value="today">{t('common.today')}</Select.Option>
                <Select.Option value="week">{t('common.this_week')}</Select.Option>
                <Select.Option value="month">{t('common.this_month')}</Select.Option>
                <Select.Option value="custom">{t('common.custom')}</Select.Option>
              </Select>
            </div>

            {timesheetDateFilter === 'custom' && (
              <>
                <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('common.from')}</label>
                  <Input type="date" value={timesheetStartDate} onChange={(e) => setTimesheetStartDate(e.target.value)} style={{ width: '140px' }} />
                </div>
                <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('common.to')}</label>
                  <Input type="date" value={timesheetEndDate} onChange={(e) => setTimesheetEndDate(e.target.value)} style={{ width: '140px' }} />
                </div>
              </>
            )}

            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('common.member')}</label>
              <Select value={timesheetMemberFilter} onChange={(val) => setTimesheetMemberFilter(val)} style={{ width: '180px' }}>
                <Select.Option value="all">{t('common.all_members')}</Select.Option>
                {project.members?.map((m: any) => (
                  <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
                ))}
              </Select>
            </div>

            <div className="filter-actions" style={{ marginLeft: 'auto' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowLogTimeModal(true)}>
                {t('timesheet.btn.log_time')}
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="timesheet-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="timesheet-stat-card" style={{ background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="card-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', fontSize: '20px' }}>
                <ClockCircleOutlined />
              </div>
              <div className="card-info" style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('common.total_time')}</span>
                <span className="value" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{totalHours}h</span>
                <span className="sub" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{filteredTimeEntries.length} {t('common.entries')}</span>
              </div>
            </div>

            <div className="timesheet-stat-card" style={{ background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="card-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '20px' }}>
                <UserOutlined />
              </div>
              <div className="card-info" style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('common.most_active')}</span>
                <span className="value" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{mostActiveMember}</span>
                <span className="sub" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {maxMemberTime > 0 ? `${(maxMemberTime / 3600).toFixed(1)}h` : '0h'}
                </span>
              </div>
            </div>

            <div className="timesheet-stat-card" style={{ background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="card-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '20px' }}>
                <CheckSquareOutlined />
              </div>
              <div className="card-info" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span className="label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('common.most_logged')}</span>
                <span className="value" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }} title={mostLoggedTask}>
                  {mostLoggedTask}
                </span>
                <span className="sub" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {maxTaskTime > 0 ? `${(maxTaskTime / 3600).toFixed(1)}h` : '0h'}
                </span>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          {filteredTimeEntries.length > 0 && (
            <div className="timesheet-charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="chart-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 16px 0', fontWeight: 600 }}>{t('common.time_per_member')}</h3>
                <div style={{ width: '100%', height: '240px' }}>
                  <ResponsiveContainer>
                    <BarChart data={memberChartData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <RechartsTooltip formatter={(value) => [`${value}h`, t('common.timeframe')]} />
                      <Bar dataKey="hours" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 16px 0', fontWeight: 600 }}>{t('common.time_per_task')}</h3>
                <div style={{ width: '100%', height: '240px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {taskChartData.length > 0 ? (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={taskChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={45}
                          paddingAngle={3}
                        >
                          {taskChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'][index % 7]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => [`${value}h`, t('common.timeframe')]} />
                        <Legend verticalAlign="bottom" height={36} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>{t('common.no_data')}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Table Logs */}
          <div className="timesheet-logs-container" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
            <h3 className="section-title" style={{ fontSize: '16px', color: 'var(--text-primary)', margin: '0 0 16px 0', fontWeight: 600 }}>{t('common.time_logs')}</h3>
            {loadingTimesheet ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spin /></div>
            ) : filteredTimeEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {t('common.no_time_logs')}
              </div>
            ) : (
              <div className="timesheet-table-wrapper" style={{ overflowX: 'auto' }}>
                <table className="timesheet-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('common.member')}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('timesheet.log_table.task')}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('timesheet.log_table.description')}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('common.start_time')}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('common.duration')}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTimeEntries.map((entry: any) => {
                      const isOwnerOrAdmin = me?.role === 'admin' || Number(entry.user_id) === Number(me?.id);
                      return (
                        <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-primary)' }} className="timesheet-row-hover">
                          <td style={{ padding: '12px 16px' }}>
                            <div className="member-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="member-avatar-mini" style={{ width: '24px', height: '24px', borderRadius: '50%', background: project.color || '#6366f1', color: '#fff', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, overflow: 'hidden' }}>
                                {entry.user?.photo ? <img src={entry.user.photo} alt={entry.user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(entry.user?.name || '')}
                              </div>
                              <span className="member-name">{entry.user?.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className="task-link-span" onClick={() => handleSelectTask(entry.task)} style={{ color: '#6366f1', cursor: 'pointer', fontWeight: 500 }}>
                              {entry.task?.title}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span className="description-text" title={entry.description}>{entry.description || '-'}</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            <span className="date-text">
                              {new Date(entry.started_at).toLocaleString(locale, {
                                year: 'numeric', month: '2-digit', day: '2-digit',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className="duration-badge" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 8px', fontWeight: 600 }}>{formatSecondsToDuration(entry.duration)}</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {isOwnerOrAdmin && (
                              <Popconfirm
                                title={t('timesheet.confirm.delete_content')}
                                onConfirm={() => handleDeleteTimeEntry(entry.id)}
                                okText={t('common.delete')}
                                cancelText={t('common.cancel')}
                              >
                                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                              </Popconfirm>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Time Modal */}
      {showLogTimeModal && (
        <Modal
          title={t('manual_log.title')}
          open={showLogTimeModal}
          onCancel={() => setShowLogTimeModal(false)}
          onOk={handleAddManualTime}
          okText={t('manual_log.submit')}
          cancelText={t('common.cancel')}
          className="timesheet-log-modal"
          styles={{ body: { background: 'var(--bg-card)' } }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {t('manual_log.select_task')}
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder={t('manual_log.select_task_placeholder')}
                value={logTimeTask}
                onChange={(val) => setLogTimeTask(val)}
                showSearch
                filterOption={(input, option) =>
                  String(option?.children || '').toLowerCase().includes(input.toLowerCase())
                }
              >
                {tasks.map((t: any) => (
                  <Select.Option key={t.id} value={t.id}>{t.title}</Select.Option>
                ))}
              </Select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  {t('manual_log.start_time')}
                </label>
                <Input
                  type="date"
                  value={logTimeDate}
                  onChange={(e) => setLogTimeDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  {t('common.duration')}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Input
                    type="number"
                    min={0}
                    placeholder="h"
                    value={logTimeHours || ''}
                    onChange={(e) => setLogTimeHours(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ width: '75px' }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>h</span>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    placeholder="m"
                    value={logTimeMinutes || ''}
                    onChange={(e) => setLogTimeMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    style={{ width: '75px' }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>m</span>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {t('manual_log.description')}
              </label>
              <Input.TextArea
                rows={3}
                placeholder={t('manual_log.description_placeholder')}
                value={logTimeDescription}
                onChange={(e) => setLogTimeDescription(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Task Detail Sidebar Panel */}
      {selectedTask && (
        <TaskDetailPanel
          taskId={selectedTask.id}
          onClose={() => setSelectedTask(null)}
          onUpdate={fetchProjectData}
          projectMembers={project?.members}
          projectStatuses={project?.statuses}
        />
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <Modal
          title={t('project_detail.add_member_modal.title')}
          open={showAddMemberModal}
          onCancel={() => setShowAddMemberModal(false)}
          onOk={handleAddMember}
          okText={t('project_detail.add_member_modal.ok')}
          cancelText={t('project_detail.cancel_btn')}
        >
          <div style={{ padding: '12px 0' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>{t('project_detail.add_member_modal.label')}</label>
            <Select
              mode="multiple"
              showSearch
              style={{ width: '100%' }}
              placeholder={t('project_detail.add_member_modal.placeholder')}
              optionLabelProp="label"
              value={selectedNewMembers}
              onChange={(val) => setSelectedNewMembers(val)}
              filterOption={(input, option) =>
                String(option?.title ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {nonProjectUsers.map(u => (
                <Select.Option key={u.id} value={u.id} label={u.name} title={`${u.name} ${u.email}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: project?.color || '#6366f1',
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
      )}

      {/* Shared Edit Project Modal */}
      {showEditProjectModal && (
        <EditProjectModal
          open={showEditProjectModal}
          onClose={() => setShowEditProjectModal(false)}
          project={editProjectForm}
          onSaved={fetchProjectData}
          onDeleted={() => navigate('/projects')}
        />
      )}

      {showWorkflowEditor && (
        <WorkflowEditor
          open={showWorkflowEditor}
          project={project}
          onClose={() => setShowWorkflowEditor(false)}
          onSaved={() => {
            // Only refresh workflow cache silently — do NOT call fetchProjectData()
            // which would re-mount the entire page and close the drawer
            if (typeof fetchWorkflow === 'function') fetchWorkflow();
          }}
        />
      )}

      {/* Manage Statuses Modal */}
      {showManageStatusesModal && (
        <Modal
          title={t('projects.status.manage_title')}
          open={showManageStatusesModal}
          onCancel={() => setShowManageStatusesModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setShowManageStatusesModal(false)}>{t('tasks.panel.cancel')}</Button>,
            <Button key="ok" type="primary" onClick={() => handleSaveStatuses()}>{t('projects.status.save_config')}</Button>
          ]}
          width={900}
          style={{ top: '50px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
            {/* Template Selector Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(120, 120, 120, 0.04)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t('projects.status.apply_template_label')}
                </span>
                <Select
                  style={{ width: '200px' }}
                  placeholder={t('projects.status.select_template_placeholder')}
                  value={selectedTemplateId}
                  onChange={(val) => {
                    setSelectedTemplateId(val);
                    handleApplyTemplate(val);
                  }}
                >
                  {statusTemplates.map(tpl => (
                    <Select.Option key={tpl.id} value={tpl.id}>{tpl.name}</Select.Option>
                  ))}
                </Select>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                {t('projects.status.apply_template_help')}
              </div>
            </div>

            {/* Status Columns Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {/* 1. NOT STARTED GROUP */}
              <div style={{ background: 'rgba(120, 120, 120, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca0b0', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{t('projects.status.group_not_started')}</span>
                  <span style={{ fontSize: '11px', background: 'rgba(120, 120, 120, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                    {activeStatuses.filter(s => s.type === 'not_started').length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeStatuses.filter(s => s.type === 'not_started').map((s, i) => renderStatusRow(s, i))}
                  <Button type="dashed" onClick={() => handleAddStatus('not_started')} style={{ width: '100%' }}>
                    + {t('projects.status.add_status')}
                  </Button>
                </div>
              </div>

              {/* 2. ACTIVE GROUP */}
              <div style={{ background: 'rgba(59, 130, 246, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{t('projects.status.group_active')}</span>
                  <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                    {activeStatuses.filter(s => s.type === 'active' || s.type === 'done' || !s.type).length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeStatuses.filter(s => s.type === 'active' || s.type === 'done' || !s.type).map((s, i) => renderStatusRow(s, i))}
                  <Button type="dashed" onClick={() => handleAddStatus('active')} style={{ width: '100%' }}>
                    + {t('projects.status.add_status')}
                  </Button>
                </div>
              </div>

              {/* 3. CLOSED GROUP */}
              <div style={{ background: 'rgba(34, 197, 94, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{t('projects.status.group_closed')}</span>
                  <span style={{ fontSize: '11px', background: 'rgba(34, 197, 94, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                    {activeStatuses.filter(s => s.type === 'closed').length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeStatuses.filter(s => s.type === 'closed').map((s, i) => renderStatusRow(s, i))}
                  <Button type="dashed" onClick={() => handleAddStatus('closed')} style={{ width: '100%' }}>
                    + {t('projects.status.add_status')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Save as Template Options Row */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="saveAsTemplateCheck"
                  checked={saveAsNewTemplate}
                  onChange={e => setSaveAsNewTemplate(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="saveAsTemplateCheck" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  {t('projects.status.save_as_new_template')}
                </label>
              </div>
              {saveAsNewTemplate && (
                <div style={{ paddingLeft: '22px' }}>
                  <Input
                    placeholder={t('projects.status.new_template_placeholder')}
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                    style={{ maxWidth: '400px' }}
                  />
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Mapping Statuses Modal */}
      {showMappingModal && (
        <Modal
          title={t('projects.status.map_title')}
          open={showMappingModal}
          onCancel={() => setShowMappingModal(false)}
          onOk={() => handleSaveStatuses(statusMappings)}
          okText={t('projects.status.confirm_save')}
          cancelText={t('tasks.panel.cancel')}
          width={500}
          destroyOnHidden
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '8px',
              padding: '12px',
              color: '#d97706',
              fontSize: '13px',
              lineHeight: '1.5'
            }}>
              <strong>{t('projects.status.map_attention_label')}</strong>{' '}
              {t('projects.status.map_attention_desc')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {orphanedStatusesToMap.map(os => (
                <div key={os.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t('projects.status.map_field_label', { name: os.name })}
                  </span>
                  <Select
                    style={{ width: '100%' }}
                    value={statusMappings[os.id]}
                    onChange={(val) => setStatusMappings(prev => ({
                      ...prev,
                      [os.id]: val
                    }))}
                  >
                    {activeStatuses.map(s => (
                      <Select.Option key={s.id} value={s.id}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: s.color, marginRight: '8px' }} />
                        {s.name}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
      <DeleteConfirmComponent />
    </div>
  );
};

export default ProjectDetailPage;
