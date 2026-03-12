import * as React from 'react';
import { Separator as BaseSeparator } from '@base-ui/react/separator';

type SeparatorProps = React.ComponentProps<typeof BaseSeparator> & {
  soft?: boolean;
};

const Separator = ({ soft = false, className = '', ...props }: SeparatorProps): React.ReactElement => (
  <BaseSeparator className={`${soft ? 'bg-border' : 'bg-border-strong'} h-px w-full ${className}`} {...props} />
);

export type { SeparatorProps };
export { Separator };
