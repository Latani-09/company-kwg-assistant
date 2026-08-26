import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

export function Modal({ open, onClose, children, maxWidthClass = "max-w-[28rem]" }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/50 backdrop-blur-sm p-md"
      onClick={onClose}
    >
      <div
        className={`bg-surface-container-lowest rounded-xl shadow-lg w-full ${maxWidthClass} overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
