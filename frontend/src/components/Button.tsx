import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

const variantClasses: Record<ButtonProps['variant'], string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'bg-white text-ink border border-border hover:bg-slate-100',
  danger: 'bg-closed text-white hover:opacity-90',
  ghost: 'bg-transparent text-ink hover:bg-slate-100',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'min-h-[44px] min-w-[44px] px-3 text-body-sm',
  md: 'min-h-[44px] min-w-[44px] px-4 text-body-lg',
  lg: 'min-h-[48px] min-w-[44px] px-6 text-title',
};

export function Button({
  variant,
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  children,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-[--radius-control] font-medium',
        'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        isDisabled ? 'opacity-50 cursor-not-allowed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

export type ButtonAttributes = ButtonHTMLAttributes<HTMLButtonElement>;
