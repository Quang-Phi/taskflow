import React, { useState, useEffect } from 'react';
import { Modal, Button, Checkbox, Select, DatePicker, Input, List, Typography, Divider, message, Spin } from 'antd';
import { AlertOutlined, CheckCircleOutlined, CloseCircleOutlined, ArrowRightOutlined, LinkOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from '../../utils/i18n';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export interface WorkflowTransitionModalProps {
  open: boolean;
  task: any;
  targetStatus: string;
  targetStatusName: string;
  failedRules: any[];
  projectMembers?: any[];
  projectLabels?: any[];
  onCancel: () => void;
  onSuccess: (updatedTask: any) => void;
}

export const WorkflowTransitionModal: React.FC<WorkflowTransitionModalProps> = ({
  open,
  task,
  targetStatus,
  targetStatusName,
  failedRules = [],
  projectMembers = [],
  projectLabels = [],
  onCancel,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [resolvedFields, setResolvedFields] = useState<Record<string, any>>({});
  const [checkedItems, setCheckedItems] = useState<number[]>([]);

  // Initialize field values from restrict_field rules
  useEffect(() => {
    if (open && failedRules.length > 0) {
      const initialFields: Record<string, any> = {};
      failedRules.forEach((rule) => {
        if (rule.type === 'restrict_field' && rule.details?.field) {
          const field = rule.details.field;
          const reqValue = rule.details.required_value;
          // Populate the required value by default so the user can just approve/verify
          initialFields[field] = reqValue;
        }
      });
      setResolvedFields(initialFields);
      setCheckedItems([]);
    }
  }, [open, failedRules]);

  // Determine if rules are resolvable
  const isResolvable = failedRules.every((rule) => {
    // Read-only/unresolvable rules in the dialog:
    // - dependency: blocker task must be done (cannot force it done from here easily without completing it)
    // - restrict_subtasks: subtasks must be done
    // - restrict_role / task_role: user permission issues
    // - transition_path: invalid path
    if (
      rule.type === 'dependency' ||
      rule.type === 'restrict_subtasks' ||
      rule.type === 'restrict_role' ||
      rule.type === 'task_role' ||
      rule.type === 'transition_path'
    ) {
      return false;
    }
    return true;
  });

  const handleToggleChecklistItem = (itemId: number, checked: boolean) => {
    if (checked) {
      setCheckedItems((prev) => [...prev, itemId]);
    } else {
      setCheckedItems((prev) => prev.filter((id) => id !== itemId));
    }
  };

  const handleUpdateAndTransition = async () => {
    if (!task?.id) return;
    setLoading(true);
    try {
      // 1. Update checklist items first
      if (checkedItems.length > 0) {
        await Promise.all(
          checkedItems.map((itemId) => api.updateChecklistItem(itemId, { is_checked: true }))
        );
      }

      // 2. Update restrict_field values
      const fieldsToSave = { ...resolvedFields };
      if (Object.keys(fieldsToSave).length > 0) {
        // Formats dates properly for API
        if (fieldsToSave.start_date) fieldsToSave.start_date = dayjs(fieldsToSave.start_date).toISOString();
        if (fieldsToSave.due_date) fieldsToSave.due_date = dayjs(fieldsToSave.due_date).toISOString();
        
        await api.updateTask(task.id, fieldsToSave);
      }

      // 3. Retry transition
      const transitionRes = await api.updateTaskStatus(task.id, { status: targetStatus });
      if (transitionRes.success) {
        message.success(t('workflow.modal.success_message') || 'Cập nhật và chuyển trạng thái thành công.');
        onSuccess(transitionRes.data || task);
      } else {
        message.error(transitionRes.message || t('workflow.modal.retry_error') || 'Không thể thực hiện chuyển trạng thái.');
      }
    } catch (err: any) {
      console.error('[WorkflowTransitionModal] Error resolving workflow rules:', err);
      message.error(err.response?.data?.message || t('workflow.modal.retry_error') || 'Không thể thực hiện chuyển trạng thái.');
    } finally {
      setLoading(false);
    }
  };

  // Render input control for restrict_field
  const renderFieldControl = (field: string, reqValue: any, reqValueLabel: string) => {
    const members = projectMembers.length > 0 ? projectMembers : (task?.project?.members || []);
    const labels = projectLabels.length > 0 ? projectLabels : (task?.project?.labels || []);

    switch (field) {
      case 'priority':
        return (
          <Select
            value={resolvedFields.priority}
            onChange={(val) => setResolvedFields((prev) => ({ ...prev, priority: val }))}
            style={{ width: '100%', marginTop: '6px' }}
            options={[
              { value: 'low', label: t('tasks.priority.low' as any) || 'Thấp' },
              { value: 'medium', label: t('tasks.priority.medium' as any) || 'Trung bình' },
              { value: 'high', label: t('tasks.priority.high' as any) || 'Cao' },
              { value: 'urgent', label: t('tasks.priority.urgent' as any) || 'Khẩn cấp' },
            ]}
          />
        );

      case 'assignee_id':
        return (
          <Select
            value={resolvedFields.assignee_id}
            onChange={(val) => setResolvedFields((prev) => ({ ...prev, assignee_id: val }))}
            style={{ width: '100%', marginTop: '6px' }}
            placeholder={t('tasks.panel.select_assignee_placeholder' as any) || 'Chọn người thực hiện...'}
            options={members.map((m: any) => ({ value: m.id, label: m.name }))}
            showSearch
            optionFilterProp="label"
          />
        );

      case 'creator_id':
        return (
          <Select
            value={resolvedFields.creator_id}
            onChange={(val) => setResolvedFields((prev) => ({ ...prev, creator_id: val }))}
            style={{ width: '100%', marginTop: '6px' }}
            placeholder={t('tasks.panel.select_creator_placeholder' as any) || 'Chọn người báo cáo...'}
            options={members.map((m: any) => ({ value: m.id, label: m.name }))}
            showSearch
            optionFilterProp="label"
          />
        );

      case 'start_date':
        return (
          <DatePicker
            value={resolvedFields.start_date ? dayjs(resolvedFields.start_date) : null}
            onChange={(val) => setResolvedFields((prev) => ({ ...prev, start_date: val ? val.toISOString() : null }))}
            style={{ width: '100%', marginTop: '6px' }}
            format="DD/MM/YYYY"
          />
        );

      case 'due_date':
        return (
          <DatePicker
            value={resolvedFields.due_date ? dayjs(resolvedFields.due_date) : null}
            onChange={(val) => setResolvedFields((prev) => ({ ...prev, due_date: val ? val.toISOString() : null }))}
            style={{ width: '100%', marginTop: '6px' }}
            format="DD/MM/YYYY"
          />
        );

      case 'title':
        return (
          <Input
            value={resolvedFields.title || ''}
            onChange={(e) => setResolvedFields((prev) => ({ ...prev, title: e.target.value }))}
            style={{ width: '100%', marginTop: '6px' }}
          />
        );

      case 'description':
        return (
          <Input.TextArea
            value={resolvedFields.description || ''}
            onChange={(e) => setResolvedFields((prev) => ({ ...prev, description: e.target.value }))}
            style={{ width: '100%', marginTop: '6px' }}
            rows={2}
          />
        );

      default:
        return (
          <div style={{ marginTop: '6px', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px dashed var(--border-color)' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Yêu cầu giá trị: <Text strong>{reqValueLabel || reqValue}</Text>
            </Text>
          </div>
        );
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={520}
      centered
      zIndex={3500}
      destroyOnClose
      closable={!loading}
      className="workflow-transition-modal"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <AlertOutlined style={{ fontSize: '24px', color: '#eab308' }} />
        <Title level={4} style={{ margin: 0, color: 'var(--text-primary, #f8fafc)' }}>
          {t('workflow.modal.title')?.replace('{status}', targetStatusName) || `Cần hoàn tất trước khi chuyển sang "${targetStatusName}"`}
        </Title>
      </div>

      <Divider style={{ margin: '12px 0', borderColor: 'var(--border-color, #2d3748)' }} />

      <Spin spinning={loading} indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}>
        <List
          dataSource={failedRules}
          renderItem={(rule) => {
            if (rule.type === 'restrict_field') {
              const field = rule.details?.field;
              const fieldLabel = rule.details?.field_label || field;
              const reqLabel = rule.details?.required_value_label || rule.details?.required_value;
              return (
                <List.Item style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color, #2d3748)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CloseCircleOutlined style={{ color: '#ef4444' }} />
                    <Text strong style={{ color: 'var(--text-primary)' }}>
                      {t('workflow.modal.field_required')?.replace('{field}', fieldLabel).replace('{value}', reqLabel) || `Chưa thiết lập "${fieldLabel}" (Yêu cầu: "${reqLabel}")`}
                    </Text>
                  </div>
                  {renderFieldControl(field, rule.details?.required_value, reqLabel)}
                </List.Item>
              );
            }

            if (rule.type === 'checklist') {
              const checked = rule.details?.checked_items || 0;
              const total = rule.details?.total_items || 0;
              const uncheckedItems = rule.details?.unchecked_items || [];
              return (
                <List.Item style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color, #2d3748)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <CloseCircleOutlined style={{ color: '#ef4444' }} />
                    <Text strong style={{ color: 'var(--text-primary)' }}>
                      {t('workflow.modal.checklist_failed')?.replace('{checked}', String(checked)).replace('{total}', String(total)) || `Checklist chưa hoàn thành (Đã xong ${checked}/${total})`}
                    </Text>
                  </div>
                  <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                    {uncheckedItems.map((item: any) => (
                      <Checkbox
                        key={item.id}
                        checked={checkedItems.includes(item.id)}
                        onChange={(e) => handleToggleChecklistItem(item.id, e.target.checked)}
                      >
                        <Text style={{ color: 'var(--text-secondary)' }}>{item.name}</Text>
                      </Checkbox>
                    ))}
                  </div>
                </List.Item>
              );
            }

            if (rule.type === 'restrict_subtasks') {
              const unfinished = rule.details?.unfinished_count || 0;
              const subtasks = rule.details?.subtasks || [];
              return (
                <List.Item style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color, #2d3748)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <CloseCircleOutlined style={{ color: '#ef4444' }} />
                    <Text strong style={{ color: 'var(--text-primary)' }}>
                      {t('workflow.modal.subtasks_failed')?.replace('{count}', String(unfinished)) || `Công việc con chưa hoàn thành (Cần xong ${unfinished} công việc)`}
                    </Text>
                  </div>
                  <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {subtasks.map((st: any) => (
                      <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LinkOutlined style={{ fontSize: '11px', color: 'var(--text-muted)' }} />
                        <Text type="secondary" style={{ fontSize: '13px' }}>{st.title}</Text>
                      </div>
                    ))}
                  </div>
                </List.Item>
              );
            }

            if (rule.type === 'dependency') {
              const blockers = rule.details?.blocker_tasks || [];
              const blockerNames = blockers.map((b: any) => b.title).join(', ');
              return (
                <List.Item style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color, #2d3748)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <CloseCircleOutlined style={{ color: '#ef4444' }} />
                    <Text strong style={{ color: 'var(--text-primary)' }}>
                      {t('workflow.modal.dependency_failed')?.replace('{blockers}', blockerNames) || `Bị chặn bởi công việc chưa hoàn thành: ${blockerNames}`}
                    </Text>
                  </div>
                  <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {blockers.map((b: any) => (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LinkOutlined style={{ fontSize: '11px', color: 'var(--text-muted)' }} />
                        <Text type="secondary" style={{ fontSize: '13px' }}>{b.title}</Text>
                      </div>
                    ))}
                  </div>
                </List.Item>
              );
            }

            if (rule.type === 'restrict_role' || rule.type === 'task_role') {
              const roleLabel = rule.details?.role_text || rule.details?.allowed_task_roles?.join(', ') || 'Chỉ định đặc biệt';
              return (
                <List.Item style={{ borderBottom: '1px solid var(--border-color, #2d3748)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CloseCircleOutlined style={{ color: '#ef4444' }} />
                    <Text strong style={{ color: 'var(--text-primary)' }}>
                      {t('workflow.modal.role_failed')?.replace('{role}', roleLabel) || `Không đủ quyền hạn chuyển đổi (Yêu cầu: ${roleLabel})`}
                    </Text>
                  </div>
                </List.Item>
              );
            }

            return (
              <List.Item style={{ borderBottom: '1px solid var(--border-color, #2d3748)', padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CloseCircleOutlined style={{ color: '#ef4444' }} />
                  <Text strong style={{ color: 'var(--text-primary)' }}>
                    {rule.message || t('workflow.modal.path_failed') || 'Không thể chuyển đổi trạng thái.'}
                  </Text>
                </div>
              </List.Item>
            );
          }}
        />
      </Spin>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
        <Button onClick={onCancel} disabled={loading} style={{ background: 'transparent', borderColor: 'var(--border-color)' }}>
          {t('workflow.modal.cancel') || 'Hủy'}
        </Button>
        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          loading={loading}
          disabled={!isResolvable}
          onClick={handleUpdateAndTransition}
          style={{ background: 'var(--primary, #3b82f6)', borderColor: 'var(--primary, #3b82f6)' }}
        >
          {t('workflow.modal.update_and_transition') || 'Cập nhật & Chuyển trạng thái'}
        </Button>
      </div>
    </Modal>
  );
};
