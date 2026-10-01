import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { CloseIcon } from '../icons/ActionIcons';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Optional description announced with the dialog title. */
  description?: string;
  /** Pinned action row under the scrollable body. */
  footer?: ReactNode;
  size?: ModalSize;
  /** Clicking the backdrop closes the dialog. */
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

/**
 * Page scroll is locked with a counter rather than a boolean so closing one
 * dialog never unlocks the page while another is still open.
 */
let openDialogCount = 0;

function lockScroll(): void {
  openDialogCount += 1;
  document.documentElement.classList.add('overflow-hidden');
}

function releaseScroll(): void {
  openDialogCount = Math.max(0, openDialogCount - 1);
  if (openDialogCount === 0) {
    document.documentElement.classList.remove('overflow-hidden');
  }
}

/**
 * Modal built on the native `<dialog>` element: focus trapping, inertness of
 * the page behind it, Escape handling and top-layer stacking all come from the
 * platform instead of a hand-rolled focus manager.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const isScrollLockedRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      isScrollLockedRef.current = true;
      lockScroll();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }

    // Runs before the next effect and on unmount: always hand the scroll lock back.
    return () => {
      if (isScrollLockedRef.current) {
        isScrollLockedRef.current = false;
        releaseScroll();
      }
    };
  }, [isOpen]);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    // The backdrop reports the dialog element itself as the click target.
    if (closeOnBackdrop && event.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleBackdropClick}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={[
        'backdrop:bg-black/75 backdrop:backdrop-blur-xs',
        'm-auto w-[calc(100%-2rem)] max-h-[90dvh] overflow-hidden p-0',
        'rounded-xl border border-surface-600 bg-surface-800 text-ink-primary shadow-2xl',
        SIZE_CLASSES[size],
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3 border-b border-surface-600 px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-base font-semibold text-ink-primary">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-0.5 truncate text-xs text-ink-tertiary">
              {description}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="-mr-2 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-surface-700 hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strava-orange"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="max-h-[calc(90dvh-4.5rem)] overflow-y-auto px-5 py-4">{children}</div>

      {footer ? (
        <div className="flex items-center justify-end gap-2 border-t border-surface-600 bg-surface-900/60 px-5 py-3">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
