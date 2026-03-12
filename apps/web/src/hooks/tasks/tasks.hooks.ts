import { useCallback, useEffect, useRef, useState } from "react";

import { client } from "../../api/api.ts";

type TaskItem = {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
};

type TaskGroup = {
  type: string;
  completed: number;
  failed: number;
  tasks: TaskItem[];
};

type TaskCounts = {
  pending: number;
  running: number;
  completed: number;
  failed: number;
};

type UseTasksResult = {
  tasks: TaskItem[];
  loading: boolean;
  hasActive: boolean;
  activeTasks: TaskItem[];
  finishedGroups: TaskGroup[];
  expandedGroups: Set<string>;
  toggleGroup: (type: string) => void;
  counts: TaskCounts;
};

const POLL_INTERVAL_MS = 3000;

const TASK_TYPE_LABELS: Record<string, string> = {
  fetch_source: "Fetch feed",
  extract_article: "Extract article",
  analyse_article: "Analyse article",
};

const formatTaskType = (type: string): string =>
  TASK_TYPE_LABELS[type] ?? type.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatTimeAgo = (ms: number): string => {
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const formatDuration = (start: number, end: number): string => {
  const sec = Math.round((end - start) / 1000);
  if (sec < 1) return "<1s";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
};

const groupFinishedTasks = (tasks: TaskItem[]): TaskGroup[] => {
  const map = new Map<string, TaskGroup>();
  for (const task of tasks) {
    let group = map.get(task.type);
    if (!group) {
      group = { type: task.type, completed: 0, failed: 0, tasks: [] };
      map.set(task.type, group);
    }
    if (task.status === "completed") group.completed++;
    else group.failed++;
    group.tasks.push(task);
  }
  return Array.from(map.values());
};

const useTasks = (token: string): UseTasksResult => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTasks = useCallback(async (): Promise<void> => {
    const { data } = await client.GET("/api/tasks", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (data) {
      setTasks(data.tasks as TaskItem[]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const hasActive = tasks.some((t) => t.status === "pending" || t.status === "running");

  useEffect(() => {
    if (hasActive) {
      intervalRef.current = setInterval(() => void loadTasks(), POLL_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasActive, loadTasks]);

  const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "running");
  const finishedTasks = tasks.filter((t) => t.status === "completed" || t.status === "failed");
  const finishedGroups = groupFinishedTasks(finishedTasks);

  const toggleGroup = useCallback((type: string): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const counts: TaskCounts = {
    pending: activeTasks.filter((t) => t.status === "pending").length,
    running: activeTasks.filter((t) => t.status === "running").length,
    completed: finishedTasks.filter((t) => t.status === "completed").length,
    failed: finishedTasks.filter((t) => t.status === "failed").length,
  };

  return {
    tasks,
    loading,
    hasActive,
    activeTasks,
    finishedGroups,
    expandedGroups,
    toggleGroup,
    counts,
  };
};

export type { TaskItem, TaskGroup, TaskCounts, UseTasksResult };
export { POLL_INTERVAL_MS, TASK_TYPE_LABELS, formatTaskType, formatTimeAgo, formatDuration, groupFinishedTasks, useTasks };
