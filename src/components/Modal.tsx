import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  dismissable?: boolean;
}

export default function Modal({ open, title, onClose, children, footer, size = "md", dismissable = true }: ModalProps) {
  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  // Close on Escape (via global shortcut custom event)
  useEffect(() => {
    if (!open || !dismissable) return;
    function handle() { onClose(); }
    document.addEventListener("sapphire:close-modal", handle);
    return () => document.removeEventListener("sapphire:close-modal", handle);
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className={`w-full ${width} rounded-lg bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-base font-semibold">{title}</h3>
          {dismissable && (
            <button className="rounded-sm p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="max-h-[70vh] overflow-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
