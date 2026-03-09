import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";

const Root = BaseTabs.Root;
const Panel = BaseTabs.Panel;

const List = ({
  className = "",
  ...props
}: React.ComponentProps<typeof BaseTabs.List>): React.ReactElement => (
  <BaseTabs.List
    className={`flex gap-1 border-b border-border ${className}`}
    {...props}
  />
);

const Tab = ({
  className = "",
  ...props
}: React.ComponentProps<typeof BaseTabs.Tab>): React.ReactElement => (
  <BaseTabs.Tab
    className={`relative flex h-10 items-center justify-center px-4 text-sm font-medium text-ink-tertiary outline-none select-none transition-colors duration-fast ease-gentle hover:text-ink-secondary focus-visible:text-ink data-[active]:text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent after:transition-colors after:duration-fast data-[active]:after:bg-accent cursor-pointer ${className}`}
    {...props}
  />
);

const Tabs = { Root, List, Tab, Panel };

export { Tabs };
