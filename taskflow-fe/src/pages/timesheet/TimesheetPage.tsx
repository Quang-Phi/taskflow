import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Spin, Empty, message, Popover, Tooltip, Modal, Drawer } from 'antd';
import { 
  LeftOutlined, 
  RightOutlined, 
  ClockCircleOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  PlayCircleOutlined, 
  UnorderedListOutlined, 
  TableOutlined,
  UserOutlined
} from '@ant-design/icons';
import api from '../../services/api';
import { useTranslation } from '../../utils/i18n';
import './TimesheetPage.scss';

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
  status: string;
  project_id: number;
  project_name?: string;
  project_color?: string;
  assignee_id?: number;
}

const TimesheetPage: React.FC = () => {
  const { lang } = useTranslation();
  const isVi = lang === 'vi';

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
  const [logTask, setLogTask] = useState<number | null>(null);
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logHours, setLogHours] = useState<number>(0);
  const [logMinutes, setLogMinutes] = useState<number>(0);
  const [logDescription, setLogDescription] = useState<string>('');

  // Timer state
  const [runningTimer, setRunningTimer] = useState<any>(null);

  // Drawer for member detailed logs
  const [selectedMemberForDrawer, setSelectedMemberForDrawer] = useState<any | null>(null);

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
    
    const startMonth = start.toLocaleDateString(isVi ? 'vi-VN' : 'en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString(isVi ? 'vi-VN' : 'en-US', { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear !== endYear) {
      return isVi 
        ? `${startDay} ${startMonth}, ${startYear} - ${endDay} ${endMonth}, ${endYear}`
        : `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
    }
    
    if (startMonth === endMonth) {
      return isVi
        ? `${startDay} - ${endDay} ${startMonth}, ${startYear}`
        : `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
    }

    return isVi
      ? `${startDay} ${startMonth} - ${endDay} ${endMonth}, ${startYear}`
      : `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
  }, [weekDays, isVi]);

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
  const fetchTimeEntries = useCallback(async () => {
    try {
      setLoading(true);
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
      message.error(isVi ? 'Không thể tải dữ liệu bảng công' : 'Failed to fetch timesheet data');
    } finally {
      setLoading(false);
    }
  }, [weekDays, activeTab, me, selectedMemberFilter, isVi]);

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
          status: t.status,
          project_id: t.project_id,
          project_name: t.project?.name,
          project_color: t.project?.color,
          assignee_id: t.assignee_id,
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
      fetchTimeEntries();
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

  // Formatter: seconds -> duration string (e.g. 2h 15m)
  const formatSeconds = (seconds: number): string => {
    if (seconds <= 0) return '—';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  // Play/Pause Timer controller
  const handleToggleTimer = async (taskId: number) => {
    try {
      if (runningTimer && Number(runningTimer.task_id) === Number(taskId)) {
        const res = await api.stopTimer(taskId);
        if (res?.success) {
          message.success(isVi ? 'Đã dừng theo dõi thời gian' : 'Stopped tracking time');
          setRunningTimer(null);
          window.dispatchEvent(new Event('timer-updated'));
          fetchTimeEntries();
        }
      } else {
        const res = await api.startTimer(taskId);
        if (res?.success) {
          message.success(isVi ? 'Đã bắt đầu tính giờ công việc' : 'Started task timer');
          setRunningTimer(res.data);
          window.dispatchEvent(new Event('timer-updated'));
          fetchTimeEntries();
        }
      }
    } catch (err) {
      console.error(err);
      message.error(isVi ? 'Lỗi thao tác tính giờ' : 'Failed to trigger timer');
    }
  };

  // Open Log Modal with default values
  const openLogModal = (taskId: number, dateStr?: string) => {
    setLogTask(taskId);
    if (dateStr) {
      setLogDate(dateStr);
    } else {
      setLogDate(new Date().toISOString().split('T')[0]);
    }
    setLogHours(0);
    setLogMinutes(0);
    setLogDescription('');
    setShowLogModal(true);
  };

  // Submit manual log entry
  const handleLogManualTime = async () => {
    if (!logTask) {
      message.error(isVi ? 'Vui lòng chọn công việc' : 'Please select a task');
      return;
    }
    const durationInSeconds = (logHours * 3600) + (logMinutes * 60);
    if (durationInSeconds <= 0) {
      message.error(isVi ? 'Thời lượng phải lớn hơn 0 phút' : 'Duration must be greater than 0m');
      return;
    }
    try {
      const data = await api.addManualTime(logTask, {
        duration: durationInSeconds,
        description: logDescription,
        started_at: logDate ? `${logDate} 09:00:00` : undefined,
      });
      if (data?.success) {
        message.success(isVi ? 'Đã ghi nhận giờ làm thành công' : 'Time logged successfully');
        setShowLogModal(false);
        fetchTimeEntries();
      }
    } catch (err) {
      console.error(err);
      message.error(isVi ? 'Lỗi ghi nhận thời gian' : 'Failed to log time');
    }
  };

  // Delete Log entry handler
  const handleDeleteLog = async (id: number) => {
    try {
      const res = await api.deleteTimeEntry(id);
      if (res?.success) {
        message.success(isVi ? 'Đã xoá bản ghi công' : 'Time entry deleted');
        fetchTimeEntries();
      }
    } catch (err) {
      console.error(err);
      message.error(isVi ? 'Không thể xoá bản ghi' : 'Failed to delete time entry');
    }
  };

  // Render detail popover contents for grid cells
  const renderCellPopover = (cellData: { duration: number; logs: TimeLog[] } | undefined, task: ProjectTask, dayDate: Date, dayIndex: number) => {
    const dateStr = dayDate.toISOString().split('T')[0];
    
    return (
      <div className="timesheet-popover-content">
        <div className="popover-header">
          <h4>{task.title}</h4>
          <span className="popover-date">
            {dayDate.toLocaleDateString(isVi ? 'vi-VN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        
        {cellData && cellData.logs.length > 0 ? (
          <div className="popover-logs-list">
            {cellData.logs.map(log => (
              <div key={log.id} className="popover-log-item">
                <div className="log-details">
                  <div className="log-duration">{formatSeconds(log.duration)}</div>
                  <div className="log-desc">{log.description || (isVi ? 'Không có mô tả' : 'No description')}</div>
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
          <div className="popover-empty">{isVi ? 'Chưa ghi nhận thời gian' : 'No tracked time yet'}</div>
        )}

        <button className="popover-add-btn" onClick={() => {
          openLogModal(task.id, dateStr);
        }}>
          <PlusOutlined /> {isVi ? 'Ghi nhận thời gian' : 'Log tracked time'}
        </button>
      </div>
    );
  };

  return (
    <div className="timesheet-page">
      {/* Page Header */}
      <div className="timesheet-page__header">
        <div className="header-title">
          <h1>{isVi ? 'Quản lý bảng công' : 'Timesheet Management'}</h1>
          <p>{isVi ? 'Theo dõi và quản lý thời gian thực hiện công việc hàng tuần' : 'Track and manage your weekly task-based workloads'}</p>
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
            {isVi ? 'Bảng công cá nhân' : 'My timesheet'}
          </button>
          
          {(me?.role === 'admin' || me?.role === 'manager') && (
            <button 
              className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('all');
                setViewType('grid');
              }}
            >
              {isVi ? 'Tất cả bảng công' : 'All timesheets'}
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
            <button className="today-btn" onClick={handleToday}>{isVi ? 'Tuần này' : 'Today'}</button>
            <button className="nav-arrow-btn" onClick={handleNextWeek}><RightOutlined /></button>
            <span className="week-range-label">{formattedDateRange}</span>
          </div>

          {/* Member Search input if on All view */}
          {activeTab === 'all' && (
            <div className="member-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="filter-label"><UserOutlined /> {isVi ? 'Thành viên:' : 'Member:'}</span>
              <input 
                type="text"
                placeholder={isVi ? 'Tìm kiếm thành viên...' : 'Search members...'}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="filter-search-input"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
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
                title={isVi ? 'Chế độ lưới' : 'Grid view'}
              >
                <TableOutlined /> <span>Timesheet</span>
              </button>
              <button 
                className={`toggle-btn ${viewType === 'list' ? 'active' : ''}`}
                onClick={() => setViewType('list')}
                title={isVi ? 'Chế độ danh sách' : 'Detailed list'}
              >
                <UnorderedListOutlined /> <span>{isVi ? 'Bản ghi chi tiết' : 'Time entries'}</span>
              </button>
            </div>
          )}

          <button className="log-time-main-btn" onClick={() => {
            if (distinctGridTasks.length > 0) {
              openLogModal(distinctGridTasks[0].id);
            } else if (myAssignedTasks.length > 0) {
              openLogModal(myAssignedTasks[0].id);
            } else {
              message.warning(isVi ? 'Không tìm thấy công việc được giao để ghi nhận' : 'No assigned tasks found to log time');
            }
          }}>
            <PlusOutlined /> {isVi ? 'Ghi nhận thời gian' : 'Log Time'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="timesheet-loading">
          <Spin size="large" />
          <p>{isVi ? 'Đang cập nhật số liệu bảng công...' : 'Syncing timesheet logs...'}</p>
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
                      ? (isVi ? `Thành viên (${displayedMembersList.length})` : `People (${displayedMembersList.length})`)
                      : (isVi ? 'Công việc / Dự án' : 'Task / Location')}
                  </th>
                  
                  {weekDays.map((day, idx) => {
                    const isToday = new Date().toDateString() === day.toDateString();
                    return (
                      <th key={idx} className={`day-header ${isToday ? 'today' : ''}`}>
                        <div className="day-name">
                          {day.toLocaleDateString(isVi ? 'vi-VN' : 'en-US', { weekday: 'short' })}
                        </div>
                        <div className="day-date">{day.getDate()}</div>
                        <div className="day-total">{formatSeconds(dailyTotals[idx])}</div>
                      </th>
                    );
                  })}
                  
                  <th className="total-header">
                    <div className="total-title">{isVi ? 'Tổng số' : 'Total'}</div>
                    <div className="total-value">{formatSeconds(grandTotal)}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeTab === 'all' ? (
                  displayedMembersList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="grid-empty-cell">
                        <Empty description={isVi ? 'Không tìm thấy thành viên nào.' : 'No members found.'} />
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
                                  <span className="member-name" style={{ fontWeight: 600, color: '#f0f2f5', fontSize: '13.5px' }}>{user.name}</span>
                                  <span className="member-capacity" style={{ fontSize: '11px', color: '#8c8c8c' }}>40h</span>
                                </div>
                              </div>
                              <button 
                                className="open-member-drawer-btn" 
                                onClick={() => setSelectedMemberForDrawer({ user, daily, total, logs: memberLogs })}
                                style={{
                                  background: 'rgba(255, 255, 255, 0.08)',
                                  border: 'none',
                                  color: '#fff',
                                  padding: '4px 12px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'background 0.2s',
                                  marginLeft: '8px'
                                }}
                              >
                                {isVi ? 'Mở' : 'Open'} &rarr;
                              </button>
                            </div>
                          </td>
                          
                          {weekDays.map((day, idx) => {
                            const dayDuration = daily[idx];
                            return (
                              <td key={idx} className="day-cell member-day-cell">
                                <div className="cell-inner-hover" onClick={() => setSelectedMemberForDrawer({ user, daily, total, logs: memberLogs })}>
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
                            <span className="task-total-badge" style={{ color: '#1890ff', borderBottom: '2px solid #1890ff', paddingBottom: '2px' }}>
                              {formatSeconds(total)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )
                ) : distinctGridTasks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="grid-empty-cell">
                      <Empty description={isVi ? 'Chưa có công việc nào trong danh sách tuần này. Hãy thêm công việc hoặc ghi nhận giờ làm.' : 'No tasks in weekly timesheet yet. Add a task to start tracking.'} />
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
                            <Tooltip title={isTracking ? (isVi ? 'Dừng tính giờ' : 'Stop Timer') : (isVi ? 'Chạy tính giờ' : 'Start Timer')}>
                              <button 
                                className={`timer-btn ${isTracking ? 'running' : ''}`}
                                onClick={() => handleToggleTimer(task.id)}
                              >
                                {isTracking ? <span className="timer-pulse" /> : <PlayCircleOutlined />}
                              </button>
                            </Tooltip>
                            
                            <div className="task-info">
                              <span className="task-title" onClick={() => {
                                // optional: redirect to task detail or open task panel
                              }}>
                                {task.title}
                              </span>
                              <div className="task-metadata">
                                <span className="project-badge" style={{ borderColor: task.project_color || '#ccc' }}>
                                  <span className="dot" style={{ backgroundColor: task.project_color || '#ccc' }} />
                                  {task.project_name || 'No Project'}
                                </span>
                                <span className="task-status-tag">{task.status}</span>
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
                    {isVi ? 'Đang tải thêm thành viên...' : 'Loading more members...'}
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
                    <h4>{isVi ? 'Chọn công việc đưa vào lưới' : 'Select task to add to grid'}</h4>
                    <div className="popover-search-container">
                      <input 
                        type="text" 
                        placeholder={isVi ? 'Tìm kiếm công việc...' : 'Search task title...'} 
                        className="popover-search-input"
                        onChange={(e) => {
                          // local query search filter if wanted
                        }}
                      />
                    </div>
                    <div className="popover-task-list">
                      {myAssignedTasks.filter(tItem => !distinctGridTasks.some(gt => gt.id === tItem.id)).length === 0 ? (
                        <p className="no-tasks-text">{isVi ? 'Tất cả công việc được giao đã có trên lưới' : 'All assigned tasks are already in timesheet grid'}</p>
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
                  <PlusOutlined /> {isVi ? 'Thêm công việc' : 'Add task'}
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
              <Empty description={isVi ? 'Không tìm thấy nhật ký ghi nhận thời gian nào cho bộ lọc đã chọn.' : 'No detailed log entries found in this timeframe.'} />
            </div>
          ) : (
            <div className="list-table-wrapper">
              <table className="time-entries-list-table">
                <thead>
                  <tr>
                    <th>{isVi ? 'Nhân viên' : 'Member'}</th>
                    <th>{isVi ? 'Công việc' : 'Task'}</th>
                    <th>{isVi ? 'Ghi chú / Mô tả' : 'Description'}</th>
                    <th>{isVi ? 'Thời gian' : 'Time'}</th>
                    <th>{isVi ? 'Thời lượng' : 'Duration'}</th>
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
                          <span className="task-title">{log.task?.title}</span>
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
                          {new Date(log.started_at).toLocaleDateString(isVi ? 'vi-VN' : 'en-US', {
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
                            title={isVi ? 'Xoá bản ghi' : 'Delete log'}
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
      <Modal
        title={
          <div className="log-modal-header">
            <ClockCircleOutlined />
            <span>{isVi ? 'Ghi nhận giờ làm việc thủ công' : 'Manual Time Log'}</span>
          </div>
        }
        open={showLogModal}
        onOk={handleLogManualTime}
        onCancel={() => setShowLogModal(false)}
        okText={isVi ? 'Ghi nhận' : 'Submit Log'}
        cancelText={isVi ? 'Huỷ bỏ' : 'Cancel'}
        className="timesheet-manual-log-modal"
      >
        <div className="manual-log-form">
          <div className="form-item">
            <label>{isVi ? 'Chọn công việc:' : 'Select Task:'}</label>
            <select 
              value={logTask || ''} 
              onChange={(e) => setLogTask(Number(e.target.value))}
              className="modal-form-select"
            >
              {myAssignedTasks.map(task => (
                <option key={task.id} value={task.id}>
                  {task.title} ({task.project_name || 'No Project'})
                </option>
              ))}
            </select>
          </div>

          <div className="form-item row-group">
            <div className="sub-item">
              <label>{isVi ? 'Ngày thực hiện:' : 'Date:'}</label>
              <input 
                type="date" 
                value={logDate} 
                onChange={(e) => setLogDate(e.target.value)}
                className="modal-form-input"
              />
            </div>
          </div>

          <div className="form-item duration-group">
            <label>{isVi ? 'Thời gian thực hiện (Giờ / Phút):' : 'Logged Duration (Hours / Minutes):'}</label>
            <div className="duration-inputs">
              <div className="input-group">
                <input 
                  type="number" 
                  min={0} 
                  max={24}
                  value={logHours} 
                  onChange={(e) => setLogHours(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                />
                <span>{isVi ? 'giờ' : 'hrs'}</span>
              </div>
              <div className="input-group">
                <input 
                  type="number" 
                  min={0} 
                  max={59}
                  value={logMinutes} 
                  onChange={(e) => setLogMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  placeholder="0"
                />
                <span>{isVi ? 'phút' : 'mins'}</span>
              </div>
            </div>
          </div>

          <div className="form-item">
            <label>{isVi ? 'Mô tả / Ghi chú:' : 'Description / Notes:'}</label>
            <textarea 
              placeholder={isVi ? 'Nhập nội dung công việc đã thực hiện...' : 'Describe what you worked on...'} 
              value={logDescription}
              onChange={(e) => setLogDescription(e.target.value)}
              className="modal-form-textarea"
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* Detailed Drawer for Workspace Member */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="avatar-placeholder" style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#1890ff',
              color: 'white',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}>
              {selectedMemberForDrawer?.user?.photo ? (
                <img src={selectedMemberForDrawer.user.photo} alt={selectedMemberForDrawer.user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                selectedMemberForDrawer?.user?.name?.charAt(0).toUpperCase()
              )}
            </div>
            <span>
              {isVi 
                ? `Nhật ký chi tiết - ${selectedMemberForDrawer?.user?.name}` 
                : `Detailed logs - ${selectedMemberForDrawer?.user?.name}`}
            </span>
          </div>
        }
        placement="right"
        width={650}
        onClose={() => setSelectedMemberForDrawer(null)}
        open={!!selectedMemberForDrawer}
        bodyStyle={{ padding: '20px', background: '#141414', color: '#fff' }}
        headerStyle={{ background: '#1f1f1f', borderBottom: '1px solid #303030' }}
      >
        {selectedMemberForDrawer && (
          <div className="member-details-drawer">
            <div style={{ marginBottom: '16px', fontSize: '14px', color: '#a6a6a6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{formattedDateRange}</span>
              <span style={{ fontWeight: 600, color: '#1890ff', fontSize: '15px' }}>
                {isVi ? 'Tổng số giờ:' : 'Total duration:'} {formatSeconds(selectedMemberForDrawer.total)}
              </span>
            </div>

            {selectedMemberForDrawer.logs.length === 0 ? (
              <Empty description={isVi ? 'Không có bản ghi thời gian nào cho tuần này' : 'No time entries recorded for this week'} />
            ) : (
              <div className="drawer-table-wrapper" style={{ overflowX: 'auto' }}>
                <table className="time-entries-list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #303030' }}>
                      <th style={{ padding: '10px', textAlign: 'left', color: '#8c8c8c', fontSize: '12px' }}>{isVi ? 'Công việc' : 'Task'}</th>
                      <th style={{ padding: '10px', textAlign: 'left', color: '#8c8c8c', fontSize: '12px' }}>{isVi ? 'Mô tả' : 'Description'}</th>
                      <th style={{ padding: '10px', textAlign: 'left', color: '#8c8c8c', fontSize: '12px' }}>{isVi ? 'Thời gian' : 'Time'}</th>
                      <th style={{ padding: '10px', textAlign: 'left', color: '#8c8c8c', fontSize: '12px' }}>{isVi ? 'Thời lượng' : 'Duration'}</th>
                      {me?.role === 'admin' && <th style={{ padding: '10px' }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMemberForDrawer.logs.map((log: TimeLog) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #262626' }}>
                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#f0f2f5' }}>{log.task?.title}</span>
                            <span style={{ fontSize: '11px', color: log.task?.project?.color || '#8c8c8c' }}>
                              {log.task?.project?.name || 'No Project'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 10px', color: '#d9d9d9', fontStyle: 'italic', fontSize: '13px' }}>
                          {log.description || '—'}
                        </td>
                        <td style={{ padding: '12px 10px', color: '#8c8c8c', fontSize: '12px' }}>
                          {new Date(log.started_at).toLocaleDateString(isVi ? 'vi-VN' : 'en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ 
                            background: 'rgba(24, 144, 255, 0.1)', 
                            border: '1px solid rgba(24, 144, 255, 0.2)', 
                            color: '#1890ff', 
                            padding: '2px 8px', 
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '12px'
                          }}>
                            {formatSeconds(log.duration)}
                          </span>
                        </td>
                        {me?.role === 'admin' && (
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                            <button 
                              onClick={async () => {
                                await handleDeleteLog(log.id);
                                // Refresh drawer logs inside drawer
                                setSelectedMemberForDrawer((prev: any) => {
                                  if (!prev) return null;
                                  const remainingLogs = prev.logs.filter((l: any) => l.id !== log.id);
                                  const newTotal = remainingLogs.reduce((sum: number, l: any) => sum + l.duration, 0);
                                  return {
                                    ...prev,
                                    logs: remainingLogs,
                                    total: newTotal
                                  };
                                });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#8c8c8c',
                                cursor: 'pointer'
                              }}
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
    </div>
  );
};

export default TimesheetPage;
