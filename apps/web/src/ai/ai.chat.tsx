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
import { SparkleIcon, FloatingStopPill, DrawerHeader, DrawerMessages, DrawerFooter } from './ai.chat.parts.tsx';

/* ── Drawer state hook ────────────────────────────────── */

type DrawerState = {
  input: string;
  setInput: (value: string) => void;
  minimized: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  handleSubmit: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleStop: () => void;
  handleExpand: () => void;
};

const useDrawerState = (): DrawerState => {
  const { isOpen, toggleOpen, displayMessages, isProcessing, sendMessage, stopProcessing } = useAi();
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

  return {
    input,
    setInput,
    minimized,
    messagesEndRef,
    inputRef,
    handleSubmit,
    handleKeyDown,
    handleStop,
    handleExpand,
  };
};

/* ── Drawer content panel ────────────────────────────── */

const DrawerPanel = (): React.ReactElement => {
  const { toggleOpen, displayMessages, isProcessing, lastActivity, turnCount, clearConversation } = useAi();
  const { input, setInput, messagesEndRef, inputRef, handleSubmit, handleKeyDown, handleStop } = useDrawerState();

  return (
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
  );
};

/* ── Chat drawer ─────────────────────────────────────── */

const AiChatDrawer = (): React.ReactNode => {
  const { isOpen, toggleOpen, isProcessing, lastActivity, turnCount } = useAi();
  const { minimized, handleStop, handleExpand } = useDrawerState();

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
            <DrawerPanel />
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
