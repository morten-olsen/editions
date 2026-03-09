import * as React from "react";
import { Select as BaseSelect } from "@base-ui/react/select";

const Root = BaseSelect.Root;

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

const ChevronIcon = (): React.ReactElement => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-ink-tertiary">
    <path
      d="M3 4.5L6 7.5L9 4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Trigger = ({
  className = "",
  ...props
}: React.ComponentProps<typeof BaseSelect.Trigger>): React.ReactElement => (
  <BaseSelect.Trigger
    className={`inline-flex h-10 items-center justify-between gap-2 rounded-md border border-border bg-surface-raised px-3.5 text-sm text-ink outline-none transition-colors duration-fast ease-gentle focus:border-accent focus:ring-2 focus:ring-accent/20 data-[popup-open]:border-accent data-[popup-open]:ring-2 data-[popup-open]:ring-accent/20 cursor-pointer ${className}`}
    {...props}
  >
    <BaseSelect.Value placeholder="Select..." />
    <BaseSelect.Icon>
      <ChevronIcon />
    </BaseSelect.Icon>
  </BaseSelect.Trigger>
);

const Content = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement => (
  <BaseSelect.Portal>
    <BaseSelect.Positioner sideOffset={4}>
      <BaseSelect.Popup
        className={`origin-[var(--transform-origin)] rounded-lg bg-surface-overlay py-1.5 shadow-lg border border-border outline-none transition-all duration-normal ease-gentle data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 ${className}`}
      >
        {children}
      </BaseSelect.Popup>
    </BaseSelect.Positioner>
  </BaseSelect.Portal>
);

const Item = ({
  className = "",
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Item>): React.ReactElement => (
  <BaseSelect.Item
    className={`grid grid-cols-[1rem_1fr] items-center gap-2 px-3 py-2 text-sm text-ink outline-none select-none cursor-default data-[highlighted]:bg-surface-sunken ${className}`}
    {...props}
  >
    <BaseSelect.ItemIndicator className="col-start-1">
      <CheckIcon />
    </BaseSelect.ItemIndicator>
    <BaseSelect.ItemText className="col-start-2">{children}</BaseSelect.ItemText>
  </BaseSelect.Item>
);

const Group = BaseSelect.Group;
const GroupLabel = ({
  className = "",
  ...props
}: React.ComponentProps<typeof BaseSelect.GroupLabel>): React.ReactElement => (
  <BaseSelect.GroupLabel
    className={`px-3 py-1.5 text-xs font-medium text-ink-tertiary tracking-wide uppercase ${className}`}
    {...props}
  />
);

const Select = { Root, Trigger, Content, Item, Group, GroupLabel };

export { Select };
