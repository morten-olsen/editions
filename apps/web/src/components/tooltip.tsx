import * as React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
};

const TooltipProvider = BaseTooltip.Provider;

const Tooltip = ({ content, children, side = 'top' }: TooltipProps): React.ReactElement => (
  <BaseTooltip.Root>
    <BaseTooltip.Trigger render={children} />
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner sideOffset={8} side={side}>
        <BaseTooltip.Popup className="rounded-md bg-ink px-2.5 py-1.5 text-xs text-surface-overlay shadow-md origin-[var(--transform-origin)] transition-all duration-fast ease-gentle data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95">
          {content}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  </BaseTooltip.Root>
);

export type { TooltipProps };
export { Tooltip, TooltipProvider };
