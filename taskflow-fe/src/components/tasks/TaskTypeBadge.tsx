import React from 'react';
import { useTranslation } from '../../utils/i18n';

export type TaskType = 'task' | 'bug';

// SVG Bug icon (Jira-style)
const BugIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="9" r="4.5" fill="#ef4444" />
    <path d="M6 4.5C6 3.4 6.9 2.5 8 2.5s2 .9 2 2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
    <path d="M5 6.5L3 5M11 6.5L13 5" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M4 9H2M12 9h2" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M5 11.5L3 13M11 11.5L13 13" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round"/>
    <ellipse cx="8" cy="9" rx="2" ry="2.5" fill="#fca5a5" opacity="0.4"/>
  </svg>
);

// SVG Task icon (checkmark style)
const TaskIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="#6366f1" opacity="0.15" stroke="#6366f1" strokeWidth="1.3"/>
    <path d="M4.5 8L7 10.5L11.5 5.5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface TaskTypeBadgeProps {
  type?: TaskType | string;
  /** 'icon' = chỉ icon nhỏ (kanban/list), 'badge' = icon + text (detail/search) */
  size?: 'icon' | 'badge';
  /** Cho phép click để đổi type */
  onClick?: () => void;
}

export const TASK_TYPE_CONFIG: Record<string, { color: string; bg: string }> = {
  task: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  bug:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
};

const TaskTypeBadge: React.FC<TaskTypeBadgeProps> = ({ type = 'task', size = 'icon', onClick }) => {
  const { t } = useTranslation();
  const cfg = TASK_TYPE_CONFIG[type] || TASK_TYPE_CONFIG['task'];
  const isBug = type === 'bug';
  const label = isBug ? t('task.type.bug') : t('task.type.task');
  const icon = isBug ? <BugIcon size={size === 'icon' ? 13 : 14} /> : <TaskIcon size={size === 'icon' ? 13 : 14} />;

  if (size === 'icon') {
    return (
      <span
        title={label}
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          background: cfg.bg,
          lineHeight: 1,
          cursor: onClick ? 'pointer' : 'default',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        {icon}
      </span>
    );
  }

  // badge size
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 9px',
        borderRadius: '12px',
        background: cfg.bg,
        color: cfg.color,
        fontSize: '11px',
        fontWeight: 600,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        border: `1px solid ${cfg.color}33`,
      }}
    >
      {icon}
      {label}
    </span>
  );
};

export default TaskTypeBadge;
