import React, { useState } from 'react';
import { Popover, Select } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  FlagOutlined
} from '@ant-design/icons';
import { useTranslation } from '../../utils/i18n';

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

interface TaskCalendarProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  columns: any[];
}

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const TaskCalendar: React.FC<TaskCalendarProps> = ({ tasks, onSelectTask, columns }) => {
  const { t, lang } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const priorityLabels: Record<string, string> = {
    urgent: t('tasks.priority.urgent') || 'Khẩn cấp',
    high: t('tasks.priority.high') || 'Cao',
    medium: t('tasks.priority.medium') || 'Trung bình',
    low: t('tasks.priority.low') || 'Thấp',
    none: t('tasks.priority.none') || 'Không ưu tiên',
  };

  // Month names for English fallback
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Week days
  const weekDays = lang === 'vi' 
    ? ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Generate 10 years before and 10 years after the selected year
  const years: number[] = [];
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i);
  }

  // Month selector options
  const monthOptions = monthNames.map((name, index) => ({
    value: index,
    label: lang === 'vi' ? `Tháng ${index + 1}` : name
  }));

  // Calculate dates of month grid (6 weeks = 42 cells)
  const startOfMonth = new Date(currentYear, currentMonth, 1);
  const startDayOfWeek = startOfMonth.getDay(); // 0 = Sunday
  const startOfCalendar = new Date(startOfMonth);
  startOfCalendar.setDate(startOfMonth.getDate() - startDayOfWeek);

  const calendarDays: Date[] = [];
  const tempDate = new Date(startOfCalendar);
  for (let i = 0; i < 42; i++) {
    calendarDays.push(new Date(tempDate));
    tempDate.setDate(tempDate.getDate() + 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < 6; i++) {
    weeks.push(calendarDays.slice(i * 7, (i + 1) * 7));
  }

  const toDateString = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const getTaskDuration = (task: any) => {
    const startStr = task.start_date ? task.start_date.substring(0, 10) : task.due_date?.substring(0, 10) || '';
    const endStr = task.due_date ? task.due_date.substring(0, 10) : startStr;
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  };

  const compareTasks = (a: any, b: any) => {
    const durA = getTaskDuration(a);
    const durB = getTaskDuration(b);
    if (durA !== durB) return durB - durA; // Longest first
    const startA = a.start_date || a.due_date || '';
    const startB = b.start_date || b.due_date || '';
    if (startA !== startB) return startA.localeCompare(startB);
    return String(a.id).localeCompare(String(b.id));
  };

  return (
    <div className="task-calendar">
      {/* Calendar Header */}
      <div className="task-calendar__header">
        <h2 className="task-calendar__title">
          {lang === 'vi' 
            ? `Tháng ${currentMonth + 1} năm ${currentYear}`
            : `${monthNames[currentMonth]} ${currentYear}`
          }
        </h2>
        <div className="task-calendar__nav">
          <Select
            value={currentMonth}
            onChange={(m) => setCurrentDate(new Date(currentYear, m, 1))}
            options={monthOptions}
            style={{ width: lang === 'vi' ? 120 : 135 }}
            size="middle"
          />
          <Select
            value={currentYear}
            onChange={(y) => setCurrentDate(new Date(y, currentMonth, 1))}
            options={years.map(y => ({ value: y, label: String(y) }))}
            style={{ width: 95 }}
            size="middle"
          />
          <button className="task-calendar__btn" onClick={handleToday}>
            {lang === 'vi' ? 'Hôm nay' : 'Today'}
          </button>
          <div className="task-calendar__arrows">
            <button className="task-calendar__btn icon-btn" onClick={handlePrevMonth}>
              <LeftOutlined />
            </button>
            <button className="task-calendar__btn icon-btn" onClick={handleNextMonth}>
              <RightOutlined />
            </button>
          </div>
        </div>
      </div>

      {/* Week Days Header */}
      <div className="task-calendar__weekdays">
        {weekDays.map(day => (
          <div key={day} className="task-calendar__weekday">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="task-calendar__grid">
        {weeks.map((week, weekIndex) => {
          const weekStartStr = toDateString(week[0]);
          const weekEndStr = toDateString(week[6]);

          // Filter tasks overlapping this week
          const overlappingTasks = tasks.filter(task => {
            if (!task.due_date) return false;
            const taskStartStr = task.start_date ? task.start_date.substring(0, 10) : task.due_date.substring(0, 10);
            const taskEndStr = task.due_date.substring(0, 10);
            return taskStartStr <= weekEndStr && taskEndStr >= weekStartStr;
          });

          // Sort tasks
          overlappingTasks.sort(compareTasks);

          // Assign tasks to tracks
          const tracks: Task[][] = [];
          overlappingTasks.forEach(task => {
            const taskStartStr = task.start_date ? task.start_date.substring(0, 10) : task.due_date?.substring(0, 10) || '';
            const taskEndStr = task.due_date ? task.due_date.substring(0, 10) : taskStartStr;

            let assignedTrackIndex = -1;
            for (let i = 0; i < tracks.length; i++) {
              const hasOverlap = tracks[i].some(existingTask => {
                const existingStartStr = existingTask.start_date ? existingTask.start_date.substring(0, 10) : existingTask.due_date?.substring(0, 10) || '';
                const existingEndStr = existingTask.due_date ? existingTask.due_date.substring(0, 10) : existingStartStr;
                return !(taskEndStr < existingStartStr || taskStartStr > existingEndStr);
              });

              if (!hasOverlap) {
                assignedTrackIndex = i;
                break;
              }
            }

            if (assignedTrackIndex === -1) {
              tracks.push([task]);
            } else {
              tracks[assignedTrackIndex].push(task);
            }
          });

          return (
            <div key={weekIndex} className="task-calendar__week">
              {/* Background Grid Cells */}
              <div className="task-calendar__week-bg">
                {week.map((day, dayIndex) => {
                  const isCurrentMonth = day.getMonth() === currentMonth;
                  const classes = `task-calendar__day ${!isCurrentMonth ? 'outside-month' : ''} ${isToday(day) ? 'today' : ''}`;
                  return (
                    <div key={dayIndex} className={classes}>
                      <span className="task-calendar__day-number">{day.getDate()}</span>
                    </div>
                  );
                })}
              </div>

              {/* Event Overlays Grid */}
              <div className="task-calendar__week-events">
                {tracks.map((track, trackIndex) => (
                  <div key={trackIndex} className="task-calendar__track">
                    {track.map(task => {
                      const taskStart = task.start_date ? new Date(task.start_date.substring(0, 10)) : new Date(task.due_date!.substring(0, 10));
                      const taskEnd = new Date(task.due_date!.substring(0, 10));

                      const startCol = taskStart < week[0] ? 0 : Math.round((taskStart.getTime() - week[0].getTime()) / (1000 * 60 * 60 * 24));
                      const endCol = taskEnd > week[6] ? 6 : Math.round((taskEnd.getTime() - week[0].getTime()) / (1000 * 60 * 60 * 24));

                      const getTaskStatusInfo = () => {
                        const projectStatuses = (task as any).project?.statuses || [];
                        const projectStatusObj = projectStatuses.find((s: any) => s.id === task.status);
                        if (projectStatusObj) {
                          return {
                            label: projectStatusObj.name,
                            color: projectStatusObj.color,
                            isClosed: projectStatusObj.type === 'closed'
                          };
                        }
                        const colObj = columns.find((col: any) => col.key === task.status);
                        if (colObj) {
                          return {
                            label: colObj.label,
                            color: colObj.color,
                            isClosed: colObj.type === 'closed' || task.status === 'done'
                          };
                        }
                        return {
                          label: task.status.toUpperCase(),
                          color: '#9ca0b0',
                          isClosed: task.status === 'done'
                        };
                      };

                      const statusInfo = getTaskStatusInfo();
                      const statusLabel = statusInfo.label;
                      const statusColor = statusInfo.color || '#9ca0b0';
                      const isClosed = statusInfo.isClosed;

                      const popoverContent = (
                        <div style={{ minWidth: '220px', padding: '4px' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                            {task.title}
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                            {/* Status */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--text-secondary)', minWidth: '85px', flexShrink: 0 }}>
                                {t('tasks.panel.status' as any) || 'Trạng thái'}:
                              </span>
                              <span style={{ 
                                background: `${statusColor}1a`,
                                color: statusColor,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 600,
                                fontSize: '10px'
                              }}>
                                {statusLabel}
                              </span>
                            </div>

                            {/* Assignee */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--text-secondary)', minWidth: '85px', flexShrink: 0 }}>
                                {t('tasks.panel.assignee' as any) || 'Người thực hiện'}:
                              </span>
                              {task.assignee ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <div style={{ 
                                    background: '#6366f1', 
                                    width: '20px', 
                                    height: '20px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    borderRadius: '50%', 
                                    color: '#fff', 
                                    fontSize: '9px', 
                                    fontWeight: 600,
                                    overflow: 'hidden' 
                                  }}>
                                    {task.assignee.photo ? (
                                      <img src={task.assignee.photo} alt={task.assignee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      getInitials(task.assignee.name)
                                    )}
                                  </div>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{task.assignee.name}</span>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>
                                  {t('tasks.panel.unassigned' as any) || 'Chưa giao'}
                                </span>
                              )}
                            </div>

                            {/* Priority */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--text-secondary)', minWidth: '85px', flexShrink: 0 }}>
                                {t('tasks.panel.priority' as any) || 'Độ ưu tiên'}:
                              </span>
                              <span style={{ 
                                color: task.priority === 'urgent' ? '#ef4444' : task.priority === 'high' ? '#f97316' : task.priority === 'medium' ? '#f59e0b' : task.priority === 'low' ? '#3b82f6' : 'var(--text-muted)',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <FlagOutlined style={{ fontSize: '10px' }} />
                                {priorityLabels[task.priority] || task.priority}
                              </span>
                            </div>

                            {/* Dates */}
                            {(task.start_date || task.due_date) && (
                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {task.start_date && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--text-secondary)', minWidth: '85px', flexShrink: 0 }}>
                                      {t('tasks.panel.start_date' as any) || 'Bắt đầu'}:
                                    </span>
                                    <span style={{ color: 'var(--text-primary)' }}>
                                      {formatDateTime(task.start_date)}
                                    </span>
                                  </div>
                                )}
                                {task.due_date && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--text-secondary)', minWidth: '85px', flexShrink: 0 }}>
                                      {t('tasks.panel.deadline' as any) || 'Hạn chót'}:
                                    </span>
                                    <span style={{ color: 'var(--text-primary)' }}>
                                      {formatDateTime(task.due_date)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );

                      // Visual states for styling contiguous event bar
                      const isTaskStart = taskStart.getTime() >= week[0].getTime();
                      const isTaskEnd = taskEnd.getTime() <= week[6].getTime();

                      return (
                        <Popover key={task.id} content={popoverContent} trigger="hover" placement="top" overlayStyle={{ zIndex: 1050 }}>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTask(task);
                            }}
                            className="task-calendar__event"
                            style={{
                              gridColumn: `${startCol + 1} / ${endCol + 2}`,
                              background: isClosed ? 'rgba(34, 197, 94, 0.12)' : `${statusColor}1c`,
                              borderLeft: isTaskStart ? `3px solid ${isClosed ? '#22c55e' : statusColor}` : 'none',
                              borderRadius: `${isTaskStart ? '3px' : '0px'} ${isTaskEnd ? '3px' : '0px'} ${isTaskEnd ? '3px' : '0px'} ${isTaskStart ? '3px' : '0px'}`,
                              marginLeft: isTaskStart ? '8px' : '0px',
                              marginRight: isTaskEnd ? '8px' : '0px',
                            }}
                          >
                            <span className="task-calendar__event-title">
                              {task.title}
                            </span>
                          </div>
                        </Popover>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
