import { useScoring, FEED_CONFIG, WEIGHT_CONFIG } from '../../hooks/scoring/scoring.hooks.ts';
import type { ScoringWeightSet, FeedType, WeightConfig } from '../../hooks/scoring/scoring.hooks.ts';
import { Button } from '../../components/button.tsx';
import { Separator } from '../../components/separator.tsx';

/* ---- Weight slider ---- */

const WeightSlider = ({
  id,
  config,
  value,
  onChange,
}: {
  id: string;
  config: WeightConfig;
  value: number;
  onChange: (v: number) => void;
}): React.ReactNode => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink">{config.label}</span>
        <span className="text-xs text-ink-faint">{config.short}</span>
      </div>
      <span className="text-xs text-ink-tertiary tabular-nums w-8 text-right">{value.toFixed(1)}</span>
    </div>
    <input
      type="range"
      min={0}
      max={1}
      step={0.1}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-accent h-1.5 cursor-pointer"
      data-ai-id={id}
      data-ai-role="input"
      data-ai-label={`${config.label} weight`}
      data-ai-value={value.toFixed(1)}
    />
    <p className="text-xs text-ink-faint leading-relaxed">{config.detail}</p>
  </div>
);

/* ---- Feed weights card ---- */

const FeedWeightsCard = ({
  feedType,
  weights,
  defaults,
  onChange,
}: {
  feedType: FeedType;
  weights: ScoringWeightSet;
  defaults: ScoringWeightSet;
  onChange: (w: ScoringWeightSet) => void;
}): React.ReactNode => {
  const feed = FEED_CONFIG[feedType];
  const isDefault =
    weights.alpha === defaults.alpha && weights.beta === defaults.beta && weights.gamma === defaults.gamma;

  return (
    <div
      className="rounded-lg border border-border p-4 flex flex-col gap-5"
      data-ai-id={`scoring-${feedType}`}
      data-ai-role="section"
      data-ai-label={feed.label}
    >
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-ink">{feed.label}</h3>
            <p className="text-xs text-ink-tertiary mt-0.5">{feed.description}</p>
          </div>
          {!isDefault && (
            <button
              type="button"
              onClick={() => onChange({ ...defaults })}
              className="text-xs text-ink-faint hover:text-accent transition-colors duration-fast cursor-pointer shrink-0"
              data-ai-id={`scoring-${feedType}-reset`}
              data-ai-role="button"
              data-ai-label={`Reset ${feed.label} to defaults`}
            >
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed mt-2">{feed.explanation}</p>
      </div>
      <Separator soft />
      {(['alpha', 'beta', 'gamma'] as const)
        .filter((key) => !(feedType === 'global' && key === 'alpha'))
        .map((key) => (
          <WeightSlider
            key={key}
            id={`scoring-${feedType}-${key}`}
            config={WEIGHT_CONFIG[key]}
            value={weights[key]}
            onChange={(v) => onChange({ ...weights, [key]: v })}
          />
        ))}
    </div>
  );
};

/* ---- Algorithm overview ---- */

const AlgorithmOverview = (): React.ReactNode => (
  <div className="flex flex-col gap-4">
    <div className="text-sm text-ink-secondary leading-relaxed flex flex-col gap-2">
      <p>
        Every article in your feeds is scored using three signals, combined into a single number that determines its
        position:
      </p>
      <div className="bg-surface-sunken rounded-md px-4 py-3 font-mono text-xs text-ink text-center">
        score = α &times; confidence + β &times; votes + γ &times; recency
      </div>
    </div>

    <div className="grid gap-3 text-xs text-ink-secondary leading-relaxed">
      <div className="flex gap-3">
        <span className="shrink-0 font-mono text-ink w-16 text-right">confidence</span>
        <span>
          How well the article matches a focus topic, determined by the on-device classifier (0.0 = unrelated, 1.0 =
          strong match). Only meaningful within focus feeds and editions.
        </span>
      </div>
      <div className="flex gap-3">
        <span className="shrink-0 font-mono text-ink w-16 text-right">votes</span>
        <span>
          A personalisation signal derived from your upvotes and downvotes. When you vote on an article, that signal
          propagates to semantically similar articles via embeddings — so a few votes shape the ranking of hundreds of
          articles. Only the 15 most similar voted articles contribute, weighted by how similar they are.
        </span>
      </div>
      <div className="flex gap-3">
        <span className="shrink-0 font-mono text-ink w-16 text-right">recency</span>
        <span>
          Freshness, as an exponential decay. An article published right now scores 1.0; after 3 days it scores 0.5;
          after a week, 0.125. Articles without a publish date get a neutral 0.5.
        </span>
      </div>
    </div>

    <p className="text-sm text-ink-secondary leading-relaxed">
      The Greek letters (α, β, γ) are the weights you control below. They determine how much each signal matters. Each
      feed type has its own set of weights because the context is different — for example, the global feed has no focus
      topic, so confidence is irrelevant there.
    </p>
    <p className="text-sm text-ink-secondary leading-relaxed">
      The weights don't need to sum to 1. Higher values amplify a signal relative to the others; setting a weight to 0
      disables that signal entirely.
    </p>
  </div>
);

/* ---- Main scoring section ---- */

const ScoringSection = ({ token }: { token: string }): React.ReactNode => {
  const { data, weights, loading, dirty, saving, handleFeedChange, save, resetAll } = useScoring(token);

  if (loading || !data || !weights) {
    return <div className="text-sm text-ink-tertiary py-6 text-center">Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <AlgorithmOverview />

      <Separator />

      <div className="grid gap-4">
        {(['global', 'focus', 'edition'] as const).map((feedType) => (
          <FeedWeightsCard
            key={feedType}
            feedType={feedType}
            weights={weights[feedType]}
            defaults={data.defaults[feedType]}
            onChange={(w) => handleFeedChange(feedType, w)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty || saving}
          onClick={() => void save()}
          data-ai-id="settings-scoring-save"
          data-ai-role="button"
          data-ai-label="Save scoring weights"
          data-ai-state={saving ? 'loading' : 'idle'}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {data.isCustom && (
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => void resetAll()}
            data-ai-id="settings-scoring-reset"
            data-ai-role="button"
            data-ai-label="Reset all to defaults"
          >
            Reset all to defaults
          </Button>
        )}
      </div>
    </div>
  );
};

export { ScoringSection };
