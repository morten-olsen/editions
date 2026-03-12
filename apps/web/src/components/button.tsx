import * as React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = React.ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover shadow-xs active:shadow-none',
  secondary: 'bg-surface-raised text-ink border border-border hover:bg-surface-sunken active:bg-surface-sunken',
  ghost: 'text-ink-secondary hover:text-ink hover:bg-surface-sunken active:bg-surface-sunken',
  destructive: 'bg-critical text-white hover:bg-critical/90 shadow-xs active:shadow-none',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-lg',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className = '', ...props }, ref): React.ReactElement => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center font-medium select-none transition-colors duration-fast ease-gentle outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  ),
);

Button.displayName = 'Button';

export type { ButtonProps, ButtonVariant, ButtonSize };
export { Button };
