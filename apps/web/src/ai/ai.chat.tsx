/* ── Chat drawer ──────────────────────────────────────────
 * Right-edge slide-out panel for the AI assistant.
 *
 * Three states:
 * - Closed: nothing visible
 * - Open + idle: full drawer with messages and input
 * - Open + processing: drawer fades to a small floating
 *   stop button so the user can watch the agent work
 * ──────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { transitions } from '../components/animate.tsx';

import { useAi } from './ai.provider.tsx';
import type { AiDisplayMessage } from './ai.types.ts';

/* ── Icons ─────────────────────────────────────────────── */

const SparkleIcon = (): React.ReactElement => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 1L9.5 5.5L14 7L9.5 8.5L8 13L6.5 8.5L2 7L6.5 5.5L8 1Z" fill="currentColor" />
  </svg>
);

const CloseIcon = (): React.ReactElement => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SendIcon = (): React.ReactElement => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 8L14 2L8 14L7 9L2 8Z" fill="currentColor" />
  </svg>
);

const StopIcon = (): React.ReactElement => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" />
  </svg>
);

const PlusIcon = (): React.ReactElement => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/* ── Message bubble ──────────────────────────────────── */

const MessageBubble = ({ message }: { message: AiDisplayMessage }): React.ReactElement => {
  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-accent/10 px-3.5 py-2.5 text-sm text-ink leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.type === 'action') {
    const statusIcon = message.status === 'running' ? '●' : message.status === 'done' ? '✓' : '✗';
    const statusColor =
      message.status === 'running' ? 'text-accent' : message.status === 'done' ? 'text-positive' : 'text-critical';
    return (
      <div className="flex items-center gap-2 text-xs text-ink-tertiary py-1 px-1">
        <span className={`${statusColor} ${message.status === 'running' ? 'animate-pulse' : ''}`}>{statusIcon}</span>
        <span className="font-mono">{message.description}</span>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] text-sm text-ink leading-relaxed">{message.content}</div>
    </div>
  );
};

/* ── Floating stop pill ──────────────────────────────── */

const FloatingStopPill = ({
  activity,
  turnCount,
  onStop,
  onExpand,
}: {
  activity: string | null;
  turnCount: number;
  onStop: () => void;
  onExpand: () => void;
}): React.ReactElement => (
  <motion.div
    className="fixed bottom-6 right-6 z-[901] flex items-center gap-1 rounded-full bg-surface border border-border shadow-lg px-1.5 py-1.5"
    initial={{ opacity: 0, scale: 0.8, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.8, y: 20 }}
    transition={transitions.enter}
  >
    <button
      type="button"
      onClick={onExpand}
      className="flex items-center gap-2 pl-3 pr-2 py-1 rounded-full text-xs text-ink-secondary hover:text-ink transition-colors duration-fast cursor-pointer max-w-64 min-w-0"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
      <span className="truncate font-mono">{activity ?? 'Working...'}</span>
      {turnCount > 0 && <span className="text-ink-faint shrink-0">{turnCount}/20</span>}
    </button>
    <button
      type="button"
      onClick={onStop}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-critical bg-critical-subtle hover:bg-critical/15 transition-colors duration-fast cursor-pointer shrink-0"
    >
      <StopIcon />
      <span>Stop</span>
    </button>
  </motion.div>
);

/* ── Drawer header ───────────────────────────────────── */

type DrawerHeaderProps = {
  hasMessages: boolean;
  isProcessing: boolean;
  onClear: () => void;
  onClose: () => void;
};

const DrawerHeader = ({ hasMessages, isProcessing, onClear, onClose }: DrawerHeaderProps): React.ReactElement => (
  <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
    <div className="flex items-center gap-2 text-sm font-medium text-ink">
      <SparkleIcon />
      <span>Assistant</span>
    </div>
    <div className="flex items-center gap-1">
      {hasMessages && !isProcessing && (
        <button
          type="button"
          onClick={onClear}
          className="p-1.5 rounded-md text-ink-tertiary hover:text-ink hover:bg-surface-sunken transition-colors duration-fast cursor-pointer"
          aria-label="New conversation"
          title="New conversation"
        >
          <PlusIcon />
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 rounded-md text-ink-tertiary hover:text-ink hover:bg-surface-sunken transition-colors duration-fast cursor-pointer"
        aria-label="Close assistant"
      >
        <CloseIcon />
      </button>
    </div>
  </div>
);

/* ── Drawer messages ─────────────────────────────────── */

type DrawerMessagesProps = {
  messages: AiDisplayMessage[];
  isProcessing: boolean;
  lastActivity: string | null;
  turnCount: number;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

const DrawerMessages = ({
  messages,
  isProcessing,
  lastActivity,
  turnCount,
  messagesEndRef,
}: DrawerMessagesProps): React.ReactElement => (
  <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
    {messages.length === 0 && (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-ink-faint text-center leading-relaxed">
          Describe what you'd like to do and I'll help set it up.
        </p>
      </div>
    )}
    {messages.map((msg, idx) => (
      <MessageBubble key={idx} message={msg} />
    ))}
    {isProcessing && messages.at(-1)?.type !== 'action' && (
      <div className="flex items-center gap-2 text-xs text-ink-tertiary py-1">
        <span className="text-accent animate-pulse">●</span>
        <span className="truncate">
          {lastActivity ?? 'Thinking'}
          {turnCount > 0 ? ` · ${turnCount}/20` : ''}
        </span>
      </div>
    )}
    <div ref={messagesEndRef} />
  </div>
);

/* ── Drawer footer ───────────────────────────────────── */

type DrawerFooterProps = {
  isProcessing: boolean;
  input: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onStop: () => void;
};

const DrawerFooter = ({
  isProcessing,
  input,
  inputRef,
  onInputChange,
  onSubmit,
  onKeyDown,
  onStop,
}: DrawerFooterProps): React.ReactElement => (
  <div className="shrink-0 border-t border-border p-3">
    {isProcessing ? (
      <button
        type="button"
        onClick={onStop}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium text-critical bg-critical-subtle hover:bg-critical/15 transition-colors duration-fast cursor-pointer"
      >
        <StopIcon />
        <span>Stop assistant</span>
      </button>
    ) : (
      <div className="flex items-end gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-colors duration-fast">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            onInputChange(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
          }}
          onKeyDown={onKeyDown}
          placeholder="Ask me anything..."
          rows={1}
          className="flex-1 text-sm text-ink placeholder:text-ink-faint bg-transparent outline-none resize-none leading-relaxed max-h-24"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!input.trim()}
          className="shrink-0 p-1 rounded text-ink-tertiary hover:text-accent disabled:opacity-30 disabled:pointer-events-none transition-colors duration-fast cursor-pointer"
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </div>
    )}
  </div>
);

/* ── Chat drawer ─────────────────────────────────────── */

const AiChatDrawer = (): React.ReactNode => {
  const {
    isOpen,
    toggleOpen,
    displayMessages,
    isProcessing,
    lastActivity,
    turnCount,
    sendMessage,
    stopProcessing,
    clearConversation,
  } = useAi();
  const [input, setInput] = useState('');
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMinimized(isProcessing && isOpen);
  }, [isProcessing, isOpen]);
  useEffect(() => {
    if (!minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayMessages, minimized]);
  useEffect(() => {
    if (isOpen && !minimized && !isProcessing) {
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [isOpen, minimized, isProcessing]);
  useEffect(() => {
    if (!isOpen || isProcessing) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        toggleOpen();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, toggleOpen]);

  const handleSubmit = useCallback((): void => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing) {
      return;
    }
    setInput('');
    sendMessage(trimmed);
  }, [input, isProcessing, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStop = useCallback((): void => {
    stopProcessing();
    setMinimized(false);
  }, [stopProcessing]);
  const handleExpand = useCallback((): void => {
    setMinimized(false);
  }, []);

  const showDrawer = isOpen && !minimized;
  const showPill = isOpen && minimized && isProcessing;

  return (
    <>
      <AnimatePresence>
        {showPill && (
          <FloatingStopPill
            key="pill"
            activity={lastActivity}
            turnCount={turnCount}
            onStop={handleStop}
            onExpand={handleExpand}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDrawer && (
          <>
            {!isProcessing && (
              <motion.div
                key="scrim"
                className="fixed inset-0 bg-ink/5 backdrop-blur-xs z-[900]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transitions.normal}
                onClick={toggleOpen}
              />
            )}
            <motion.div
              key="drawer"
              className="fixed right-0 top-0 bottom-0 z-[901] w-full max-w-sm flex flex-col bg-surface border-l border-border shadow-xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={transitions.enter}
            >
              <DrawerHeader
                hasMessages={displayMessages.length > 0}
                isProcessing={isProcessing}
                onClear={clearConversation}
                onClose={toggleOpen}
              />
              <DrawerMessages
                messages={displayMessages}
                isProcessing={isProcessing}
                lastActivity={lastActivity}
                turnCount={turnCount}
                messagesEndRef={messagesEndRef}
              />
              <DrawerFooter
                isProcessing={isProcessing}
                input={input}
                inputRef={inputRef}
                onInputChange={setInput}
                onSubmit={handleSubmit}
                onKeyDown={handleKeyDown}
                onStop={handleStop}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

/* ── Toggle button (for nav) ─────────────────────────── */

const AiToggleButton = (): React.ReactNode => {
  const { isEnabled, toggleOpen, isProcessing } = useAi();

  if (!isEnabled) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleOpen}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-ink-secondary hover:text-ink hover:bg-surface-sunken transition-colors duration-fast cursor-pointer"
      aria-label="Toggle AI assistant"
    >
      <SparkleIcon />
      <span className="truncate">Assistant</span>
      <span className="text-[10px] font-medium text-accent/60 uppercase tracking-wider">alpha</span>
      {isProcessing && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
    </button>
  );
};

export { AiChatDrawer, AiToggleButton };
