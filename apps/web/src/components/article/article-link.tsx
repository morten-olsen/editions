import * as React from 'react';
import { Popover } from '../popover.tsx';
import { useShowToast } from '../toast.tsx';

/* ── Icons ───────────────────────────────────────────────────── */

const ExternalLinkIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M8.75 3.5a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V5.56l-4.22 4.22a.75.75 0 1 1-1.06-1.06l4.22-4.22H9.5a.75.75 0 0 1-.75-.75Z" />
    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25h1.5a.75.75 0 0 0 0-1.5h-1.5A2.75 2.75 0 0 0 2 5.75v5.5A2.75 2.75 0 0 0 4.75 14h5.5A2.75 2.75 0 0 0 13 11.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-5.5c-.69 0-1.25-.56-1.25-1.25v-5.5Z" />
  </svg>
);

const BookmarkIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M4 3.5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 12 3.5v10a.5.5 0 0 1-.765.424L8 11.84l-3.235 2.084A.5.5 0 0 1 4 13.5v-10Z" />
  </svg>
);

/* ── Component ───────────────────────────────────────────────── */

type ArticleLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  onSaveUrl: (url: string) => Promise<void>;
};

const ArticleLink = ({ href, children, onSaveUrl, ...rest }: ArticleLinkProps): React.ReactElement => {
  const showToast = useShowToast();

  const handleOpen = (): void => {
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  const handleBookmark = (): void => {
    if (!href) {
      return;
    }
    const url = href;
    showToast({
      title: 'Saving bookmark',
      description: url,
      action: () => onSaveUrl(url),
    });
  };

  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <a
            {...rest}
            href={href}
            onClick={(e) => {
              e.preventDefault();
            }}
          />
        }
      >
        {children}
      </Popover.Trigger>
      <Popover.Content side="top">
        <Popover.Close render={<Popover.Item />} onClick={handleOpen}>
          <ExternalLinkIcon />
          Open in new tab
        </Popover.Close>
        <Popover.Close render={<Popover.Item />} onClick={handleBookmark}>
          <BookmarkIcon />
          Save bookmark
        </Popover.Close>
      </Popover.Content>
    </Popover.Root>
  );
};

export type { ArticleLinkProps };
export { ArticleLink };
