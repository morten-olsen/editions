// --- Discovery catalog types ---

type DiscoverySource = {
  id: string;
  name: string;
  type: 'rss' | 'podcast';
  url: string;
  description: string;
  tags: string[];
  coverImage: string | null;
};

type DiscoveryFocus = {
  id: string;
  name: string;
  description: string;
  icon: string;
  coverImage: string | null;
  minConfidence: number;
  sources: DiscoveryFocusSource[];
};

type DiscoveryFocusSource = {
  sourceId: string;
  weight: number;
};

type DiscoveryEditionConfig = {
  id: string;
  name: string;
  description: string;
  icon: string;
  coverImage: string | null;
  schedule: string;
  lookbackHours: number;
  focuses: DiscoveryEditionFocus[];
};

type DiscoveryEditionFocus = {
  focusId: string;
  position: number;
  budgetType: 'time' | 'count';
  budgetValue: number;
  weight: number;
};

// --- Source catalog ---

const discoverySources: DiscoverySource[] = [
  // Technology
  {
    id: 'ars-technica',
    name: 'Ars Technica',
    type: 'rss',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    description: 'In-depth technology news, analysis, and reviews',
    tags: ['technology', 'science'],
    coverImage: null,
  },
  {
    id: 'hacker-news',
    name: 'Hacker News',
    type: 'rss',
    url: 'https://hnrss.org/frontpage',
    description: 'Community-curated tech and startup news',
    tags: ['technology', 'programming'],
    coverImage: null,
  },
  {
    id: 'the-verge',
    name: 'The Verge',
    type: 'rss',
    url: 'https://www.theverge.com/rss/index.xml',
    description: 'Technology, science, art, and culture',
    tags: ['technology', 'culture'],
    coverImage: null,
  },
  {
    id: 'wired',
    name: 'Wired',
    type: 'rss',
    url: 'https://www.wired.com/feed/rss',
    description: 'How technology changes the world',
    tags: ['technology', 'culture', 'science'],
    coverImage: null,
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    type: 'rss',
    url: 'https://techcrunch.com/feed/',
    description: 'Startup and technology news',
    tags: ['technology', 'startups'],
    coverImage: null,
  },

  // Science
  {
    id: 'nature-news',
    name: 'Nature News',
    type: 'rss',
    url: 'https://www.nature.com/nature.rss',
    description: 'Leading scientific research and discoveries',
    tags: ['science'],
    coverImage: null,
  },
  {
    id: 'new-scientist',
    name: 'New Scientist',
    type: 'rss',
    url: 'https://www.newscientist.com/feed/home/',
    description: 'Science and technology news for the curious',
    tags: ['science', 'technology'],
    coverImage: null,
  },
  {
    id: 'quanta-magazine',
    name: 'Quanta Magazine',
    type: 'rss',
    url: 'https://api.quantamagazine.org/feed/',
    description: 'Illuminating mathematics, physics, and the life sciences',
    tags: ['science', 'mathematics'],
    coverImage: null,
  },

  // World news
  {
    id: 'bbc-news',
    name: 'BBC News',
    type: 'rss',
    url: 'https://feeds.bbci.co.uk/news/rss.xml',
    description: 'Breaking news and analysis from the BBC',
    tags: ['news', 'world'],
    coverImage: null,
  },
  {
    id: 'reuters',
    name: 'Reuters',
    type: 'rss',
    url: 'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en',
    description: 'International news wire service',
    tags: ['news', 'world'],
    coverImage: null,
  },
  {
    id: 'the-guardian',
    name: 'The Guardian',
    type: 'rss',
    url: 'https://www.theguardian.com/world/rss',
    description: 'World news, opinion, and investigative journalism',
    tags: ['news', 'world'],
    coverImage: null,
  },
  {
    id: 'ap-news',
    name: 'Associated Press',
    type: 'rss',
    url: 'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en',
    description: 'Independent global news from the AP',
    tags: ['news', 'world'],
    coverImage: null,
  },

  // Programming & development
  {
    id: 'lobsters',
    name: 'Lobsters',
    type: 'rss',
    url: 'https://lobste.rs/rss',
    description: 'Computing-focused community link aggregator',
    tags: ['programming', 'technology'],
    coverImage: null,
  },
  {
    id: 'css-tricks',
    name: 'CSS-Tricks',
    type: 'rss',
    url: 'https://css-tricks.com/feed/',
    description: 'Tips, tricks, and techniques on using CSS',
    tags: ['programming', 'web'],
    coverImage: null,
  },

  // Design
  {
    id: 'sidebar',
    name: 'Sidebar',
    type: 'rss',
    url: 'https://sidebar.io/feed.xml',
    description: 'Five curated design links, every day',
    tags: ['design'],
    coverImage: null,
  },

  // Business & economics
  {
    id: 'ft',
    name: 'Financial Times',
    type: 'rss',
    url: 'https://www.ft.com/rss/home',
    description: 'International business and finance news',
    tags: ['business', 'economics'],
    coverImage: null,
  },
  {
    id: 'economist',
    name: 'The Economist',
    type: 'rss',
    url: 'https://www.economist.com/finance-and-economics/rss.xml',
    description: 'Analysis of international news, business, and politics',
    tags: ['business', 'world', 'economics'],
    coverImage: null,
  },

  // Indie blogs — technology & programming
  {
    id: 'julia-evans',
    name: 'Julia Evans',
    type: 'rss',
    url: 'https://jvns.ca/atom.xml',
    description: 'Approachable explanations of systems programming, networking, and debugging',
    tags: ['programming', 'indie'],
    coverImage: null,
  },
  {
    id: 'simon-willison',
    name: 'Simon Willison',
    type: 'rss',
    url: 'https://simonwillison.net/atom/everything/',
    description: 'AI, Python, open data, and web development from a Django co-creator',
    tags: ['programming', 'ai', 'indie'],
    coverImage: null,
  },
  {
    id: 'daring-fireball',
    name: 'Daring Fireball',
    type: 'rss',
    url: 'https://daringfireball.net/feeds/main',
    description: 'John Gruber on Apple, technology, and the intersection of culture and tech',
    tags: ['technology', 'apple', 'indie'],
    coverImage: null,
  },
  {
    id: 'stratechery',
    name: 'Stratechery',
    type: 'rss',
    url: 'https://stratechery.com/feed/',
    description: 'Ben Thompson on technology strategy and the business of tech',
    tags: ['technology', 'business', 'indie'],
    coverImage: null,
  },
  {
    id: 'dan-luu',
    name: 'Dan Luu',
    type: 'rss',
    url: 'https://danluu.com/atom.xml',
    description: 'Deep dives into hardware, software performance, and engineering culture',
    tags: ['programming', 'technology', 'indie'],
    coverImage: null,
  },
  {
    id: 'fasterthanli',
    name: 'fasterthanli.me',
    type: 'rss',
    url: 'https://fasterthanli.me/index.xml',
    description: 'Amos on Rust, systems programming, and deep technical explorations',
    tags: ['programming', 'systems', 'indie'],
    coverImage: null,
  },
  {
    id: 'dense-discovery',
    name: 'Dense Discovery',
    type: 'rss',
    url: 'https://www.densediscovery.com/feed/',
    description: 'A weekly newsletter on culture, design, sustainability, and the creative life',
    tags: ['design', 'culture', 'indie'],
    coverImage: null,
  },
  {
    id: 'chriscoyier',
    name: 'Chris Coyier',
    type: 'rss',
    url: 'https://chriscoyier.net/feed/',
    description: 'Thoughts on web design, development, and the indie web',
    tags: ['web', 'design', 'indie'],
    coverImage: null,
  },
  {
    id: 'macwright',
    name: 'Tom MacWright',
    type: 'rss',
    url: 'https://macwright.com/rss.xml',
    description: 'Thoughtful writing on software, maps, and the open web',
    tags: ['programming', 'web', 'indie'],
    coverImage: null,
  },
  {
    id: 'brainpickings',
    name: 'The Marginalian',
    type: 'rss',
    url: 'https://www.themarginalian.org/feed/',
    description: 'Maria Popova on literature, science, philosophy, and the life of the mind',
    tags: ['culture', 'science', 'indie'],
    coverImage: null,
  },
  {
    id: 'kottke',
    name: 'Kottke.org',
    type: 'rss',
    url: 'https://feeds.kottke.org/main',
    description: 'One of the oldest blogs on the web — culture, science, design, and curiosity',
    tags: ['culture', 'technology', 'indie'],
    coverImage: null,
  },
  {
    id: 'wait-but-why',
    name: 'Wait But Why',
    type: 'rss',
    url: 'https://waitbutwhy.com/feed',
    description: 'Tim Urban on big ideas, explained with stick figures and deep research',
    tags: ['science', 'culture', 'indie'],
    coverImage: null,
  },
  {
    id: 'seth-godin',
    name: 'Seth Godin',
    type: 'rss',
    url: 'https://seths.blog/feed/',
    description: 'Daily posts on marketing, leadership, and making things that matter',
    tags: ['business', 'culture', 'indie'],
    coverImage: null,
  },
  {
    id: 'swyx',
    name: 'swyx',
    type: 'rss',
    url: 'https://www.swyx.io/rss.xml',
    description: 'Shawn Wang on AI engineering, developer tools, and learning in public',
    tags: ['programming', 'ai', 'indie'],
    coverImage: null,
  },
  {
    id: 'neil-gaiman',
    name: 'Neil Gaiman\'s Journal',
    type: 'rss',
    url: 'https://journal.neilgaiman.com/feeds/posts/default?alt=rss',
    description: 'Stories, musings, and behind-the-scenes from the author',
    tags: ['culture', 'writing', 'indie'],
    coverImage: null,
  },
];

// --- Focus catalog ---

const discoveryFocuses: DiscoveryFocus[] = [
  {
    id: 'technology',
    name: 'Technology',
    description: 'Software, hardware, startups, and the tech industry',
    icon: 'cpu',
    coverImage: null,
    minConfidence: 0.3,
    sources: [
      { sourceId: 'ars-technica', weight: 1 },
      { sourceId: 'hacker-news', weight: 1 },
      { sourceId: 'the-verge', weight: 0.8 },
      { sourceId: 'wired', weight: 0.8 },
      { sourceId: 'techcrunch', weight: 0.7 },
    ],
  },
  {
    id: 'science',
    name: 'Science',
    description: 'Research, discoveries, and the natural world',
    icon: 'flask-conical',
    coverImage: null,
    minConfidence: 0.3,
    sources: [
      { sourceId: 'nature-news', weight: 1 },
      { sourceId: 'new-scientist', weight: 1 },
      { sourceId: 'quanta-magazine', weight: 1 },
      { sourceId: 'ars-technica', weight: 0.5 },
    ],
  },
  {
    id: 'world-news',
    name: 'World News',
    description: 'International current affairs and global events',
    icon: 'globe',
    coverImage: null,
    minConfidence: 0.2,
    sources: [
      { sourceId: 'bbc-news', weight: 1 },
      { sourceId: 'reuters', weight: 1 },
      { sourceId: 'the-guardian', weight: 0.8 },
      { sourceId: 'ap-news', weight: 0.8 },
    ],
  },
  {
    id: 'programming',
    name: 'Programming',
    description: 'Software development, languages, tools, and practices',
    icon: 'code',
    coverImage: null,
    minConfidence: 0.3,
    sources: [
      { sourceId: 'hacker-news', weight: 1 },
      { sourceId: 'lobsters', weight: 1 },
      { sourceId: 'css-tricks', weight: 0.7 },
      { sourceId: 'julia-evans', weight: 1 },
      { sourceId: 'dan-luu', weight: 1 },
      { sourceId: 'fasterthanli', weight: 0.8 },
      { sourceId: 'macwright', weight: 0.8 },
    ],
  },
  {
    id: 'indie-tech',
    name: 'Indie Tech Voices',
    description: 'Independent writers on technology, software, and the web — the blogs that make RSS worth having',
    icon: 'pen-tool',
    coverImage: null,
    minConfidence: 0.2,
    sources: [
      { sourceId: 'julia-evans', weight: 1 },
      { sourceId: 'simon-willison', weight: 1 },
      { sourceId: 'daring-fireball', weight: 1 },
      { sourceId: 'stratechery', weight: 1 },
      { sourceId: 'dan-luu', weight: 1 },
      { sourceId: 'fasterthanli', weight: 1 },
      { sourceId: 'macwright', weight: 0.8 },
      { sourceId: 'chriscoyier', weight: 0.8 },
      { sourceId: 'swyx', weight: 0.8 },
      { sourceId: 'kottke', weight: 0.7 },
    ],
  },
  {
    id: 'culture',
    name: 'Culture & Ideas',
    description: 'Literature, philosophy, creativity, and the bigger questions',
    icon: 'book-open',
    coverImage: null,
    minConfidence: 0.2,
    sources: [
      { sourceId: 'brainpickings', weight: 1 },
      { sourceId: 'kottke', weight: 1 },
      { sourceId: 'wait-but-why', weight: 1 },
      { sourceId: 'neil-gaiman', weight: 0.8 },
      { sourceId: 'seth-godin', weight: 0.7 },
      { sourceId: 'dense-discovery', weight: 0.7 },
    ],
  },
  {
    id: 'business',
    name: 'Business & Economics',
    description: 'Markets, finance, and the global economy',
    icon: 'trending-up',
    coverImage: null,
    minConfidence: 0.3,
    sources: [
      { sourceId: 'ft', weight: 1 },
      { sourceId: 'economist', weight: 1 },
      { sourceId: 'reuters', weight: 0.5 },
    ],
  },
];

// --- Edition config catalog ---

const discoveryEditionConfigs: DiscoveryEditionConfig[] = [
  {
    id: 'morning-briefing',
    name: 'Morning Briefing',
    description: 'A daily digest of top stories across technology, science, and world news. A calm start to your day.',
    icon: 'sun',
    coverImage: null,
    schedule: '0 7 * * *',
    lookbackHours: 24,
    focuses: [
      { focusId: 'world-news', position: 0, budgetType: 'count', budgetValue: 5, weight: 1 },
      { focusId: 'technology', position: 1, budgetType: 'count', budgetValue: 4, weight: 1 },
      { focusId: 'science', position: 2, budgetType: 'count', budgetValue: 3, weight: 1 },
    ],
  },
  {
    id: 'tech-weekly',
    name: 'Tech Weekly',
    description: 'A weekly roundup of the most important technology and programming stories. Best enjoyed with a weekend coffee.',
    icon: 'calendar',
    coverImage: null,
    schedule: '0 9 * * 6',
    lookbackHours: 168,
    focuses: [
      { focusId: 'technology', position: 0, budgetType: 'count', budgetValue: 8, weight: 1 },
      { focusId: 'programming', position: 1, budgetType: 'count', budgetValue: 6, weight: 1 },
    ],
  },
  {
    id: 'world-observer',
    name: 'World Observer',
    description: 'A daily window into global affairs and business, with just enough depth to stay informed without feeling overwhelmed.',
    icon: 'globe',
    coverImage: null,
    schedule: '0 8 * * *',
    lookbackHours: 24,
    focuses: [
      { focusId: 'world-news', position: 0, budgetType: 'count', budgetValue: 6, weight: 1 },
      { focusId: 'business', position: 1, budgetType: 'count', budgetValue: 4, weight: 1 },
    ],
  },
  {
    id: 'indie-digest',
    name: 'Indie Digest',
    description: 'The best of independent blogs and personal sites. The voices that make the open web worth reading.',
    icon: 'pen-tool',
    coverImage: null,
    schedule: '0 10 * * 3',
    lookbackHours: 168,
    focuses: [
      { focusId: 'indie-tech', position: 0, budgetType: 'count', budgetValue: 6, weight: 1 },
      { focusId: 'culture', position: 1, budgetType: 'count', budgetValue: 4, weight: 1 },
    ],
  },
];

// --- Lookup helpers ---

const sourceById = new Map(discoverySources.map((s) => [s.id, s]));
const focusById = new Map(discoveryFocuses.map((f) => [f.id, f]));
const editionConfigById = new Map(discoveryEditionConfigs.map((e) => [e.id, e]));
const allTags = [...new Set(discoverySources.flatMap((s) => s.tags))].sort();

export type {
  DiscoverySource,
  DiscoveryFocus,
  DiscoveryFocusSource,
  DiscoveryEditionConfig,
  DiscoveryEditionFocus,
};
export {
  discoverySources,
  discoveryFocuses,
  discoveryEditionConfigs,
  sourceById,
  focusById,
  editionConfigById,
  allTags,
};
