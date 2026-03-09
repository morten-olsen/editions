import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";

/* ── Root ──────────────────────────────────────────────── */
const Root = BaseDialog.Root;
const Trigger = BaseDialog.Trigger;
const Close = BaseDialog.Close;

/* ── Portal + Overlay + Content ────────────────────────── */
type ContentProps = React.ComponentProps<typeof BaseDialog.Popup> & {
  overlayClassName?: string;
};

const Content = ({
  children,
  className = "",
  overlayClassName = "",
  ...props
}: ContentProps): React.ReactElement => (
  <BaseDialog.Portal>
    <BaseDialog.Backdrop
      className={`fixed inset-0 bg-ink/20 backdrop-blur-xs transition-opacity duration-slow ease-gentle data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 ${overlayClassName}`}
    />
    <BaseDialog.Popup
      className={`fixed top-1/2 left-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface-overlay p-8 shadow-xl border border-border transition-all duration-slow ease-gentle data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 ${className}`}
      {...props}
    >
      {children}
    </BaseDialog.Popup>
  </BaseDialog.Portal>
);

/* ── Title & Description ───────────────────────────────── */
const Title = ({
  className = "",
  ...props
}: React.ComponentProps<typeof BaseDialog.Title>): React.ReactElement => (
  <BaseDialog.Title
    className={`text-lg font-medium text-ink tracking-tight mb-1 ${className}`}
    {...props}
  />
);

const Description = ({
  className = "",
  ...props
}: React.ComponentProps<typeof BaseDialog.Description>): React.ReactElement => (
  <BaseDialog.Description
    className={`text-sm text-ink-secondary leading-relaxed mb-6 ${className}`}
    {...props}
  />
);

const Dialog = { Root, Trigger, Close, Content, Title, Description };

export { Dialog };
