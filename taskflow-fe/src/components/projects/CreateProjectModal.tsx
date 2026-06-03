import React, { useState } from 'react';
import { Modal, Tooltip, Popover, Input, Button, message } from 'antd';
import { CloseOutlined, SearchOutlined, CheckOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from '../../utils/i18n';
import ProjectIconPicker from './ProjectIconPicker';
import api from '../../services/api';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  allUsers: any[];
}

interface UserSelectorPopoverContentProps {
  allUsers: any[];
  userSearchText: string;
  setUserSearchText: (text: string) => void;
  memberIds: number[];
  onToggleMember: (userId: number) => void;
  getInitials: (name: string) => string;
  t: any;
}

const UserSelectorPopoverContent: React.FC<UserSelectorPopoverContentProps> = ({
  allUsers,
  userSearchText,
  setUserSearchText,
  memberIds,
  onToggleMember,
  getInitials,
  t,
}) => {
  return (
    <div style={{ width: '280px', padding: '4px' }}>
      <Input
        placeholder={t('members.search_placeholder') || 'Tìm kiếm theo tên hoặc email...'}
        prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
        value={userSearchText}
        onChange={(e) => setUserSearchText(e.target.value)}
        size="middle"
        style={{ marginBottom: '8px' }}
        allowClear
      />
      <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {allUsers
          .filter(u =>
            u.name.toLowerCase().includes(userSearchText.toLowerCase()) ||
            u.email.toLowerCase().includes(userSearchText.toLowerCase())
          )
          .map((u) => {
            const isSelected = memberIds.includes(u.id);
            return (
              <div
                key={u.id}
                onClick={() => onToggleMember(u.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  transition: 'all 0.2s',
                }}
                className="member-selector-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {u.photo ? <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(u.name)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted, #9ca0b0)' }}>{u.email}</span>
                  </div>
                </div>
                {isSelected && <CheckOutlined style={{ color: '#6366f1', fontSize: '12px' }} />}
              </div>
            );
          })}
        {allUsers.filter(u =>
          u.name.toLowerCase().includes(userSearchText.toLowerCase()) ||
          u.email.toLowerCase().includes(userSearchText.toLowerCase())
        ).length === 0 && (
            <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
              {t('members.empty') || 'Không tìm thấy thành viên nào.'}
            </div>
          )}
      </div>
    </div>
  );
};

interface OtherMembersPopoverContentProps {
  memberIds: number[];
  allUsers: any[];
  onRemoveMember: (userId: number) => void;
  getInitials: (name: string) => string;
  t: any;
}

const OtherMembersPopoverContent: React.FC<OtherMembersPopoverContentProps> = ({
  memberIds,
  allUsers,
  onRemoveMember,
  getInitials,
  t,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '220px', padding: '4px 0' }}>
      {memberIds.slice(10).map(id => {
        const u = allUsers.find(user => user.id === id);
        if (!u) return null;
        return (
          <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 600,
                overflow: 'hidden',
              }}>
                {u.photo ? <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(u.name)}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }} title={u.email}>{u.name}</span>
            </div>
            <Button
              type="text"
              size="small"
              danger
              icon={<CloseOutlined style={{ fontSize: '10px' }} />}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveMember(id);
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  open,
  onClose,
  onCreated,
  allUsers,
}) => {
  const { t } = useTranslation();
  const [showUserSelectorPopover, setShowUserSelectorPopover] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [showOtherMembersPopover, setShowOtherMembersPopover] = useState(false);

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    icon: null as string | null,
    status: 'active',
    startDate: '',
    endDate: '',
    memberIds: [] as number[],
  });

  const getInitials = (name: string) => {
    return name ? name.trim().charAt(0).toUpperCase() : 'U';
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      message.error(t('projects.toast.required_name'));
      return;
    }
    if (newProject.startDate && newProject.endDate) {
      if (new Date(newProject.endDate) < new Date(newProject.startDate)) {
        message.error(t('projects.toast.date_err'));
        return;
      }
    }

    try {
      const res = await api.createProject({
        name: newProject.name,
        description: newProject.description,
        color: newProject.color,
        icon: newProject.icon || undefined,
        status: newProject.status as any,
        start_date: newProject.startDate || undefined,
        end_date: newProject.endDate || undefined,
        member_ids: newProject.memberIds,
      });
      if (res.success) {
        message.success(t('projects.toast.create_success', { name: newProject.name }));
        setNewProject({ name: '', description: '', color: '#6366f1', icon: null, status: 'active', startDate: '', endDate: '', memberIds: [] });
        setUserSearchText('');
        setShowUserSelectorPopover(false);
        onCreated();
        onClose();
        window.dispatchEvent(new Event('projects-changed'));
      }
    } catch (err) {
      console.error(err);
      message.error(t('projects.toast.create_err'));
    }
  };

  const toggleMember = (userId: number) => {
    const isSelected = newProject.memberIds.includes(userId);
    const updatedMemberIds = isSelected
      ? newProject.memberIds.filter(id => id !== userId)
      : [...newProject.memberIds, userId];
    setNewProject({ ...newProject, memberIds: updatedMemberIds });
  };

  const removeMember = (userId: number) => {
    setNewProject({
      ...newProject,
      memberIds: newProject.memberIds.filter(id => id !== userId)
    });
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={560} closable={false} className="create-project-modal">
      <div className="create-project-modal__header">
        <h2>{t('projects.create.title')}</h2>
        <button className="close-btn" onClick={onClose}><CloseOutlined /></button>
      </div>
      <div className="create-project-modal__body">
        <div className="create-project-modal__field">
          <label>{t('projects.create.icon')} & {t('projects.create.name')} <span className="required">*</span></label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <ProjectIconPicker
              color={newProject.color}
              icon={newProject.icon}
              projectName={newProject.name}
              onChange={(c, i) => setNewProject({ ...newProject, color: c, icon: i })}
              size={33}
            />
            <input
              placeholder={t('projects.create.name_placeholder')}
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              style={{ flex: 1 }}
            />
          </div>
        </div>
        <div className="create-project-modal__field">
          <label>{t('projects.create.desc')}</label>
          <textarea placeholder={t('projects.create.desc_placeholder')} value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} />
        </div>
        <div className="create-project-modal__row">
          <div className="create-project-modal__field">
            <label>{t('projects.create.start_date')}</label>
            <input type="date" value={newProject.startDate}
              onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })} />
          </div>
          <div className="create-project-modal__field">
            <label>{t('projects.create.end_date')}</label>
            <input type="date" value={newProject.endDate}
              onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })} />
          </div>
        </div>
        <div className="create-project-modal__field">
          <label>{t('projects.create.members') || 'Thành viên'}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
            {/* Selected members avatar stack */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {newProject.memberIds.slice(0, 10).map((userId, index) => {
                const u = allUsers.find(user => user.id === userId);
                if (!u) return null;
                return (
                  <Tooltip title={`${u.name} (${u.email}) - Click to remove`} key={u.id}>
                    <div
                      className="selected-avatar-item"
                      onClick={() => removeMember(userId)}
                      style={{
                        position: 'relative',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#6366f1',
                        border: '2px solid var(--bg-card, #fff)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 600,
                        marginLeft: index > 0 ? '-10px' : '0',
                        zIndex: 10 - index,
                        cursor: 'pointer',
                        overflow: 'visible',
                      }}
                    >
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
                        {u.photo ? (
                          <img src={u.photo} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          getInitials(u.name)
                        )}
                      </div>
                      <div
                        className="avatar-delete-icon"
                        style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-4px',
                          background: '#ef4444',
                          color: '#fff',
                          borderRadius: '50%',
                          width: '14px',
                          height: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '8px',
                          border: '1px solid #fff',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                        }}
                      >
                        <CloseOutlined style={{ fontSize: '7px' }} />
                      </div>
                    </div>
                  </Tooltip>
                );
              })}

              {newProject.memberIds.length > 10 && (
                <Popover
                  trigger="click"
                  placement="bottom"
                  open={showOtherMembersPopover}
                  onOpenChange={setShowOtherMembersPopover}
                  title={<span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('projects.create.other_members' as any) || 'Thành viên khác'}</span>}
                  content={
                    <OtherMembersPopoverContent
                      memberIds={newProject.memberIds}
                      allUsers={allUsers}
                      onRemoveMember={removeMember}
                      getInitials={getInitials}
                      t={t}
                    />
                  }
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--border-color, #e5e7eb)',
                      border: '2px solid var(--bg-card, #fff)',
                      color: 'var(--text-secondary, #4b5563)',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: '-10px',
                      zIndex: 4,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    +{newProject.memberIds.length - 10}
                  </div>
                </Popover>
              )}
            </div>

            {/* Add member button and Popover */}
            <Popover
              trigger="click"
              placement="bottomLeft"
              open={showUserSelectorPopover}
              onOpenChange={(open) => setShowUserSelectorPopover(open)}
              content={
                <UserSelectorPopoverContent
                  allUsers={allUsers}
                  userSearchText={userSearchText}
                  setUserSearchText={setUserSearchText}
                  memberIds={newProject.memberIds}
                  onToggleMember={toggleMember}
                  getInitials={getInitials}
                  t={t}
                />
              }
            >
              <Button
                type="dashed"
                shape="circle"
                icon={<PlusOutlined />}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              />
            </Popover>
          </div>
        </div>
      </div>
      <div className="create-project-modal__footer">
        <button className="cancel-btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="submit-btn" onClick={handleCreateProject} disabled={!newProject.name.trim()}>{t('projects.create_btn')}</button>
      </div>
    </Modal>
  );
};

export default CreateProjectModal;
