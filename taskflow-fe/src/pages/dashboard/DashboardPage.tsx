import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin, message } from 'antd';
import { TaskDetailPanel } from '../../components/tasks/TaskDetailPanel';
import {
  ProjectOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import { useTranslation } from '../../utils/i18n';
import './DashboardPage.scss';
import TaskTypeBadge from '../../components/tasks/TaskTypeBadge';

interface DashboardData {
  stats: {
    total_projects: number;
    active_tasks: number;
    overdue_tasks: number;
    completed_tasks: number;
  };
  my_tasks: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    project_id?: number | null;
    project_name: string;
    project_color: string;
    project_statuses?: any[];
    type?: string;
    due_date: string | null;
    is_overdue: boolean;
    assignee_initials: string;
    assignee_photo?: string | null;
  }>;
  activities: Array<{
    id: number;
    user_name: string;
    user_photo: string | null;
    action: string;
    details: string;
    task_title: string;
    task_id: number;
    project_name: string;
    created_at: string;
  }>;
  project_progress: Array<{
    id: number;
    name: string;
    color: string;
    progress: number;
    total_tasks: number;
    done_tasks: number;
  }>;
  upcoming_deadlines: Array<{
    id: number;
    title: string;
    due_date: string;
    project_id?: number | null;
    is_today: boolean;
    is_tomorrow: boolean;
    project_name: string;
    project_color: string;
  }>;
}

const getTaskStatusInfo = (task: any) => {
  const statuses = task.project_statuses && task.project_statuses.length > 0 ? task.project_statuses : [
    { id: 'backlog', name: 'BACKLOG', color: '#6b7084', type: 'not_started' },
    { id: 'todo', name: 'TO DO', color: '#9ca0b0', type: 'not_started' },
    { id: 'in_progress', name: 'IN PROGRESS', color: '#3b82f6', type: 'active' },
    { id: 'review', name: 'REVIEW', color: '#a855f7', type: 'active' },
    { id: 'done', name: 'COMPLETE', color: '#22c55e', type: 'closed' }
  ];
  
  const current = statuses.find((s: any) => s.id === task.status) || {
    id: task.status,
    color: task.status === 'done' ? '#22c55e' : (task.status === 'in_progress' ? '#3b82f6' : (task.status === 'review' ? '#a855f7' : '#9ca0b0')),
    type: task.status === 'done' ? 'closed' : (task.status === 'todo' ? 'not_started' : 'active')
  };

  const idx = statuses.findIndex((s: any) => s.id === current.id);
  const percentage = statuses.length > 0 ? ((idx + 1) / statuses.length) * 100 : 25;
  const isClosed = current.type === 'closed' || task.status === 'done';

  return {
    color: current.color,
    percentage,
    isClosed
  };
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, lang, locale } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [greeting, setGreeting] = useState('');


  const fetchDashboardData = async () => {
    try {
      const dashRes = await api.getDashboardStats();
      if (dashRes?.success) setData(dashRes.data);
    } catch (err) {
      console.error('Dashboard data refresh error:', err);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const meRes = await api.getMe();
        if (meRes) setProfile(meRes);
        await fetchDashboardData();
      } catch (err) {
        console.error('Dashboard load error:', err);
        message.error(t('dashboard.load_error' as any) || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const getGreetingText = () => {
      const hour = new Date().getHours();
      const name = profile?.name ? (profile.name.split(' ').pop() || profile.name) : t('dashboard.user_fallback');
      
      let greetings: string[] = [];
      if (lang === 'vi') {
        if (hour >= 5 && hour < 12) {
          greetings = [
            `Chào buổi sáng, ${name} 👋`,
            `Chào ngày mới tốt lành, ${name}! ☀️`,
            `Ngày mới làm việc đầy năng lượng nhé, ${name}! 🚀`,
            `Chúc ${name} một buổi sáng tuyệt vời! ✨`
          ];
        } else if (hour >= 12 && hour < 14) {
          greetings = [
            `Chào buổi trưa, ${name} 👋`,
            `Chúc ${name} buổi trưa vui vẻ và thư giãn! ☕`,
            `Chúc ${name} có một giờ nghỉ trưa dễ chịu! 🍀`,
            `Buổi trưa vui vẻ nhé, ${name}! ✨`
          ];
        } else if (hour >= 14 && hour < 18) {
          greetings = [
            `Chào buổi chiều, ${name} 👋`,
            `Chúc ${name} buổi chiều tốt lành! ☀️`,
            `Buổi chiều làm việc thật năng suất nhé, ${name}! 🚀`,
            `Chúc ${name} hoàn thành tốt công việc chiều nay! ✨`
          ];
        } else {
          greetings = [
            `Chào buổi tối, ${name} 👋`,
            `Chúc ${name} có một buổi tối vui vẻ! 🌙`,
            `Đã đến tối rồi, nghỉ ngơi thôi nào ${name}! ☕`,
            `Chúc ${name} buổi tối ấm áp bên gia đình! ✨`
          ];
        }
      } else {
        if (hour >= 5 && hour < 12) {
          greetings = [
            `Good morning, ${name} 👋`,
            `Have a great morning, ${name}! ☀️`,
            `Rise and shine, ${name}! 🚀`,
            `Wishing you a wonderful morning, ${name}! ✨`
          ];
        } else if (hour >= 12 && hour < 14) {
          greetings = [
            `Good day, ${name} 👋`,
            `Hope your day is going well, ${name}! ☕`,
            `Have a pleasant afternoon, ${name}! 🍀`,
            `Enjoy your lunch break, ${name}! ✨`
          ];
        } else if (hour >= 14 && hour < 18) {
          greetings = [
            `Good afternoon, ${name} 👋`,
            `Hope you're having a productive afternoon, ${name}! 🚀`,
            `Almost there! Have a great afternoon, ${name}! ☀️`,
            `Wishing you a nice afternoon, ${name}! ✨`
          ];
        } else {
          greetings = [
            `Good evening, ${name} 👋`,
            `Hope you're having a relaxing evening, ${name}! 🌙`,
            `Have a peaceful evening, ${name}! ☕`,
            `Wishing you a cozy evening, ${name}! ✨`
          ];
        }
      }
      const randomIndex = Math.floor(Math.random() * greetings.length);
      return greetings[randomIndex];
    };

    setGreeting(getGreetingText());
  }, [profile, lang]);

  // Format relative time
  const timeAgo = (iso: string): string => {
    const now = Date.now();
    const diff = now - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('dashboard.time.just_now');
    if (mins < 60) return t('dashboard.time.minutes_ago', { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('dashboard.time.hours_ago', { n: hrs });
    const days = Math.floor(hrs / 24);
    return t('dashboard.time.days_ago', { n: days });
  };

  // Format due date for display
  const formatDueDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  };

  // Render activity description with full translation support
  const renderActivityText = (act: any) => {
    const details = act.details || '';
    const taskLink = (
      <span
        className="highlight"
        style={{ cursor: 'pointer', textDecoration: 'underline' }}
        onClick={() => setSelectedTaskId(act.task_id)}
      >
        {act.task_title}
      </span>
    );

    const getStatusText = (statusId: string) => {
      if (statusId === 'todo') return t('timesheet.status.todo');
      if (statusId === 'in_progress') return t('timesheet.status.in_progress');
      if (statusId === 'review') return t('timesheet.status.review');
      if (statusId === 'done') return t('timesheet.status.done');
      if (statusId === 'backlog') return t('timesheet.status.backlog');
      return statusId;
    };

    if (act.action === 'created') {
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã tạo công việc' : 'created task'} {taskLink}
        </>
      );
    }

    if (act.action === 'updated_status') {
      const match = details.match(/Changed status from '(.*)' to '(.*)'/);
      if (match) {
        const fromName = getStatusText(match[1]);
        const toName = getStatusText(match[2]);
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã đổi trạng thái của' : 'changed status of'} {taskLink} {lang === 'vi' ? `từ "${fromName}" sang "${toName}"` : `from "${fromName}" to "${toName}"`}
          </>
        );
      }
      const autoMatch = details.match(/Auto-transitioned status from '(.*)' to '(.*)' after all reviews approved/);
      if (autoMatch) {
        const fromName = getStatusText(autoMatch[1]);
        const toName = getStatusText(autoMatch[2]);
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã tự động chuyển trạng thái của' : 'auto-transitioned status of'} {taskLink} {lang === 'vi' ? `từ "${fromName}" sang "${toName}" sau khi toàn bộ phê duyệt được thông qua` : `from "${fromName}" to "${toName}" after all reviews approved`}
          </>
        );
      }
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã đổi trạng thái của' : 'changed status of'} {taskLink}
        </>
      );
    }

    if (act.action === 'updated_assignee') {
      if (details.includes('Removed assignee')) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã bỏ phân công người thực hiện công việc' : 'removed assignee from task'} {taskLink}
          </>
        );
      }
      const match = details.match(/Assigned to (.*)/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã giao công việc' : 'assigned task'} {taskLink} {lang === 'vi' ? `cho ${match[1]}` : `to ${match[1]}`}
          </>
        );
      }
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã thay đổi người thực hiện công việc' : 'changed assignee of task'} {taskLink}
        </>
      );
    }

    if (act.action === 'commented') {
      const match = details.match(/Posted a comment: "(.*)"/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã bình luận vào công việc' : 'commented on task'} {taskLink}: <span style={{ fontStyle: 'italic' }}>"{match[1]}"</span>
          </>
        );
      }
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã bình luận vào công việc' : 'commented on task'} {taskLink}
        </>
      );
    }

    if (act.action === 'started_timer') {
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã bắt đầu bấm giờ cho công việc' : 'started timer for task'} {taskLink}
        </>
      );
    }

    if (act.action === 'stopped_timer') {
      const match = details.match(/Logged (.*)\./);
      const rawDuration = match ? match[1] : '';
      let duration = rawDuration;
      if (lang === 'vi') {
        duration = duration.replace(/h/g, 'h').replace(/m/g, 'p').replace(/s/g, 's');
      }

      if (details.includes('due to starting timer on another task')) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã dừng bấm giờ' : 'stopped timer for'} {taskLink} {lang === 'vi' ? `(do bấm giờ ở task khác - Ghi nhận ${duration})` : `(due to starting timer on another task - Logged ${duration})`}
          </>
        );
      }
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã dừng bấm giờ cho công việc' : 'stopped timer for task'} {taskLink} {lang === 'vi' ? `(Ghi nhận ${duration})` : `(Logged ${duration})`}
        </>
      );
    }

    if (act.action === 'added_time') {
      const durationMatch = details.match(/Manually added ([^\.]+)\./);
      const rawDuration = durationMatch ? durationMatch[1] : '';
      let duration = rawDuration;
      if (lang === 'vi') {
        duration = duration.replace(/h/g, 'h').replace(/m/g, 'p').replace(/s/g, 's');
      }

      const noteMatch = details.match(/Note: (.*)/);
      const noteText = noteMatch ? (lang === 'vi' ? ` với ghi chú: "${noteMatch[1]}"` : ` with note: "${noteMatch[1]}"`) : '';
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã thêm thủ công' : 'manually added'} {duration} {lang === 'vi' ? 'cho công việc' : 'to task'} {taskLink}{noteText}
        </>
      );
    }

    if (act.action === 'deleted_time') {
      const match = details.match(/Deleted time log ([^\.]+)\./);
      const rawDuration = match ? match[1] : '';
      let duration = rawDuration;
      if (lang === 'vi') {
        duration = duration.replace(/h/g, 'h').replace(/m/g, 'p').replace(/s/g, 's');
      }
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã xóa log thời gian' : 'deleted time log'} {duration} {lang === 'vi' ? 'của công việc' : 'from task'} {taskLink}
        </>
      );
    }

    if (act.action === 'updated_title') {
      const match = details.match(/Updated title to '(.*)'/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã đổi tên công việc thành' : 'renamed task to'} "{match[1]}"
          </>
        );
      }
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã đổi tên công việc' : 'renamed task'} {taskLink}
        </>
      );
    }

    if (act.action === 'updated_description') {
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã cập nhật mô tả của công việc' : 'updated description of task'} {taskLink}
        </>
      );
    }

    if (act.action === 'updated_estimated_hours') {
      const match = details.match(/Updated estimated hours to (.*)/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã cập nhật thời gian ước tính công việc' : 'updated estimated hours for task'} {taskLink} {lang === 'vi' ? `thành ${match[1]} giờ` : `to ${match[1]}h`}
          </>
        );
      }
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã cập nhật thời gian ước tính công việc' : 'updated estimated hours for task'} {taskLink}
        </>
      );
    }

    if (act.action === 'updated_actual_hours') {
      const match = details.match(/Updated actual hours to (.*)/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã cập nhật thời gian thực tế công việc' : 'updated actual hours for task'} {taskLink} {lang === 'vi' ? `thành ${match[1]} giờ` : `to ${match[1]}h`}
          </>
        );
      }
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã cập nhật thời gian thực tế công việc' : 'updated actual hours for task'} {taskLink}
        </>
      );
    }

    if (act.action === 'updated_priority') {
      const match = details.match(/Changed priority to '(.*)'/);
      const prio = match ? match[1] : '';
      const prioLabel = prio ? t(`tasks.priority.${prio}` as any) : prio;
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã thay đổi độ ưu tiên công việc' : 'changed priority of task'} {taskLink} {lang === 'vi' ? `thành "${prioLabel}"` : `to "${prioLabel}"`}
        </>
      );
    }

    if (act.action === 'updated_start_date') {
      const match = details.match(/Changed start date to (.*)/);
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã thay đổi ngày bắt đầu công việc' : 'changed start date of task'} {taskLink} {match ? (lang === 'vi' ? `thành ${match[1]}` : `to ${match[1]}`) : ''}
        </>
      );
    }

    if (act.action === 'updated_due_date') {
      const match = details.match(/Changed due date to (.*)/);
      return (
        <>
          <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã thay đổi hạn chót công việc' : 'changed due date of task'} {taskLink} {match ? (lang === 'vi' ? `thành ${match[1]}` : `to ${match[1]}`) : ''}
        </>
      );
    }

    if (act.action === 'added_attachment') {
      const match = details.match(/Attached file "(.*)"/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã đính kèm tệp' : 'attached file'} <span style={{ fontStyle: 'italic' }}>"{match[1]}"</span> {lang === 'vi' ? 'vào công việc' : 'to task'} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'renamed_attachment') {
      const match = details.match(/Renamed attachment "(.*)" to "(.*)"/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã đổi tên tệp đính kèm' : 'renamed attachment'} <span style={{ fontStyle: 'italic' }}>"{match[1]}"</span> {lang === 'vi' ? 'thành' : 'to'} <span style={{ fontStyle: 'italic' }}>"{match[2]}"</span> {lang === 'vi' ? 'trong công việc' : 'in task'} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'deleted_attachment') {
      const match = details.match(/Deleted attachment "(.*)"/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã xóa tệp đính kèm' : 'deleted attachment'} <span style={{ fontStyle: 'italic' }}>"{match[1]}"</span> {lang === 'vi' ? 'khỏi công việc' : 'from task'} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'created_checklist') {
      const match = details.match(/Created checklist: "(.*)"/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã tạo checklist' : 'created checklist'} <span style={{ fontStyle: 'italic' }}>"{match[1]}"</span> {lang === 'vi' ? 'trong công việc' : 'in task'} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'updated_checklist') {
      const match = details.match(/Renamed checklist to "(.*)"/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã đổi tên checklist thành' : 'renamed checklist to'} <span style={{ fontStyle: 'italic' }}>"{match[1]}"</span> {lang === 'vi' ? 'trong công việc' : 'in task'} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'deleted_checklist') {
      const match = details.match(/Deleted checklist "(.*)"/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã xóa checklist' : 'deleted checklist'} <span style={{ fontStyle: 'italic' }}>"{match[1]}"</span> {lang === 'vi' ? 'khỏi công việc' : 'from task'} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'created_checklist_item') {
      const match = details.match(/Added item "(.*)" to checklist "(.*)"/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã thêm mục' : 'added item'} <span style={{ fontStyle: 'italic' }}>"{match[1]}"</span> {lang === 'vi' ? 'vào checklist' : 'to checklist'} <span style={{ fontStyle: 'italic' }}>"{match[2]}"</span> {lang === 'vi' ? 'của công việc' : 'of task'} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'updated_checklist_item') {
      const checkedMatch = details.match(/Marked item "(.*)" as (checked|unchecked)/);
      if (checkedMatch) {
        const itemName = checkedMatch[1];
        const isChecked = checkedMatch[2] === 'checked';
        if (lang === 'vi') {
          return (
            <>
              <strong>{act.user_name}</strong> đã đánh dấu mục <span style={{ fontStyle: 'italic' }}>"{itemName}"</span> là {isChecked ? 'đã hoàn thành' : 'chưa hoàn thành'} trong công việc {taskLink}
            </>
          );
        } else {
          return (
            <>
              <strong>{act.user_name}</strong> marked item <span style={{ fontStyle: 'italic' }}>"{itemName}"</span> as {isChecked ? 'checked' : 'unchecked'} in task {taskLink}
            </>
          );
        }
      }

      const renameMatch = details.match(/Renamed checklist item "(.*)" to "(.*)"/);
      if (renameMatch) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã đổi tên mục checklist' : 'renamed checklist item'} <span style={{ fontStyle: 'italic' }}>"{renameMatch[1]}"</span> {lang === 'vi' ? 'thành' : 'to'} <span style={{ fontStyle: 'italic' }}>"{renameMatch[2]}"</span> {lang === 'vi' ? 'trong công việc' : 'in task'} {taskLink}
          </>
        );
      }

      const updateMatch = details.match(/Updated item "(.*)" in checklist "(.*)"/);
      if (updateMatch) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã cập nhật mục' : 'updated item'} <span style={{ fontStyle: 'italic' }}>"{updateMatch[1]}"</span> {lang === 'vi' ? 'trong checklist' : 'in checklist'} <span style={{ fontStyle: 'italic' }}>"{updateMatch[2]}"</span> {lang === 'vi' ? 'của công việc' : 'of task'} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'deleted_checklist_item') {
      const match = details.match(/Deleted item "(.*)" from checklist "(.*)"/);
      if (match) {
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? 'đã xóa mục' : 'deleted item'} <span style={{ fontStyle: 'italic' }}>"{match[1]}"</span> {lang === 'vi' ? 'khỏi checklist' : 'from checklist'} <span style={{ fontStyle: 'italic' }}>"{match[2]}"</span> {lang === 'vi' ? 'của công việc' : 'of task'} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'converted_checklist_item') {
      const match = details.match(/Converted item "(.*)" to (task|subtask)/);
      if (match) {
        const typeLabel = match[2] === 'subtask' ? (lang === 'vi' ? 'công việc con' : 'subtask') : (lang === 'vi' ? 'công việc' : 'task');
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? `đã chuyển đổi mục "${match[1]}" thành ${typeLabel} của công việc` : `converted item "${match[1]}" to ${typeLabel} of task`} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'linked_task') {
      const match = details.match(/Linked this task \((.*)\) to #(\d+) '(.*)'/);
      if (match) {
        const type = match[1];
        const targetId = match[2];
        const targetTitle = match[3];
        const typeLabels: Record<string, string> = lang === 'vi' ? {
          'blocks': 'chặn',
          'is blocked by': 'bị chặn bởi',
          'relates to': 'liên quan đến',
          'duplicates': 'trùng lặp với',
          'is duplicated by': 'bị trùng lặp bởi',
          'clones': 'nhân bản',
          'is cloned from': 'được nhân bản từ',
          'causes': 'nguyên nhân của',
          'is caused by': 'gây ra bởi'
        } : {};
        const typeLabel = typeLabels[type] || type;
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? `đã liên kết công việc này (${typeLabel}) với công việc #${targetId} "${targetTitle}"` : `linked this task (${type}) to task #${targetId} "${targetTitle}"`}
          </>
        );
      }
    }

    if (act.action === 'unlinked_task') {
      const match = details.match(/Removed link \((.*)\) to #(\d+) '(.*)'/);
      if (match) {
        const type = match[1];
        const targetId = match[2];
        const targetTitle = match[3];
        const typeLabels: Record<string, string> = lang === 'vi' ? {
          'blocks': 'chặn',
          'is blocked by': 'bị chặn bởi',
          'relates to': 'liên quan đến',
          'duplicates': 'trùng lặp với',
          'is duplicated by': 'bị trùng lặp bởi',
          'clones': 'nhân bản',
          'is cloned from': 'được nhân bản từ',
          'causes': 'nguyên nhân của',
          'is caused by': 'gây ra bởi'
        } : {};
        const typeLabel = typeLabels[type] || type;
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? `đã gỡ bỏ liên kết (${typeLabel}) với công việc #${targetId} "${targetTitle}"` : `removed link (${type}) to task #${targetId} "${targetTitle}"`}
          </>
        );
      }
    }

    if (act.action === 'added_assignee' || act.action === 'added_reviewer' || act.action === 'added_reporter') {
      const match = details.match(/Added (.*) as (assignee|reviewer|reporter)/);
      if (match) {
        const name = match[1];
        const role = match[2];
        const roleLabels: Record<string, string> = lang === 'vi' ? {
          'assignee': 'người thực hiện',
          'reviewer': 'người phê duyệt',
          'reporter': 'người báo cáo'
        } : {};
        const roleLabel = roleLabels[role] || role;
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? `đã thêm ${name} làm ${roleLabel} cho công việc` : `added ${name} as ${role} to task`} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'removed_assignee' || act.action === 'removed_reviewer' || act.action === 'removed_reporter') {
      const match = details.match(/Removed (.*) from task/);
      if (match) {
        const name = match[1];
        const role = act.action.replace('removed_', '');
        const roleLabels: Record<string, string> = lang === 'vi' ? {
          'assignee': 'người thực hiện',
          'reviewer': 'người phê duyệt',
          'reporter': 'người báo cáo'
        } : {};
        const roleLabel = roleLabels[role] || role;
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? `đã xóa ${name} khỏi vai trò ${roleLabel} của công việc` : `removed ${name} (${role}) from task`} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'changed_role') {
      const match = details.match(/Changed (.*)'s role from (assignee|reviewer|reporter) to (assignee|reviewer|reporter)/);
      if (match) {
        const name = match[1];
        const fromRole = match[2];
        const toRole = match[3];
        const roleLabels: Record<string, string> = lang === 'vi' ? {
          'assignee': 'người thực hiện',
          'reviewer': 'người phê duyệt',
          'reporter': 'người báo cáo'
        } : {};
        return (
          <>
            <strong>{act.user_name}</strong> {lang === 'vi' ? `đã đổi vai trò của ${name} từ ${roleLabels[fromRole] || fromRole} thành ${roleLabels[toRole] || toRole} trong công việc` : `changed ${name}'s role from ${fromRole} to ${toRole} in task`} {taskLink}
          </>
        );
      }
    }

    if (act.action === 'review_approved' || act.action === 'review_rejected') {
      const isApproved = act.action === 'review_approved';
      const commentMatch = details.match(/Comment: (.*)/);
      const commentText = commentMatch ? `: "${commentMatch[1]}"` : '';
      const transitionMatch = details.match(/transition '(.*)'/);
      const transitionLabel = transitionMatch ? ` (${transitionMatch[1]})` : '';
      if (lang === 'vi') {
        return (
          <>
            <strong>{act.user_name}</strong> đã {isApproved ? 'phê duyệt' : 'từ chối'} yêu cầu review cho bước chuyển{transitionLabel} của công việc {taskLink}{commentText}
          </>
        );
      } else {
        return (
          <>
            <strong>{act.user_name}</strong> {isApproved ? 'approved' : 'rejected'} review for transition{transitionLabel} on task {taskLink}{commentText}
          </>
        );
      }
    }

    // Default fallback
    const fallbackMap: Record<string, string> = lang === 'vi' ? {
      created: 'đã tạo',
      updated: 'đã cập nhật',
      updated_status: 'đã đổi trạng thái',
      updated_assignee: 'đã giao lại',
      commented: 'đã bình luận vào',
      deleted: 'đã xóa',
    } : {
      created: 'created',
      updated: 'updated',
      updated_status: 'changed status of',
      updated_assignee: 'reassigned',
      commented: 'commented on',
      deleted: 'deleted',
    };
    const translatedActionText = fallbackMap[act.action] || act.action;
    return (
      <>
        <strong>{act.user_name}</strong> {translatedActionText} {taskLink}
        {act.details && <span style={{ color: 'var(--text-muted)' }}> — {act.details}</span>}
      </>
    );
  };

  // Get avatar color from name
  const getAvatarColor = (name: string): string => {
    const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#3b82f6'];
    const charSum = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return colors[charSum % colors.length];
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const stats = data?.stats;

  const statCards = [
    { key: 'projects', label: t('dashboard.total_projects'), value: stats?.total_projects ?? 0, icon: <ProjectOutlined />, iconClass: 'projects' },
    { key: 'active', label: t('dashboard.active_tasks'), value: stats?.active_tasks ?? 0, icon: <ThunderboltOutlined />, iconClass: 'active' },
    { key: 'overdue', label: t('dashboard.overdue'), value: stats?.overdue_tasks ?? 0, icon: <ClockCircleOutlined />, iconClass: 'overdue' },
    { key: 'completed', label: t('dashboard.completed'), value: stats?.completed_tasks ?? 0, icon: <CheckCircleOutlined />, iconClass: 'completed' },
  ];

  const greetingName = profile?.name?.split(' ')[0] || 'User';

  return (
    <div className="dashboard">
      {/* Greeting */}
      <div className="dashboard__greeting">
        <h1>{greeting || t('dashboard.greeting', { name: greetingName })}</h1>
        <p>{t('dashboard.sub_greeting', { count: stats?.active_tasks ?? 0 })}</p>
      </div>

      {/* Stat Cards */}
      <div className="dashboard__stats">
        {statCards.map((stat) => (
          <div
            key={stat.key}
            className={`dashboard__stat-card dashboard__stat-card--${stat.key}`}
            onClick={() => {
              if (stat.key === 'projects') {
                navigate('/projects');
              } else {
                const filterVal = stat.key === 'completed' ? 'done' : stat.key;
                navigate(`/my-tasks?filter=${filterVal}`);
              }
            }}
          >
            <div className="dashboard__stat-card-header">
              <div className={`dashboard__stat-card-icon dashboard__stat-card-icon--${stat.iconClass}`}>
                {stat.icon}
              </div>
              {stat.key === 'overdue' && stat.value > 0 && (
                <span className="dashboard__stat-card-trend down">
                  <ArrowDownOutlined /> {stat.value}
                </span>
              )}
              {stat.key === 'completed' && stat.value > 0 && (
                <span className="dashboard__stat-card-trend up">
                  <ArrowUpOutlined /> {stat.value}
                </span>
              )}
            </div>
            <div className="dashboard__stat-card-value">{stat.value}</div>
            <div className="dashboard__stat-card-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="dashboard__grid">
        {/* Left: My Tasks */}
        <div>
          <div className="dashboard__widget">
            <div className="dashboard__widget-header">
              <h3>{t('tasks.title')}</h3>
              <button className="view-all" onClick={() => navigate('/my-tasks')}>{t('dashboard.view_all')} →</button>
            </div>
            <div className="dashboard__task-list">
              {(!data?.my_tasks || data.my_tasks.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {t('dashboard.no_tasks')}
                </div>
              ) : (
                data.my_tasks.map((task) => (
                  <div key={task.id} className="dashboard__task-item" onClick={() => {
                    setSelectedTaskId(task.id);
                  }}>
                    <div className={`dashboard__task-item-priority dashboard__task-item-priority--${task.priority}`} />
                    {(() => {
                      const { color, percentage, isClosed } = getTaskStatusInfo(task);
                      return (
                        <div
                          className={`dashboard__task-item-status ${isClosed ? 'done' : ''}`}
                          style={{
                            borderColor: color,
                            backgroundColor: isClosed ? color : 'transparent',
                            color: isClosed ? 'white' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                          }}
                        >
                          {isClosed ? (
                            <CheckOutlined style={{ fontSize: '8px' }} />
                          ) : (
                            <div style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: `conic-gradient(${color} 0% ${percentage}%, transparent ${percentage}% 100%)`
                            }} />
                          )}
                        </div>
                      );
                    })()}
                    <div className="dashboard__task-item-content">
                      <div className="dashboard__task-item-title">
                        <TaskTypeBadge type={task.type || 'task'} size="icon" />
                        <span style={{ flex: 1, wordBreak: 'break-word', whiteSpace: 'normal' }}>{task.title}</span>
                      </div>
                      <div className="dashboard__task-item-meta">
                        <span className="dashboard__task-item-project">
                          <span className="dot" style={{ background: task.project_color }} />
                          {task.project_name}
                        </span>
                      </div>
                    </div>
                    <span className={`dashboard__task-item-date ${task.is_overdue ? 'overdue' : ''}`}>
                      {formatDueDate(task.due_date)}
                    </span>
                    <div 
                      className="dashboard__task-item-avatar"
                      style={{
                        background: task.assignee_photo ? 'none' : undefined,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {task.assignee_photo ? (
                        <img 
                          src={task.assignee_photo} 
                          alt={task.assignee_initials} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
                        />
                      ) : (
                        task.assignee_initials
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="dashboard__widget" style={{ marginTop: 20 }}>
            <div className="dashboard__widget-header">
              <h3>{t('dashboard.recent_activity')}</h3>
            </div>
            <div className="dashboard__activity-list">
              {(!data?.activities || data.activities.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {t('dashboard.no_activity')}
                </div>
              ) : (
                data.activities.map((act) => (
                  <div key={act.id} className="dashboard__activity-item">
                    <div 
                      className="dashboard__activity-avatar" 
                      style={{ 
                        background: act.user_photo ? 'none' : getAvatarColor(act.user_name),
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {act.user_photo ? (
                        <img 
                          src={act.user_photo} 
                          alt={act.user_name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
                        />
                      ) : (
                        act.user_name.charAt(0)
                      )}
                    </div>
                    <div className="dashboard__activity-content">
                      <p>
                        {renderActivityText(act)}
                      </p>
                      <div className="time">{timeAgo(act.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="dashboard__right">
          {/* Project Progress */}
          <div className="dashboard__widget">
            <div className="dashboard__widget-header">
              <h3>{t('dashboard.project_progress')}</h3>
            </div>
            <div className="dashboard__project-list">
              {(!data?.project_progress || data.project_progress.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {t('dashboard.no_projects')}
                </div>
              ) : (
                data.project_progress.map((proj) => (
                  <div key={proj.id} className="dashboard__project-progress" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${proj.id}`)}>
                    <div className="dashboard__project-progress-header">
                      <span className="dashboard__project-progress-name">
                        <span className="dot" style={{ background: proj.color }} />
                        {proj.name}
                      </span>
                      <span className="dashboard__project-progress-percent">{proj.progress}%</span>
                    </div>
                    <div className="dashboard__project-progress-bar">
                      <div
                        className="dashboard__project-progress-bar-fill"
                        style={{ width: `${proj.progress}%`, background: proj.color }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="dashboard__widget">
            <div className="dashboard__widget-header">
              <h3>{t('dashboard.upcoming_deadlines')}</h3>
            </div>
            <div className="dashboard__task-list">
              {(!data?.upcoming_deadlines || data.upcoming_deadlines.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {t('dashboard.no_deadlines')}
                </div>
              ) : (
                data.upcoming_deadlines.map((task) => (
                  <div key={task.id} className="dashboard__task-item" onClick={() => {
                    setSelectedTaskId(task.id);
                  }}>
                    <div className="dashboard__task-item-content">
                      <div className="dashboard__task-item-title">{task.title}</div>
                      <div className="dashboard__task-item-meta">
                        <span className="dashboard__task-item-project">
                          <span className="dot" style={{ background: task.project_color }} />
                          {task.project_name}
                        </span>
                      </div>
                    </div>
                    <span className={`dashboard__task-item-date ${task.is_today ? 'overdue' : ''}`}>
                      {task.is_today
                        ? t('dashboard.today')
                        : task.is_tomorrow
                          ? t('dashboard.tomorrow')
                          : formatDueDate(task.due_date)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => {
            fetchDashboardData();
          }}
        />
      )}
    </div>
  );
};

export default DashboardPage;
