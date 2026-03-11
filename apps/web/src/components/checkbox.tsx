import * as React from "react";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";

type CheckboxProps = React.ComponentProps<typeof BaseCheckbox.Root> & {
  label?: string;
  description?: string;
};

const CheckIcon = (): React.ReactElement => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path
      d="M10 3L4.5 8.5L2 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Checkbox = ({
  label,
  description,
  className = "",
  ...props
}: CheckboxProps): React.ReactElement => {
  const control = (
    <BaseCheckbox.Root
      className={`flex size-5 shrink-0 items-center justify-center rounded border border-border bg-surface-raised transition-colors duration-fast ease-gentle outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface data-[checked]:bg-accent data-[checked]:border-accent data-[checked]:text-accent-ink cursor-pointer ${className}`}
      {...props}
    >
      <BaseCheckbox.Indicator className="flex data-[unchecked]:hidden">
        <CheckIcon />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );

  if (!label) return control;

  return (
    <label className={`flex gap-2.5 cursor-pointer select-none ${description ? "items-start" : "items-center"}`}>
      {description ? <div className="mt-0.5">{control}</div> : control}
      <div>
        <span className="text-sm text-ink">{label}</span>
        {description && (
          <p className="text-xs text-ink-tertiary mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
};

export type { CheckboxProps };
export { Checkbox };
