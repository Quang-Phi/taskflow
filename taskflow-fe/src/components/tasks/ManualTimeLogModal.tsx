import React, { useState, useEffect } from 'react';
import { Modal, Select, DatePicker, InputNumber, Input, message } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from '../../utils/i18n';
import api from '../../services/api';
import './ManualTimeLogModal.scss';

export interface ManualTimeLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tasks?: Array<{
    id: number | string;
    title: string;
    project_name?: string;
    project?: { name: string };
    status?: string;
    project_statuses?: any[];
    [key: string]: any;
  }>;
  defaultTaskId?: number | string | null;
  defaultDate?: string | null; // e.g. YYYY-MM-DD or YYYY-MM-DD HH:mm
  lockTaskSelection?: boolean;
}

const ManualTimeLogModal: React.FC<ManualTimeLogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tasks = [],
  defaultTaskId = null,
  defaultDate = null,
  lockTaskSelection = false,
}) => {
  const { t } = useTranslation();

  const [logTask, setLogTask] = useState<number | string | null>(null);
  const [logDate, setLogDate] = useState<string>('');
  const [logHours, setLogHours] = useState<number>(0);
  const [logMinutes, setLogMinutes] = useState<number>(0);
  const [logDescription, setLogDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Helper to check if task status is completed/closed
  const isTaskDone = (t: any) => {
    const projectStatuses = t.project_statuses || t.project?.statuses || [];
    const statusObj = projectStatuses.find((s: any) => s.id === t.status);
    if (statusObj) return statusObj.type === 'closed';
    return t.status === 'done';
  };

  // Reset fields when opening/closing
  useEffect(() => {
    if (isOpen) {
      setLogTask(defaultTaskId);
      setLogHours(0);
      setLogMinutes(0);
      setLogDescription('');

      // Fetch current user details
      api.getMe().then(res => setCurrentUser(res)).catch(console.error);

      if (defaultDate) {
        if (defaultDate.includes(' ')) {
          setLogDate(defaultDate);
        } else {
          // If it is just a date string (YYYY-MM-DD), set with current time
          const now = new Date();
          const hrs = String(now.getHours()).padStart(2, '0');
          const mins = String(now.getMinutes()).padStart(2, '0');
          setLogDate(`${defaultDate} ${hrs}:${mins}`);
        }
      } else {
        const now = new Date();
        const yr = now.getFullYear();
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const dy = String(now.getDate()).padStart(2, '0');
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        setLogDate(`${yr}-${mo}-${dy} ${hrs}:${mins}`);
      }
    }
  }, [isOpen, defaultTaskId, defaultDate]);

  const handleSubmit = async () => {
    if (!logTask) {
      message.error(t('manual_log.err.select_task'));
      return;
    }

    const taskObj = tasks.find(t => String(t.id) === String(logTask));
    if (taskObj && isTaskDone(taskObj)) {
      message.error(t('manual_log.err.task_completed'));
      return;
    }

    const durationInSeconds = logHours * 3600 + logMinutes * 60;
    if (durationInSeconds <= 0) {
      message.error(t('manual_log.err.duration_zero'));
      return;
    }

    setLoading(true);
    try {
      const data = await api.addManualTime(Number(logTask), {
        duration: durationInSeconds,
        description: logDescription,
        started_at: logDate ? dayjs(logDate).toISOString() : undefined,
      });

      if (data?.success) {
        message.success(t('manual_log.success'));
        onSuccess();
        onClose();
      } else {
        message.error(data?.message || t('manual_log.err.generic'));
      }
    } catch (err: any) {
      console.error(err);
      message.error(
        err.response?.data?.message || t('manual_log.err.generic')
      );
    } finally {
      setLoading(false);
    }
  };

  const getTaskLabel = (t: any) => {
    const projName = t.project_name || t.project?.name;
    return projName ? `${t.title} (${projName})` : t.title;
  };

  const activeTask = tasks.find(t => String(t.id) === String(logTask));

  const filteredTasks = tasks.filter(task => {
    // If task selection is locked, keep the default selected task
    if (lockTaskSelection) return true;

    // Always include the currently selected task so it displays correctly
    if (logTask && String(task.id) === String(logTask)) return true;

    // Check if task is completed
    if (isTaskDone(task)) return false;

    // Only show tasks assigned to the user
    if (!currentUser) return false;
    return Number(task.assignee_id) === Number(currentUser.id);
  });

  return (
    <Modal
      title={
        <div className="log-modal-header">
          <ClockCircleOutlined />
          <span>{t('manual_log.title')}</span>
        </div>
      }
      open={isOpen}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      okText={t('manual_log.submit')}
      cancelText={t('manual_log.cancel')}
      className="timesheet-manual-log-modal"
      destroyOnHidden
      width={520}
      zIndex={1150}
    >
      <div className="manual-log-form">
        <div className="form-item">
          <label>{t('manual_log.select_task')}</label>
          {lockTaskSelection && activeTask ? (
            <div className="locked-task-display">
              {getTaskLabel(activeTask)}
            </div>
          ) : (
            <Select
              value={logTask || undefined}
              onChange={value => setLogTask(value)}
              className="modal-form-select"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={filteredTasks.map(task => ({
                value: task.id,
                label: getTaskLabel(task),
              }))}
              placeholder={t('manual_log.select_task_placeholder')}
              style={{ width: '100%' }}
            />
          )}
        </div>

        <div className="form-item row-group">
          <div className="sub-item">
            <label>{t('manual_log.start_time')}</label>
            <DatePicker
              showTime
              value={logDate ? dayjs(logDate) : null}
              onChange={date => setLogDate(date ? date.format('YYYY-MM-DD HH:mm') : '')}
              className="modal-form-datepicker"
              format="DD/MM/YYYY HH:mm"
              style={{ width: '100%' }}
              placeholder={t('manual_log.date_placeholder')}
            />
          </div>
        </div>

        <div className="form-item duration-group">
          <label>{t('manual_log.duration_label')}</label>
          <div className="duration-inputs">
            <div className="input-group-new">
              <InputNumber
                min={0}
                max={24}
                value={logHours}
                onChange={val => setLogHours(val || 0)}
                placeholder="0"
                style={{ width: '100%' }}
                addonAfter={<span className="addon-text">{t('manual_log.hrs')}</span>}
              />
            </div>
            <div className="input-group-new">
              <InputNumber
                min={0}
                max={59}
                value={logMinutes}
                onChange={val => setLogMinutes(val || 0)}
                placeholder="0"
                style={{ width: '100%' }}
                addonAfter={<span className="addon-text">{t('manual_log.mins')}</span>}
              />
            </div>
          </div>
        </div>

        <div className="form-item">
          <label>{t('manual_log.description')}</label>
          <Input.TextArea
            placeholder={t('manual_log.description_placeholder')}
            value={logDescription}
            onChange={e => setLogDescription(e.target.value)}
            className="modal-form-textarea"
            rows={3}
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ManualTimeLogModal;
