import { useEffect, useState } from 'react';

type ScoringWeightSet = {
  alpha: number;
  beta: number;
  gamma: number;
};

type UserScoringWeights = {
  global: ScoringWeightSet;
  focus: ScoringWeightSet;
  edition: ScoringWeightSet;
};

type ScoringResponse = {
  weights: UserScoringWeights;
  defaults: UserScoringWeights;
  isCustom: boolean;
};

type FeedType = 'global' | 'focus' | 'edition';

type FeedConfig = {
  label: string;
  description: string;
  explanation: string;
};

type WeightConfig = {
  label: string;
  short: string;
  detail: string;
};

type UseScoringResult = {
  data: ScoringResponse | null;
  weights: UserScoringWeights | null;
  loading: boolean;
  dirty: boolean;
  saving: boolean;
  handleFeedChange: (feedType: FeedType, w: ScoringWeightSet) => void;
  save: () => Promise<void>;
  resetAll: () => Promise<void>;
};

const FEED_CONFIG: Record<FeedType, FeedConfig> = {
  global: {
    label: 'Global Feed',
    description: 'All articles across sources, without focus filtering.',
    explanation:
      "The global feed has no focus context, so confidence is unused by default. Ranking relies on your vote history and recency. Raise recency to keep the feed fresh; raise votes to surface articles similar to ones you've liked.",
  },
  focus: {
    label: 'Focus Feeds',
    description: 'Articles within a specific focus topic.',
    explanation:
      'Focus feeds use all three signals. Confidence measures how well an article matches the topic \u2014 raising it surfaces on-topic articles more strongly. Vote signal is scoped: votes cast within a focus teach it your preferences for that topic specifically, layered on top of your global votes.',
  },
  edition: {
    label: 'Editions',
    description: 'Curated, finite editions assembled from your focuses.',
    explanation:
      "Editions already filter by a time window (lookback hours), so recency matters less here \u2014 confidence and votes drive selection. Editions also apply source budgeting and per-focus weights on top of this score, so these weights shape the ordering within each source's allocation.",
  },
};

const WEIGHT_CONFIG: Record<keyof ScoringWeightSet, WeightConfig> = {
  alpha: {
    label: 'Confidence (\u03B1)',
    short: 'Topic relevance',
    detail:
      'How well the article matches the focus, from the classifier (0.0\u20131.0). Set to 0 to ignore topic fit entirely; raise it to strongly prefer on-topic articles.',
  },
  beta: {
    label: 'Votes (\u03B2)',
    short: 'Personalisation',
    detail:
      'Your upvotes and downvotes, propagated to similar articles via semantic embeddings. Only the 15 most similar voted articles contribute \u2014 a few votes go a long way. Raise this to make ranking more personal; lower it for a more neutral feed.',
  },
  gamma: {
    label: 'Recency (\u03B3)',
    short: 'Freshness',
    detail:
      'Exponential decay with a 3-day half-life \u2014 an article published today scores 1.0, after 3 days it scores 0.5, after 6 days 0.25. Raise this to prioritise breaking news; lower it to surface older gems.',
  },
};

const useScoring = (token: string): UseScoringResult => {
  const [data, setData] = useState<ScoringResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [weights, setWeights] = useState<UserScoringWeights | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      const res = await fetch('/api/settings/scoring', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as ScoringResponse;
        setData(json);
        setWeights(json.weights);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleFeedChange = (feedType: FeedType, w: ScoringWeightSet): void => {
    if (!weights) {
      return;
    }
    const updated = { ...weights, [feedType]: w };
    setWeights(updated);
    setDirty(true);
  };

  const save = async (): Promise<void> => {
    if (!weights) {
      return;
    }
    setSaving(true);
    const res = await fetch('/api/settings/scoring', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(weights),
    });
    if (res.ok) {
      const json = (await res.json()) as ScoringResponse;
      setData(json);
      setWeights(json.weights);
      setDirty(false);
    }
    setSaving(false);
  };

  const resetAll = async (): Promise<void> => {
    setSaving(true);
    const res = await fetch('/api/settings/scoring', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = (await res.json()) as ScoringResponse;
      setData(json);
      setWeights(json.weights);
      setDirty(false);
    }
    setSaving(false);
  };

  return {
    data,
    weights,
    loading,
    dirty,
    saving,
    handleFeedChange,
    save,
    resetAll,
  };
};

export type {
  ScoringWeightSet,
  UserScoringWeights,
  ScoringResponse,
  FeedType,
  FeedConfig,
  WeightConfig,
  UseScoringResult,
};
export { FEED_CONFIG, WEIGHT_CONFIG, useScoring };
