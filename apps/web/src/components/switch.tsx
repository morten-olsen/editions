import * as React from 'react';
import { Switch as BaseSwitch } from '@base-ui/react/switch';

type SwitchProps = React.ComponentProps<typeof BaseSwitch.Root> & {
  label?: string;
};

const Switch = ({ label, className = '', ...props }: SwitchProps): React.ReactElement => {
  const control = (
    <BaseSwitch.Root
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-surface-sunken transition-colors duration-normal ease-gentle outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface data-[checked]:bg-accent data-[checked]:border-accent cursor-pointer ${className}`}
      {...props}
    >
      <BaseSwitch.Thumb className="block size-5 rounded-full bg-surface-overlay shadow-sm transition-transform duration-normal ease-gentle translate-x-0.5 data-[checked]:translate-x-[1.375rem]" />
    </BaseSwitch.Root>
  );

  if (!label) {
    return control;
  }

  return (
    <label className="flex items-center justify-between gap-3 text-sm text-ink cursor-pointer select-none">
      {label}
      {control}
    </label>
  );
};

export type { SwitchProps };
export { Switch };
