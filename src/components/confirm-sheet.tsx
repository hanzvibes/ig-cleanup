import type { PointerEvent as ReactPointerEvent } from "react";
import { CloseIcon } from "./icons";

type ConfirmSheetProps = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmSheet({
  title,
  description,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <div className="sheetBackdrop" role="presentation" onPointerDown={onCancel}>
      <section
        className="reviewSheet confirmSheet"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(event: ReactPointerEvent<HTMLElement>) => event.stopPropagation()}
      >
        <div className="sheetHandle" />
        <button className="sheetClose" type="button" onClick={onCancel} aria-label="Close">
          <CloseIcon />
        </button>
        <h2>{title}</h2>
        <p className="confirmDescription">{description}</p>
        <button className={danger ? "confirmDanger" : "primaryAction"} type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="secondaryAction" type="button" onClick={onCancel}>Cancel</button>
      </section>
    </div>
  );
}
