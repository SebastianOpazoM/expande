import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

type AsyncButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  onAction: () => Promise<unknown>;
  pendingContent?: ReactNode;
};

export function AsyncButton({
  onAction,
  pendingContent,
  children,
  disabled,
  ...props
}: AsyncButtonProps) {
  const [pending, setPending] = useState(false);

  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      onClick={() => {
        if (pending) return;
        setPending(true);
        void onAction()
          .catch(() => {})
          .finally(() => setPending(false));
      }}
    >
      {pending ? pendingContent || <><Spinner />{children}</> : children}
    </button>
  );
}
