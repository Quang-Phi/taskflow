import React, { useState, useCallback, useRef } from 'react';
import { Modal, Button } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import { useTranslation } from '../../utils/i18n';
import './DeleteConfirmModal.scss';

export interface DeleteConfirmModalProps {
  open: boolean;
  title?: string;
  content?: React.ReactNode;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  confirmLoading?: boolean;
  okText?: string;
  cancelText?: string;
  zIndex?: number;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  open,
  title,
  content,
  onConfirm,
  onCancel,
  confirmLoading = false,
  okText,
  cancelText,
  zIndex = 3000,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={400}
      closable={false}
      className="delete-confirm-modal"
      centered
      zIndex={zIndex}
      destroyOnClose
    >
      <div className="delete-confirm-modal__container">
        <div className="delete-confirm-modal__icon-wrapper">
          <ExclamationCircleFilled />
        </div>
        <h3 className="delete-confirm-modal__title">
          {title || t('common.delete_confirm_title' as any) || 'Xác nhận xóa'}
        </h3>
        <div className="delete-confirm-modal__message">
          {content || t('common.delete_confirm_content' as any) || 'Bạn có chắc chắn muốn thực hiện hành động này?'}
        </div>
      </div>
      <div className="delete-confirm-modal__footer">
        <Button
          onClick={onCancel}
          className="delete-confirm-modal__btn-cancel"
          disabled={confirmLoading}
        >
          {cancelText || t('common.cancel' as any) || 'Hủy'}
        </Button>
        <Button
          type="primary"
          danger
          loading={confirmLoading}
          onClick={onConfirm}
          className="delete-confirm-modal__btn-confirm"
        >
          {okText || t('common.delete' as any) || 'Xóa'}
        </Button>
      </div>
    </Modal>
  );
};

export interface DeleteConfirmOptions {
  title?: string;
  content?: React.ReactNode;
  onConfirm: () => Promise<void> | void;
  okText?: string;
  cancelText?: string;
  zIndex?: number;
}

export const useDeleteConfirm = () => {
  const [open, setOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [options, setOptions] = useState<DeleteConfirmOptions | null>(null);
  // Guard: prevent AntD Modal's onCancel from firing AFTER we already confirmed
  const isConfirming = useRef(false);

  const showDeleteConfirm = useCallback((opts: DeleteConfirmOptions) => {
    isConfirming.current = false;
    setOptions(opts);
    setOpen(true);
    setConfirmLoading(false);
  }, []);

  const hideDeleteConfirm = useCallback(() => {
    // If we're mid-confirm, AntD may fire onCancel due to parent re-render — ignore it
    if (isConfirming.current) return;
    setOpen(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!options || isConfirming.current) return;
    isConfirming.current = true;
    setConfirmLoading(true);
    // Close modal FIRST before running callback.
    // This prevents onClose() → parent re-render → Modal.onCancel double-fire.
    setOpen(false);
    try {
      await options.onConfirm();
    } catch (err) {
      console.error('Delete confirmation callback failed:', err);
    } finally {
      setConfirmLoading(false);
      isConfirming.current = false;
    }
  }, [options]);

  const DeleteConfirmComponent = useCallback(() => {
    if (!options) return null;
    return (
      <DeleteConfirmModal
        open={open}
        confirmLoading={confirmLoading}
        title={options.title}
        content={options.content}
        okText={options.okText}
        cancelText={options.cancelText}
        zIndex={options.zIndex}
        onConfirm={handleConfirm}
        onCancel={hideDeleteConfirm}
      />
    );
  }, [open, confirmLoading, options, handleConfirm, hideDeleteConfirm]);

  return {
    showDeleteConfirm,
    hideDeleteConfirm,
    DeleteConfirmComponent,
  };
};
