import React from 'react';
import { Button, Segmented, Dropdown, MenuProps, Divider } from 'antd';
import { PlusOutlined, SaveOutlined, ThunderboltOutlined, LeftOutlined, BranchesOutlined, SwapOutlined, ArrowRightOutlined, DeleteOutlined, UnlockOutlined } from '@ant-design/icons';

interface WorkflowToolbarProps {
  projectName: string;
  workflowMode: 'unrestricted' | 'restricted';
  setWorkflowMode: (mode: 'unrestricted' | 'restricted') => void;
  isAddingTransition: boolean;
  setIsAddingTransition: (active: boolean) => void;
  onApplyPreset: (type: 'all' | 'linear' | 'linear_back' | 'clear') => void;
  onSave: () => void;
  onDiscard: () => void;
  t: (key: string) => string;
}

const TransitionIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="6" r="3" />
    <path d="M8 16c2-4 6-4 8-8" />
  </svg>
);

export const WorkflowToolbar: React.FC<WorkflowToolbarProps> = ({
  projectName,
  workflowMode,
  setWorkflowMode,
  isAddingTransition,
  setIsAddingTransition,
  onApplyPreset,
  onSave,
  onDiscard,
  t
}) => {
  const presetItems: MenuProps['items'] = [
    {
      key: 'all',
      icon: <UnlockOutlined />,
      label: t('workflow.preset_all'),
      onClick: () => onApplyPreset('all')
    },
    {
      key: 'linear',
      icon: <ArrowRightOutlined />,
      label: t('workflow.preset_linear'),
      onClick: () => onApplyPreset('linear')
    },
    {
      key: 'linear_back',
      icon: <SwapOutlined />,
      label: t('workflow.preset_linear_back'),
      onClick: () => onApplyPreset('linear_back')
    },
    {
      type: 'divider'
    },
    {
      key: 'clear',
      icon: <DeleteOutlined />,
      label: t('workflow.preset_clear'),
      danger: true,
      onClick: () => onApplyPreset('clear')
    }
  ];

  return (
    <div className="workflow-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '56px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
      {/* Title Area */}
      <div className="toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Button 
          type="text" 
          icon={<LeftOutlined />} 
          onClick={onDiscard} 
          style={{ marginRight: '4px' }}
        />
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BranchesOutlined style={{ fontSize: '16px', color: 'var(--primary-light)' }} />
          {t('workflow.edit_title')}
        </h2>
        <span className="project-badge" style={{ background: 'rgba(120, 120, 120, 0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {projectName}
        </span>
      </div>

      {/* Editor controls in the center */}
      <div className="toolbar-center" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => setIsAddingTransition(!isAddingTransition)}
          className={`toolbar-tool-btn ${isAddingTransition ? 'active' : ''}`}
          title={isAddingTransition ? t('workflow.cancel_transition') : t('workflow.add_transition')}
        >
          <TransitionIcon />
          <span style={{ fontSize: '11px', fontWeight: 500 }}>
            {isAddingTransition ? t('workflow.cancel_transition') : t('workflow.add_transition')}
          </span>
        </button>

        <Dropdown menu={{ items: presetItems }} trigger={['click']}>
          <button className="toolbar-tool-btn">
            <ThunderboltOutlined style={{ fontSize: '16px' }} />
            <span style={{ fontSize: '11px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              {t('workflow.preset_label')} <span style={{ fontSize: '9px', opacity: 0.6 }}>▼</span>
            </span>
          </button>
        </Dropdown>
      </div>

      {/* Action buttons - Save and discard */}
      <div className="toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Button
          size="small"
          onClick={onDiscard}
        >
          {t('workflow.rules.cancel')}
        </Button>
        <Button
          type="primary"
          size="small"
          onClick={onSave}
          icon={<SaveOutlined />}
        >
          {t('workflow.save')}
        </Button>
      </div>
    </div>
  );
};
