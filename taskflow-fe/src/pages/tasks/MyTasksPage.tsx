

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dropdown, message, Modal, Select, Button, Timeline, Tooltip, Spin, Popover, Input } from 'antd';
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
  CalendarOutlined,
  DownOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
  LockOutlined
} from '@ant-design/icons';
import { useTranslation } from '../../utils/i18n';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import './MyTasksPage.scss';
import { TaskDetailPanel } from '../../components/tasks/TaskDetailPanel';
import { TaskCalendar } from '../../components/tasks/TaskCalendar';

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
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} phút`);
  return parts.length > 0 ? parts.join(' ') : '< 1 phút';
};

const MyTimeTracker: React.FC<{ taskId: number; timeEntries: any[]; onUpdate: () => void; disabled?: boolean }> = ({ taskId, timeEntries = [], onUpdate, disabled }) => {
  const [running, setRunning] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [manualDesc, setManualDesc] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const r = timeEntries.find((e: any) => !e.ended_at);
    setRunning(r || null);
    if (r) {
      const started = new Date(r.started_at).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    }
  }, [timeEntries]);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        const started = new Date(running.started_at).getTime();
        setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
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
      message.error(err.response?.data?.message || 'Không thể bắt đầu timer');
    }
  };

  const handleStop = async () => {
    try {
      await api.stopTimer(taskId);
      window.dispatchEvent(new Event('timer-updated'));
      onUpdate();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể dừng timer');
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
      message.success('Đã thêm thời gian');
    } catch (err: any) {
      message.error('Không thể thêm thời gian');
    }
  };

  const manualAddContent = (
    <div style={{ width: '220px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Thêm thời gian thủ công</div>
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
        placeholder="Ghi chú..."
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
        Lưu
      </Button>
    </div>
  );

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(120, 120, 120, 0.05)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '4px 12px', width: 'fit-content' }}>
      {/* Play/Stop Trigger */}
      {running ? (
        <Tooltip title="Dừng tính giờ">
          <button
            onClick={handleStop}
            disabled={disabled}
            style={{ background: 'none', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0, outline: 'none' }}
          >
            <PauseCircleOutlined style={{ fontSize: '16px' }} />
          </button>
        </Tooltip>
      ) : (
        <Tooltip title="Bắt đầu tính giờ">
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
              {myFormatDuration(elapsed)}
            </span>
          ) : hasTimeLogs ? (
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {myFormatDuration(totalTracked)}
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
              Thêm thời gian
            </span>
          )}
        </div>
      </Popover>
    </div>
  );
};

const MyTasksPage: React.FC = () => {
  const { t, lang } = useTranslation();

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
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Grouping
  const [filter, setFilter] = useState('all');
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

  // Drag & drop
  const [draggedTask, setDraggedTask] = useState<number | null>(null);

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

  const [searchParams] = useSearchParams();

  // Initial Load
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        const meRes = await api.getMe();
        setMe(meRes);

        const usersRes = await api.getLocalUsers();
        setUsers(usersRes.data || []);

        if (meRes?.id) {
          const tasksRes = await api.getTasks({ assignee_id: meRes.id });
          setTaskList(tasksRes.data || []);
        }
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

  const refreshTasks = useCallback(async () => {
    if (!me?.id) return;
    try {
      const tasksRes = await api.getTasks({ assignee_id: me.id });
      setTaskList(tasksRes.data || []);
    } catch (err) {
      console.error('Error refreshing tasks:', err);
    }
  }, [me]);

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
    const day = date.getDate();
    const month = date.getMonth() + 1;
    if (lang === 'vi') {
      return `${day} Th${month}`;
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month - 1]} ${day}`;
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
      message.error(err.response?.data?.message || t('tasks.toast.status_err' as any));
    }
  };

  // Actions
  const handleMarkDone = async (id: number) => {
    const task = taskList.find(t => t.id === id);
    if (!task) return;

    // Check if transition to 'done' is allowed
    if (!allowedTransition(task.status, 'done')) {
      message.error('Không thể nhảy vọt trạng thái. Quy trình bắt buộc: To Do -> In Progress -> Review -> Done');
      return;
    }

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
      message.error(err.response?.data?.message || t('tasks.toast.mark_done_err' as any));
    }
  };

  const handleReassignOpen = async (id: number, currentAssigneeId?: number, projectId?: number) => {
    setActionTaskId(id);
    setNewAssigneeId(currentAssigneeId);
    setReassignModalOpen(true);
    // Fetch project members for the reassign dropdown
    if (projectId) {
      try {
        const projRes = await api.getProject(projectId);
        if (projRes.success) {
          setProjectMembers(projRes.data.members || []);
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
  };

  // Drag & drop
  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedTask(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: 'todo' | 'in_progress' | 'review' | 'done') => {
    e.preventDefault();
    if (draggedTask === null) return;

    const task = taskList.find(t => t.id === draggedTask);
    if (!task) return;

    if (!canEditTask(task)) {
      message.error(t('project_detail.toast.no_edit_permission' as any) || 'Bạn không có quyền chỉnh sửa công việc này!');
      setDraggedTask(null);
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

    try {
      const res = await api.updateTaskStatus(draggedTask, { status: resolvedStatus as any });
      if (res.success) {
        message.success(t('tasks.toast.status_updated' as any));
        setTaskList(prev => prev.map(t => t.id === draggedTask ? { ...t, status: resolvedStatus } : t));
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.toast.status_err' as any));
    } finally {
      setDraggedTask(null);
    }
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
        status: 'todo',
        priority: subtaskPriority,
        assignee_id: subtaskAssigneeId,
      });
      if (res.success) {
        message.success(lang === 'vi' ? 'Đã thêm công việc con' : 'Subtask added successfully');
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
      message.error(lang === 'vi' ? 'Không thể thêm công việc con' : 'Failed to add subtask');
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
        message.success(lang === 'vi' ? 'Đã cập nhật trạng thái' : 'Status updated');
        
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
      message.error(lang === 'vi' ? 'Không thể cập nhật trạng thái' : 'Failed to update status');
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

    // 2. Filter Option
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
    const matchingTask = taskList.find(t => (t.project?.name || t.project?.title || t.project?.id) === key);
    return matchingTask?.project?.color || '#6b7084';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" tip={t('tasks.loading' as any)} />
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
      <div className="my-tasks__header">
        <div>
          <h1>{t('tasks.title')}</h1>
          <p>{t('tasks.sub_title', { count: counts.active })}</p>
        </div>
      </div>

      <div className="my-tasks__toolbar">
        <div className="my-tasks__quick-filters" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <Input
            placeholder={t('projects.search_tasks_placeholder' as any) || "Tìm kiếm công việc..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '260px', borderRadius: '8px' }}
            allowClear
            prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          />
          <select
            className="my-tasks__group-select"
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="all">{(t('tasks.filter.all') || 'Tất cả')} ({counts.all})</option>
            <option value="active">{(t('tasks.filter.active') || 'Đang thực hiện')} ({counts.active})</option>
            <option value="today">{(t('tasks.filter.today' as any) || 'Hôm nay')} ({counts.today})</option>
            <option value="this_week">{(t('tasks.filter.this_week' as any) || 'Tuần này')} ({counts.this_week})</option>
            <option value="overdue">{(t('tasks.filter.overdue') || 'Quá hạn')} ({counts.overdue})</option>
            <option value="done">{(t('tasks.filter.done') || 'Đã xong')} ({counts.done})</option>
            <option value="no_date">{(t('tasks.filter.no_date' as any) || 'Không thời hạn')} ({counts.no_date})</option>
          </select>
        </div>
        <div className="my-tasks__view-options">
          {viewMode === 'list' && (
            <select className="my-tasks__group-select" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              <option value="priority">{t('tasks.group.priority')}</option>
              <option value="status">{t('tasks.group.status')}</option>
              <option value="project">{t('tasks.group.project')}</option>
              <option value="due_date">{t('tasks.group.due_date' as any)}</option>
            </select>
          )}

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

                      return (
                        <div key={task.id} className="my-tasks__task-row" onClick={() => handleSelectTask(task)}>
                          <div
                            className={`my-tasks__task-checkbox ${isClosed ? 'done' : ''}`}
                            onClick={(e) => { e.stopPropagation(); if (!isClosed) toggleStatus(task.id, task.status, task); }}
                            style={{
                              borderColor: statusObj.color,
                              backgroundColor: isClosed ? statusObj.color : 'transparent',
                              color: isClosed ? 'white' : 'transparent',
                              cursor: isClosed ? 'default' : 'pointer'
                            }}
                          >
                            {isClosed ? <CheckOutlined /> : ''}
                          </div>
                          <div className="my-tasks__task-info">
                            <div className="title">{task.title}</div>
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
                            {task.due_date ? formatDate(task.due_date) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>{t('tasks.no_deadline' as any)}</span>}
                          </div>
                          <div className="my-tasks__task-assignee" style={{ background: 'var(--primary)' }}>
                            {task.assignee ? (task.assignee.photo ? <img src={task.assignee.photo} alt={task.assignee.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : getInitials(task.assignee.name)) : 'U'}
                          </div>
                          <div className="my-tasks__task-actions" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const editPerm = canEditTask(task);
                              const deletePerm = canDeleteTask(task);
                              const menuItems = [];
                              if (editPerm) {
                                menuItems.push({ key: 'done', label: t('tasks.action.mark_done' as any), onClick: () => handleMarkDone(task.id) });
                                menuItems.push({ key: 'reassign', label: t('tasks.action.reassign' as any), onClick: () => handleReassignOpen(task.id, task.assignee_id, task.project_id) });
                                menuItems.push({ key: 'deadline', label: t('tasks.action.set_deadline' as any), onClick: () => handleDeadlineOpen(task.id, task.due_date) });
                              }
                              if (deletePerm) {
                                menuItems.push({ key: 'delete', label: t('tasks.action.delete'), danger: true, onClick: () => handleDeleteTask(task.id) });
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
                      className={`project-detail__task-card ${draggedTask === task.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={() => setDraggedTask(null)}
                      onClick={() => handleSelectTask(task)}
                    >
                      <div className="project-detail__task-card-top">
                        <span className="project-detail__task-card-id">#{task.id}</span>
                        <div className={`project-detail__task-card-priority project-detail__task-card-priority--${task.priority}`} />
                      </div>
                      <div className="project-detail__task-card-title">{task.title}</div>
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
            optionFilterProp="children"
            value={newAssigneeId}
            onChange={(val) => setNewAssigneeId(val)}
            allowClear
          >
            {projectMembers.map(u => (
              <Select.Option key={u.id} value={u.id}>{u.name} ({u.email})</Select.Option>
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
    </div>
  );
};

export default MyTasksPage;
