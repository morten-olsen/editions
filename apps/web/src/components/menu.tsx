import * as React from 'react';
import { Menu as BaseMenu } from '@base-ui/react/menu';

const Root = BaseMenu.Root;
const Trigger = BaseMenu.Trigger;
const RadioGroup = BaseMenu.RadioGroup;

const Content = ({
  children,
  className = '',
  ...props
}: React.ComponentProps<typeof BaseMenu.Popup>): React.ReactElement => (
  <BaseMenu.Portal>
    <BaseMenu.Positioner sideOffset={8}>
      <BaseMenu.Popup
        className={`origin-[var(--transform-origin)] rounded-lg bg-surface-overlay py-1.5 shadow-lg border border-border min-w-48 outline-none transition-all duration-normal ease-gentle data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 ${className}`}
        {...props}
      >
        {children}
      </BaseMenu.Popup>
    </BaseMenu.Positioner>
  </BaseMenu.Portal>
);

const Item = ({ className = '', ...props }: React.ComponentProps<typeof BaseMenu.Item>): React.ReactElement => (
  <BaseMenu.Item
    className={`flex items-center gap-2 px-3 py-2 text-sm text-ink outline-none select-none cursor-default data-[highlighted]:bg-surface-sunken data-[highlighted]:text-ink ${className}`}
    {...props}
  />
);

const Separator = ({ className = '', ...props }: React.ComponentProps<'div'>): React.ReactElement => (
  <div role="separator" className={`h-px bg-border my-1.5 ${className}`} {...props} />
);

const Label = ({ className = '', ...props }: React.ComponentProps<'div'>): React.ReactElement => (
  <div
    className={`px-3 py-1.5 text-xs font-medium text-ink-tertiary tracking-wide uppercase ${className}`}
    {...props}
  />
);

const Menu = { Root, Trigger, Content, Item, Separator, Label, RadioGroup };

export { Menu };
