import * as React from 'react';
import { Field } from '@base-ui/react/field';

type TextareaProps = React.ComponentProps<'textarea'> & {
  label?: string;
  description?: string;
  error?: string;
};

const textareaClasses =
  'w-full rounded-md border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors duration-fast ease-gentle focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-40 disabled:pointer-events-none resize-y min-h-20';

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, description, error, className = '', ...props }, ref): React.ReactElement => {
    if (!label) {
      return <textarea ref={ref} className={`${textareaClasses} ${className}`} {...props} />;
    }

    return (
      <Field.Root className="flex flex-col gap-1.5">
        <Field.Label className="text-sm font-medium text-ink">{label}</Field.Label>
        {description && (
          <Field.Description className="text-xs text-ink-tertiary -mt-0.5">{description}</Field.Description>
        )}
        <Field.Control
          ref={ref as React.Ref<HTMLInputElement>}
          className={`${textareaClasses} ${error ? 'border-critical focus:border-critical focus:ring-critical/20' : ''} ${className}`}
          render={<textarea {...(props as React.ComponentProps<'textarea'>)} />}
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

Textarea.displayName = 'Textarea';

export type { TextareaProps };
export { Textarea };
