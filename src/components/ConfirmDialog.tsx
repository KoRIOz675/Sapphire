import { useTranslation } from "react-i18next";
import Modal from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  onCancel: () => void;
  onConfirm: () => void;
  danger?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  danger,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={title ?? t("common.confirm")}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button
            className={danger ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
          >
            {t("common.confirm")}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        {message ?? t("common.confirm_delete")}
      </p>
    </Modal>
  );
}
