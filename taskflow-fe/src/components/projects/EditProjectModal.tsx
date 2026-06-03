import React, { useState, useEffect } from 'react';
import { Select, Button, Popconfirm, Modal, message } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import ProjectIconPicker from './ProjectIconPicker';
import { useTranslation } from '../../utils/i18n';
import api from '../../services/api';

export interface EditProjectFormData {
  id: number | string;
  name: string;
  description: string;
  color: string;
  icon: string | null;
  status: string;
  startDate: string;
  endDate: string;
}

interface EditProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: EditProjectFormData;
  onSaved: () => void;
  onDeleted?: () => void;
  showDelete?: boolean;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({
  open,
  onClose,
  project,
  onSaved,
  onDeleted,
  showDelete = true,
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<EditProjectFormData>({ ...project });

  useEffect(() => {
    if (open) {
      setForm({ ...project });
    }
  }, [open, project]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      message.error(t('projects.toast.required_name'));
      return;
    }
    if (form.startDate && form.endDate) {
      if (new Date(form.endDate) < new Date(form.startDate)) {
        message.error(t('projects.toast.date_err'));
        return;
      }
    }
    try {
      const res = await api.updateProject(form.id, {
        name: form.name,
        description: form.description,
        color: form.color,
        icon: form.icon,
        status: form.status,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
      });
      if (res.success) {
        message.success(t('projects.toast.update_success', { name: form.name }));
        onClose();
        onSaved();
        window.dispatchEvent(new Event('projects-changed'));
      }
    } catch (err) {
      console.error(err);
      message.error(t('projects.toast.update_err'));
    }
  };

  const handleDelete = async () => {
    try {
      const res = await api.deleteProject(form.id);
      if (res.success) {
        message.success(t('projects.toast.delete_success'));
        onClose();
        window.dispatchEvent(new Event('projects-changed'));
        onDeleted?.();
      }
    } catch (err) {
      console.error(err);
      message.error(t('projects.toast.delete_err' as any) || 'Error deleting project');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      closable={false}
      className="create-project-modal"
    >
      <div className="create-project-modal__header">
        <h2>{t('projects.edit.title')}</h2>
        <button className="close-btn" onClick={onClose}>
          <CloseOutlined />
        </button>
      </div>
      <div className="create-project-modal__body">
        <div className="create-project-modal__field">
          <label>
            {t('projects.create.icon')} & {t('projects.create.name')}{' '}
            <span className="required">*</span>
          </label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <ProjectIconPicker
              color={form.color}
              icon={form.icon}
              projectName={form.name}
              onChange={(c, i) => setForm({ ...form, color: c, icon: i })}
              size={33}
            />
            <input
              placeholder={t('projects.create.name_placeholder')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ flex: 1 }}
            />
          </div>
        </div>
        <div className="create-project-modal__field">
          <label>{t('projects.create.desc')}</label>
          <textarea
            placeholder={t('projects.create.desc_placeholder')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="create-project-modal__row">
          <div className="create-project-modal__field">
            <label>{t('projects.create.start_date')}</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div className="create-project-modal__field">
            <label>{t('projects.create.end_date')}</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
        </div>
        <div className="create-project-modal__field">
          <label>{t('projects.edit.status')}</label>
          <Select
            style={{ width: '100%' }}
            value={form.status}
            onChange={(val) => setForm({ ...form, status: val })}
          >
            <Select.Option value="planning">
              {t('projects.status.planning')}
            </Select.Option>
            <Select.Option value="active">
              {t('projects.status.active')}
            </Select.Option>
            <Select.Option value="on_hold">
              {t('projects.status.on_hold')}
            </Select.Option>
            <Select.Option value="completed">
              {t('projects.status.completed')}
            </Select.Option>
          </Select>
        </div>

        {showDelete && (
          <div
            style={{
              borderTop: '2px solid rgba(255, 77, 79, 0.4)',
              paddingTop: '20px',
              marginTop: '24px',
            }}
          >
            <h4
              style={{
                color: '#ff4d4f',
                margin: '0 0 12px 0',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ⚠️ {t('projects.edit.danger_zone')}
            </h4>
            <div
              style={{
                border: '1px solid rgba(255, 77, 79, 0.5)',
                borderRadius: '10px',
                padding: '18px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 77, 79, 0.12)',
                gap: '16px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: 'var(--text-primary, #fff)',
                    fontWeight: 600,
                    fontSize: '14px',
                    marginBottom: '4px',
                  }}
                >
                  {t('projects.edit.delete_btn')}
                </div>
                <div
                  style={{
                    color: 'var(--text-secondary, #9ca0b0)',
                    fontSize: '12px',
                    lineHeight: '1.5',
                  }}
                >
                  {t('projects.edit.danger_desc')}
                </div>
              </div>
              <div>
                <Popconfirm
                  title={t('projects.edit.delete_btn')}
                  description={t('projects.confirm.delete_title')}
                  onConfirm={handleDelete}
                  okText={t('common.delete')}
                  cancelText={t('common.cancel')}
                  okType="danger"
                >
                  <Button
                    danger
                    style={{
                      backgroundColor: '#ff4d4f',
                      borderColor: '#ff4d4f',
                      color: '#fff',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}
                  >
                    {t('projects.edit.delete_btn')}
                  </Button>
                </Popconfirm>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="create-project-modal__footer">
        <button className="cancel-btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button
          className="submit-btn"
          onClick={handleSave}
          disabled={!form.name.trim()}
        >
          {t('common.save')}
        </button>
      </div>
    </Modal>
  );
};

export default EditProjectModal;
