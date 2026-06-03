import React, { useState, useEffect, useRef } from 'react';
import { Dropdown, Tooltip, message, Modal, Select, Button, Popconfirm, Spin, Popover, Input, DatePicker } from 'antd';
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  PlusOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FlagOutlined,
  CalendarOutlined,
  ArrowRightOutlined,
  DashboardOutlined,
  InfoCircleOutlined,
  PaperClipOutlined,
  SendOutlined,
  CheckOutlined,
  DownOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  LockOutlined,
  SmileOutlined,
  CheckSquareOutlined,
  SubnodeOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import { getEcho } from '../../services/echo';
import { useTranslation } from '../../utils/i18n';
import dayjs from 'dayjs';
import './TaskDetailPanel.scss';

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys & People',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
      '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
      '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
      '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓',
      '🤗', '🤔', '🫣', '🤭', '🤫', '🤥', '😶', '🫥', '😐', '😑',
      '😬', '🫠', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴',
      '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '🤧', '😷',
      '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩',
      '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹',
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
      '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂'
    ]
  },
  {
    name: 'Animals & Nature',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
      '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞',
      '🐜', '🪰', '🪲', '🪳', '🦂', '🕷️', '🕸️', '🐢', '🐍', '🦎',
      '🐙', '🦑', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋',
      '🦈', '🐊', '🐅', '🐆', '🦍', '🦧', '🐘'
    ]
  },
  {
    name: 'Food & Drink',
    icon: '🍎',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
      '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑',
      '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧅', '🥔', '🍠',
      '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🍳', '🥞', '🧇', '🥓',
      '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🌮', '🌯'
    ]
  },
  {
    name: 'Activities & Objects',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓',
      '🏸', '🥅', '⛳', '🏹', '🎣', '🥊', '🥋', '🛹', '🏆', '🥇',
      '🥈', '🥉', '🏅', '🎖️', '🎟️', '🎫', '🎬', '🎨', '🎭', '🎤',
      '🎧', '🎼', '🎹', '🥁', '🎸', '🎻', '🎲', '🧩', '🎳', '🎮',
      '💻', '🖥️', '🖨️', '🖱️', '📱', '☎️', '📺', '📷', '📸', '📹',
      '📼', '🔍', '🔎', '💡', '🔦', '🏮', '🪔', '💵', '💳'
    ]
  }
];

interface User {
  id: number;
  name: string;
  photo?: string;
  email?: string;
  role?: string;
}

interface Task {
  id: number;
  project_id?: number | string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee_id?: number | string;
  assignee?: User;
  creator_id?: number;
  start_date?: string;
  due_date?: string;
  time_entries?: any[];
  watcher_ids?: number[];
  subtasks?: any[];
  comments?: any[];
  comments_count?: number;
  activities?: any[];
  activities_count?: number;
  project?: {
    name?: string;
    title?: string;
    owner_id?: number;
    statuses?: any[];
    members?: User[];
    custom_fields?: any[];
  };
  parent_task_id?: number;
  parentTask?: Task;
  custom_field_values?: any[];
  checklists?: any[];
  attachments?: any[];
}

interface TaskDetailPanelProps {
  taskId: number | string;
  onClose: () => void;
  onUpdate: (silent?: boolean) => void;
  projectMembers?: User[];
  projectStatuses?: any[];
}

// Priority Config ClickUp Style
const PRIORITIES = [
  { id: 'urgent', name: 'Khẩn cấp', nameEn: 'Urgent', color: '#ef4444', icon: '🚩' },
  { id: 'high', name: 'Cao', nameEn: 'High', color: '#f97316', icon: '🏁' },
  { id: 'medium', name: 'Trung bình', nameEn: 'Medium', color: '#f59e0b', icon: '🔶' },
  { id: 'low', name: 'Thấp', nameEn: 'Low', color: '#3b82f6', icon: '🔽' },
];

const priorityColors: Record<string, string> = { urgent: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6' };

// Flag Icon Component
const FlagIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

// Priority Picker Component
const PriorityPicker: React.FC<{
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const { t, lang } = useTranslation();
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
            <span style={{ fontSize: '13px', fontWeight: 600, color: p.id === value ? 'var(--primary)' : 'var(--text-primary)' }}>
              {t(`tasks.priority.${p.id}` as any)}
            </span>
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
        <span style={{ fontSize: '12px', fontWeight: 600, color: current.color }}>
          {t(`tasks.priority.${current.id}` as any)}
        </span>
        <DownOutlined style={{ fontSize: '8px', color: 'var(--text-muted)' }} />
      </button>
    </Popover>
  );
};

// Status Picker Component
const ClickUpStatusPicker: React.FC<{
  currentStatusId: string;
  projectStatuses: any[];
  onChange: (val: string) => void;
  disabled?: boolean;
}> = ({ currentStatusId, projectStatuses, onChange, disabled }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const statuses = projectStatuses && projectStatuses.length > 0 ? projectStatuses : [
    { id: 'todo', name: t('tasks.status.todo') || 'CẦN LÀM', color: '#9ca0b0', type: 'not_started' },
    { id: 'doing', name: t('tasks.status.in_progress') || 'ĐANG LÀM', color: '#3b82f6', type: 'active' },
    { id: 'done', name: t('tasks.status.done') || 'HOÀN THÀNH', color: '#22c55e', type: 'closed' }
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
        placeholder={t('tasks.panel.status_search_placeholder' as any) || 'Tìm trạng thái...'}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        allowClear
      />
      <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
        {renderGroup(t('tasks.status_group.not_started' as any) || 'Cần làm', filtered.not_started)}
        {renderGroup(t('tasks.status_group.active' as any) || 'Đang hoạt động', filtered.active)}
        {renderGroup(t('tasks.status_group.closed' as any) || 'Đã đóng', filtered.closed)}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', background: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
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
            borderRadius: !isLastStatus ? '0 4px 4px 0' : '4px',
            fontWeight: 600,
            fontSize: '11px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            height: '30px',
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

// Time Tracker Component
const TimeTracker: React.FC<{
  taskId: number;
  timeEntries: any[];
  onUpdate: (silent?: boolean) => void;
  disabled?: boolean;
}> = ({ taskId, timeEntries = [], onUpdate, disabled }) => {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState<any>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [manualDesc, setManualDesc] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const runningEntry = timeEntries.find((e: any) => !e.ended_at);
    setRunning(runningEntry || null);
    if (runningEntry) {
      const started = new Date(runningEntry.started_at).getTime();
      setElapsed(Math.round((Date.now() - started) / 1000));
    }
  }, [timeEntries]);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        const started = new Date(running.started_at).getTime();
        setElapsed(Math.round((Date.now() - started) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
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
      onUpdate(true);
    } catch (err: any) {
      message.error(err.response?.data?.message || t('tasks.detail_toast.timer_start_err'));
    }
  };

  const handleStop = async () => {
    try {
      await api.stopTimer(taskId);
      window.dispatchEvent(new Event('timer-updated'));
      onUpdate(true);
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
      onUpdate(true);
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
        {t('tasks.panel.save')}
      </Button>
    </div>
  );

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(120, 120, 120, 0.05)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '4px 12px', width: 'fit-content' }}>
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
              {formatDuration(elapsed, t)}
            </span>
          ) : hasTimeLogs ? (
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatDuration(totalTracked, t)}
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

// Subtask Title Input Component
const SubtaskTitleInput: React.FC<{
  subtask: any;
  disabled?: boolean;
  onUpdate: () => void;
}> = ({ subtask, disabled, onUpdate }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState(subtask.title);

  useEffect(() => {
    setTitle(subtask.title);
  }, [subtask.title]);

  const handleBlur = async () => {
    if (title.trim() === '') {
      setTitle(subtask.title);
      return;
    }
    if (title !== subtask.title) {
      try {
        const res = await api.updateTask(subtask.id, { title });
        if (res.success) {
          onUpdate();
        }
      } catch {
        message.error(t('tasks.detail_toast.subtask_title_err'));
      }
    }
  };

  return (
    <input
      type="text"
      value={title}
      disabled={disabled}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      style={{
        flex: 1,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        fontSize: '13px',
        fontWeight: 500,
        color: subtask.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)',
        textDecoration: subtask.status === 'done' ? 'line-through' : 'none',
        padding: '2px 4px',
        borderRadius: '4px',
        width: '100%',
      }}
      className="subtask-title-inline-input"
    />
  );
};

// Subtask Assignee Picker Component
const SubtaskAssigneePicker: React.FC<{
  subtask: any;
  members: any[];
  disabled?: boolean;
  onUpdate: () => void;
}> = ({ subtask, members = [], disabled, onUpdate }) => {
  const { t } = useTranslation();
  const handleSelect = async (userId: number | undefined) => {
    if (disabled) return;
    try {
      const res = await api.updateTask(subtask.id, { assignee_id: userId || null });
      if (res.success) {
        onUpdate();
      }
    } catch {
      message.error(t('tasks.detail_toast.assignee_err'));
    }
  };

  const currentAssignee = subtask.assignee;

  return (
    <Dropdown
      disabled={disabled}
      trigger={['click']}
      dropdownRender={() => (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '180px' }}>
          <div style={{ fontSize: '11px', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('tasks.panel.assignee')}</div>
          <div
            onClick={() => handleSelect(undefined)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              borderRadius: '6px',
              background: !currentAssignee ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
              color: !currentAssignee ? '#6366f1' : 'var(--text-primary)',
            }}
          >
            <UserOutlined style={{ fontSize: '12px' }} />
            <span style={{ fontSize: '12px' }}>{t('tasks.panel.unassigned' as any)}</span>
          </div>
          {members.map((m: any) => (
            <div
              key={m.id}
              onClick={() => handleSelect(m.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                borderRadius: '6px',
                background: m.id === currentAssignee?.id ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                color: m.id === currentAssignee?.id ? '#6366f1' : 'var(--text-primary)',
              }}
            >
              <div style={{ background: '#6366f1', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '9px', fontWeight: 600, overflow: 'hidden' }}>
                {m.photo ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.name)}
              </div>
              <span style={{ fontSize: '12px' }}>{m.name}</span>
            </div>
          ))}
        </div>
      )}
    >
      <div style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {currentAssignee ? (
          <Tooltip title={currentAssignee.name}>
            <div style={{ background: '#6366f1', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '9px', fontWeight: 600, overflow: 'hidden' }}>
              {currentAssignee.photo ? (
                <img src={currentAssignee.photo} alt={currentAssignee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                getInitials(currentAssignee.name)
              )}
            </div>
          </Tooltip>
        ) : (
          <Tooltip title={t('tasks.panel.assignee_placeholder')}>
            <div style={{ width: '22px', height: '22px', border: '1px dashed var(--text-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
              <UserOutlined style={{ color: 'var(--text-muted)', fontSize: '10px' }} />
            </div>
          </Tooltip>
        )}
      </div>
    </Dropdown>
  );
};

// Subtask Priority Picker Component
const SubtaskPriorityPicker: React.FC<{
  subtask: any;
  disabled?: boolean;
  onUpdate: () => void;
}> = ({ subtask, disabled, onUpdate }) => {
  const { t } = useTranslation();
  const handleSelect = async (prio: 'low' | 'medium' | 'high') => {
    if (disabled) return;
    try {
      const res = await api.updateTask(subtask.id, { priority: prio });
      if (res.success) {
        onUpdate();
      }
    } catch {
      message.error(t('tasks.detail_toast.priority_err'));
    }
  };

  const currentPrio = subtask.priority;

  return (
    <Dropdown
      disabled={disabled}
      trigger={['click']}
      dropdownRender={() => (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '120px' }}>
          <div style={{ fontSize: '11px', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('tasks.panel.priority')}</div>
          {['high', 'medium', 'low'].map((prio) => (
            <div
              key={prio}
              onClick={() => handleSelect(prio as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                borderRadius: '6px',
                background: prio === currentPrio ? 'rgba(120, 120, 120, 0.08)' : 'transparent',
                color: prio === 'high' ? '#ef4444' : prio === 'medium' ? '#f59e0b' : '#3b82f6',
                fontWeight: 600,
                fontSize: '12px',
              }}
            >
              <FlagOutlined />
              <span>{t(`tasks.priority.${prio}` as any)}</span>
            </div>
          ))}
        </div>
      )}
    >
      <span
        style={{
          fontSize: '11px',
          padding: '2px 6px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background:
            currentPrio === 'high'
              ? 'rgba(239, 68, 68, 0.1)'
              : currentPrio === 'medium'
                ? 'rgba(245, 158, 11, 0.1)'
                : 'rgba(59, 130, 246, 0.1)',
          color:
            currentPrio === 'high'
              ? '#ef4444'
              : currentPrio === 'medium'
                ? '#f59e0b'
                : '#3b82f6',
        }}
      >
        {t(`tasks.priority.${currentPrio}` as any)}
      </span>
    </Dropdown>
  );
};

// Helper to get status name from project statuses config
const getStatusName = (statusId: string, t: any, projectStatuses?: any[]): string => {
  if (projectStatuses && Array.isArray(projectStatuses)) {
    const found = projectStatuses.find(s => s.id === statusId);
    if (found) {
      const defaultNames = ['TO DO', 'IN PROGRESS', 'REVIEW', 'COMPLETE', 'DONE', 'TODO', 'CẦN LÀM', 'ĐANG LÀM', 'ĐANG DUYỆT', 'HOÀN THÀNH', 'ĐÃ XONG'];
      const isDefault = defaultNames.includes(found.name?.toUpperCase());
      if (isDefault) {
        const translationKey = `tasks.status.${found.id}`;
        const translated = t(translationKey as any);
        if (translated !== translationKey) return translated;
      }
      return found.name || statusId;
    }
  }

  // Default fallbacks
  if (statusId === 'todo') return t('tasks.status.todo');
  if (statusId === 'in_progress') return t('tasks.status.in_progress');
  if (statusId === 'review') return t('tasks.status.in_review');
  if (statusId === 'done') return t('tasks.status.done');

  return statusId;
};

// Helper to format activity details using translation function
const formatActivityDescription = (act: any, t: any, projectStatuses?: any[]): string => {
  const details = act.details || '';

  if (act.action === 'updated_status') {
    const match = details.match(/Changed status from '(.*)' to '(.*)'/);
    if (match) {
      const fromName = getStatusName(match[1], t, projectStatuses);
      const toName = getStatusName(match[2], t, projectStatuses);
      return t('tasks.activity.updated_status', { from: fromName, to: toName });
    }
    return t('tasks.activity.updated_status_generic');
  }

  if (act.action === 'created') {
    return t('tasks.activity.created');
  }
  if (act.action === 'updated_title') {
    const match = details.match(/Updated title to '(.*)'/);
    if (match) return t('tasks.activity.updated_title', { title: match[1] });
    return t('tasks.activity.updated_title_generic');
  }
  if (act.action === 'updated_assignee') {
    if (details.includes('Removed assignee')) return t('tasks.activity.updated_assignee_removed');
    const match = details.match(/Assigned to (.*)/);
    if (match) return t('tasks.activity.updated_assignee_to', { name: match[1] });
    return t('tasks.activity.updated_assignee_generic');
  }
  if (act.action === 'updated_estimated_hours') {
    const match = details.match(/Updated estimated hours to (.*)/);
    if (match) return t('tasks.activity.updated_estimated_hours', { hours: match[1] });
    return t('tasks.activity.updated_estimated_hours_generic');
  }
  if (act.action === 'updated_actual_hours') {
    const match = details.match(/Updated actual hours to (.*)/);
    if (match) return t('tasks.activity.updated_actual_hours', { hours: match[1] });
    return t('tasks.activity.updated_actual_hours_generic');
  }
  if (act.action === 'updated_description') {
    return t('tasks.activity.updated_description');
  }
  if (act.action === 'updated_priority') {
    const match = details.match(/Changed priority to '(.*)'/);
    let prio = match ? match[1] : '';
    const prioLabel = prio ? t(`tasks.priority.${prio}` as any) : '';
    return t('tasks.activity.updated_priority', { priority: prioLabel || prio });
  }
  if (act.action === 'updated_start_date') {
    const match = details.match(/Changed start date to (.*)/);
    if (match) return t('tasks.activity.updated_start_date', { date: match[1] });
    return t('tasks.activity.updated_start_date_generic');
  }
  if (act.action === 'updated_due_date') {
    const match = details.match(/Changed due date to (.*)/);
    if (match) return t('tasks.activity.updated_due_date', { date: match[1] });
    return t('tasks.activity.updated_due_date_generic');
  }
  if (act.action === 'commented') {
    const match = details.match(/Posted a comment: "(.*)"/);
    if (match) return t('tasks.activity.commented', { comment: match[1] });
    return t('tasks.activity.commented_generic');
  }
  if (act.action === 'started_timer') {
    return t('tasks.activity.started_timer');
  }
  if (act.action === 'stopped_timer') {
    if (details.includes('due to starting timer on another task')) {
      const match = details.match(/Logged (.*)\./);
      const duration = match ? match[1] : '';
      return t('tasks.activity.stopped_timer_another', { duration });
    } else {
      const match = details.match(/Logged (.*)\./);
      const duration = match ? match[1] : '';
      return t('tasks.activity.stopped_timer', { duration });
    }
  }
  if (act.action === 'added_time') {
    const durationMatch = details.match(/Manually added ([^\.]+)\./);
    const duration = durationMatch ? durationMatch[1] : '';
    const noteMatch = details.match(/Note: (.*)/);
    const note = noteMatch ? noteMatch[1] : '';
    const noteText = note ? t('tasks.activity.added_time_note', { note }) : '';
    return t('tasks.activity.added_time', { duration, note: noteText });
  }
  if (act.action === 'deleted_time') {
    const match = details.match(/Deleted time log ([^\.]+)\./);
    const duration = match ? match[1] : '';
    return t('tasks.activity.deleted_time', { duration });
  }

  return details || act.action || '';
};

// Subtask Date Picker Component
const SubtaskDatePicker: React.FC<{
  subtask: any;
  disabled?: boolean;
  onUpdate: () => void;
}> = ({ subtask, disabled, onUpdate }) => {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState(subtask.start_date ? dayjs(subtask.start_date).format('YYYY-MM-DDTHH:mm') : '');
  const [dueDate, setDueDate] = useState(subtask.due_date ? dayjs(subtask.due_date).format('YYYY-MM-DDTHH:mm') : '');

  useEffect(() => {
    setStartDate(subtask.start_date ? dayjs(subtask.start_date).format('YYYY-MM-DDTHH:mm') : '');
    setDueDate(subtask.due_date ? dayjs(subtask.due_date).format('YYYY-MM-DDTHH:mm') : '');
  }, [subtask.start_date, subtask.due_date]);

  const handleSave = async (newStart: string, newDue: string) => {
    if (disabled) return;
    try {
      const res = await api.updateTask(subtask.id, {
        start_date: newStart ? new Date(newStart).toISOString() : null,
        due_date: newDue ? new Date(newDue).toISOString() : null,
      });
      if (res.success) {
        onUpdate();
      }
    } catch {
      message.error(t('tasks.subtask.update_time_err'));
    }
  };

  return (
    <Dropdown
      disabled={disabled}
      trigger={['click']}
      dropdownRender={() => (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('tasks.panel.time')}</div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('tasks.panel.start_date_placeholder')}</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                handleSave(e.target.value, dueDate);
              }}
              style={{ width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '12px', padding: '4px 8px', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('tasks.panel.due_date_placeholder')}</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={e => {
                setDueDate(e.target.value);
                handleSave(startDate, e.target.value);
              }}
              style={{ width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '12px', padding: '4px 8px', borderRadius: '4px' }}
            />
          </div>
          {(startDate || dueDate) && (
            <Button
              size="small"
              danger
              style={{ fontSize: '10px', marginTop: '4px' }}
              onClick={() => {
                setStartDate('');
                setDueDate('');
                handleSave('', '');
              }}
            >
              {t('tasks.subtask.clear_time')}
            </Button>
          )}
        </div>
      )}
    >
      <div style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {(subtask.start_date || subtask.due_date) ? (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              background: 'rgba(120, 120, 120, 0.08)',
              padding: '2px 6px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title={t('tasks.panel.time_tooltip' as any) || "Thời gian thực hiện"}
          >
            <CalendarOutlined style={{ fontSize: '10px' }} />
            {subtask.start_date && new Date(subtask.start_date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })}
            {subtask.start_date && subtask.due_date && ' - '}
            {subtask.due_date && new Date(subtask.due_date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })}
          </span>
        ) : (
          <Tooltip title={t('tasks.panel.select_time_tooltip' as any) || "Chọn thời gian"}>
            <div style={{ width: '22px', height: '22px', border: '1px dashed var(--text-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
              <CalendarOutlined style={{ color: 'var(--text-muted)', fontSize: '10px' }} />
            </div>
          </Tooltip>
        )}
      </div>
    </Dropdown>
  );
};

// Main Component
export const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  taskId,
  onClose,
  onUpdate,
  projectMembers: initialMembers,
  projectStatuses: initialStatuses,
}) => {
  const { t, lang } = useTranslation();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<User | null>(null);
  const [project, setProject] = useState<any>(null);
  const commentsListRef = useRef<HTMLDivElement | null>(null);
  const activitiesListRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (commentsListRef.current) {
        commentsListRef.current.scrollTop = commentsListRef.current.scrollHeight;
      }
    }, 100);
  };

  const scrollToBottomActivities = () => {
    setTimeout(() => {
      if (activitiesListRef.current) {
        activitiesListRef.current.scrollTop = activitiesListRef.current.scrollHeight;
      }
    }, 100);
  };

  // Members & Statuses from Props or dynamically loaded
  const [members, setMembers] = useState<User[]>(initialMembers || []);
  const [statuses, setStatuses] = useState<any[]>(initialStatuses || []);

  // Form edit states
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('todo');
  const [editPriority, setEditPriority] = useState('medium');
  const [editAssigneeId, setEditAssigneeId] = useState<number | string | undefined>(undefined);
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  // Subtasks states
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskAssigneeId, setSubtaskAssigneeId] = useState<number | undefined>(undefined);
  const [subtaskPriority, setSubtaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [subtaskStartDate, setSubtaskStartDate] = useState('');
  const [subtaskDueDate, setSubtaskDueDate] = useState('');

  // Comments and Activities states
  const [comments, setComments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [activitiesCount, setActivitiesCount] = useState(0);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentFile, setNewCommentFile] = useState<File | null>(null);
  const [commentFilePreview, setCommentFilePreview] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<'comments' | 'history'>('comments');
  const [aiPromptChecklist, setAiPromptChecklist] = useState('');
  const [aiChecklistLoading, setAiChecklistLoading] = useState(false);
  const [isAiChecklistPopoverOpen, setIsAiChecklistPopoverOpen] = useState(false);
  const [isAiDescChecklistPopoverOpen, setIsAiDescChecklistPopoverOpen] = useState(false);

  // Comment replies & expansion states
  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replyFilePreview, setReplyFilePreview] = useState<string | null>(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState<number | null>(null);
  const [replyingToSubCommentId, setReplyingToSubCommentId] = useState<number | null>(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Record<number, boolean>>({});
  const [activeCommentEmojiCat, setActiveCommentEmojiCat] = useState(0);
  const [activeReplyEmojiCat, setActiveReplyEmojiCat] = useState(0);

  // Mention Suggestions states
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);

  // ClickUp Custom Fields & Checklists States
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newChecklistName, setNewChecklistName] = useState('');
  const [isChecklistPopoverOpen, setIsChecklistPopoverOpen] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<number | null>(null);
  const [editingChecklistName, setEditingChecklistName] = useState('');
  const [newItemNames, setNewItemNames] = useState<Record<number, string>>({});

  // Pagination for comments & activities
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [activitiesHasMore, setActivitiesHasMore] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Load profile on mount
  useEffect(() => {
    api.getMe().then(res => setMe(res)).catch(console.error);
  }, []);

  // Scroll to reply textarea and focus when replyingToCommentId or replyingToSubCommentId changes
  useEffect(() => {
    if (replyingToCommentId) {
      setTimeout(() => {
        const replyBox = document.getElementById(`reply-textarea-${replyingToCommentId}`) as HTMLTextAreaElement | null;
        if (replyBox) {
          replyBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          replyBox.focus();
          const len = replyBox.value.length;
          replyBox.setSelectionRange(len, len);
        }
      }, 100);
    }
  }, [replyingToCommentId, replyingToSubCommentId]);

  // Fetch Task Details
  const fetchTaskDetails = async (id: number | string) => {
    setLoading(true);
    try {
      const res = await api.getTask(id);
      if (res.success) {
        const fullTask = res.data as Task;
        setTask(fullTask);
        setEditTitle(fullTask.title || '');
        setEditDescription(fullTask.description || '');
        setEditStatus(fullTask.status || 'todo');
        setEditPriority(fullTask.priority || 'medium');
        setEditAssigneeId(fullTask.assignee_id || undefined);
        setEditStartDate(fullTask.start_date || '');
        setEditDueDate(fullTask.due_date || '');

        // Fetch comments and activities
        setComments(fullTask.comments || []);
        setCommentsPage(1);
        setCommentsHasMore((fullTask.comments || []).length < (fullTask.comments_count || 0));
        setCommentsCount(fullTask.comments_count || 0);
        scrollToBottom();

        const sortedActs = [...(fullTask.activities || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setActivities(sortedActs);
        setActivitiesPage(1);
        setActivitiesHasMore((fullTask.activities || []).length < (fullTask.activities_count || 0));
        setActivitiesCount(fullTask.activities_count || 0);

        // Load project statuses and members if not provided as props
        if (fullTask.project_id) {
          const projRes = await api.getProject(fullTask.project_id);
          if (projRes.success) {
            setProject(projRes.data);
            if (!initialStatuses) setStatuses(projRes.data.statuses || []);
            if (!initialMembers) setMembers(projRes.data.members || []);
            setCustomFields(projRes.data.custom_fields || []);
          }
        } else {
          // Default project info if standalone task
          if (!initialStatuses) {
            setStatuses([
              { id: 'todo', name: t('tasks.status.todo') || 'Cần làm', color: '#9ca0b0', type: 'not_started', position: 0 },
              { id: 'in_progress', name: t('tasks.status.in_progress') || 'Đang làm', color: '#3b82f6', type: 'active', position: 1 },
              { id: 'review', name: t('tasks.status.in_review') || 'Đang duyệt', color: '#a855f7', type: 'active', position: 2 },
              { id: 'done', name: t('tasks.status.done') || 'Hoàn thành', color: '#22c55e', type: 'closed', position: 3 },
            ]);
          }
          if (!initialMembers) setMembers([]);
        }
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.fetch_err'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchTaskDetails(taskId);
    }
  }, [taskId]);

  useEffect(() => {
    if (task) {
      setCommentsCount(task.comments_count || 0);
      setActivitiesCount(task.activities_count || 0);
    }
  }, [task]);

  useEffect(() => {
    if (!task?.project_id || !task?.id) return;

    const echo = getEcho();
    const channel = echo.channel(`project.${task.project_id}`);

    const handleTaskUpdated = (data: { action: string; taskData?: any }) => {
      if (!data.taskData) return;

      if (data.action === 'comment_created' && data.taskData.task_id === task.id) {
        const comment = data.taskData.comment;
        setComments(prev => {
          if (prev.some((c: any) => c.id === comment.id)) return prev;
          scrollToBottom();
          return [...prev, comment];
        });
        setCommentsCount(prev => prev + 1);
      } else if (data.action === 'updated' && data.taskData.id === task.id) {
        setTask(prev => prev ? { ...prev, ...data.taskData } : null);
        setEditTitle(data.taskData.title || '');
        setEditDescription(data.taskData.description || '');
        setEditStatus(data.taskData.status || 'todo');
        setEditPriority(data.taskData.priority || 'medium');
        setEditAssigneeId(data.taskData.assignee_id || undefined);
        setEditStartDate(data.taskData.start_date || '');
        setEditDueDate(data.taskData.due_date || '');
      }
    };

    channel.listen('.task.updated', handleTaskUpdated);

    return () => {
      channel.stopListening('.task.updated', handleTaskUpdated);
    };
  }, [task?.id, task?.project_id]);

  // Sync statuses & members if initial props change
  useEffect(() => {
    if (initialMembers) setMembers(initialMembers);
  }, [initialMembers]);

  useEffect(() => {
    if (initialStatuses) setStatuses(initialStatuses);
  }, [initialStatuses]);

  useEffect(() => {
    if (panelTab === 'comments') {
      scrollToBottom();
    } else if (panelTab === 'history') {
      scrollToBottomActivities();
    }
  }, [panelTab]);

  if (!taskId || loading || !task) {
    return (
      <>
        <div className="task-detail__backdrop" onClick={onClose} />
        <div className="task-detail__task-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      </>
    );
  }

  const hasTimeLogs = (task.time_entries || []).length > 0;

  const checkCanEditTask = () => {
    if (!me || !task) return false;
    if (me.role === 'admin') return true;

    const proj = project || task.project;
    if (proj) {
      if (proj.created_by === me.id || proj.owner_id === me.id) return true;
      const isManager = proj.members?.some(
        (m: any) => m.id === me.id && (m.pivot?.role === 'manager' || m.role === 'manager')
      );
      if (isManager) return true;

      const isMember = proj.members?.some((m: any) => m.id === me.id);
      const isOwnTask = task.creator_id === me.id || task.assignee_id === me.id;
      return !!(isMember && isOwnTask);
    }
    return task.creator_id === me.id || task.assignee_id === me.id;
  };

  const checkCanDeleteTask = () => {
    if (!me || !task) return false;
    if (me.role === 'admin') return true;
    const proj = project || task.project;
    if (proj) {
      if (proj.created_by === me.id || proj.owner_id === me.id) return true;
      const isManager = proj.members?.some(
        (m: any) => m.id === me.id && (m.pivot?.role === 'manager' || m.role === 'manager')
      );
      if (isManager) return true;
    }
    return task.creator_id === me.id;
  };

  const taskEditable = checkCanEditTask();
  const canDelete = checkCanDeleteTask();

  // Auto Save fields helper
  const autoSaveTaskField = async (fieldName: string, value: any) => {
    try {
      let startVal = editStartDate;
      let dueVal = editDueDate;
      if (fieldName === 'start_date') startVal = value;
      if (fieldName === 'due_date') dueVal = value;

      const payload: any = {
        title: fieldName === 'title' ? value : editTitle,
        description: fieldName === 'description' ? value : editDescription,
        status: fieldName === 'status' ? value : editStatus,
        priority: fieldName === 'priority' ? value : editPriority,
        assignee_id: fieldName === 'assignee_id' ? (value || null) : (editAssigneeId || null),
        start_date: startVal ? new Date(startVal).toISOString() : null,
        due_date: dueVal ? new Date(dueVal).toISOString() : null,
      };

      const res = await api.updateTask(task.id, payload);
      if (res.success) {
        setTask(prev => prev ? { ...prev, ...res.data } : null);
        onUpdate(true);
      }
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || t('tasks.detail_toast.auto_save_err'));
    }
  };

  // Watch / Unwatch Task
  const handleToggleWatch = async () => {
    try {
      const res = await api.toggleWatchTask(task.id);
      if (res.success) {
        setTask(prev => prev ? { ...prev, watcher_ids: res.data } : null);
        onUpdate(true);
        message.success(t('tasks.detail_toast.watcher_success'));
      }
    } catch {
      message.error(t('tasks.detail_toast.watcher_err'));
    }
  };

  // Delete Task
  const handleDeleteTask = () => {
    Modal.confirm({
      title: t('project_detail.confirm.delete_task'),
      content: t('project_detail.confirm.delete_task_content'),
      okText: t('tasks.action.delete'),
      okType: 'danger',
      cancelText: t('tasks.panel.cancel'),
      onOk: async () => {
        try {
          const res = await api.deleteTask(task.id);
          if (res.success) {
            message.success(t('tasks.detail_toast.delete_success'));
            onClose();
            onUpdate(true);
          }
        } catch {
          message.error(t('tasks.detail_toast.delete_err'));
        }
      }
    });
  };

  // Helper to determine final and first status IDs
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

  // Subtask Status Toggle
  const handleToggleSubtaskStatus = async (st: any) => {
    const finalStatusId = getFinalStatusId(statuses);
    const firstStatusId = getFirstStatusId(statuses);
    const isDone = st.status === finalStatusId;
    const newStatus = isDone ? firstStatusId : finalStatusId;
    try {
      const res = await api.updateTask(st.id, { status: newStatus });
      if (res.success) {
        // Reload details to get refreshed subtask tree
        const taskRes = await api.getTask(task.id);
        if (taskRes.success) {
          setTask(taskRes.data);
          onUpdate(true);
        }
      }
    } catch {
      message.error(t('tasks.detail_toast.subtask_status_err'));
    }
  };

  // Add Subtask
  const handleAddSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    try {
      const res = await api.createTask({
        title: subtaskTitle,
        parent_task_id: task.id,
        project_id: task.project_id as string | number,
        priority: subtaskPriority,
        assignee_id: subtaskAssigneeId || undefined,
        status: 'todo',
        start_date: subtaskStartDate ? new Date(subtaskStartDate).toISOString() : undefined,
        due_date: subtaskDueDate ? new Date(subtaskDueDate).toISOString() : undefined,
      });
      if (res.success) {
        message.success(t('tasks.detail_toast.subtask_create_success'));
        setSubtaskTitle('');
        setSubtaskAssigneeId(undefined);
        setSubtaskPriority('medium');
        setSubtaskStartDate('');
        setSubtaskDueDate('');
        const taskRes = await api.getTask(task.id);
        if (taskRes.success) {
          setTask(taskRes.data);
          onUpdate(true);
        }
      }
    } catch {
      message.error(t('tasks.detail_toast.subtask_create_err'));
    }
  };

  // Delete Subtask
  const handleDeleteSubtask = async (subtaskId: number) => {
    try {
      const res = await api.deleteTask(subtaskId);
      if (res.success) {
        message.success(t('tasks.detail_toast.subtask_delete_success'));
        const taskRes = await api.getTask(task.id);
        if (taskRes.success) {
          setTask(taskRes.data);
          onUpdate(true);
        }
      }
    } catch {
      message.error(t('tasks.detail_toast.subtask_delete_err'));
    }
  };

  // ==========================================
  // CLICKUP FEATURE HANDLERS
  // ==========================================

  // --- CUSTOM FIELDS ---
  const handleCreateCustomField = async () => {
    if (!task || !task.project_id) return;
    if (!newFieldName.trim()) {
      message.warning(t('tasks.detail_toast.custom_field_name_req'));
      return;
    }
    try {
      const options = newFieldType === 'dropdown'
        ? newFieldOptions.split(',').map(o => o.trim()).filter(Boolean)
        : undefined;

      const res = await api.createCustomField(task.project_id, {
        name: newFieldName,
        type: newFieldType,
        options,
      });

      if (res.success) {
        message.success(t('tasks.detail_toast.custom_field_create_success'));
        setCustomFields(prev => [...prev, res.data]);
        setNewFieldName('');
        setNewFieldOptions('');
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.custom_field_create_err'));
    }
  };

  const handleDeleteCustomField = async (fieldId: number) => {
    try {
      const res = await api.deleteCustomField(fieldId);
      if (res.success) {
        message.success(t('tasks.detail_toast.custom_field_delete_success'));
        setCustomFields(prev => prev.filter(f => f.id !== fieldId));
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.custom_field_delete_err'));
    }
  };

  const handleUpdateCustomFieldValue = async (fieldId: number, value: any) => {
    if (!task) return;
    try {
      const res = await api.updateCustomFieldValues(task.id, { [fieldId]: value });
      if (res.success) {
        // Update task state with new values
        setTask(prev => {
          if (!prev) return null;
          const updatedValues = prev.custom_field_values
            ? prev.custom_field_values.filter(v => v.custom_field_id !== fieldId)
            : [];

          // Find the updated value
          const valObj = res.data.find((v: any) => v.custom_field_id === fieldId);
          if (valObj) {
            updatedValues.push(valObj);
          }
          return {
            ...prev,
            custom_field_values: updatedValues,
          };
        });
        message.success(t('tasks.detail_toast.custom_field_save_success'));
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.custom_field_save_err'));
    }
  };

  // --- CHECKLISTS ---
  const handleQuickCreateChecklist = async () => {
    if (!task) return;
    const defaultName = t('tasks.checklist.default_name');
    try {
      const res = await api.createChecklist(task.id, defaultName);
      if (res.success) {
        message.success(t('tasks.detail_toast.checklist_create_success'));
        setTask(prev => {
          if (!prev) return null;
          return {
            ...prev,
            checklists: [...(prev.checklists || []), res.data],
          };
        });
        setEditingChecklistId(res.data.id);
        setEditingChecklistName(res.data.name || defaultName);
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.checklist_create_err'));
    }
  };

  const handleSaveChecklistName = async (checklistId: number) => {
    if (!editingChecklistName.trim()) {
      setEditingChecklistId(null);
      return;
    }
    try {
      const res = await api.updateChecklist(checklistId, editingChecklistName);
      if (res.success) {
        setTask(prev => {
          if (!prev) return null;
          return {
            ...prev,
            checklists: (prev.checklists || []).map(c =>
              c.id === checklistId ? { ...c, name: editingChecklistName } : c
            ),
          };
        });
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.checklist_save_name_err'));
    } finally {
      setEditingChecklistId(null);
    }
  };

  const handleCreateChecklist = async () => {
    if (!task) return;
    if (!newChecklistName.trim()) {
      message.warning(t('tasks.detail_toast.checklist_name_req'));
      return;
    }
    try {
      const res = await api.createChecklist(task.id, newChecklistName);
      if (res.success) {
        message.success(t('tasks.detail_toast.checklist_create_success'));
        setTask(prev => {
          if (!prev) return null;
          return {
            ...prev,
            checklists: [...(prev.checklists || []), res.data],
          };
        });
        setNewChecklistName('');
        setIsChecklistPopoverOpen(false);
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.checklist_create_err'));
    }
  };

  const handleGenerateAiChecklist = async (prompt?: string) => {
    if (!task) return;
    setAiChecklistLoading(true);
    try {
      const res = await api.generateAiChecklist(task.id, prompt);
      if (res.success) {
        message.success("Đã sinh checklist bằng AI thành công!");
        setTask(prev => {
          if (!prev) return null;
          return {
            ...prev,
            checklists: [...(prev.checklists || []), res.data],
          };
        });
        setAiPromptChecklist('');
        setIsAiChecklistPopoverOpen(false);
        setIsAiDescChecklistPopoverOpen(false);
      }
    } catch (err) {
      console.error(err);
      message.error("Có lỗi xảy ra khi tạo gợi ý checklist từ AI.");
    } finally {
      setAiChecklistLoading(false);
    }
  };



  const handleDeleteChecklist = async (checklistId: number) => {
    try {
      const res = await api.deleteChecklist(checklistId);
      if (res.success) {
        message.success(t('tasks.detail_toast.checklist_delete_success'));
        setTask(prev => {
          if (!prev) return null;
          return {
            ...prev,
            checklists: (prev.checklists || []).filter(c => c.id !== checklistId),
          };
        });
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.checklist_delete_err'));
    }
  };

  const handleCreateChecklistItem = async (checklistId: number, itemName: string, assigneeId?: number) => {
    if (!itemName.trim()) return;
    try {
      const res = await api.createChecklistItem(checklistId, itemName, assigneeId);
      if (res.success) {
        message.success(t('tasks.detail_toast.checklist_item_create_success'));
        setTask(prev => {
          if (!prev) return null;
          const updatedChecklists = (prev.checklists || []).map(c => {
            if (c.id === checklistId) {
              return {
                ...c,
                items: [...(c.items || []), res.data],
              };
            }
            return c;
          });
          return {
            ...prev,
            checklists: updatedChecklists,
          };
        });
        setNewItemNames(prev => ({ ...prev, [checklistId]: '' }));
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.checklist_item_create_err'));
    }
  };

  const handleUpdateChecklistItem = async (itemId: number, checklistId: number, data: { name?: string; is_checked?: boolean; assignee_id?: number | null }) => {
    try {
      const res = await api.updateChecklistItem(itemId, data);
      if (res.success) {
        setTask(prev => {
          if (!prev) return null;
          const updatedChecklists = (prev.checklists || []).map((c: any) => {
            if (c.id === checklistId) {
              return {
                ...c,
                items: (c.items || []).map((item: any) => item.id === itemId ? res.data : item),
              };
            }
            return c;
          });
          return {
            ...prev,
            checklists: updatedChecklists,
          };
        });
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.checklist_item_update_err'));
    }
  };

  const handleDeleteChecklistItem = async (itemId: number, checklistId: number) => {
    try {
      const res = await api.deleteChecklistItem(itemId);
      if (res.success) {
        message.success(t('tasks.detail_toast.checklist_item_delete_success'));
        setTask(prev => {
          if (!prev) return null;
          const updatedChecklists = (prev.checklists || []).map((c: any) => {
            if (c.id === checklistId) {
              return {
                ...c,
                items: (c.items || []).filter((item: any) => item.id !== itemId),
              };
            }
            return c;
          });
          return {
            ...prev,
            checklists: updatedChecklists,
          };
        });
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.checklist_item_delete_err'));
    }
  };

  const handleConvertChecklistItem = async (itemId: number, checklistId: number, type: 'task' | 'subtask') => {
    if (type === 'task') {
      const checklist = task?.checklists?.find((c: any) => c.id === checklistId);
      const item = checklist?.items?.find((i: any) => i.id === itemId);
      const itemName = item ? item.name : '';

      window.dispatchEvent(new CustomEvent('open-create-task-modal', {
        detail: {
          title: itemName,
          projectId: task?.project_id,
          checklistId: checklistId,
          checklistItemId: itemId,
          onSuccess: () => {
            setTask(prev => {
              if (!prev) return null;
              const updatedChecklists = (prev.checklists || []).map((c: any) => {
                if (c.id === checklistId) {
                  return {
                    ...c,
                    items: (c.items || []).filter((it: any) => it.id !== itemId),
                  };
                }
                return c;
              });
              return {
                ...prev,
                checklists: updatedChecklists,
              };
            });
            onUpdate();
            if (task) {
              fetchTaskDetails(task.id);
            }
          }
        }
      }));
      return;
    }

    try {
      const res = await api.convertChecklistItem(itemId, type);
      if (res.success) {
        message.success(t('tasks.detail_toast.checklist_item_convert_success'));
        // Remove item from UI
        setTask(prev => {
          if (!prev) return null;
          const updatedChecklists = (prev.checklists || []).map((c: any) => {
            if (c.id === checklistId) {
              return {
                ...c,
                items: (c.items || []).filter((item: any) => item.id !== itemId),
              };
            }
            return c;
          });
          return {
            ...prev,
            checklists: updatedChecklists,
          };
        });
        // Trigger generic page reload/updates
        onUpdate();
        if (task) {
          fetchTaskDetails(task.id);
        }
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.checklist_item_convert_err'));
    }
  };

  // --- ATTACHMENTS ---
  const handleUploadAttachment = async (file: File) => {
    if (!task) return;
    try {
      const res = await api.uploadAttachment(task.id, file);
      if (res.success) {
        message.success(t('tasks.detail_toast.attachment_upload_success'));
        setTask(prev => {
          if (!prev) return null;
          return {
            ...prev,
            attachments: [...(prev.attachments || []), res.data],
          };
        });
        // Refresh activities/comments to show the log
        api.getTask(task.id).then(r => {
          if (r.success) {
            setTask(r.data);
          }
        });
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.attachment_upload_err'));
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      const res = await api.deleteAttachment(attachmentId);
      if (res.success) {
        message.success(t('tasks.detail_toast.attachment_delete_success'));
        setTask(prev => {
          if (!prev) return null;
          return {
            ...prev,
            attachments: (prev.attachments || []).filter(a => a.id !== attachmentId),
          };
        });
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.attachment_delete_err'));
    }
  };

  // Comments loading & scroll handlers
  const loadMoreComments = async () => {
    if (commentsLoading || !commentsHasMore) return;
    const container = commentsListRef.current;
    const oldScrollHeight = container ? container.scrollHeight : 0;
    const oldScrollTop = container ? container.scrollTop : 0;

    setCommentsLoading(true);
    try {
      const nextPage = commentsPage + 1;
      const res = await api.getTaskComments(task.id, nextPage);
      if (res.success) {
        setComments(prev => [...prev, ...res.data]);
        setCommentsPage(nextPage);
        setCommentsHasMore(res.pagination?.has_more || false);
        if (res.pagination && typeof res.pagination.total === 'number') {
          setCommentsCount(res.pagination.total);
        }

        // Preserve scroll position relative to the bottom
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
          }
        }, 50);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleScrollComments = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // When scroll top is near 0, load older comments
    if (el.scrollTop < 20) {
      loadMoreComments();
    }
  };

  const loadMoreActivities = async () => {
    if (activitiesLoading || !activitiesHasMore) return;
    const container = activitiesListRef.current;
    const oldScrollHeight = container ? container.scrollHeight : 0;
    const oldScrollTop = container ? container.scrollTop : 0;

    setActivitiesLoading(true);
    try {
      const nextPage = activitiesPage + 1;
      const res = await api.getTaskActivities(task.id, nextPage);
      if (res.success) {
        setActivities(prev => [...prev, ...res.data]);
        setActivitiesPage(nextPage);
        setActivitiesHasMore(res.pagination?.has_more || false);
        if (res.pagination && typeof res.pagination.total === 'number') {
          setActivitiesCount(res.pagination.total);
        }

        // Preserve scroll position relative to the bottom
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
          }
        }, 50);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const handleScrollActivities = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // When scroll top is near 0, load older activities
    if (el.scrollTop < 20) {
      loadMoreActivities();
    }
  };

  // Post Comment
  const handlePostComment = async () => {
    if (!newCommentText.trim() && !newCommentFile) return;
    try {
      const res = await api.createTaskComment(task.id, newCommentText, newCommentFile || undefined);
      if (res.success) {
        message.success(t('project_detail.toast.comment_sent'));
        setNewCommentText('');
        setNewCommentFile(null);
        setCommentFilePreview(null);
        const taskRes = await api.getTask(task.id);
        if (taskRes.success) {
          setTask(taskRes.data);
          setComments(taskRes.data.comments || []);
          const sortedActs = [...(taskRes.data.activities || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setActivities(sortedActs);
          scrollToBottom();
        }
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.comment_err'));
    }
  };

  // Post Reply to Comment
  const handlePostReply = async (parentCommentId: number) => {
    if (!replyText.trim()) return;
    try {
      const res = await api.createTaskComment(task.id, replyText, replyFile || undefined, parentCommentId);
      if (res.success) {
        message.success(t('project_detail.toast.comment_sent'));
        setReplyText('');
        setReplyFile(null);
        setReplyFilePreview(null);
        setReplyingToCommentId(null);
        setReplyingToSubCommentId(null);
        setExpandedCommentIds(prev => ({ ...prev, [parentCommentId]: true }));

        const taskRes = await api.getTask(task.id);
        if (taskRes.success) {
          setTask(taskRes.data);
          setComments(taskRes.data.comments || []);
          const sortedActs = [...(taskRes.data.activities || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setActivities(sortedActs);
          scrollToBottom();
        }
      }
    } catch (err) {
      console.error(err);
      message.error(t('tasks.detail_toast.reply_err'));
    }
  };

  const toggleExpandReplies = (commentId: number) => {
    setExpandedCommentIds(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
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
      console.error(err);
    }
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
      case 'like': return t('tasks.reaction.like' as any) || 'Thích';
      case 'love': return t('tasks.reaction.love' as any) || 'Yêu thích';
      case 'haha': return t('tasks.reaction.haha' as any) || 'Haha';
      case 'wow': return t('tasks.reaction.wow' as any) || 'Wow';
      case 'sad': return t('tasks.reaction.sad' as any) || 'Buồn';
      case 'angry': return t('tasks.reaction.angry' as any) || 'Phẫn nộ';
      default: return t('tasks.reaction.like' as any) || 'Thích';
    }
  };

  // Mention functions
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
        const matches = members.filter((m: any) =>
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

  const renderReplyForm = (commentId: number, isSubComment = false) => {
    return (
      <div style={{ marginLeft: isSubComment ? '34px' : '42px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(120,120,120,0.04)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <textarea
            id={`reply-textarea-${commentId}`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={t('tasks.panel.reply_placeholder' as any)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontSize: '13px', minHeight: '60px' }}
          />
        </div>

        {replyFilePreview && (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            <img src={replyFilePreview} alt="upload preview" style={{ maxWidth: '100px', maxHeight: '80px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
            <button onClick={() => { setReplyFile(null); setReplyFilePreview(null); }} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>×</button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="file"
              id={`reply-file-upload-${commentId}`}
              style={{ display: 'none' }}
              onChange={(e) => handleReplyFileChange(e.target.files ? e.target.files[0] : null)}
            />
            <Popover
              trigger="click"
              content={
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column' }}>
                  {/* Categories */}
                  <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '8px', justifyContent: 'space-between' }}>
                    {EMOJI_CATEGORIES.map((cat, idx) => (
                      <span
                        key={cat.name}
                        onClick={() => setActiveReplyEmojiCat(idx)}
                        style={{
                          fontSize: '18px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: activeReplyEmojiCat === idx ? 'rgba(99,102,241,0.1)' : 'transparent',
                          borderBottom: activeReplyEmojiCat === idx ? '2px solid #6366f1' : 'none'
                        }}
                        title={cat.name}
                      >
                        {cat.icon}
                      </span>
                    ))}
                  </div>
                  {/* Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
                    {EMOJI_CATEGORIES[activeReplyEmojiCat].emojis.map(emoji => (
                      <span
                        key={emoji}
                        onClick={() => insertEmojiToReply(emoji)}
                        style={{ fontSize: '20px', cursor: 'pointer', textAlign: 'center', transition: 'transform 0.1s' }}
                        className="emoji-item"
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>
                </div>
              }
            >
              <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }}><SmileOutlined style={{ fontSize: '14px' }} /></span>
            </Popover>
            <Tooltip title={t('tasks.panel.attach_file_tooltip' as any)}>
              <label htmlFor={`reply-file-upload-${commentId}`} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>
                <PaperClipOutlined style={{ fontSize: '14px' }} />
              </label>
            </Tooltip>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <Button size="small" onClick={() => { setReplyingToCommentId(null); setReplyingToSubCommentId(null); }}>{t('tasks.panel.cancel_btn' as any)}</Button>
            <Button size="small" type="primary" onClick={() => handlePostReply(commentId)} disabled={!replyText.trim()}>{t('tasks.panel.send_btn' as any)}</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="task-detail__backdrop" onClick={onClose} />
      <div className="task-detail__task-panel" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Panel Header */}
        <div className="task-detail__panel-header">
          <div className="task-detail__panel-header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
            <span className="task-id">#{task.id}</span>

            {/* Watchers section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '24px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('tasks.panel.watchers_count', { count: task.watcher_ids?.length || 0 })}
              </span>

              <Button
                type={me?.id && task.watcher_ids?.includes(me.id) ? "primary" : "default"}
                size="small"
                style={{ fontSize: '12px', height: '24px', padding: '0 8px', display: 'flex', alignItems: 'center' }}
                icon={me?.id && task.watcher_ids?.includes(me.id) ? <EyeInvisibleOutlined style={{ fontSize: '12px' }} /> : <EyeOutlined style={{ fontSize: '12px' }} />}
                onClick={handleToggleWatch}
              >
                {me?.id && task.watcher_ids?.includes(me.id) ? t('tasks.panel.unwatch') : t('tasks.panel.watch')}
              </Button>

              {task.watcher_ids && task.watcher_ids.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {task.watcher_ids.map((uid: number) => {
                    const member = members.find((m: any) => m.id === uid);
                    if (!member) return null;
                    return (
                      <Tooltip title={member.name} key={uid}>
                        <div style={{ background: '#6366f1', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '10px', fontWeight: 600, overflow: 'hidden' }}>
                          {member.photo ? (
                            <img src={member.photo} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            getInitials(member.name)
                          )}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="task-detail__panel-header-right">
            {canDelete && (
              <Tooltip title={t('tasks.panel.delete_task')}>
                <button className="panel-btn" onClick={handleDeleteTask}>
                  <DeleteOutlined style={{ color: '#ef4444' }} />
                </button>
              </Tooltip>
            )}
            <button className="panel-btn" onClick={onClose}><CloseOutlined /></button>
          </div>
        </div>

        {/* Panel Body */}
        <div className="task-detail__panel-body">

          {/* Left Column: Properties Grid, Description, Subtasks */}
          <div className="task-detail__panel-content">
            {/* Breadcrumb / Location */}
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>{task.project?.name || task.project?.title || t('tasks.no_project' as any) || 'Không có dự án'}</span>
              {task.parentTask && (
                <>
                  <span>/</span>
                  <span
                    onClick={() => fetchTaskDetails(task.parent_task_id!)}
                    style={{
                      cursor: 'pointer',
                      color: 'var(--primary)',
                      textDecoration: 'underline',
                      fontWeight: 500
                    }}
                    title={t('tasks.panel.parent_task_tooltip' as any) || 'Quay lại công việc cha'}
                  >
                    {task.parentTask.title}
                  </span>
                </>
              )}
              <span>/</span>
              <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{t('tasks.panel.task_id_label' as any, { id: task.id })}</span>
            </div>

            {/* Title Input */}
            <input
              className="task-title-input"
              value={editTitle}
              disabled={!taskEditable}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                width: '100%',
                padding: '4px 0',
              }}
              onFocus={(e) => {
                if (taskEditable) e.target.style.borderBottom = '1px solid var(--primary)';
              }}
              onBlur={(e) => {
                e.target.style.borderBottom = '1px solid transparent';
                if (taskEditable && editTitle !== task.title) {
                  autoSaveTaskField('title', editTitle);
                }
              }}
            />

            {/* Properties Grid - 2 Column Layout (ưu tiên giao diện 2 cột như hình 1) */}
            <div className="properties-grid">

              {/* 1. Trạng thái */}
              <div className="property-field">
                <span className="field-label">
                  <CheckCircleOutlined style={{ fontSize: '14px', color: 'var(--text-muted)' }} /> {t('tasks.panel.status')}
                </span>
                <div style={{ marginTop: '4px' }}>
                  <ClickUpStatusPicker
                    currentStatusId={editStatus}
                    projectStatuses={statuses}
                    disabled={!taskEditable}
                    onChange={(val) => {
                      setEditStatus(val);
                      autoSaveTaskField('status', val);
                    }}
                  />
                </div>
              </div>

              {/* 2. Người thực hiện */}
              <div className="property-field">
                <span className="field-label">
                  <UserOutlined style={{ fontSize: '14px', color: 'var(--text-muted)' }} /> {t('tasks.panel.assignee')}
                </span>
                <div className="field-value" style={{ marginTop: '5px' }}>
                  <Dropdown
                    disabled={!taskEditable}
                    trigger={['click']}
                    dropdownRender={() => (
                      <div style={{ background: 'var(--bg-card, #1e1e1e)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.25)', minWidth: '200px' }} className="assignee-dropdown-container">
                        <div style={{ fontSize: '11px', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('tasks.panel.assignee')}</div>
                        <div
                          onClick={() => {
                            setEditAssigneeId(undefined);
                            autoSaveTaskField('assignee_id', null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            background: !editAssigneeId ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                            color: !editAssigneeId ? '#6366f1' : 'var(--text-primary)',
                          }}
                          className="status-item-hover"
                        >
                          <UserOutlined style={{ fontSize: '12px' }} />
                          <span style={{ fontSize: '12px' }}>{t('tasks.panel.assignee_placeholder')}</span>
                        </div>
                        {members.map((m: any) => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setEditAssigneeId(m.id);
                              autoSaveTaskField('assignee_id', m.id);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderRadius: '6px',
                              background: m.id === editAssigneeId ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                              color: m.id === editAssigneeId ? '#6366f1' : 'var(--text-primary)',
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
                    <div style={{ cursor: !taskEditable ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                      {editAssigneeId ? (
                        (() => {
                          const currentAssignee = members.find((m: any) => m.id === editAssigneeId) || task.assignee;
                          if (!currentAssignee) {
                            return (
                              <Tooltip title={t('tasks.panel.assignee_placeholder')}>
                                <div style={{ width: '22px', height: '22px', border: '1px dashed var(--text-muted, #9ca0b0)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
                                  <UserOutlined style={{ color: 'var(--text-muted, #9ca0b0)', fontSize: '10px' }} />
                                </div>
                              </Tooltip>
                            );
                          }
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
                <div style={{ marginTop: '4px' }}>
                  <PriorityPicker
                    value={editPriority}
                    disabled={!taskEditable}
                    onChange={(val) => {
                      setEditPriority(val);
                      autoSaveTaskField('priority', val);
                    }}
                  />
                </div>
              </div>

              {/* 4. Ước tính */}
              <div className="property-field">
                <span className="field-label">
                  <DashboardOutlined style={{ fontSize: '14px', color: 'var(--text-muted)' }} /> {t('tasks.panel.estimate')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '30px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {formatEstimate(t, editStartDate, editDueDate)}
                  </span>
                  <Tooltip title={t('tasks.panel.estimate_tooltip')}>
                    <InfoCircleOutlined style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '4px' }} />
                  </Tooltip>
                </div>
              </div>

              {/* 5. Thời gian (start_date to due_date) */}
              <div className="property-field">
                <span className="field-label">
                  <CalendarOutlined style={{ fontSize: '14px', color: 'var(--text-muted)' }} /> {t('tasks.panel.time')}
                  {hasTimeLogs && (
                    <Tooltip title={t('tasks.panel.lock_time_tooltip')}>
                      <LockOutlined style={{ fontSize: '11px', color: '#ef4444', marginLeft: '4px' }} />
                    </Tooltip>
                  )}
                </span>
                <div className="field-value">
                  <div className="premium-date-picker-group">
                    <DatePicker
                      showTime
                      format="DD/MM/YYYY HH:mm"
                      placeholder={t('tasks.panel.start_date_placeholder')}
                      value={editStartDate ? dayjs(editStartDate) : null}
                      disabled={!taskEditable || hasTimeLogs}
                      onChange={(date) => {
                        const val = date ? date.toISOString() : '';
                        setEditStartDate(val);
                        autoSaveTaskField('start_date', val);
                      }}
                      className="premium-date-picker"
                      bordered={false}
                    />
                    <span className="date-arrow">→</span>
                    <DatePicker
                      showTime
                      format="DD/MM/YYYY HH:mm"
                      placeholder={t('tasks.panel.due_date_placeholder')}
                      value={editDueDate ? dayjs(editDueDate) : null}
                      disabled={!taskEditable || hasTimeLogs}
                      onChange={(date) => {
                        const val = date ? date.toISOString() : '';
                        setEditDueDate(val);
                        autoSaveTaskField('due_date', val);
                      }}
                      className="premium-date-picker"
                      bordered={false}
                    />
                  </div>
                </div>
              </div>

              {/* 6. Theo dõi thời gian */}
              <div className="property-field">
                <span className="field-label">
                  <ClockCircleOutlined style={{ fontSize: '14px', color: 'var(--text-muted)' }} /> {t('tasks.panel.time_tracking')}
                </span>
                <div style={{ marginTop: '4px' }}>
                  {(!editStartDate || !editDueDate) ? (
                    <Tooltip title={t('tasks.panel.time_tracking_tooltip')}>
                      <div style={{ display: 'inline-block', opacity: 0.5, cursor: 'not-allowed' }}>
                        <div style={{ pointerEvents: 'none' }}>
                          <TimeTracker
                            taskId={task.id}
                            timeEntries={task.time_entries || []}
                            disabled={true}
                            onUpdate={() => { }}
                          />
                        </div>
                      </div>
                    </Tooltip>
                  ) : (
                    <TimeTracker
                      taskId={task.id}
                      timeEntries={task.time_entries || []}
                      disabled={!taskEditable}
                      onUpdate={async () => {
                        const res = await api.getTask(task.id);
                        if (res.success) {
                          setTask(res.data);
                          onUpdate(true);
                        }
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Custom Fields defined in Project */}
              {customFields.map((field) => {
                const valueObj = task.custom_field_values?.find(
                  (v: any) => v.custom_field_id === field.id
                );
                const rawValue = valueObj ? valueObj.value : '';

                // Handle Checkbox parsing
                const isChecked = field.type === 'checkbox' ? rawValue === '1' || rawValue === 'true' : false;

                return (
                  <div key={field.id} className="property-field custom-field-item">
                    <span className="field-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <InfoCircleOutlined style={{ fontSize: '13px', color: 'var(--text-muted)' }} /> {field.name}
                      </span>
                      <Popconfirm
                        title={t('tasks.panel.delete_field_confirm' as any) || 'Bạn có chắc chắn muốn xóa trường này khỏi dự án?'}
                        onConfirm={() => handleDeleteCustomField(field.id)}
                        okText={t('tasks.panel.ok_yes' as any) || 'Có'}
                        cancelText={t('tasks.panel.cancel_no' as any) || 'Không'}
                      >
                        <DeleteOutlined style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }} className="delete-field-btn" />
                      </Popconfirm>
                    </span>

                    <div style={{ marginTop: '4px' }}>
                      {field.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleUpdateCustomFieldValue(field.id, e.target.checked ? 'true' : 'false')}
                          style={{ cursor: 'pointer' }}
                        />
                      ) : field.type === 'dropdown' ? (
                        <Select
                          variant="borderless"
                          style={{ width: '100%', padding: 0 }}
                          value={rawValue || undefined}
                          placeholder={t('tasks.panel.select_value_placeholder' as any) || 'Chọn giá trị'}
                          allowClear
                          onChange={(val) => handleUpdateCustomFieldValue(field.id, val || '')}
                        >
                          {(field.options || []).map((opt: string) => (
                            <Select.Option key={opt} value={opt}>
                              {opt}
                            </Select.Option>
                          ))}
                        </Select>
                      ) : field.type === 'date' ? (
                        <input
                          type="date"
                          value={rawValue || ''}
                          onChange={(e) => handleUpdateCustomFieldValue(field.id, e.target.value)}
                          style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '12px', padding: '4px 6px', borderRadius: '4px', width: '100%', maxWidth: '160px' }}
                        />
                      ) : field.type === 'number' ? (
                        <input
                          type="number"
                          value={rawValue || ''}
                          onChange={(e) => handleUpdateCustomFieldValue(field.id, e.target.value)}
                          placeholder={t('tasks.panel.input_number_placeholder' as any) || 'Nhập số...'}
                          style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px dashed var(--border-color)', outline: 'none', fontSize: '13px', width: '100%' }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={rawValue || ''}
                          onBlur={(e) => handleUpdateCustomFieldValue(field.id, e.target.value)}
                          placeholder={t('tasks.panel.empty_value_placeholder' as any) || 'Chưa nhập...'}
                          style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px dashed var(--border-color)', outline: 'none', fontSize: '13px', width: '100%' }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Custom Field Popover Button (Tạm thời comment lại theo yêu cầu người dùng)
              {taskEditable && (
                <Popover
                  trigger="click"
                  placement="bottomLeft"
                  content={
                    <div style={{ padding: '8px', width: '260px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{t('tasks.custom_field.create_title')}</span>
                      <Input
                        placeholder={t('tasks.custom_field.name_placeholder')}
                        value={newFieldName}
                        onChange={e => setNewFieldName(e.target.value)}
                        size="small"
                      />
                      <Select
                        placeholder={t('tasks.custom_field.type_placeholder')}
                        value={newFieldType}
                        onChange={val => setNewFieldType(val)}
                        size="small"
                        style={{ width: '100%' }}
                      >
                        <Select.Option value="text">{t('tasks.custom_field.type_text')}</Select.Option>
                        <Select.Option value="textarea">{t('tasks.custom_field.type_textarea')}</Select.Option>
                        <Select.Option value="number">{t('tasks.custom_field.type_number')}</Select.Option>
                        <Select.Option value="dropdown">{t('tasks.custom_field.type_dropdown')}</Select.Option>
                        <Select.Option value="checkbox">{t('tasks.custom_field.type_checkbox')}</Select.Option>
                        <Select.Option value="date">{t('tasks.custom_field.type_date')}</Select.Option>
                        <Select.Option value="money">{t('tasks.custom_field.type_money')}</Select.Option>
                        <Select.Option value="website">Website</Select.Option>
                        <Select.Option value="email">Email</Select.Option>
                        <Select.Option value="phone">{t('tasks.custom_field.type_phone')}</Select.Option>
                      </Select>
                      {newFieldType === 'dropdown' && (
                        <Input
                          placeholder={t('tasks.custom_field.options_placeholder')}
                          value={newFieldOptions}
                          onChange={e => setNewFieldOptions(e.target.value)}
                          size="small"
                        />
                      )}
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={handleCreateCustomField}
                      >
                        {t('tasks.custom_field.create_btn')}
                      </Button>
                    </div>
                  }
                >
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    style={{ gridColumn: 'span 2', alignSelf: 'start', marginTop: '8px' }}
                  >
                    {t('tasks.custom_field.add_custom_field')}
                  </Button>
                </Popover>
              )}
              */}

            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('tasks.panel.description' as any) || "Mô tả công việc"}</span>
              <textarea
                className="task-description-textarea"
                placeholder={t('tasks.panel.desc_placeholder' as any) || "Thêm mô tả công việc..."}
                value={editDescription}
                disabled={!taskEditable}
                onChange={(e) => setEditDescription(e.target.value)}
                onBlur={() => {
                  if (taskEditable && editDescription !== task.description) {
                    autoSaveTaskField('description', editDescription);
                  }
                }}
              />
              {taskEditable && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Popover
                    open={isAiDescChecklistPopoverOpen}
                    onOpenChange={setIsAiDescChecklistPopoverOpen}
                    content={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '250px' }}>
                        <span style={{ fontWeight: 500, fontSize: '12px' }}>Gợi ý checklist bằng AI</span>
                        <Input.TextArea
                          placeholder="Nhập yêu cầu gợi ý (ví dụ: checklist cho test API, checklist code review...)"
                          rows={3}
                          value={aiPromptChecklist}
                          onChange={(e) => setAiPromptChecklist(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'end', gap: '8px' }}>
                          <Button size="small" onClick={() => { setAiPromptChecklist(''); setIsAiDescChecklistPopoverOpen(false); }}>Hủy</Button>
                          <Button
                            type="primary"
                            size="small"
                            loading={aiChecklistLoading}
                            onClick={() => handleGenerateAiChecklist(aiPromptChecklist)}
                          >
                            Tạo
                          </Button>
                        </div>
                      </div>
                    }
                    title={null}
                    trigger="click"
                  >
                    <Button
                      type="default"
                      size="small"
                      icon={<RobotOutlined />}
                      style={{ color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
                      loading={aiChecklistLoading}
                    >
                      Gợi ý checklist từ AI
                    </Button>
                  </Popover>
                </div>
              )}
            </div>

            {/* Subtasks Section */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t('tasks.panel.subtasks_count' as any, { count: task.subtasks?.length || 0 })}
                </span>
              </div>

              {/* Progress Bar */}
              {task.subtasks && task.subtasks.length > 0 && (() => {
                const subtasks = task.subtasks || [];
                const totalSubtasks = subtasks.length;
                const finalStatusId = getFinalStatusId(statuses);
                const completedSubtasks = subtasks.filter((st: any) => st.status === finalStatusId).length;
                const percent = Math.round((completedSubtasks / totalSubtasks) * 100);
                return (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>{t('tasks.panel.progress_label' as any) || "Tiến độ hoàn thành"}</span>
                      <span>{completedSubtasks}/{totalSubtasks} ({percent}%)</span>
                    </div>
                    <div style={{ background: 'var(--border-color)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ background: '#10b981', height: '100%', width: `${percent}%`, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                );
              })()}

              {/* List of Subtasks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {task.subtasks?.map((st: any) => {
                  const finalStatusId = getFinalStatusId(statuses);
                  const isDone = st.status === finalStatusId;
                  return (
                    <div
                      key={st.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg-card-hover)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        transition: 'all 0.2s ease',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={isDone}
                          disabled={!taskEditable}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => handleToggleSubtaskStatus(st)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#10b981', flexShrink: 0 }}
                        />
                        <SubtaskTitleInput
                          subtask={st}
                          disabled={!taskEditable}
                          onUpdate={async () => {
                            const taskRes = await api.getTask(task.id);
                            if (taskRes.success) {
                              setTask(taskRes.data);
                              onUpdate(true);
                            }
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        <div style={{ width: '90px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
                          <SubtaskDatePicker
                            subtask={st}
                            disabled={!taskEditable}
                            onUpdate={async () => {
                              const taskRes = await api.getTask(task.id);
                              if (taskRes.success) {
                                setTask(taskRes.data);
                                onUpdate(true);
                              }
                            }}
                          />
                        </div>

                        <div style={{ width: '81px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                          <SubtaskPriorityPicker
                            subtask={st}
                            disabled={!taskEditable}
                            onUpdate={async () => {
                              const taskRes = await api.getTask(task.id);
                              if (taskRes.success) {
                                setTask(taskRes.data);
                                onUpdate(true);
                              }
                            }}
                          />
                        </div>

                        <div style={{ width: '28px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                          <SubtaskAssigneePicker
                            subtask={st}
                            members={members || []}
                            disabled={!taskEditable}
                            onUpdate={async () => {
                              const taskRes = await api.getTask(task.id);
                              if (taskRes.success) {
                                setTask(taskRes.data);
                                onUpdate(true);
                              }
                            }}
                          />
                        </div>

                        <div style={{ width: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                          <Tooltip title={t('tasks.panel.view_details' as any) || "Xem chi tiết"}>
                            <Button
                              type="text"
                              size="small"
                              icon={<ArrowRightOutlined style={{ color: 'var(--primary)', fontSize: '12px' }} />}
                              onClick={() => fetchTaskDetails(st.id)}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', padding: 0 }}
                            />
                          </Tooltip>
                        </div>

                        <div style={{ width: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                          {taskEditable ? (
                            <Popconfirm
                              title={t('tasks.panel.delete_subtask_confirm' as any) || "Xóa công việc con này?"}
                              onConfirm={() => handleDeleteSubtask(st.id)}
                              okText={t('tasks.panel.delete_btn' as any) || "Xóa"}
                              cancelText={t('tasks.panel.cancel_btn' as any) || "Hủy"}
                              okButtonProps={{ danger: true }}
                            >
                              <Tooltip title={t('tasks.panel.delete_subtask' as any) || "Xóa công việc con"}>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<DeleteOutlined style={{ color: '#ef4444', fontSize: '12px' }} />}
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', padding: 0 }}
                                />
                              </Tooltip>
                            </Popconfirm>
                          ) : (
                            <div style={{ width: '24px' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inline Subtask Creator */}
              {taskEditable && (
                <div
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    background: 'rgba(120, 120, 120, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '12px',
                  }}
                  className="subtask-inline-creator-bar"
                >
                  <Tooltip title={t('tasks.panel.status_todo_tooltip' as any) || "Trạng thái: Cần làm"}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px dashed var(--text-muted)', cursor: 'pointer', flexShrink: 0 }} />
                  </Tooltip>

                  <input
                    type="text"
                    placeholder={t('tasks.panel.add_subtask_placeholder' as any) || "Thêm công việc con..."}
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddSubtask();
                      }
                    }}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <Dropdown
                      trigger={['click']}
                      dropdownRender={() => (
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '180px' }}>
                          <div style={{ fontSize: '11px', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('tasks.panel.assignee')}</div>
                          {members.map((m: any) => (
                            <div
                              key={m.id}
                              onClick={() => setSubtaskAssigneeId(m.id === subtaskAssigneeId ? undefined : m.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                background: m.id === subtaskAssigneeId ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                color: m.id === subtaskAssigneeId ? '#6366f1' : 'var(--text-primary)',
                              }}
                            >
                              <div style={{ background: '#6366f1', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '9px', fontWeight: 600, overflow: 'hidden' }}>
                                {m.photo ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.name)}
                              </div>
                              <span style={{ fontSize: '12px' }}>{m.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    >
                      <div style={{ cursor: 'pointer', padding: '4px', borderRadius: '4px', background: subtaskAssigneeId ? 'rgba(99, 102, 241, 0.1)' : 'transparent', display: 'flex', alignItems: 'center' }}>
                        {subtaskAssigneeId ? (
                          (() => {
                            const assignedMember = members.find((m: any) => m.id === subtaskAssigneeId);
                            return assignedMember ? (
                              <Tooltip title={assignedMember.name}>
                                <div style={{ background: '#6366f1', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '9px', fontWeight: 600, overflow: 'hidden' }}>
                                  {assignedMember.photo ? <img src={assignedMember.photo} alt={assignedMember.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(assignedMember.name)}
                                </div>
                              </Tooltip>
                            ) : <UserOutlined style={{ color: 'var(--text-muted)' }} />;
                          })()
                        ) : (
                          <Tooltip title={t('tasks.panel.assign_tooltip' as any) || "Giao việc"}><UserOutlined style={{ color: 'var(--text-muted)' }} /></Tooltip>
                        )}
                      </div>
                    </Dropdown>

                    <Dropdown
                      trigger={['click']}
                      dropdownRender={() => (
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '120px' }}>
                          <div style={{ fontSize: '11px', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('tasks.panel.priority')}</div>
                          {['high', 'medium', 'low'].map((prio) => (
                            <div
                              key={prio}
                              onClick={() => setSubtaskPriority(prio as any)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                background: prio === subtaskPriority ? 'rgba(120, 120, 120, 0.08)' : 'transparent',
                                color: prio === 'high' ? '#ef4444' : prio === 'medium' ? '#f59e0b' : '#3b82f6',
                                fontWeight: 600,
                                fontSize: '12px',
                              }}
                            >
                              <FlagOutlined />
                              <span>{t(`tasks.priority.${prio}` as any)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    >
                      <div style={{ cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
                        <Tooltip title={t('tasks.panel.priority')}>
                          <FlagOutlined
                            style={{
                              color: subtaskPriority === 'high' ? '#ef4444' : subtaskPriority === 'medium' ? '#f59e0b' : subtaskPriority === 'low' ? '#3b82f6' : 'var(--text-muted)',
                            }}
                          />
                        </Tooltip>
                      </div>
                    </Dropdown>

                    <Dropdown
                      trigger={['click']}
                      dropdownRender={() => (
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('tasks.panel.time_tooltip' as any) || 'Thời gian thực hiện'}</div>
                          <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('tasks.panel.start_date_placeholder')}</label>
                            <input
                              type="datetime-local"
                              value={subtaskStartDate}
                              onChange={e => setSubtaskStartDate(e.target.value)}
                              style={{ width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '12px', padding: '4px 8px', borderRadius: '4px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('tasks.panel.due_date_placeholder')}</label>
                            <input
                              type="datetime-local"
                              value={subtaskDueDate}
                              onChange={e => setSubtaskDueDate(e.target.value)}
                              style={{ width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '12px', padding: '4px 8px', borderRadius: '4px' }}
                            />
                          </div>
                          {(subtaskStartDate || subtaskDueDate) && (
                            <Button
                              size="small"
                              danger
                              style={{ fontSize: '10px', marginTop: '4px' }}
                              onClick={() => {
                                setSubtaskStartDate('');
                                setSubtaskDueDate('');
                              }}
                            >
                              {t('tasks.subtask.clear_time' as any) || "Xóa thời gian"}
                            </Button>
                          )}
                        </div>
                      )}
                    >
                      <div style={{ cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', background: (subtaskStartDate || subtaskDueDate) ? 'rgba(99, 102, 241, 0.1)' : 'transparent' }}>
                        <Tooltip title={(subtaskStartDate || subtaskDueDate) ? `${t('tasks.panel.time_tooltip' as any) || 'Thời gian'}: ${subtaskStartDate ? new Date(subtaskStartDate).toLocaleDateString() : ''} - ${subtaskDueDate ? new Date(subtaskDueDate).toLocaleDateString() : ''}` : (t('tasks.panel.time_tooltip' as any) || 'Thời gian thực hiện')}>
                          <CalendarOutlined
                            style={{
                              color: (subtaskStartDate || subtaskDueDate) ? '#6366f1' : 'var(--text-muted)',
                            }}
                          />
                        </Tooltip>
                      </div>
                    </Dropdown>

                    <span style={{ color: 'var(--border-color)' }}>|</span>

                    <button
                      type="button"
                      onClick={() => {
                        setSubtaskTitle('');
                        setSubtaskAssigneeId(undefined);
                        setSubtaskPriority('medium');
                        setSubtaskStartDate('');
                        setSubtaskDueDate('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '2px 6px',
                      }}
                    >
                      {t('tasks.panel.cancel_btn' as any) || 'Hủy'}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      disabled={!subtaskTitle.trim()}
                      style={{
                        background: subtaskTitle.trim() ? 'var(--primary)' : 'rgba(120, 120, 120, 0.1)',
                        color: subtaskTitle.trim() ? '#fff' : 'var(--text-muted)',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: subtaskTitle.trim() ? 'pointer' : 'not-allowed',
                        padding: '4px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {t('tasks.panel.save_btn' as any) || 'Lưu'} <span style={{ fontSize: '10px' }}>↵</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Checklists Section */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t('tasks.panel.checklists')}
                </span>

                {/* Create Checklist */}
                {taskEditable && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Popover
                      open={isAiChecklistPopoverOpen}
                      onOpenChange={setIsAiChecklistPopoverOpen}
                      content={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '250px' }}>
                          <span style={{ fontWeight: 500, fontSize: '12px' }}>Gợi ý checklist bằng AI</span>
                          <Input.TextArea
                            placeholder="Nhập yêu cầu gợi ý (ví dụ: checklist cho test API, checklist code review...)"
                            rows={3}
                            value={aiPromptChecklist}
                            onChange={(e) => setAiPromptChecklist(e.target.value)}
                          />
                          <div style={{ display: 'flex', justifyContent: 'end', gap: '8px' }}>
                            <Button size="small" onClick={() => { setAiPromptChecklist(''); setIsAiChecklistPopoverOpen(false); }}>Hủy</Button>
                            <Button
                              type="primary"
                              size="small"
                              loading={aiChecklistLoading}
                              onClick={() => handleGenerateAiChecklist(aiPromptChecklist)}
                            >
                              Tạo
                            </Button>
                          </div>
                        </div>
                      }
                      title={null}
                      trigger="click"
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<RobotOutlined />}
                        style={{ color: 'var(--primary-color)' }}
                        loading={aiChecklistLoading}
                      >
                        Gợi ý checklist từ AI
                      </Button>
                    </Popover>

                    <Button
                      type="text"
                      size="small"
                      icon={<PlusOutlined />}
                      style={{ color: 'var(--primary-color)' }}
                      onClick={handleQuickCreateChecklist}
                    >
                      {t('tasks.panel.add_checklist')}
                    </Button>
                  </div>
                )}
              </div>

              {(task.checklists || []).map((checklist: any) => {
                const totalItems = checklist.items?.length || 0;
                const completedItems = checklist.items?.filter((it: any) => it.is_checked).length || 0;
                const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

                return (
                  <div key={checklist.id} className="checklist-card" style={{ background: 'var(--bg-card-hover)', borderRadius: '8px', padding: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      {editingChecklistId === checklist.id ? (
                        <Input
                          size="small"
                          value={editingChecklistName}
                          onChange={e => setEditingChecklistName(e.target.value)}
                          onBlur={() => handleSaveChecklistName(checklist.id)}
                          onPressEnter={() => handleSaveChecklistName(checklist.id)}
                          autoFocus
                          style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--primary-color)',
                            borderRadius: '4px',
                            width: '70%',
                            height: '24px'
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            cursor: taskEditable ? 'pointer' : 'default'
                          }}
                          onClick={() => {
                            if (taskEditable) {
                              setEditingChecklistId(checklist.id);
                              setEditingChecklistName(checklist.name);
                            }
                          }}
                        >
                          {checklist.name}
                        </span>
                      )}
                      {taskEditable && (
                        <Popconfirm
                          title={t('tasks.panel.delete_checklist_confirm')}
                          onConfirm={() => handleDeleteChecklist(checklist.id)}
                          okText={t('tasks.panel.delete')}
                          cancelText={t('tasks.panel.cancel')}
                        >
                          <DeleteOutlined style={{ color: '#ef4444', cursor: 'pointer', fontSize: '13px' }} />
                        </Popconfirm>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {totalItems > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ flex: 1, height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${percentage}%`, height: '100%', background: '#22c55e', transition: 'width 0.3s ease' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{completedItems}/{totalItems} ({percentage}%)</span>
                      </div>
                    )}

                    {/* Items List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                      {(checklist.items || []).map((item: any) => {
                        const assignedMember = members.find((m: any) => m.id === item.assignee_id);

                        return (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={item.is_checked}
                                disabled={!taskEditable}
                                onChange={(e) => handleUpdateChecklistItem(item.id, checklist.id, { is_checked: e.target.checked })}
                                style={{ cursor: 'pointer', marginTop: '3px' }}
                              />
                              <span style={{
                                fontSize: '13px',
                                color: item.is_checked ? 'var(--text-muted)' : 'var(--text-primary)',
                                textDecoration: item.is_checked ? 'line-through' : 'none',
                                flex: 1
                              }}>
                                {item.name}
                              </span>
                            </div>

                            {/* Member Assignee & Dropdown options */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '2px' }}>
                              <Dropdown
                                disabled={!taskEditable}
                                trigger={['click']}
                                dropdownRender={() => (
                                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '180px' }}>
                                    <div style={{ fontSize: '11px', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>{t('tasks.panel.assignee')}</div>
                                    <div
                                      onClick={() => handleUpdateChecklistItem(item.id, checklist.id, { assignee_id: null })}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        borderRadius: '6px',
                                        background: !assignedMember ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                        color: !assignedMember ? '#6366f1' : 'var(--text-primary)',
                                      }}
                                    >
                                      <UserOutlined style={{ fontSize: '12px' }} />
                                      <span style={{ fontSize: '12px' }}>{t('tasks.panel.unassigned' as any)}</span>
                                    </div>
                                    {members.map((m: any) => (
                                      <div
                                        key={m.id}
                                        onClick={() => handleUpdateChecklistItem(item.id, checklist.id, { assignee_id: m.id })}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '8px 12px',
                                          cursor: 'pointer',
                                          borderRadius: '6px',
                                          background: m.id === item.assignee_id ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                          color: m.id === item.assignee_id ? '#6366f1' : 'var(--text-primary)',
                                        }}
                                      >
                                        <div style={{ background: '#6366f1', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '9px', fontWeight: 600, overflow: 'hidden' }}>
                                          {m.photo ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.name)}
                                        </div>
                                        <span style={{ fontSize: '12px' }}>{m.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              >
                                <div style={{ cursor: !taskEditable ? 'not-allowed' : 'pointer' }}>
                                  {assignedMember ? (
                                    <Tooltip title={assignedMember.name}>
                                      <div style={{ background: '#6366f1', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '9px', fontWeight: 600, overflow: 'hidden' }}>
                                        {assignedMember.photo ? (
                                          <img src={assignedMember.photo} alt={assignedMember.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                          getInitials(assignedMember.name)
                                        )}
                                      </div>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip title={t('tasks.panel.assignee_placeholder')}>
                                      <div style={{ width: '22px', height: '22px', border: '1px dashed var(--text-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
                                        <UserOutlined style={{ color: 'var(--text-muted)', fontSize: '10px' }} />
                                      </div>
                                    </Tooltip>
                                  )}
                                </div>
                              </Dropdown>

                              {/* Options Menu: Convert to Task/Subtask, Delete */}
                              {taskEditable && (
                                <Dropdown
                                  trigger={['click']}
                                  dropdownRender={() => (
                                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                                      <Button type="text" size="small" icon={<CheckSquareOutlined style={{ fontSize: '12px' }} />} style={{ textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%' }} onClick={() => handleConvertChecklistItem(item.id, checklist.id, 'task')}>{t('tasks.panel.convert_to_task')}</Button>
                                      <Button type="text" size="small" icon={<SubnodeOutlined style={{ fontSize: '12px' }} />} style={{ textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%' }} onClick={() => handleConvertChecklistItem(item.id, checklist.id, 'subtask')}>{t('tasks.panel.convert_to_subtask')}</Button>
                                      <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: '12px' }} />} style={{ textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%' }} onClick={() => handleDeleteChecklistItem(item.id, checklist.id)}>{t('tasks.panel.delete')}</Button>
                                    </div>
                                  )}
                                >
                                  <Button type="text" size="small" style={{ padding: '0 4px', height: '20px' }}>•••</Button>
                                </Dropdown>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Item form */}
                    {taskEditable && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Input
                          placeholder={t('tasks.panel.add_checklist_item_placeholder')}
                          size="small"
                          value={newItemNames[checklist.id] || ''}
                          onChange={(e) => setNewItemNames(prev => ({ ...prev, [checklist.id]: e.target.value }))}
                          onPressEnter={() => {
                            const val = newItemNames[checklist.id] || '';
                            if (val.trim()) {
                              handleCreateChecklistItem(checklist.id, val);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Attachments Section */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PaperClipOutlined /> {t('tasks.panel.attachments_count', { count: task.attachments?.length || 0 })}
              </span>

              {/* Upload Zone */}
              {taskEditable && (
                <div style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--bg-card-hover)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
                  onClick={() => {
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        handleUploadAttachment(file);
                      }
                    };
                    fileInput.click();
                  }}
                >
                  <PlusOutlined style={{ fontSize: '20px', color: 'var(--primary-color)' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('tasks.panel.drag_drop_attachments')}</span>
                </div>
              )}

              {/* Attachments list */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginTop: '8px' }}>
                {(task.attachments || []).map((att: any) => {
                  const isImage = att.file_type?.startsWith('image/');
                  const sizeMB = (att.file_size / (1024 * 1024)).toFixed(2);
                  const formattedSize = parseFloat(sizeMB) > 0.1 ? `${sizeMB} MB` : `${(att.file_size / 1024).toFixed(1)} KB`;

                  return (
                    <div key={att.id} className="attachment-card" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ height: '100px', background: 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                        {isImage ? (
                          <img src={att.file_path} alt={att.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <PaperClipOutlined style={{ fontSize: '32px', color: 'var(--text-muted)' }} />
                        )}
                        {taskEditable && (
                          <Popconfirm
                            title={t('tasks.panel.delete_attachment_confirm')}
                            onConfirm={() => handleDeleteAttachment(att.id)}
                            okText={t('tasks.panel.delete')}
                            cancelText={t('tasks.panel.cancel')}
                          >
                            <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(255,255,255,0.85)', padding: '4px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <DeleteOutlined style={{ color: '#ef4444', fontSize: '12px' }} />
                            </div>
                          </Popconfirm>
                        )}
                      </div>
                      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={att.file_name}>
                          {att.file_name}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {formattedSize}
                        </span>
                        <a href={att.file_path} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--primary-color)', marginTop: '4px', textDecoration: 'none' }}>
                          {t('tasks.panel.download')}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Comments & Activities Feed */}
          <div className="task-detail__panel-sidebar">
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', flexShrink: 0 }}>
              <button
                style={{ background: 'none', border: 'none', borderBottom: panelTab === 'comments' ? '2px solid var(--primary)' : 'none', color: panelTab === 'comments' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                onClick={() => setPanelTab('comments')}
              >
                {t('tasks.panel.comments_count', { count: Math.max(commentsCount, comments.length) })}
              </button>
              <button
                style={{ background: 'none', border: 'none', borderBottom: panelTab === 'history' ? '2px solid var(--primary)' : 'none', color: panelTab === 'history' ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                onClick={() => setPanelTab('history')}
              >
                {t('tasks.panel.history_count', { count: Math.max(activitiesCount, activities.length) })}
              </button>
            </div>

            {panelTab === 'comments' ? (
              <div className="panel-comments-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
                {/* Comments List */}
                <div ref={commentsListRef} onScroll={handleScrollComments} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                  {[...comments].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).filter(c => !c.parent_id).map((comment) => {
                    const userReaction = comment.reactions?.find((r: any) => r.user_id === me?.id);
                    const replies = comments.filter(c => c.parent_id === comment.id);
                    const isRepliesExpanded = !!expandedCommentIds[comment.id];

                    return (
                      <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {/* Main Comment */}
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <div className="comment-avatar" style={{ background: '#6366f1', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '12px', fontWeight: 600, flexShrink: 0, overflow: 'hidden' }}>
                            {comment.user?.photo ? (
                              <img src={comment.user.photo} alt={comment.user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              getInitials(comment.user?.name || '')
                            )}
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <div style={{ background: 'rgba(120, 120, 120, 0.08)', padding: '8px 12px', borderRadius: '18px', display: 'inline-block', maxWidth: '100%', border: '1px solid var(--border-color)' }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px', display: 'block' }}>{comment.user?.name}</span>
                              <p style={{ color: 'var(--text-primary)', fontSize: '13px', margin: '2px 0 0 0', whiteSpace: 'pre-wrap' }}>
                                {renderCommentText(comment.comment)}
                              </p>
                            </div>

                            {comment.attachment_path && (
                              <div style={{ marginTop: '6px', marginLeft: '8px' }}>
                                {isImageFile(comment.attachment_path) ? (
                                  <a href={`http://localhost:8000${comment.attachment_path}`} target="_blank" rel="noreferrer">
                                    <img
                                      src={`http://localhost:8000${comment.attachment_path}`}
                                      alt="attachment"
                                      style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={`http://localhost:8000${comment.attachment_path}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                                  >
                                    <PaperClipOutlined /> {t('tasks.panel.download_attachment_with_name' as any, { filename: comment.attachment_path.split('/').pop() || '' })}
                                  </a>
                                )}
                              </div>
                            )}
                            {/* Action Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px', fontSize: '11px', paddingLeft: '8px', width: '100%' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {new Date(comment.created_at).toLocaleString('vi-VN')}
                              </span>

                              <Popover content={reactionMenu(comment.id)} trigger="hover" placement="top" mouseEnterDelay={0.3}>
                                <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: userReaction ? '#6366f1' : 'var(--text-secondary)', fontWeight: 600 }}>
                                  {userReaction ? getReactionEmoji(userReaction.reaction) : t('tasks.reaction.like' as any)}
                                </button>
                              </Popover>

                              <button
                                onClick={() => {
                                  setReplyingToCommentId(comment.id);
                                  setReplyingToSubCommentId(null);
                                  setReplyText(comment.user?.id === me?.id ? '' : `@[${comment.user?.name || ''}] `);
                                }}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}
                              >
                                {t('tasks.panel.reply_btn' as any)}
                              </button>
                            </div>

                            {/* Reactions display */}
                            {comment.reactions && comment.reactions.length > 0 && renderReactionsDisplay(comment.reactions)}
                          </div>
                        </div>

                        {/* Reply Form */}
                        {replyingToCommentId === comment.id && replyingToSubCommentId === null && renderReplyForm(comment.id)}

                        {/* Replies List */}
                        {replies.length > 0 && (
                          <div style={{ marginLeft: '42px', marginTop: '4px' }}>
                            <button
                              onClick={() => toggleExpandReplies(comment.id)}
                              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                            >
                              {isRepliesExpanded ? t('tasks.panel.hide_replies' as any) : t('tasks.panel.show_more_replies' as any, { count: replies.length })}
                            </button>

                            {isRepliesExpanded && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', borderLeft: '2px solid var(--border-color)', paddingLeft: '12px' }}>
                                {[...replies].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(reply => {
                                  const replyReaction = reply.reactions?.find((r: any) => r.user_id === me?.id);
                                  return (
                                    <React.Fragment key={reply.id}>
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                        <div style={{ background: '#6366f1', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '10px', fontWeight: 600, flexShrink: 0, overflow: 'hidden' }}>
                                          {reply.user?.photo ? (
                                            <img src={reply.user.photo} alt={reply.user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          ) : (
                                            getInitials(reply.user?.name || '')
                                          )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ background: 'rgba(120, 120, 120, 0.05)', padding: '6px 10px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '12px', display: 'block' }}>{reply.user?.name}</span>
                                            <p style={{ color: 'var(--text-primary)', fontSize: '12px', margin: '2px 0 0 0', whiteSpace: 'pre-wrap' }}>
                                              {renderCommentText(reply.comment)}
                                            </p>
                                          </div>

                                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px', fontSize: '10px', paddingLeft: '6px' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                              {new Date(reply.created_at).toLocaleString('vi-VN')}
                                            </span>
                                            <Popover content={reactionMenu(reply.id)} trigger="hover" placement="top" mouseEnterDelay={0.3}>
                                              <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: replyReaction ? '#6366f1' : 'var(--text-secondary)', fontWeight: 600 }}>
                                                {replyReaction ? getReactionEmoji(replyReaction.reaction) : t('tasks.reaction.like' as any)}
                                              </button>
                                            </Popover>
                                            <button
                                              onClick={() => {
                                                setReplyingToCommentId(comment.id);
                                                setReplyingToSubCommentId(reply.id);
                                                setReplyText(reply.user?.id === me?.id ? '' : `@[${reply.user?.name || ''}] `);
                                              }}
                                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}
                                            >
                                              {t('tasks.panel.reply_btn' as any)}
                                            </button>
                                          </div>
                                          {reply.reactions && reply.reactions.length > 0 && renderReactionsDisplay(reply.reactions)}
                                        </div>
                                      </div>
                                      {replyingToCommentId === comment.id && replyingToSubCommentId === reply.id && (
                                        <div style={{ marginTop: '4px', marginBottom: '8px' }}>
                                          {renderReplyForm(comment.id, true)}
                                        </div>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Comment Input */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', position: 'relative' }}>
                  {showMentions && mentionSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 -4px 12px rgba(0,0,0,0.15)', maxHeight: '160px', overflowY: 'auto', zIndex: 10, padding: '4px' }}>
                      {mentionSuggestions.map(member => (
                        <div
                          key={member.id}
                          onClick={() => selectMention(member)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px' }}
                          className="status-item-hover"
                        >
                          <div style={{ background: '#6366f1', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '9px', fontWeight: 600, overflow: 'hidden' }}>
                            {member.photo ? <img src={member.photo} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(member.name)}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{member.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {commentFilePreview && (
                    <div style={{ position: 'relative', width: 'fit-content', marginBottom: '8px' }}>
                      <img src={commentFilePreview} alt="upload preview" style={{ maxWidth: '120px', maxHeight: '90px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                      <button onClick={() => { setNewCommentFile(null); setCommentFilePreview(null); }} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>×</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ background: '#6366f1', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: '#fff', fontSize: '12px', fontWeight: 600, flexShrink: 0, overflow: 'hidden' }}>
                      {me?.photo ? <img src={me.photo} alt={me.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(me?.name || '')}
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(120, 120, 120, 0.05)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '8px 12px' }}>
                      <textarea
                        id="comment-textarea"
                        placeholder={t('tasks.panel.comment_placeholder_mention' as any) || "Viết bình luận (Sử dụng @ để nhắc tên)..."}
                        value={newCommentText}
                        onChange={handleCommentChange}
                        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', resize: 'vertical', fontSize: '13px', minHeight: '60px', fontFamily: 'inherit' }}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', borderTop: '1px solid rgba(120,120,120,0.1)', paddingTop: '6px' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input
                            type="file"
                            id="file-upload"
                            style={{ display: 'none' }}
                            onChange={(e) => handleCommentFileChange(e.target.files ? e.target.files[0] : null)}
                          />
                          <Tooltip title={t('tasks.panel.attach_file_tooltip' as any) || "Đính kèm tệp"}>
                            <label htmlFor="file-upload" style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>
                              <PaperClipOutlined style={{ fontSize: '16px' }} />
                            </label>
                          </Tooltip>

                          <Popover
                            trigger="click"
                            content={
                              <div style={{ width: '280px', display: 'flex', flexDirection: 'column' }}>
                                {/* Categories */}
                                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '8px', justifyContent: 'space-between' }}>
                                  {EMOJI_CATEGORIES.map((cat, idx) => (
                                    <span
                                      key={cat.name}
                                      onClick={() => setActiveCommentEmojiCat(idx)}
                                      style={{
                                        fontSize: '18px',
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: activeCommentEmojiCat === idx ? 'rgba(99,102,241,0.1)' : 'transparent',
                                        borderBottom: activeCommentEmojiCat === idx ? '2px solid #6366f1' : 'none'
                                      }}
                                      title={cat.name}
                                    >
                                      {cat.icon}
                                    </span>
                                  ))}
                                </div>
                                {/* Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
                                  {EMOJI_CATEGORIES[activeCommentEmojiCat].emojis.map(emoji => (
                                    <span
                                      key={emoji}
                                      onClick={() => insertEmoji(emoji)}
                                      style={{ fontSize: '20px', cursor: 'pointer', textAlign: 'center', transition: 'transform 0.1s' }}
                                      className="emoji-item"
                                    >
                                      {emoji}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            }
                          >
                            <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }}><SmileOutlined style={{ fontSize: '16px' }} /></span>
                          </Popover>
                        </div>

                        <button
                          onClick={handlePostComment}
                          disabled={!newCommentText.trim() && !newCommentFile}
                          style={{
                            marginLeft: 'auto',
                            background: (newCommentText.trim() || newCommentFile) ? 'var(--primary)' : 'transparent',
                            color: (newCommentText.trim() || newCommentFile) ? '#fff' : 'var(--text-muted)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            cursor: (newCommentText.trim() || newCommentFile) ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <SendOutlined style={{ fontSize: '12px' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Activities List (Timeline style)
              (() => {
                const projectStatusesToUse = statuses.length > 0 ? statuses : task?.project?.statuses;
                return (
                  <div ref={activitiesListRef} onScroll={handleScrollActivities} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                    {activities.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
                        {t('tasks.panel.no_activity' as any) || "Chưa có lịch sử hoạt động."}
                      </div>
                    ) : (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        paddingLeft: '16px',
                        position: 'relative',
                        borderLeft: '2px solid var(--border-color)',
                        marginLeft: '12px',
                        marginTop: '8px'
                      }}>
                        {[...activities].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((act) => (
                          <div key={act.id} style={{ position: 'relative' }}>
                            {/* Timeline dot node */}
                            <div style={{
                              position: 'absolute',
                              left: '-21px',
                              top: '4px',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'var(--primary)',
                              border: '2px solid var(--bg-card)'
                            }} />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {/* Date and Time first */}
                              <div style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <span>{new Date(act.created_at).toLocaleString('vi-VN')}</span>
                              </div>

                              {/* User Avatar + Who did what */}
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div style={{
                                  background: '#6366f1',
                                  width: '20px',
                                  height: '20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '50%',
                                  color: '#fff',
                                  fontSize: '8px',
                                  fontWeight: 600,
                                  flexShrink: 0,
                                  overflow: 'hidden'
                                }}>
                                  {act.user?.photo ? (
                                    <img src={act.user.photo} alt={act.user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    getInitials(act.user?.name || '')
                                  )}
                                </div>
                                <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{act.user?.name} </span>
                                  <span style={{ color: 'var(--text-secondary)' }}>{formatActivityDescription(act, t, projectStatusesToUse)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>

        </div>
      </div>
    </>
  );

  function insertEmojiToReply(emoji: string) {
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
  }

  function renderReactionsDisplay(reactionsList: any[]) {
    // Group reactions
    const groups: Record<string, any[]> = {};
    reactionsList.forEach(r => {
      if (!groups[r.reaction]) groups[r.reaction] = [];
      groups[r.reaction].push(r);
    });

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px', marginLeft: '6px' }}>
        {Object.entries(groups).map(([type, list]) => (
          <Tooltip
            key={type}
            title={list.map(r => r.user?.name).join(', ')}
          >
            <div
              onClick={() => handleReactComment(reactionsList[0].comment_id, type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '10px',
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: '11px',
                userSelect: 'none',
              }}
            >
              <span>{getReactionEmoji(type)}</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{list.length}</span>
            </div>
          </Tooltip>
        ))}
      </div>
    );
  }
};

// ================== HELPER FUNCTIONS ==================

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return isNaN(r) || isNaN(g) || isNaN(b) ? '156, 160, 176' : `${r}, ${g}, ${b}`;
};

const formatDuration = (totalSeconds: number, t: any) => {
  const days = Math.floor(totalSeconds / 86400);
  const remainingSecs = totalSeconds % 86400;
  const hours = Math.floor(remainingSecs / 3600);
  const minutes = Math.floor((remainingSecs % 3600) / 60);
  const seconds = remainingSecs % 60;

  const parts = [];
  if (days > 0) parts.push(t('common.time.days', { count: days }));
  if (hours > 0 || days > 0) parts.push(t('common.time.hours', { count: hours }));
  if (minutes > 0 || hours > 0 || days > 0) parts.push(t('common.time.minutes', { count: minutes }));
  parts.push(t('common.time.seconds', { count: seconds }));

  return parts.join(' ');
};

const isImageFile = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
};

const formatEstimate = (t: any, start?: string, due?: string) => {
  if (!start || !due) return t('tasks.panel.no_estimate' as any) || 'Chưa có ước tính';
  const s = new Date(start).getTime();
  const d = new Date(due).getTime();
  if (isNaN(s) || isNaN(d) || s >= d) return t('tasks.panel.no_estimate' as any) || 'Chưa có ước tính';

  const diffMs = d - s;
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutes = totalMinutes % (24 * 60);
  const hours = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(t('common.time.days', { count: days }));
  if (hours > 0) parts.push(t('common.time.hours', { count: hours }));
  if (mins > 0) parts.push(t('common.time.minutes', { count: mins }));

  return parts.join(' ') || t('tasks.panel.no_estimate' as any) || 'Chưa có ước tính';
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

const renderMarkdown = (text: string) => {
  if (!text) return '';
  let html = text;

  // Escape HTML to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code block
  html = html.replace(/```([\s\S]*?)```/g, '<pre style="background: rgba(120, 120, 120, 0.12); padding: 8px 12px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 12.5px; margin: 8px 0; border: 1px solid var(--border-color); color: var(--text-primary);"><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code style="background: rgba(120, 120, 120, 0.12); padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 12.5px; color: #e11d48;">$1</code>');

  // Bold
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

  // Bullet lists
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li style="margin-left: 16px; margin-bottom: 4px; list-style-type: disc;">$1</li>');

  const parts = html.split(/(<pre[\s\S]*?<\/pre>)/g);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i].startsWith('<pre')) {
      parts[i] = parts[i].replace(/\n/g, '<br />');
    }
  }
  html = parts.join('');

  return <div className="ai-markdown-content" dangerouslySetInnerHTML={{ __html: html }} style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-primary)' }} />;
};
