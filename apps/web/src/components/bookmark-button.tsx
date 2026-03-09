import * as React from "react";

type BookmarkButtonProps = {
  bookmarked: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
};

const BookmarkFlagIcon = ({ filled }: { filled: boolean }): React.ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 1.5}
    className="w-4 h-4"
  >
    <path d="M5 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14l-5-2.5L5 18V4Z" />
  </svg>
);

const BookmarkButton = ({
  bookmarked,
  onToggle,
  size = "sm",
}: BookmarkButtonProps): React.ReactElement => (
  <button
    type="button"
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onToggle();
    }}
    className={`shrink-0 rounded-md transition-colors duration-fast cursor-pointer ${
      size === "sm" ? "p-1" : "p-1.5"
    } ${
      bookmarked
        ? "text-accent hover:text-accent-hover"
        : "text-ink-faint hover:text-ink-secondary"
    }`}
    aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
  >
    <BookmarkFlagIcon filled={bookmarked} />
  </button>
);

export type { BookmarkButtonProps };
export { BookmarkButton };
