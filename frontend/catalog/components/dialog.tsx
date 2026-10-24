"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icon";

export function Dialog({ title, drawer = false, children, onClose }: {
  title: string; drawer?: boolean; children: React.ReactNode; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={ref} className={`modal ${drawer ? "basket-drawer" : ""}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-content">
      <button type="button" className="modal-close" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
      {children}
    </div>
  </dialog>;
}
