import React, { useState, useRef, useEffect } from 'react';
import { Popover, Input, Tabs, Button, message } from 'antd';
import * as AntIcons from '@ant-design/icons';
import {
  SearchOutlined,
  UploadOutlined,
  PictureOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useTranslation } from '../../utils/i18n';
import './ProjectIconPicker.scss';

// Filter all keys from @ant-design/icons that end with "Outlined" (Clean style)
export const allOutlinedIconNames = Object.keys(AntIcons).filter(
  (key) =>
    key.endsWith('Outlined') &&
    key !== 'AntDesignOutlined' &&
    // @ts-ignore
    (typeof AntIcons[key] === 'object' || typeof AntIcons[key] === 'function')
);

// Define popular icons to display by default (when search is empty) to keep UI responsive
export const popularIcons = [
  'ProjectOutlined',
  'FolderOutlined',
  'HomeOutlined',
  'RocketOutlined',
  'ThunderboltOutlined',
  'CrownOutlined',
  'StarOutlined',
  'TeamOutlined',
  'UserOutlined',
  'LaptopOutlined',
  'SettingOutlined',
  'DatabaseOutlined',
  'CloudOutlined',
  'CodeOutlined',
  'BugOutlined',
  'CheckSquareOutlined',
  'CalendarOutlined',
  'ClockCircleOutlined',
  'MailOutlined',
  'PhoneOutlined',
  'MessageOutlined',
  'CompassOutlined',
  'EnvironmentOutlined',
  'GlobalOutlined',
  'TagOutlined',
  'BookOutlined',
  'ReadOutlined',
  'FileTextOutlined',
  'SmileOutlined',
  'GiftOutlined',
  'ShoppingOutlined',
  'LineChartOutlined',
  'PieChartOutlined',
  'DotChartOutlined',
  'SafetyOutlined',
  'HeartOutlined',
];

export const colorOptions = [
  '#6366f1', // Indigo (Default)
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#6b7280', // Gray
  '#14b8a6', // Teal
  '#a855f7', // Purple
  '#f43f5e', // Rose
  '#84cc16', // Lime
  '#eab308', // Yellow
  '#059669', // Green
];

// Shared rendering helper for showing chosen icons (Standard or custom avatar images)
export const renderProjectIcon = (
  icon: string | null,
  color: string,
  projectName: string,
  size: number = 24,
  style: React.CSSProperties = {}
) => {
  if (icon) {
    if (icon.startsWith('data:image/')) {
      return (
        <img
          src={icon}
          alt="Project Avatar"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: 'inherit',
            objectFit: 'cover',
            display: 'block',
            ...style,
          }}
        />
      );
    }
    const IconComponent = (AntIcons as any)[icon];
    if (IconComponent) {
      return <IconComponent style={{ color: '#ffffff', fontSize: size * 0.5, ...style }} />;
    }
  }

  // Fallback to first letter of project name
  const initials = projectName ? projectName.trim().charAt(0).toUpperCase() : 'P';
  return <span style={{ color: '#ffffff', fontWeight: 600, fontSize: size * 0.45, ...style }}>{initials}</span>;
};

interface IconPickerPopoverContentProps {
  color: string;
  icon: string | null;
  projectName: string;
  searchText: string;
  setSearchText: (text: string) => void;
  onChange: (color: string, icon: string | null) => void;
  visibleIconNames: string[];
  removeAvatar: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  processFile: (file: File) => void;
  t: any;
}

const IconPickerPopoverContent: React.FC<IconPickerPopoverContentProps> = ({
  color,
  icon,
  projectName,
  searchText,
  setSearchText,
  onChange,
  visibleIconNames,
  removeAvatar,
  fileInputRef,
  handleFileChange,
  processFile,
  t,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  // Handle clipboard paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [processFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="project-icon-picker-popover">
      <Tabs
        defaultActiveKey="icon"
        items={[
          {
            key: 'icon',
            label: (
              <span>
                <AppstoreOutlined />
                {t('projects.create.select_icon' as any)}
              </span>
            ),
            children: (
              <div className="tab-pane-content">
                {/* Color Picker Grid */}
                <div className="color-section">
                  <div className="color-picker-grid">
                    {colorOptions.map((c) => (
                      <div
                        key={c}
                        className={`color-dot-option ${color === c ? 'selected' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => {
                          // Revert from image base64 to standard Project icon if they switch colors and have an image
                          const currentIcon = icon && icon.startsWith('data:image/') ? 'ProjectOutlined' : icon || 'ProjectOutlined';
                          onChange(c, currentIcon);
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon Search & Grid */}
                <div className="icon-search-bar">
                  <Input
                    className='no-bg'
                    prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                    placeholder={t('projects.create.search_icons' as any)}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                    size="small"
                  />
                </div>

                <div className="icon-picker-grid">
                  {/* Option for null/no icon (letters fallback) */}
                  <div
                    className={`icon-grid-option ${!icon || icon.startsWith('data:image/') ? 'selected' : ''}`}
                    onClick={() => onChange(color, null)}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>
                      {projectName ? projectName.trim().charAt(0).toUpperCase() : 'A'}
                    </span>
                  </div>
                  {visibleIconNames.map((name) => {
                    const IconComponent = (AntIcons as any)[name];
                    if (!IconComponent) return null;
                    return (
                      <div
                        key={name}
                        className={`icon-grid-option ${icon === name ? 'selected' : ''}`}
                        onClick={() => onChange(color, name)}
                        title={name}
                      >
                        <IconComponent />
                      </div>
                    );
                  })}
                </div>
              </div>
            ),
          },
          {
            key: 'avatar',
            label: (
              <span>
                <PictureOutlined />
                {t('projects.create.select_avatar' as any)}
              </span>
            ),
            children: (
              <div className="tab-pane-content avatar-tab">
                {icon && icon.startsWith('data:image/') ? (
                  <div className="avatar-preview-section">
                    <img src={icon} alt="Avatar Preview" className="uploaded-avatar-preview" />
                    <Button danger onClick={removeAvatar} size="small">
                      {t('projects.create.remove_avatar' as any)}
                    </Button>
                  </div>
                ) : (
                  <div
                    className={`avatar-upload-dropzone ${isDragging ? 'is-dragging' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <UploadOutlined className="upload-icon" />
                    <span className="upload-text">{t('projects.create.upload_avatar' as any)}</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

interface ProjectIconPickerProps {
  color: string;
  icon: string | null;
  projectName: string;
  onChange: (color: string, icon: string | null) => void;
  size?: number;
}

const ProjectIconPicker: React.FC<ProjectIconPickerProps> = ({
  color,
  icon,
  projectName,
  onChange,
  size = 40,
}) => {
  const { t } = useTranslation();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resize and convert uploaded image to base64
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error(t('projects.toast.create_err' as any) || 'Vui lòng chọn tệp hình ảnh.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 128;
        const MAX_HEIGHT = 128;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          onChange(color, base64);
        } else {
          onChange(color, event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const removeAvatar = () => {
    onChange(color, null);
  };

  // Sort icons so popular ones are first, and render all 250+ icons
  const sortedAllIcons = React.useMemo(() => {
    return [...allOutlinedIconNames].sort((a, b) => {
      const aIndex = popularIcons.indexOf(a);
      const bIndex = popularIcons.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
  }, []);

  const getVisibleIconNames = () => {
    if (!searchText.trim()) {
      return popularIcons;
    }
    return sortedAllIcons
      .filter((name) => name.toLowerCase().includes(searchText.toLowerCase()))
      .slice(0, 100);
  };

  const visibleIconNames = getVisibleIconNames();
  const previewBackground = icon && icon.startsWith('data:image/') ? 'transparent' : color;
  const isBase64 = icon && icon.startsWith('data:image/');

  return (
    <Popover
      content={
        <IconPickerPopoverContent
          color={color}
          icon={icon}
          projectName={projectName}
          searchText={searchText}
          setSearchText={setSearchText}
          onChange={onChange}
          visibleIconNames={visibleIconNames}
          removeAvatar={removeAvatar}
          fileInputRef={fileInputRef}
          handleFileChange={handleFileChange}
          processFile={processFile}
          t={t}
        />
      }
      trigger="click"
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      placement="bottomLeft"
      overlayClassName="project-icon-picker-overlay"
    >
      <div
        className={`project-icon-bubble-trigger ${isBase64 ? 'has-avatar' : ''}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: previewBackground,
          cursor: 'pointer',
        }}
      >
        {renderProjectIcon(icon, color, projectName, size)}
      </div>
    </Popover>
  );
};

export default ProjectIconPicker;
