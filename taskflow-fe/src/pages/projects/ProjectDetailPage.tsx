

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Dropdown, Tooltip, message, Modal, Select, Button, Popconfirm, Spin, Timeline, Popover, Calendar, Input } from 'antd';
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
  LockOutlined
} from '@ant-design/icons';
import api from '../../services/api';
import { getEcho } from '../../services/echo';
import { useTranslation } from '../../utils/i18n';
import './ProjectDetailPage.scss';
import { TaskDetailPanel } from '../../components/tasks/TaskDetailPanel';
import { TaskCalendar } from '../../components/tasks/TaskCalendar';

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
            <span style={{ fontSize: '13px', fontWeight: 600, color: p.id === value ? 'var(--primary)' : 'var(--text-primary)' }}>{t(`tasks.priority.${p.id}` as any)}</span>
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
        <span style={{ fontSize: '12px', fontWeight: 600, color: current.color }}>{t(`tasks.priority.${current.id}` as any)}</span>
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
}> = ({
  currentStatusId,
  projectStatuses,
  onChange,
  disabled
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [open, setOpen] = useState(false);
    const { t } = useTranslation();
    const currentStatus = projectStatuses.find(s => s.id === currentStatusId) || projectStatuses[0];
    const currentIndex = projectStatuses.findIndex(s => s.id === currentStatus?.id);
    const isLastStatus = currentIndex === projectStatuses.length - 1;

    const handleNextStep = () => {
      if (disabled) return;
      if (currentIndex >= 0 && currentIndex < projectStatuses.length - 1) {
        onChange(projectStatuses[currentIndex + 1].id);
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
          placeholder={t('tasks.panel.status_search_placeholder' as any) || 'Tìm kiếm trạng thái...'}
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

    const checkColor = currentStatus?.color || '#9ca0b0';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1px', background: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden', width: 'fit-content', border: '1px solid var(--border-color)' }}>
        {!isLastStatus && (
          <Tooltip title={t('tasks.panel.next_status_tooltip' as any) || 'Chuyển sang trạng thái tiếp theo'}>
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
  const { t, lang } = useTranslation();

  const [project, setProject] = useState<any>(null);
  const [showManageStatusesModal, setShowManageStatusesModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [orphanedStatusesToMap, setOrphanedStatusesToMap] = useState<any[]>([]);
  const [statusMappings, setStatusMappings] = useState<Record<string, string>>({});
  const [draggedStatusId, setDraggedStatusId] = useState<string | null>(null);

  const columns = (project?.statuses || [
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

  const priorityLabels: Record<string, string> = {
    urgent: t('tasks.priority.urgent') || 'Khẩn cấp',
    high: t('tasks.priority.high') || 'Cao',
    medium: t('tasks.priority.medium') || 'Trung bình',
    low: t('tasks.priority.low') || 'Thấp',
    none: t('tasks.priority.none') || 'Không ưu tiên',
  };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterMyTasks, setFilterMyTasks] = useState<boolean>(false);
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [filterAssigneeId, setFilterAssigneeId] = useState<number | undefined>(undefined);
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>({});
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [inlineCreate, setInlineCreate] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<string>('medium');
  const [newTaskAssignee, setNewTaskAssignee] = useState<number | null>(null);
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [draggedTask, setDraggedTask] = useState<string | number | null>(null);
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
      name: t('projects.status.new_status' as any) || (lang === 'vi' ? 'Trạng thái mới' : 'New Status'),
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
      message.warning(t('projects.status.min_status_warning' as any) || (lang === 'vi' ? 'Phải có ít nhất 1 trạng thái cho mỗi nhóm!' : 'Must keep at least 1 status per group!'));
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
      message.error(t('projects.status.empty_list_error' as any) || 'Danh sách trạng thái không được để trống!');
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
        message.success(t('projects.status.update_success' as any) || (lang === 'vi' ? 'Cập nhật trạng thái dự án thành công!' : 'Project statuses updated successfully!'));
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
        message.error(res.message || t('projects.status.save_error' as any) || 'Không thể lưu trạng thái');
      }
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || t('projects.status.save_error' as any) || 'Không thể lưu trạng thái');
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
    return t(`tasks.reaction.${type}` as any) || type;
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
  const [editProjectForm, setEditProjectForm] = useState({
    name: '',
    description: '',
    color: '',
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
          name: res.data.name,
          description: res.data.description || '',
          color: res.data.color,
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
      message.error(t('project_detail.toast.load_err' as any));
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

    return true;
  };

  const hasMatchingSubtasks = (parentId: number): boolean => {
    const children = tasks.filter(t => Number(t.parent_task_id) === Number(parentId));
    for (const child of children) {
      if (taskMatchesFilters(child)) return true;
      if (hasMatchingSubtasks(Number(child.id))) return true;
    }
    return false;
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter((t) => {
      if (t.status !== status || t.parent_task_id) return false;

      // Show parent if it matches filters or has a subtask that matches filters
      if (taskMatchesFilters(t)) return true;
      if (hasMatchingSubtasks(Number(t.id))) return true;

      return false;
    });
  };

  const handleDragStart = (e: React.DragEvent, taskId: string | number) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedTask) return;

    const taskToMove = tasks.find(t => t.id === draggedTask);
    if (!taskToMove) return;

    if (!canEditTask(taskToMove)) {
      message.error(t('project_detail.toast.no_edit_permission' as any) || 'Bạn không có quyền chỉnh sửa công việc này!');
      setDraggedTask(null);
      return;
    }

    // Optimistic Update
    const prevTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === draggedTask ? { ...t, status: newStatus as Task['status'] } : t))
    );

    try {
      const res = await api.updateTaskStatus(draggedTask, { status: newStatus as any });
      if (res.success) {
        message.success(t('project_detail.toast.status_updated' as any));
        fetchProjectData(true);
      } else {
        setTasks(prevTasks);
      }
    } catch (err: any) {
      console.error(err);
      setTasks(prevTasks);
      const errMsg = err.response?.data?.message || t('tasks.toast.status_err' as any);
      message.error(errMsg);
    } finally {
      setDraggedTask(null);
    }
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
        message.success(t('project_detail.toast.task_created' as any));
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

  const handleUpdateProject = async () => {
    if (!editProjectForm.name.trim() || !id) {
      message.error(t('project_detail.toast.required_name' as any));
      return;
    }

    if (editProjectForm.startDate && editProjectForm.endDate) {
      if (new Date(editProjectForm.endDate) < new Date(editProjectForm.startDate)) {
        message.error(t('project_detail.toast.date_err' as any));
        return;
      }
    }

    try {
      const res = await api.updateProject(id, {
        name: editProjectForm.name,
        description: editProjectForm.description,
        color: editProjectForm.color,
        status: editProjectForm.status,
        start_date: editProjectForm.startDate || null,
        end_date: editProjectForm.endDate || null,
      });
      if (res.success) {
        message.success(t('project_detail.toast.update_success' as any));
        setShowEditProjectModal(false);
        fetchProjectData();
        window.dispatchEvent(new Event('projects-changed'));
      }
    } catch (err) {
      console.error(err);
      message.error(t('project_detail.toast.update_err' as any));
    }
  };

  const handleAddMember = async () => {
    if (selectedNewMembers.length === 0 || !id) return;
    try {
      const res = await api.addProjectMember(id, { user_ids: selectedNewMembers.map(Number), role: 'member' });
      if (res.success) {
        message.success(t('project_detail.toast.member_added' as any));
        setShowAddMemberModal(false);
        setSelectedNewMembers([]);
        fetchProjectData();
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || t('projects.members.add_failed' as any);
      message.error(errMsg);
    }
  };

  const handleRemoveMember = async (userId: number | string) => {
    if (!id) return;
    try {
      const res = await api.removeProjectMember(id, userId);
      if (res.success) {
        message.success(t('project_detail.toast.member_removed' as any));
        fetchProjectData();
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || t('projects.members.delete_failed' as any);
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
      message.error(lang === 'vi' ? 'Vui lòng chọn công việc' : 'Please select a task');
      return;
    }
    const durationInSeconds = (logTimeHours * 3600) + (logTimeMinutes * 60);
    if (durationInSeconds <= 0) {
      message.error(lang === 'vi' ? 'Vui lòng nhập thời gian hợp lệ' : 'Please enter a valid duration');
      return;
    }
    try {
      const data = await api.addManualTime(logTimeTask, {
        duration: durationInSeconds,
        description: logTimeDescription,
        started_at: logTimeDate ? `${logTimeDate} 09:00:00` : undefined
      });
      if (data?.success) {
        message.success(lang === 'vi' ? 'Ghi nhận thời gian thành công' : 'Time entry logged successfully');
        setShowLogTimeModal(false);
        setLogTimeTask(null);
        setLogTimeHours(0);
        setLogTimeMinutes(0);
        setLogTimeDescription('');
        fetchProjectData(true);
      } else {
        message.error(data?.message || 'Error logging time');
      }
    } catch (err) {
      console.error(err);
      message.error('Failed to log time');
    }
  };

  const handleDeleteTimeEntry = async (entryId: number) => {
    try {
      const data = await api.deleteTimeEntry(entryId);
      if (data?.success) {
        message.success(lang === 'vi' ? 'Xoá bản ghi thành công' : 'Deleted time log successfully');
        fetchProjectData(true);
      }
    } catch (err) {
      console.error(err);
      message.error('Failed to delete time log');
    }
  };

  const formatSecondsToDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (h === 0 && m === 0) parts.push(`${s}s`);
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
        status: 'todo',
        priority: subtaskPriority,
        assignee_id: subtaskAssigneeId,
      });
      if (res.success) {
        message.success(t('tasks.detail_toast.subtask_added' as any) || 'Đã thêm công việc con');
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
      message.error(t('tasks.detail_toast.subtask_add_err' as any) || 'Không thể thêm công việc con');
    }
  };

  const handleToggleSubtaskStatus = async (st: any) => {
    if (!selectedTask) return;
    const newStatus = st.status === 'done' ? 'todo' : 'done';
    try {
      const res = await api.updateTask(st.id, { status: newStatus });
      if (res.success) {
        message.success(t('tasks.detail_toast.status_updated' as any) || 'Đã cập nhật trạng thái');

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
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.status_update_err' as any) || 'Không thể cập nhật trạng thái');
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
        message.success(res.watched ? (t('tasks.detail_toast.watching' as any) || 'Đang theo dõi công việc') : (t('tasks.detail_toast.unwatching' as any) || 'Đã bỏ theo dõi công việc'));
        fetchProjectData();
      }
    } catch (err) {
      console.error('Failed to toggle watch status', err);
      message.error(t('tasks.detail_toast.watch_update_err' as any) || 'Không thể cập nhật trạng thái theo dõi');
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
    if (days > 0) parts.push(t('common.time.days' as any, { count: days }));
    if (hours > 0) parts.push(t('common.time.hours' as any, { count: hours }));
    if (minutes > 0 && days === 0) parts.push(t('common.time.minutes' as any, { count: minutes }));
    return parts.length > 0 ? parts.join(' ') : t('common.time.less_than_minute' as any);
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
      const errMsg = err.response?.data?.message || 'Không thể tự động lưu.';
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
        message.success(t('project_detail.toast.comment_sent' as any));
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
      message.error(t('project_detail.toast.comment_err' as any));
    }
  };

  const handlePostReply = async (parentCommentId: number) => {
    if (!selectedTask || !replyText.trim()) return;
    try {
      const res = await api.createTaskComment(selectedTask.id, replyText, replyFile || undefined, parentCommentId);
      if (res.success) {
        message.success(t('project_detail.toast.comment_sent' as any));
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
      message.error(t('project_detail.toast.comment_err' as any));
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
    Modal.confirm({
      title: t('project_detail.confirm.delete_task' as any),
      content: t('project_detail.confirm.delete_task_content' as any),
      okText: t('project_detail.confirm.delete_btn' as any),
      okType: 'danger',
      cancelText: t('tasks.modal.cancel' as any),
      onOk: async () => {
        try {
          const res = await api.deleteTask(taskId);
          if (res.success) {
            message.success(t('project_detail.toast.task_deleted' as any));
            setSelectedTask(null);
            fetchProjectData();
          }
        } catch (err) {
          console.error(err);
          message.error(t('project_detail.toast.task_delete_err' as any));
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

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };



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

  let mostActiveMember = 'N/A';
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

  let mostLoggedTask = 'N/A';
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
    { key: 'board', label: t('project_detail.tab.board' as any), badge: columns.reduce((sum: number, col: any) => sum + getTasksByStatus(col.key).length, 0) },
    { key: 'calendar', label: t('project_detail.tab.calendar' as any) || (lang === 'vi' ? 'Lịch biểu' : 'Calendar'), badge: tasks.filter(t => t.due_date).length },
    { key: 'timesheet', label: t('project_detail.tab.timesheet' as any) || (lang === 'vi' ? 'Bảng công' : 'Timesheet'), badge: projectTimeEntries.length },
    { key: 'members', label: t('project_detail.tab.members' as any), badge: project?.members?.length || 0 },
  ];
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" tip={t('projects.toast.loading_details' as any) || 'Đang tải chi tiết dự án...'} />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h3>{t('projects.toast.project_not_found' as any) || 'Không tìm thấy dự án'}</h3>
        <Button onClick={() => navigate('/projects')}>{t('projects.toast.back_to_list' as any) || 'Quay lại danh sách'}</Button>
      </div>
    );
  }


  const renderStatusRow = (s: any, index: number) => {
    return (
      <div
        key={s.id}
        draggable
        onDragStart={(e) => {
          setDraggedStatusId(s.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!draggedStatusId || draggedStatusId === s.id) return;
          const fromIdx = activeStatuses.findIndex(st => st.id === draggedStatusId);
          const toIdx = activeStatuses.findIndex(st => st.id === s.id);
          if (fromIdx === -1 || toIdx === -1) return;
          const newList = [...activeStatuses];
          const [moved] = newList.splice(fromIdx, 1);
          newList.splice(toIdx, 0, moved);
          newList.forEach((st, i) => { st.position = i; });
          setActiveStatuses(newList);
          setDraggedStatusId(null);
        }}
        onDragEnd={() => setDraggedStatusId(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: draggedStatusId === s.id ? 'rgba(99, 102, 241, 0.06)' : 'var(--bg-card)',
          border: draggedStatusId === s.id ? '1px dashed var(--primary)' : '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '6px 8px',
          transition: 'all 0.2s',
          cursor: 'grab',
          opacity: draggedStatusId === s.id ? 0.6 : 1,
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
          <div className="project-icon" style={{ background: `${project.color}20`, color: project.color }}>
            {project.name.charAt(0)}
          </div>
          <div className="project-info">
            <h1>{project.name}</h1>
            <span className="project-id">#{project.id}</span>
          </div>
        </div>
        {canEditProject() && (
          <div className="project-detail__header-right" style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={() => setShowManageStatusesModal(true)}>{t('projects.status.manage_btn' as any) || 'Quản lý trạng thái'}</Button>
            <Button type="primary" onClick={() => setShowEditProjectModal(true)}>{t('project_detail.edit_btn' as any)}</Button>
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
      {activeTab === 'board' && (
        <>
          {/* Board Toolbar */}
          <div className="project-detail__toolbar">
            <div className="project-detail__toolbar-left">
              <span style={{ color: '#9ca0b0', fontSize: '13px' }}>{project.description || t('projects.no_desc')}</span>
            </div>
            {/* <div className="project-detail__toolbar-right">
              <button className="project-detail__add-task-btn" onClick={() => {
                const firstCol = columns[0]?.key || 'todo';
                setInlineCreate(firstCol);
                setNewTaskTitle('');
                setNewTaskStatus(firstCol);
                setNewTaskPriority('medium');
                setNewTaskAssignee(null);
                setNewTaskStartDate('');
                setNewTaskDueDate('');
              }}>
                <PlusOutlined /> {t('project_detail.add_task' as any)}
              </button>
            </div> */}
          </div>

          {/* Filters & Search Toolbar */}
          <div
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '240px' }}>
              <Input
                prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder={t('projects.search_tasks_placeholder' as any) || 'Tìm kiếm công việc theo tên hoặc ID...'}
                variant="filled"
                allowClear
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                style={{ maxWidth: '320px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)' }}
                className='search-task-board-input'
              />

              {/* <div 
                onClick={() => setFilterMyTasks(prev => !prev)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  padding: '6px 12px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  background: filterMyTasks ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)', 
                  border: filterMyTasks ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  color: filterMyTasks ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '13px',
                  userSelect: 'none',
                  transition: 'all 0.2s'
                }}
              >
                <UserOutlined />
                <span>Chỉ công việc của tôi</span>
              </div> */}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('projects.filters.assignee' as any) || 'Người thực hiện:'}</span>
              <Select
                placeholder={t('projects.filters.all_members' as any) || 'Tất cả thành viên'}
                allowClear
                value={filterAssigneeId}
                onChange={val => setFilterAssigneeId(val)}
                style={{ width: '180px' }}
                dropdownStyle={{ background: 'var(--bg-card)' }}
                options={(project?.members || []).map((m: any) => ({
                  value: m.id,
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {m.photo ? (
                        <img src={m.photo} alt={m.name} style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#6366f1', color: '#fff', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{m.name}</span>
                    </div>
                  )
                }))}
              />

              {(filterSearch || filterMyTasks || filterAssigneeId !== undefined) && (
                <Button
                  type="text"
                  onClick={() => {
                    setFilterSearch('');
                    setFilterMyTasks(false);
                    setFilterAssigneeId(undefined);
                  }}
                  style={{ color: '#ef4444', fontSize: '13px', fontWeight: 500 }}
                >
                  {t('projects.filters.clear_filters' as any) || 'Xóa bộ lọc'}
                </Button>
              )}
            </div>
          </div>

          {/* Kanban Board */}
          <div className="project-detail__board">
            {columns.map((col: any) => {
              const colTasks = getTasksByStatus(col.key);
              return (
                <div key={col.key} className={`project-detail__column project-detail__column--${col.key}`}
                  onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.key)}>
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
                  </div>

                  <div className="project-detail__column-body">
                    {/* Task Cards */}
                    {colTasks.map((task) => (
                      <div key={task.id} className={`project-detail__task-card ${draggedTask === task.id ? 'dragging' : ''}`}
                        draggable onDragStart={(e) => handleDragStart(e, task.id)} onDragEnd={() => setDraggedTask(null)}
                        onClick={() => handleSelectTask(task)}>
                        <div className="project-detail__task-card-top">
                          <span className="project-detail__task-card-id">#{task.id}</span>
                          <FlagIcon color={priorityColors[task.priority] || '#f59e0b'} size={14} />
                        </div>
                        <div className="project-detail__task-card-title">{task.title}</div>
                        <div className="project-detail__task-card-bottom">
                          <div className="project-detail__task-card-meta">
                            <span className="project-detail__task-card-date">{formatDateTime(task.due_date)}</span>
                          </div>
                          {task.assignee && (
                            <div className="project-detail__task-card-assignee" style={{ background: project.color }}>
                              {task.assignee.photo ? <img src={task.assignee.photo} alt={task.assignee.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : getInitials(task.assignee.name)}
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
                                                message.error(t('tasks.detail_toast.status_update_err' as any) || 'Không thể cập nhật trạng thái công việc con');
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
                                <span>{t('project_detail.subtask_title_with_count' as any, { done: doneCount, total: totalCount })}</span>
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
                              placeholder={t('project_detail.task_name_placeholder' as any)}
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
                                          <span style={{ fontSize: '12px', fontWeight: 600, color: p.color }}>{t(`tasks.priority.${p.id}` as any)}</span>
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
                                {t('project_detail.cancel_btn' as any)}
                              </button>
                              <button onClick={() => handleInlineCreate(col.key)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {t('tasks.panel.save_short')} ↵
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Add card button - every column */}
                    {inlineCreate !== col.key && (
                      <div className="project-detail__add-card" onClick={() => {
                        setInlineCreate(col.key);
                        setNewTaskTitle('');
                        setNewTaskStatus(col.key);
                        setNewTaskPriority('medium');
                        setNewTaskAssignee(null);
                        setNewTaskStartDate('');
                        setNewTaskDueDate('');
                      }}>
                        <PlusOutlined /> {t('project_detail.add_task' as any)}
                      </div>
                    )}

                    {/* Spacer to allow scrolling fully past the inline creation form */}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'calendar' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '8px', padding: '24px', border: '1px solid var(--border-color)', marginTop: '16px' }} className="project-detail__calendar-container">
          <TaskCalendar tasks={tasks.filter(taskMatchesFilters)} onSelectTask={handleSelectTask} columns={columns} />
        </div>
      )}

      {activeTab === 'members' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '8px', padding: '24px', border: '1px solid var(--border-color)', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px' }}>{t('project_detail.members_title' as any)}</h3>
            {canEditProject() && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAddMemberModal(true)}>{t('project_detail.add_member' as any)}</Button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {project.members?.map((m: any) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-body)', padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="member-avatar" style={{ background: project.color, width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', color: '#fff', fontWeight: 600 }}>
                    {m.photo ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : getInitials(m.name)}
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{m.email}</div>
                  </div>
                </div>
                <div>
                  <span style={{ marginRight: '16px', color: '#6366f1', textTransform: 'capitalize', fontSize: '13px' }}>{m.pivot?.role || 'member'}</span>
                  {Number(m.id) !== Number(project.created_by) ? (
                    canEditProject() ? (
                      <Popconfirm title={t('project_detail.confirm_remove_member' as any)} onConfirm={() => handleRemoveMember(m.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ) : null
                  ) : (
                    <span style={{ color: '#555', fontSize: '12px' }}>{t('project_detail.owner' as any)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'timesheet' && (
        <div className="project-detail__timesheet" style={{ marginTop: '16px' }}>
          {/* Toolbar Filters */}
          <div className="timesheet-filters" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{lang === 'vi' ? 'Thời gian' : 'Timeframe'}</label>
              <Select value={timesheetDateFilter} onChange={(val) => setTimesheetDateFilter(val)} style={{ width: '140px' }}>
                <Select.Option value="all">{lang === 'vi' ? 'Tất cả' : 'All'}</Select.Option>
                <Select.Option value="today">{lang === 'vi' ? 'Hôm nay' : 'Today'}</Select.Option>
                <Select.Option value="week">{lang === 'vi' ? 'Tuần này' : 'This Week'}</Select.Option>
                <Select.Option value="month">{lang === 'vi' ? 'Tháng này' : 'This Month'}</Select.Option>
                <Select.Option value="custom">{lang === 'vi' ? 'Tự chọn' : 'Custom'}</Select.Option>
              </Select>
            </div>

            {timesheetDateFilter === 'custom' && (
              <>
                <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{lang === 'vi' ? 'Từ ngày' : 'From'}</label>
                  <Input type="date" value={timesheetStartDate} onChange={(e) => setTimesheetStartDate(e.target.value)} style={{ width: '140px' }} />
                </div>
                <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{lang === 'vi' ? 'Đến ngày' : 'To'}</label>
                  <Input type="date" value={timesheetEndDate} onChange={(e) => setTimesheetEndDate(e.target.value)} style={{ width: '140px' }} />
                </div>
              </>
            )}

            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{lang === 'vi' ? 'Thành viên' : 'Member'}</label>
              <Select value={timesheetMemberFilter} onChange={(val) => setTimesheetMemberFilter(val)} style={{ width: '180px' }}>
                <Select.Option value="all">{lang === 'vi' ? 'Tất cả thành viên' : 'All Members'}</Select.Option>
                {project.members?.map((m: any) => (
                  <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
                ))}
              </Select>
            </div>

            <div className="filter-actions" style={{ marginLeft: 'auto' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowLogTimeModal(true)}>
                {lang === 'vi' ? 'Ghi nhận thời gian' : 'Log Time'}
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
                <span className="label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{lang === 'vi' ? 'Tổng thời gian ghi nhận' : 'Total Time Tracked'}</span>
                <span className="value" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{totalHours}h</span>
                <span className="sub" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{filteredTimeEntries.length} {lang === 'vi' ? 'bản ghi' : 'entries'}</span>
              </div>
            </div>

            <div className="timesheet-stat-card" style={{ background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="card-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '20px' }}>
                <UserOutlined />
              </div>
              <div className="card-info" style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{lang === 'vi' ? 'Tích cực nhất' : 'Most Active Member'}</span>
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
                <span className="label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{lang === 'vi' ? 'Công việc tốn thời gian' : 'Most Logged Task'}</span>
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
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 16px 0', fontWeight: 600 }}>{lang === 'vi' ? 'Thời gian theo thành viên (Giờ)' : 'Time per Member (Hours)'}</h3>
                <div style={{ width: '100%', height: '240px' }}>
                  <ResponsiveContainer>
                    <BarChart data={memberChartData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <RechartsTooltip formatter={(value) => [`${value}h`, lang === 'vi' ? 'Thời gian' : 'Time']} />
                      <Bar dataKey="hours" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 16px 0', fontWeight: 600 }}>{lang === 'vi' ? 'Phân bổ theo công việc' : 'Time per Task'}</h3>
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
                        <RechartsTooltip formatter={(value) => [`${value}h`, lang === 'vi' ? 'Thời gian' : 'Time']} />
                        <Legend verticalAlign="bottom" height={36} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>{lang === 'vi' ? 'Chưa có dữ liệu' : 'No data'}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Table Logs */}
          <div className="timesheet-logs-container" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
            <h3 className="section-title" style={{ fontSize: '16px', color: 'var(--text-primary)', margin: '0 0 16px 0', fontWeight: 600 }}>{lang === 'vi' ? 'Nhật ký ghi nhận thời gian' : 'Time Tracking Logs'}</h3>
            {loadingTimesheet ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Spin /></div>
            ) : filteredTimeEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {lang === 'vi' ? 'Chưa có bản ghi nhận thời gian nào.' : 'No time entries found.'}
              </div>
            ) : (
              <div className="timesheet-table-wrapper" style={{ overflowX: 'auto' }}>
                <table className="timesheet-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 500 }}>{lang === 'vi' ? 'Thành viên' : 'Member'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500 }}>{lang === 'vi' ? 'Công việc' : 'Task'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500 }}>{lang === 'vi' ? 'Mô tả' : 'Description'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500 }}>{lang === 'vi' ? 'Thời gian bắt đầu' : 'Start Time'}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500 }}>{lang === 'vi' ? 'Thời lượng' : 'Duration'}</th>
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
                              {new Date(entry.started_at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', {
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
                                title={lang === 'vi' ? 'Xoá bản ghi thời gian này?' : 'Delete this time log?'}
                                onConfirm={() => handleDeleteTimeEntry(entry.id)}
                                okText={lang === 'vi' ? 'Xoá' : 'Delete'}
                                cancelText={lang === 'vi' ? 'Huỷ' : 'Cancel'}
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
      <Modal
        title={lang === 'vi' ? 'Ghi nhận thời gian thủ công' : 'Log Time Manually'}
        open={showLogTimeModal}
        onCancel={() => setShowLogTimeModal(false)}
        onOk={handleAddManualTime}
        okText={lang === 'vi' ? 'Ghi nhận' : 'Log Time'}
        cancelText={lang === 'vi' ? 'Huỷ' : 'Cancel'}
        className="timesheet-log-modal"
        styles={{ body: { background: 'var(--bg-card)' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {lang === 'vi' ? 'Chọn công việc *' : 'Select Task *'}
            </label>
            <Select
              style={{ width: '100%' }}
              placeholder={lang === 'vi' ? 'Chọn một công việc thuộc dự án...' : 'Select a project task...'}
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
                {lang === 'vi' ? 'Ngày ghi nhận' : 'Date'}
              </label>
              <Input
                type="date"
                value={logTimeDate}
                onChange={(e) => setLogTimeDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {lang === 'vi' ? 'Thời lượng' : 'Duration'}
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
              {lang === 'vi' ? 'Ghi chú / Mô tả công việc' : 'Notes / Description'}
            </label>
            <Input.TextArea
              rows={3}
              placeholder={lang === 'vi' ? 'Nhập chi tiết công việc đã làm...' : 'What did you work on?...'}
              value={logTimeDescription}
              onChange={(e) => setLogTimeDescription(e.target.value)}
            />
          </div>
        </div>
      </Modal>

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
      <Modal
        title={t('project_detail.add_member_modal.title' as any) || "Thêm thành viên"}
        open={showAddMemberModal}
        onCancel={() => setShowAddMemberModal(false)}
        onOk={handleAddMember}
        okText={t('project_detail.add_member_modal.ok' as any) || "Thêm vào dự án"}
        cancelText={t('project_detail.cancel_btn' as any) || "Hủy"}
      >
        <div style={{ padding: '12px 0' }}>
          <label style={{ display: 'block', marginBottom: '8px' }}>{t('project_detail.add_member_modal.label' as any) || "Chọn nhân viên từ hệ thống:"}</label>
          <Select
            mode="multiple"
            showSearch
            style={{ width: '100%' }}
            placeholder={t('project_detail.add_member_modal.placeholder' as any) || "Chọn nhân viên..."}
            optionFilterProp="children"
            value={selectedNewMembers}
            onChange={(val) => setSelectedNewMembers(val)}
          >
            {nonProjectUsers.map(u => (
              <Select.Option key={u.id} value={u.id}>{u.name} ({u.email})</Select.Option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* Edit Project Details Modal */}
      <Modal
        title={t('projects.edit.title')}
        open={showEditProjectModal}
        onCancel={() => setShowEditProjectModal(false)}
        onOk={handleUpdateProject}
        okText={t('settings.workspace.save')}
        cancelText={t('tasks.modal.cancel' as any)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>{t('projects.create.name')}</label>
            <input
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              value={editProjectForm.name}
              onChange={(e) => setEditProjectForm({ ...editProjectForm, name: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>{t('projects.create.desc')}</label>
            <textarea
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '80px' }}
              value={editProjectForm.description}
              onChange={(e) => setEditProjectForm({ ...editProjectForm, description: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px' }}>{t('projects.create.start_date')}</label>
              <input
                type="date"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                value={editProjectForm.startDate}
                onChange={(e) => setEditProjectForm({ ...editProjectForm, startDate: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px' }}>{t('projects.create.end_date')}</label>
              <input
                type="date"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                value={editProjectForm.endDate}
                onChange={(e) => setEditProjectForm({ ...editProjectForm, endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>{t('projects.create.color')}</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7'].map(c => (
                <div
                  key={c}
                  style={{
                    background: c,
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: editProjectForm.color === c ? '3px solid #000' : '1px solid #ccc'
                  }}
                  onClick={() => setEditProjectForm({ ...editProjectForm, color: c })}
                />
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>{t('projects.edit.status')}</label>
            <Select
              style={{ width: '100%' }}
              value={editProjectForm.status}
              onChange={(val) => setEditProjectForm({ ...editProjectForm, status: val })}
            >
              <Select.Option value="planning">{t('projects.status.planning')}</Select.Option>
              <Select.Option value="active">{t('projects.status.active')}</Select.Option>
              <Select.Option value="on_hold">{t('projects.status.on_hold')}</Select.Option>
              <Select.Option value="completed">{t('projects.status.completed')}</Select.Option>
            </Select>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
            <h4 style={{ color: 'var(--danger)', margin: '0 0 8px 0', fontSize: '14px' }}>{t('projects.edit.danger_zone')}</h4>
            <p style={{ color: '#9ca0b0', fontSize: '12px', margin: '0 0 12px 0' }}>{t('projects.edit.danger_desc')}</p>
            <Popconfirm
              title={t('projects.edit.delete_btn')}
              description={t('projects.confirm.delete_title')}
              onConfirm={async () => {
                const res = await api.deleteProject(project.id);
                if (res.success) {
                  message.success(t('projects.toast.delete_success'));
                  window.dispatchEvent(new Event('projects-changed'));
                  navigate('/projects');
                }
              }}
              okText={t('projects.edit.delete_btn')}
              cancelText={t('tasks.modal.cancel' as any)}
              okType="danger"
            >
              <Button type="primary" danger>{t('projects.edit.delete_btn')}</Button>
            </Popconfirm>
          </div>
        </div>
      </Modal>

      {/* Manage Statuses Modal */}
      <Modal
        title={t('projects.status.manage_title' as any) || 'Quản lý trạng thái công việc'}
        open={showManageStatusesModal}
        onCancel={() => setShowManageStatusesModal(false)}
        onOk={() => handleSaveStatuses()}
        width={900}
        okText={t('projects.status.save_config' as any) || 'Lưu cấu hình'}
        cancelText={t('tasks.panel.cancel')}
        style={{ top: '50px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
          {/* Template Selector Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(120, 120, 120, 0.04)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('projects.status.apply_template_label' as any) || 'Áp dụng Template mẫu:'}
              </span>
              <Select
                style={{ width: '200px' }}
                placeholder={t('projects.status.select_template_placeholder' as any) || 'Chọn Template...'}
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
              {t('projects.status.apply_template_help' as any) || 'Chọn template có sẵn để áp dụng nhanh bộ trạng thái mẫu.'}
            </div>
          </div>

          {/* Status Columns Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            {/* 1. NOT STARTED GROUP */}
            <div style={{ background: 'rgba(120, 120, 120, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca0b0', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('projects.status.group_not_started' as any) || 'CẦN LÀM (NOT STARTED)'}</span>
                <span style={{ fontSize: '11px', background: 'rgba(120, 120, 120, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                  {activeStatuses.filter(s => s.type === 'not_started').length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeStatuses.filter(s => s.type === 'not_started').map((s, i) => renderStatusRow(s, i))}
                <Button type="dashed" onClick={() => handleAddStatus('not_started')} style={{ width: '100%' }}>
                  + {t('projects.status.add_status' as any) || 'Thêm trạng thái'}
                </Button>
              </div>
            </div>

            {/* 2. ACTIVE GROUP */}
            <div style={{ background: 'rgba(59, 130, 246, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('projects.status.group_active' as any) || 'ĐANG THỰC HIỆN (ACTIVE)'}</span>
                <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                  {activeStatuses.filter(s => s.type === 'active' || s.type === 'done' || !s.type).length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeStatuses.filter(s => s.type === 'active' || s.type === 'done' || !s.type).map((s, i) => renderStatusRow(s, i))}
                <Button type="dashed" onClick={() => handleAddStatus('active')} style={{ width: '100%' }}>
                  + {t('projects.status.add_status' as any) || 'Thêm trạng thái'}
                </Button>
              </div>
            </div>

            {/* 3. CLOSED GROUP */}
            <div style={{ background: 'rgba(34, 197, 94, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('projects.status.group_closed' as any) || 'HOÀN THÀNH (CLOSED)'}</span>
                <span style={{ fontSize: '11px', background: 'rgba(34, 197, 94, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                  {activeStatuses.filter(s => s.type === 'closed').length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeStatuses.filter(s => s.type === 'closed').map((s, i) => renderStatusRow(s, i))}
                <Button type="dashed" onClick={() => handleAddStatus('closed')} style={{ width: '100%' }}>
                  + {t('projects.status.add_status' as any) || 'Thêm trạng thái'}
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
                {t('projects.status.save_as_new_template' as any) || 'Lưu cấu hình này thành Template mới'}
              </label>
            </div>
            {saveAsNewTemplate && (
              <div style={{ paddingLeft: '22px' }}>
                <Input
                  placeholder={t('projects.status.new_template_placeholder' as any) || 'Nhập tên Template mới (ví dụ: Quy trình Marketing)...'}
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  style={{ maxWidth: '400px' }}
                />
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Mapping Statuses Modal */}
      <Modal
        title={t('projects.status.map_title' as any) || 'Chuyển đổi trạng thái công việc cũ'}
        open={showMappingModal}
        onCancel={() => setShowMappingModal(false)}
        onOk={() => handleSaveStatuses(statusMappings)}
        okText={t('projects.status.confirm_save' as any) || 'Xác nhận & Lưu'}
        cancelText={t('tasks.panel.cancel')}
        width={500}
        destroyOnClose
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
            <strong>{t('projects.status.map_attention_label' as any) || 'Chú ý:'}</strong>{' '}
            {t('projects.status.map_attention_desc' as any) || 'Bạn đang xóa một số trạng thái vẫn còn công việc chưa hoàn thành. Hãy chọn trạng thái mới để chuyển các công việc này sang.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {orphanedStatusesToMap.map(os => (
              <div key={os.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t('projects.status.map_field_label' as any, { name: os.name }) || `Chuyển công việc ở "${os.name}" sang:`}
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
    </div>
  );
};

export default ProjectDetailPage;
