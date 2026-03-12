import * as React from 'react';
import { Field } from '@base-ui/react/field';

type InputProps = React.ComponentProps<'input'> & {
  label?: string;
  description?: string;
  error?: string;
};

const inputClasses =
  'h-10 w-full rounded-md border border-border bg-surface-raised px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors duration-fast ease-gentle focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-40 disabled:pointer-events-none';

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, description, error, className = '', id, ...props }, ref): React.ReactElement => {
    if (!label) {
      return <input ref={ref} className={`${inputClasses} ${className}`} id={id} {...props} />;
    }

    return (
      <Field.Root className="flex flex-col gap-1.5">
        <Field.Label className="text-sm font-medium text-ink">{label}</Field.Label>
        {description && (
          <Field.Description className="text-xs text-ink-tertiary -mt-0.5">{description}</Field.Description>
        )}
        <Field.Control
          ref={ref}
          className={`${inputClasses} ${error ? 'border-critical focus:border-critical focus:ring-critical/20' : ''} ${className}`}
          render={<input />}
          id={id}
          {...props}
        />
        {error && (
          <Field.Error className="text-xs text-critical" match>
            {error}
          </Field.Error>
        )}
      </Field.Root>
    );
  },
);

Input.displayName = 'Input';

export type { InputProps };
export { Input, inputClasses };
