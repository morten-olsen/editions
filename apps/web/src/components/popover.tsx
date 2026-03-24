import * as React from 'react';
import { Popover as BasePopover } from '@base-ui/react/popover';

const Root = BasePopover.Root;
const Trigger = BasePopover.Trigger;
const Close = BasePopover.Close;

const Content = ({
  children,
  side = 'top',
  className = '',
  ...props
}: React.ComponentProps<typeof BasePopover.Popup> & {
  side?: 'top' | 'bottom' | 'left' | 'right';
}): React.ReactElement => (
  <BasePopover.Portal>
    <BasePopover.Positioner sideOffset={8} side={side} className="z-[70]">
      <BasePopover.Popup
        className={`origin-[var(--transform-origin)] rounded-lg bg-surface-overlay py-1.5 shadow-lg border border-border min-w-40 outline-none transition-all duration-normal ease-gentle data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 ${className}`}
        {...props}
      >
        {children}
      </BasePopover.Popup>
    </BasePopover.Positioner>
  </BasePopover.Portal>
);

const Item = ({
  className = '',
  ...props
}: React.ComponentProps<'button'>): React.ReactElement => (
  <button
    type="button"
    className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-ink outline-none select-none cursor-default hover:bg-surface-sunken hover:text-ink transition-colors duration-fast ${className}`}
    {...props}
  />
);

const Popover = { Root, Trigger, Content, Close, Item };

export { Popover };
