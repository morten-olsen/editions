/* ── Tutorial registry and loader ─────────────────────────
 * Lazy-loaded markdown tutorials that give the agent
 * domain knowledge about Editions.
 * ──────────────────────────────────────────────────────── */

type TutorialEntry = {
  id: string;
  title: string;
  summary: string;
};

const tutorials: TutorialEntry[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    summary: 'What Editions is, core concepts, first-time setup walkthrough',
  },
  { id: 'sources', title: 'Sources', summary: 'Adding RSS, podcast, Mastodon, Bluesky, YouTube sources' },
  { id: 'focuses', title: 'Focuses', summary: 'Creating topic focuses, how article classification works' },
  { id: 'editions', title: 'Editions', summary: 'Configuring editions, source/focus budgets, scheduling' },
  { id: 'feed', title: 'Feed', summary: 'Feed ranking, sorting modes, voting on articles' },
  { id: 'bookmarks', title: 'Bookmarks', summary: 'Saving and managing bookmarked articles' },
  { id: 'scoring', title: 'Scoring', summary: 'Customizing scoring weights for article ranking' },
  {
    id: 'settings',
    title: 'Settings',
    summary: 'Settings page tabs: tasks, votes, scoring weights, AI assistant configuration',
  },
];

const tutorialModules: Record<string, () => Promise<string>> = {
  'getting-started': () => import('./tutorials/getting-started.md?raw').then((m) => m.default),
  sources: () => import('./tutorials/sources.md?raw').then((m) => m.default),
  focuses: () => import('./tutorials/focuses.md?raw').then((m) => m.default),
  editions: () => import('./tutorials/editions.md?raw').then((m) => m.default),
  feed: () => import('./tutorials/feed.md?raw').then((m) => m.default),
  bookmarks: () => import('./tutorials/bookmarks.md?raw').then((m) => m.default),
  scoring: () => import('./tutorials/scoring.md?raw').then((m) => m.default),
  settings: () => import('./tutorials/settings.md?raw').then((m) => m.default),
};

const getTutorialContent = async (id: string): Promise<string> => {
  const loader = tutorialModules[id];
  if (!loader) {
    return `Tutorial "${id}" not found. Available: ${tutorials.map((t) => t.id).join(', ')}`;
  }
  return loader();
};

const getTutorialRegistry = (): string => {
  const lines = tutorials.map((t) => `- **${t.id}**: ${t.title} — ${t.summary}`);
  return `Available tutorials:\n${lines.join('\n')}`;
};

export type { TutorialEntry };
export { tutorials, getTutorialContent, getTutorialRegistry };
