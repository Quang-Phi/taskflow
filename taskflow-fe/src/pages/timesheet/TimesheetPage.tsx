import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Spin, Empty, message, Popover, Tooltip, Drawer } from 'antd';
import { 
  LeftOutlined, 
  RightOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  PlayCircleOutlined, 
  UnorderedListOutlined, 
  TableOutlined,
  UserOutlined,
  CloseOutlined
} from '@ant-design/icons';
import api from '../../services/api';
import { useTranslation } from '../../utils/i18n';
import './TimesheetPage.scss';
import { TaskDetailPanel } from '../../components/tasks/TaskDetailPanel';
import ManualTimeLogModal from '../../components/tasks/ManualTimeLogModal';
import TaskTypeBadge from '../../components/tasks/TaskTypeBadge';
import { useDeleteConfirm } from '../../components/tasks/DeleteConfirmModal';

interface TimeLog {
  id: number;
  task_id: number;
  user_id: number;
  started_at: string;
  ended_at: string | null;
  duration: number;
  description: string | null;
  user?: {
    id: number;
    name: string;
    photo?: string;
  };
  task?: {
    id: number;
    title: string;
    type?: string;
    status: string;
    project_id: number;
    assignee_id?: number;
    project?: {
      id: number;
      name: string;
      color: string;
    };
  };
}

interface ProjectTask {
  id: number;
  title: string;
  type?: string;
  status: string;
  project_id: number;
  project_name?: string;
  project_color?: string;
  assignee_id?: number;
  project_statuses?: any[];
}

const TimesheetPage: React.FC = () => {
  const { t, lang, locale } = useTranslation();

  const isTaskDone = (task: ProjectTask) => {
    const projectStatuses = task.project_statuses || [];
    const statusObj = projectStatuses.find((s: any) => s.id === task.status);
    if (statusObj) return statusObj.type === 'closed';
    return task.status === 'done';
  };

  const getTaskStatusLabel = (task: ProjectTask) => {
    const projectStatuses = task.project_statuses || [];
    const statusObj = projectStatuses.find((s: any) => s.id === task.status);
    if (statusObj) return statusObj.name;

    const fallbackMap: Record<string, string> = {
      backlog: t('timesheet.status.backlog'),
      todo: t('timesheet.status.todo'),
      in_progress: t('timesheet.status.in_progress'),
      review: t('timesheet.status.review'),
      done: t('timesheet.status.done')
    };
    return fallbackMap[task.status] || task.status;
  };

  const getTaskStatusColor = (task: ProjectTask) => {
    const projectStatuses = task.project_statuses || [];
    const statusObj = projectStatuses.find((s: any) => s.id === task.status);
    if (statusObj) return statusObj.color;

    const fallbackMap: Record<string, string> = {
      backlog: '#6b7084',
      todo: '#9ca0b0',
      in_progress: '#3b82f6',
      review: '#a855f7',
      done: '#22c55e'
    };
    return fallbackMap[task.status] || 'var(--text-muted)';
  };

  // State definitions
  const [me, setMe] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  
  // Date State: starts with today's week
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tasks lookup for logging
  const [allTasks, setAllTasks] = useState<ProjectTask[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([]);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [usersPage, setUsersPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const myAssignedTasks = useMemo(() => {
    if (!me) return [];
    return allTasks.filter(task => Number(task.assignee_id) === Number(me.id));
  }, [allTasks, me]);
  
  // Grid display additional tasks (tasks added by user to log time even if no entry yet)
  const [gridTasks, setGridTasks] = useState<ProjectTask[]>([]);
  const [showAddTaskPopover, setShowAddTaskPopover] = useState(false);

  // Manual Time Log Modal State
  const [showLogModal, setShowLogModal] = useState(false);
  const [activePopoverCell, setActivePopoverCell] = useState<{ taskId: number, dayIndex: number } | null>(null);
  const [logTask, setLogTask] = useState<number | null>(null);
  const [logDate, setLogDate] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  // Timer state
  const [runningTimer, setRunningTimer] = useState<any>(null);

  // Drawer for member detailed logs
  const [selectedMemberForDrawer, setSelectedMemberForDrawer] = useState<any | null>(null);

  const { showDeleteConfirm, DeleteConfirmComponent } = useDeleteConfirm();

  // Helper: calculate 7 days of the week starting Sunday
  const weekDays = useMemo(() => {
    const sunday = new Date(baseDate);
    const day = baseDate.getDay();
    sunday.setDate(baseDate.getDate() - day);
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [baseDate]);

  // Date Range Display formatting
  const formattedDateRange = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    
    const startMonth = start.toLocaleDateString(locale, { month: 'short' });
    const endMonth = end.toLocaleDateString(locale, { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear !== endYear) {
      return lang === 'vi'
        ? `${startDay} ${startMonth}, ${startYear} - ${endDay} ${endMonth}, ${endYear}`
        : `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
    }
    
    if (startMonth === endMonth) {
      return lang === 'vi'
        ? `${startDay} - ${endDay} ${startMonth}, ${startYear}`
        : `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
    }

    return lang === 'vi'
      ? `${startDay} ${startMonth} - ${endDay} ${endMonth}, ${startYear}`
      : `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
  }, [weekDays, lang, locale]);

  // Load user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = await api.getMe();
        setMe(user);
      } catch (err) {
        console.error('Failed to load profile', err);
      }
    };
    fetchProfile();
  }, []);

  // Fetch running timer
  const fetchRunningTimer = useCallback(async () => {
    try {
      const res = await api.getRunningTimer();
      if (res?.success && res.data) {
        setRunningTimer(res.data);
      } else {
        setRunningTimer(null);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch logged time entries for the selected week
  const fetchTimeEntries = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const startStr = weekDays[0].toISOString().split('T')[0] + ' 00:00:00';
      const endStr = weekDays[6].toISOString().split('T')[0] + ' 23:59:59';
      
      const params: any = {
        start_date: startStr,
        end_date: endStr,
      };

      if (activeTab === 'my') {
        params.user_id = me?.id;
      } else {
        params.view_all = true;
        if (selectedMemberFilter !== 'all') {
          params.user_id = selectedMemberFilter;
        }
      }

      const res = await api.getTimeEntriesList(params);
      if (res?.success) {
        setLogs(res.data || []);
      }
    } catch (err) {
      console.error(err);
      if (!silent) message.error(t('timesheet.toast.fetch_err'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [weekDays, activeTab, me, selectedMemberFilter, t]);

  // Fetch workspace users helper with pagination and search filter
  const fetchWorkspaceUsers = useCallback(async (page: number, replace: boolean = false, searchVal: string = '') => {
    if (!me || (me.role !== 'admin' && me.role !== 'manager')) return;
    try {
      setLoadingUsers(true);
      const res = await api.getUsers({ page, limit: 30, search: searchVal.trim(), active: true });
      if (res?.success) {
        const newUsers = res.data || [];
        setWorkspaceUsers((prev: any[]) => {
          if (replace) return newUsers;
          const existingIds = new Set(prev.map((u: any) => u.id));
          const filtered = newUsers.filter((u: any) => !existingIds.has(u.id));
          return [...prev, ...filtered];
        });
        setUsersPage(page);
        setHasMoreUsers(newUsers.length === 30);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  }, [me]);

  const handleLoadMoreUsers = useCallback(() => {
    if (loadingUsers || !hasMoreUsers) return;
    fetchWorkspaceUsers(usersPage + 1, false, memberSearch);
  }, [loadingUsers, hasMoreUsers, usersPage, memberSearch, fetchWorkspaceUsers]);

  // Debounced search for members
  useEffect(() => {
    if (activeTab !== 'all') return;
    const delayDebounce = setTimeout(() => {
      fetchWorkspaceUsers(1, true, memberSearch);
    }, 450);
    return () => clearTimeout(delayDebounce);
  }, [memberSearch, activeTab, fetchWorkspaceUsers]);

  // Intersection Observer for infinite scrolling
  useEffect(() => {
    if (activeTab !== 'all' || !hasMoreUsers || loadingUsers) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        handleLoadMoreUsers();
      }
    }, {
      rootMargin: '150px', // fetch slightly before reaching bottom
    });

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [activeTab, hasMoreUsers, loadingUsers, handleLoadMoreUsers]);

  // Load support metadata: projects, tasks, workspace members
  const fetchMetadata = useCallback(async () => {
    try {
      const tasksRes = await api.getTasks();
      if (tasksRes?.success) {
        const mapped: ProjectTask[] = (tasksRes.data || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          type: t.type,
          status: t.status,
          project_id: t.project_id,
          project_name: t.project?.name,
          project_color: t.project?.color,
          assignee_id: t.assignee_id,
          project_statuses: t.project?.statuses,
        }));
        setAllTasks(mapped);
      }

      if (me && (me.role === 'admin' || me.role === 'manager')) {
        fetchWorkspaceUsers(1, true, '');
      }
    } catch (err) {
      console.error(err);
    }
  }, [me, fetchWorkspaceUsers]);

  useEffect(() => {
    if (me) {
      fetchTimeEntries();
    }
  }, [me, fetchTimeEntries]);

  useEffect(() => {
    fetchMetadata();
    fetchRunningTimer();
  }, [fetchMetadata, fetchRunningTimer]);

  useEffect(() => {
    const handleTimerUpdate = () => {
      fetchRunningTimer();
      fetchTimeEntries(true);
    };
    window.addEventListener('timer-updated', handleTimerUpdate);
    return () => {
      window.removeEventListener('timer-updated', handleTimerUpdate);
    };
  }, [fetchRunningTimer, fetchTimeEntries]);

  // Date Shift helpers
  const handlePrevWeek = () => {
    const newDate = new Date(baseDate);
    newDate.setDate(baseDate.getDate() - 7);
    setBaseDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(baseDate);
    newDate.setDate(baseDate.getDate() + 7);
    setBaseDate(newDate);
  };

  const handleToday = () => {
    setBaseDate(new Date());
  };

  // Compute tasks displayed in the timesheet grid
  const distinctGridTasks = useMemo(() => {
    const taskMap = new Map<number, ProjectTask>();
    
    // 1. Add tasks that have logs in this week
    logs.forEach(log => {
      if (log.task && !taskMap.has(log.task_id)) {
        taskMap.set(log.task_id, {
          id: log.task.id,
          title: log.task.title,
          type: log.task.type,
          status: log.task.status,
          project_id: log.task.project_id,
          project_name: log.task.project?.name,
          project_color: log.task.project?.color,
          assignee_id: log.task.assignee_id,
        });
      }
    });

    // 2. Append grid tasks added manually by user for logging ease
    gridTasks.forEach(task => {
      if (!taskMap.has(task.id)) {
        taskMap.set(task.id, task);
      }
    });

    return Array.from(taskMap.values());
  }, [logs, gridTasks]);

  // Compute union of tasks that are selectable in manual time log
  const selectableTasks = useMemo(() => {
    const taskMap = new Map<number, ProjectTask>();
    myAssignedTasks.forEach(task => {
      if (!isTaskDone(task)) {
        taskMap.set(task.id, task);
      }
    });
    distinctGridTasks.forEach(task => {
      if (!isTaskDone(task)) {
        taskMap.set(task.id, task);
      }
    });
    allTasks.forEach(task => {
      if (task.id === logTask) {
        taskMap.set(task.id, task);
      }
    });
    return Array.from(taskMap.values());
  }, [myAssignedTasks, distinctGridTasks, allTasks, logTask]);


  // Group logs by taskId and day index (0-6)
  const cellDurations = useMemo(() => {
    // Structure: { [taskId]: { [dayIndex]: { duration: number, logs: TimeLog[] } } }
    const matrix: Record<number, Record<number, { duration: number; logs: TimeLog[] }>> = {};

    logs.forEach(log => {
      const date = new Date(log.started_at);
      // Find matching day index in weekDays
      const dayIndex = weekDays.findIndex(d => d.toDateString() === date.toDateString());
      
      if (dayIndex !== -1) {
        if (!matrix[log.task_id]) {
          matrix[log.task_id] = {};
        }
        if (!matrix[log.task_id][dayIndex]) {
          matrix[log.task_id][dayIndex] = { duration: 0, logs: [] };
        }
        matrix[log.task_id][dayIndex].duration += log.duration;
        matrix[log.task_id][dayIndex].logs.push(log);
      }
    });

    return matrix;
  }, [logs, weekDays]);

  // Compute daily totals
  const dailyTotals = useMemo(() => {
    const totals = Array(7).fill(0);
    logs.forEach(log => {
      const date = new Date(log.started_at);
      const dayIndex = weekDays.findIndex(d => d.toDateString() === date.toDateString());
      if (dayIndex !== -1) {
        totals[dayIndex] += log.duration;
      }
    });
    return totals;
  }, [logs, weekDays]);

  // Compute grand total
  const grandTotal = useMemo(() => {
    return logs.reduce((sum, log) => sum + log.duration, 0);
  }, [logs]);

  // Group logs and calculate totals by Member for All timesheets view
  const memberLogsMap = useMemo(() => {
    const map: Record<number, { 
      user: any; 
      daily: number[]; 
      total: number; 
      logs: TimeLog[]; 
    }> = {};

    // Initialize map with filtered users
    const filteredUsers = workspaceUsers.filter(u => {
      if (selectedMemberFilter !== 'all') {
        return u.id === Number(selectedMemberFilter);
      }
      return true;
    });

    filteredUsers.forEach(user => {
      map[user.id] = {
        user,
        daily: Array(7).fill(0),
        total: 0,
        logs: []
      };
    });

    // Populate log entries per user
    logs.forEach(log => {
      const userId = log.user_id;
      const date = new Date(log.started_at);
      const dayIndex = weekDays.findIndex(d => d.toDateString() === date.toDateString());

      if (dayIndex !== -1) {
        if (!map[userId]) {
          map[userId] = {
            user: log.user || { id: userId, name: `User #${userId}` },
            daily: Array(7).fill(0),
            total: 0,
            logs: []
          };
        }
        map[userId].daily[dayIndex] += log.duration;
        map[userId].total += log.duration;
        map[userId].logs.push(log);
      }
    });

    return map;
  }, [logs, workspaceUsers, selectedMemberFilter, weekDays]);

  const displayedMembersList = useMemo(() => {
    return Object.values(memberLogsMap).sort((a, b) => b.total - a.total);
  }, [memberLogsMap]);

  // Formatter: seconds -> duration string (e.g. 2h 15m, translated)
  const formatSeconds = (seconds: number): string => {
    if (seconds <= 0) return '—';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const hStr = t('common.time.hours' as any, { count: hours });
    const mStr = t('common.time.minutes' as any, { count: minutes });
    const sStr = t('common.time.seconds' as any, { count: secs });

    const parts: string[] = [];
    if (hours > 0) parts.push(hStr);
    if (minutes > 0) parts.push(mStr);
    if (secs > 0 || (hours === 0 && minutes === 0)) parts.push(sStr);
    
    return parts.join(' ');
  };

  // Play/Pause Timer controller
  const handleToggleTimer = async (taskId: number) => {
    try {
      if (runningTimer && Number(runningTimer.task_id) === Number(taskId)) {
        const res = await api.stopTimer(taskId);
        if (res?.success) {
          message.success(t('timesheet.toast.timer_stop'));
          setRunningTimer(null);
          window.dispatchEvent(new Event('timer-updated'));
          fetchTimeEntries(true);
        }
      } else {
        const res = await api.startTimer(taskId);
        if (res?.success) {
          message.success(t('timesheet.toast.timer_start'));
          setRunningTimer(res.data);
          window.dispatchEvent(new Event('timer-updated'));
          fetchTimeEntries(true);
        }
      }
    } catch (err) {
      console.error(err);
      message.error(t('timesheet.toast.timer_err'));
    }
  };

  // Open Log Modal with default values
  const openLogModal = (taskId: number, dateStr?: string) => {
    setActivePopoverCell(null);
    setShowAddTaskPopover(false);
    setLogTask(taskId);
    if (dateStr) {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setLogDate(`${dateStr} ${hrs}:${mins}`);
    } else {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const dy = String(now.getDate()).padStart(2, '0');
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setLogDate(`${yr}-${mo}-${dy} ${hrs}:${mins}`);
    }
    setShowLogModal(true);
  };

  // Delete Log entry handler
  const handleDeleteLog = (id: number, onDeleted?: () => void) => {
    showDeleteConfirm({
      title: t('timesheet.confirm.delete_title' as any) || 'Xoá bản ghi công',
      content: t('timesheet.confirm.delete_content' as any) || 'Bạn có chắc chắn muốn xoá bản ghi thời gian làm việc này không?',
      okText: t('common.delete' as any) || 'Xóa',
      cancelText: t('common.cancel' as any) || 'Hủy',
      onConfirm: async () => {
        try {
          const res = await api.deleteTimeEntry(id);
          if (res?.success) {
            message.success(t('timesheet.toast.log_deleted'));
            fetchTimeEntries(true);
            if (onDeleted) {
              onDeleted();
            }
          }
        } catch (err) {
          console.error(err);
          message.error(t('timesheet.toast.log_delete_err'));
        }
      }
    });
  };

  // Render detail popover contents for grid cells
  const renderCellPopover = (cellData: { duration: number; logs: TimeLog[] } | undefined, task: ProjectTask, dayDate: Date, dayIndex: number) => {
    const dateStr = dayDate.toISOString().split('T')[0];
    
    return (
      <div className="timesheet-popover-content">
        <div className="popover-header">
          <h4>{task.title}</h4>
          <span className="popover-date">
            {dayDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        
        {cellData && cellData.logs.length > 0 ? (
          <div className="popover-logs-list">
            {cellData.logs.map(log => (
              <div key={log.id} className="popover-log-item">
                <div className="log-details">
                  <div className="log-duration">{formatSeconds(log.duration)}</div>
                  <div className="log-desc">{log.description || t('timesheet.log.no_description')}</div>
                  {log.user && activeTab === 'all' && (
                    <div className="log-author">By: {log.user.name}</div>
                  )}
                </div>
                {(me?.role === 'admin' || log.user_id === me?.id) && (
                  <button className="delete-log-btn" onClick={() => handleDeleteLog(log.id)}>
                    <DeleteOutlined />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="popover-empty">{t('timesheet.popover.no_time')}</div>
        )}

        <button 
          className="popover-add-btn" 
          disabled={isTaskDone(task) || Number(task.assignee_id) !== Number(me?.id)} 
          style={isTaskDone(task) || Number(task.assignee_id) !== Number(me?.id) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          onClick={() => {
            if (!isTaskDone(task) && Number(task.assignee_id) === Number(me?.id)) openLogModal(task.id, dateStr);
          }}
        >
          <PlusOutlined /> {t('timesheet.popover.log_time_btn')}
        </button>
      </div>
    );
  };

  return (
    <div className="timesheet-page">
      {/* Page Header */}
      <div className="timesheet-page__header">
        <div className="header-title">
          <h1>{t('timesheet.title')}</h1>
          <p>{t('timesheet.sub_title')}</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="timesheet-tabs">
          <button 
            className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('my');
              setSelectedMemberFilter('all');
            }}
          >
            {t('timesheet.tab.my')}
          </button>
          
          {(me?.role === 'admin' || me?.role === 'manager') && (
            <button 
              className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('all');
                setViewType('grid');
              }}
            >
              {t('timesheet.tab.all')}
            </button>
          )}
        </div>
      </div>

      {/* Toolbar Filter Section */}
      <div className="timesheet-toolbar">
        <div className="toolbar-left">
          {/* Week Selector */}
          <div className="week-selector">
            <button className="nav-arrow-btn" onClick={handlePrevWeek}><LeftOutlined /></button>
            <button className="today-btn" onClick={handleToday}>{t('timesheet.btn.today')}</button>
            <button className="nav-arrow-btn" onClick={handleNextWeek}><RightOutlined /></button>
            <span className="week-range-label">{formattedDateRange}</span>
          </div>

          {/* Member Search input if on All view */}
          {activeTab === 'all' && (
            <div className="member-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="filter-label"><UserOutlined /> {t('timesheet.filter.member')}</span>
              <input 
                type="text"
                placeholder={t('timesheet.filter.member_placeholder')}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="filter-search-input"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  outline: 'none',
                  fontSize: '13px',
                  width: '200px',
                }}
              />
            </div>
          )}
        </div>

        <div className="toolbar-right">
          {/* View Toggles */}
          {activeTab === 'my' && (
            <div className="view-toggles">
              <button 
                className={`toggle-btn ${viewType === 'grid' ? 'active' : ''}`}
                onClick={() => setViewType('grid')}
                title={t('timesheet.view.grid')}
              >
                <TableOutlined /> <span>Timesheet</span>
              </button>
              <button 
                className={`toggle-btn ${viewType === 'list' ? 'active' : ''}`}
                onClick={() => setViewType('list')}
                title={t('timesheet.view.list')}
              >
                <UnorderedListOutlined /> <span>{t('timesheet.view.list_label')}</span>
              </button>
            </div>
          )}

          <button className="log-time-main-btn" onClick={() => {
            const firstActiveAssignedTask = myAssignedTasks.find(t => !isTaskDone(t));
            if (firstActiveAssignedTask) {
              openLogModal(firstActiveAssignedTask.id);
            } else {
              message.warning(t('timesheet.toast.no_active_task'));
            }
          }}>
            <PlusOutlined /> {t('timesheet.btn.log_time')}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="timesheet-loading">
          <Spin size="large" />
          <p>{t('timesheet.syncing')}</p>
        </div>
      ) : viewType === 'grid' ? (
        /* Timesheet Grid Rendering */
        <div className="timesheet-grid-container">
          <div className="grid-table-wrapper">
            <table className="timesheet-grid-table">
              <thead>
                <tr>
                  <th className="task-header">
                    {activeTab === 'all' 
                      ? t('timesheet.header.member_col', { count: displayedMembersList.length })
                      : t('timesheet.header.task_col')}
                  </th>
                  
                  {weekDays.map((day, idx) => {
                    const isToday = new Date().toDateString() === day.toDateString();
                    return (
                      <th key={idx} className={`day-header ${isToday ? 'today' : ''}`}>
                        <div className="day-name">
                          {day.toLocaleDateString(locale, { weekday: 'short' })}
                        </div>
                        <div className="day-date">{day.getDate()}</div>
                        <div className="day-total">{formatSeconds(dailyTotals[idx])}</div>
                      </th>
                    );
                  })}
                  
                  <th className="total-header">
                    <div className="total-title">{t('timesheet.header.total')}</div>
                    <div className="total-value">{formatSeconds(grandTotal)}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeTab === 'all' ? (
                  displayedMembersList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="grid-empty-cell">
                        <Empty description={t('timesheet.empty.members')} />
                      </td>
                    </tr>
                  ) : (
                    displayedMembersList.map(({ user, daily, total, logs: memberLogs }) => {
                      return (
                        <tr key={user.id} className="grid-task-row member-row">
                          <td className="task-cell member-cell">
                            <div className="member-cell-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <div className="member-meta" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="avatar-placeholder" style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: '#1890ff',
                                  color: 'white',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  flexShrink: 0
                                }}>
                                  {user.photo ? (
                                    <img src={user.photo} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    user.name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div className="member-names" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                  <span className="member-name" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13.5px' }}>{user.name}</span>
                                  <span className="member-capacity" style={{ fontSize: '11px', color: '#8c8c8c' }}>40h</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          {weekDays.map((day, idx) => {
                            const dayDuration = daily[idx];
                            return (
                              <td key={idx} className="day-cell member-day-cell">
                                <div 
                                  className="cell-inner-hover" 
                                  onClick={() => {
                                    const dayDateStr = day.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                    const filteredDayLogs = memberLogs.filter(log => new Date(log.started_at).toDateString() === day.toDateString());
                                    setSelectedMemberForDrawer({ user, daily, total: dayDuration, logs: filteredDayLogs, dateLabel: dayDateStr });
                                  }}
                                  style={{ cursor: dayDuration > 0 ? 'pointer' : 'default' }}
                                >
                                  {dayDuration > 0 ? (
                                    <span className="cell-duration-badge">{formatSeconds(dayDuration)}</span>
                                  ) : (
                                    <span className="cell-placeholder">0h</span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          
                          <td className="task-total-cell member-total-cell">
                            {total > 0 ? (
                              <span 
                                className="task-total-badge" 
                                onClick={() => setSelectedMemberForDrawer({ user, daily, total, logs: memberLogs })}
                                style={{ color: '#1890ff', borderBottom: '2px solid #1890ff', paddingBottom: '2px', cursor: 'pointer' }}
                              >
                                {formatSeconds(total)}
                              </span>
                            ) : (
                              <span className="task-total-badge" style={{ color: 'var(--text-muted)' }}>
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )
                ) : distinctGridTasks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="grid-empty-cell">
                      <Empty description={t('timesheet.empty.tasks')} />
                    </td>
                  </tr>
                ) : (
                  distinctGridTasks.map(task => {
                    // Calculate task total for the week
                    let taskTotal = 0;
                    weekDays.forEach((_, idx) => {
                      taskTotal += cellDurations[task.id]?.[idx]?.duration || 0;
                    });

                    const isTracking = runningTimer && Number(runningTimer.task_id) === Number(task.id);

                    return (
                      <tr key={task.id} className="grid-task-row">
                        <td className="task-cell">
                          <div className="task-cell-content">
                            {
                              (() => {
                                const isAssignedToMe = Number(task.assignee_id) === Number(me?.id);
                                return (
                                  <Tooltip title={isTaskDone(task) ? t('timesheet.tooltip.task_done') : !isAssignedToMe ? t('timesheet.tooltip.not_assigned') : isTracking ? t('timesheet.tooltip.stop_timer') : t('timesheet.tooltip.start_timer')}>
                                    <button 
                                      className={`timer-btn ${isTracking ? 'running' : ''}`}
                                      onClick={() => !isTaskDone(task) && isAssignedToMe && handleToggleTimer(task.id)}
                                      disabled={isTaskDone(task) || !isAssignedToMe}
                                      style={isTaskDone(task) || !isAssignedToMe ? { cursor: 'not-allowed', opacity: 0.5 } : {}}
                                    >
                                      {isTracking ? <span className="timer-pulse" /> : <PlayCircleOutlined />}
                                    </button>
                                  </Tooltip>
                                );
                              })()
                            }
                            
                            <div className="task-info">
                              <span className="task-title" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => {
                                setSelectedTaskId(task.id);
                              }}>
                                <TaskTypeBadge type={task.type || 'task'} size="icon" />
                                {task.title}
                              </span>
                              <div className="task-metadata">
                                <span className="project-badge" style={{ borderColor: task.project_color || '#ccc' }}>
                                  <span className="dot" style={{ backgroundColor: task.project_color || '#ccc' }} />
                                  {task.project_name || 'No Project'}
                                </span>
                                <span 
                                  className="task-status-tag"
                                  style={{
                                    color: getTaskStatusColor(task),
                                    background: `${getTaskStatusColor(task)}15`,
                                    border: `1px solid ${getTaskStatusColor(task)}30`
                                  }}
                                >
                                  {getTaskStatusLabel(task)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Rendering 7 Day Cells */}
                        {weekDays.map((day, idx) => {
                          const cellData = cellDurations[task.id]?.[idx];
                          
                          return (
                            <td key={idx} className="day-cell">
                              <Popover 
                                content={renderCellPopover(cellData, task, day, idx)} 
                                trigger="click"
                                placement="bottom"
                                overlayClassName="timesheet-popover"
                                open={activePopoverCell?.taskId === task.id && activePopoverCell?.dayIndex === idx}
                                onOpenChange={(visible) => {
                                  if (visible) {
                                    setActivePopoverCell({ taskId: task.id, dayIndex: idx });
                                  } else {
                                    setActivePopoverCell(null);
                                  }
                                }}
                              >
                                <div className="cell-inner-hover">
                                  {cellData ? (
                                    <span className="cell-duration-badge">{formatSeconds(cellData.duration)}</span>
                                  ) : (
                                    <span className="cell-placeholder">—</span>
                                  )}
                                  <div className="cell-hover-icon">
                                    <PlusOutlined />
                                  </div>
                                </div>
                              </Popover>
                            </td>
                          );
                        })}

                        {/* Row Total */}
                        <td className="task-total-cell">
                          <span className="task-total-badge">{formatSeconds(taskTotal)}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Infinite Scroll Sentinel if on All view */}
          {activeTab === 'all' && (
            <div 
              ref={sentinelRef} 
              className="infinite-scroll-sentinel" 
              style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                padding: '24px 0', 
                minHeight: '60px' 
              }}
            >
              {loadingUsers && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1890ff' }}>
                  <Spin size="small" />
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>
                    {t('timesheet.loading.more_members')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Grid Add Task Row */}
          {activeTab === 'my' && (
            <div className="grid-table-actions">
              <Popover
                content={
                  <div className="task-selection-popover">
                    <h4>{t('timesheet.task_picker.title')}</h4>
                    <div className="popover-search-container">
                      <input 
                        type="text" 
                        placeholder={t('timesheet.task_picker.placeholder')} 
                        className="popover-search-input"
                        onChange={(e) => {
                          // local query search filter if wanted
                        }}
                      />
                    </div>
                    <div className="popover-task-list">
                      {myAssignedTasks.filter(tItem => !distinctGridTasks.some(gt => gt.id === tItem.id)).length === 0 ? (
                        <p className="no-tasks-text">{t('timesheet.task_picker.all_added')}</p>
                      ) : (
                        myAssignedTasks
                          .filter(tItem => !distinctGridTasks.some(gt => gt.id === tItem.id))
                          .map(tItem => (
                            <div 
                              key={tItem.id} 
                              className="task-option-item"
                              onClick={() => {
                                setGridTasks(prev => [...prev, tItem]);
                                setShowAddTaskPopover(false);
                              }}
                            >
                              <span className="option-title">{tItem.title}</span>
                              <span className="option-proj">{tItem.project_name || 'No Project'}</span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                }
                trigger="click"
                open={showAddTaskPopover}
                onOpenChange={setShowAddTaskPopover}
                placement="bottomLeft"
                overlayClassName="add-task-popover-container"
              >
                <button className="add-grid-task-btn">
                  <PlusOutlined /> {t('timesheet.btn.add_task')}
                </button>
              </Popover>
            </div>
          )}
        </div>
      ) : (
        /* Detailed time entries view */
        <div className="timesheet-list-container">
          {logs.length === 0 ? (
            <div className="list-empty-wrapper">
              <Empty description={t('timesheet.empty.logs')} />
            </div>
          ) : (
            <div className="list-table-wrapper">
              <table className="time-entries-list-table">
                <thead>
                  <tr>
                    <th>{t('timesheet.log_table.member')}</th>
                    <th>{t('timesheet.log_table.task')}</th>
                    <th>{t('timesheet.log_table.description')}</th>
                    <th>{t('timesheet.log_table.time')}</th>
                    <th>{t('timesheet.log_table.duration')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td>
                        <div className="member-info-cell">
                          <div className="avatar-placeholder">
                            {log.user?.photo ? (
                              <img src={log.user.photo} alt={log.user.name} />
                            ) : (
                              log.user?.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span>{log.user?.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="task-info-cell">
                          <span className="task-title" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => {
                            if (log.task_id) {
                              setSelectedTaskId(log.task_id);
                            }
                          }}>
                            <TaskTypeBadge type={log.task?.type || 'task'} size="icon" />
                            {log.task?.title}
                          </span>
                          <span className="project-badge-mini" style={{ color: log.task?.project?.color }}>
                            {log.task?.project?.name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="log-description-text">
                          {log.description || <span className="empty-placeholder">—</span>}
                        </span>
                      </td>
                      <td>
                        <span className="log-time-text">
                          {new Date(log.started_at).toLocaleDateString(locale, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </td>
                      <td>
                        <span className="duration-tag">{formatSeconds(log.duration)}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {(me?.role === 'admin' || log.user_id === me?.id) && (
                          <button 
                            className="delete-list-row-btn"
                            onClick={() => handleDeleteLog(log.id)}
                            title={t('timesheet.log_table.delete')}
                          >
                            <DeleteOutlined />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Manual Time Logging Dialog */}
      <ManualTimeLogModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSuccess={() => fetchTimeEntries(true)}
        tasks={selectableTasks}
        defaultTaskId={logTask}
        defaultDate={logDate}
      />

      {/* Detailed Drawer for Workspace Member */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'var(--primary)', color: 'white',
              fontWeight: 600, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '12px', flexShrink: 0,
              overflow: 'hidden',
            }}>
              {selectedMemberForDrawer?.user?.photo ? (
                <img src={selectedMemberForDrawer.user.photo} alt={selectedMemberForDrawer.user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                selectedMemberForDrawer?.user?.name?.charAt(0).toUpperCase()
              )}
            </div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {`${t('timesheet.drawer.detailed_logs')} - ${selectedMemberForDrawer?.user?.name}`}
            </span>
          </div>
        }
        placement="right"
        width={650}
        closable={false}
        extra={
          <button 
            onClick={() => setSelectedMemberForDrawer(null)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer', 
              fontSize: '16px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '6px', 
              borderRadius: '4px',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none'; }}
          >
            <CloseOutlined />
          </button>
        }
        onClose={() => setSelectedMemberForDrawer(null)}
        open={!!selectedMemberForDrawer}
        styles={{
          body: { padding: '20px', background: 'var(--bg-card)', color: 'var(--text-primary)' },
          header: { background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' },
        }}
      >
        {selectedMemberForDrawer && (
          <div className="member-details-drawer">
            <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{selectedMemberForDrawer.dateLabel || formattedDateRange}</span>
              <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '15px' }}>
                {t('timesheet.drawer.total')} {formatSeconds(selectedMemberForDrawer.total)}
              </span>
            </div>

            {selectedMemberForDrawer.logs.length === 0 ? (
              <Empty description={t('timesheet.empty.member_week')} />
            ) : (
              <div className="drawer-table-wrapper" style={{ overflowX: 'auto' }}>
                <table className="time-entries-list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('timesheet.log_table.task')}</th>
                      <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('timesheet.log_table.description')}</th>
                      <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('timesheet.log_table.time')}</th>
                      <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('timesheet.log_table.duration')}</th>
                      {me?.role === 'admin' && <th style={{ padding: '10px' }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMemberForDrawer.logs.map((log: TimeLog) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--divider)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <TaskTypeBadge type={log.task?.type || 'task'} size="icon" />
                              {log.task?.title}
                            </span>
                            <span style={{ fontSize: '11px', color: log.task?.project?.color || 'var(--text-muted)' }}>
                              {log.task?.project?.name || '—'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '13px' }}>
                          {log.description || '—'}
                        </td>
                        <td style={{ padding: '12px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {new Date(log.started_at).toLocaleDateString(locale, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{
                            background: 'rgba(99,102,241,0.10)',
                            border: '1px solid rgba(99,102,241,0.20)',
                            color: 'var(--primary)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '12px',
                          }}>
                            {formatSeconds(log.duration)}
                          </span>
                        </td>
                        {me?.role === 'admin' && (
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                handleDeleteLog(log.id, () => {
                                  setSelectedMemberForDrawer((prev: any) => {
                                    if (!prev) return null;
                                    const remainingLogs = prev.logs.filter((l: any) => l.id !== log.id);
                                    const newTotal = remainingLogs.reduce((sum: number, l: any) => sum + l.duration, 0);
                                    return { ...prev, logs: remainingLogs, total: newTotal };
                                  });
                                });
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '4px', padding: '4px 6px', transition: 'all 0.15s' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                            >
                              <DeleteOutlined />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Drawer>
      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => {
            fetchTimeEntries();
          }}
        />
      )}
      <DeleteConfirmComponent />
    </div>
  );
};

export default TimesheetPage;
