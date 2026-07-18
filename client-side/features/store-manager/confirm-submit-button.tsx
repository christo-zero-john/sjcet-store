"use client";

import type { MouseEvent, ReactNode } from "react";

type ConfirmSubmitButtonProps = Readonly<{
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  message: string;
  title?: string;
}>;

export function ConfirmSubmitButton({
  "aria-label": ariaLabel,
  children,
  className,
  disabled,
  message,
  title,
}: ConfirmSubmitButtonProps) {
  function confirmSubmission(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(message)) event.preventDefault();
  }

  return (
    <button
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      onClick={confirmSubmission}
      title={title}
      type="submit"
    >
      {children}
    </button>
  );
}
