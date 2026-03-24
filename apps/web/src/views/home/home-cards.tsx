import { Link } from '@tanstack/react-router';

/* ── Types ────────────────────────────────────────────────────────── */

type HomeEditionSection = { focusName: string; articleCount: number };
type HomeEditionLead = {
  title: string;
  sourceName: string;
  imageUrl: string | null;
  consumptionTimeSeconds: number | null;
};
type HomeEditionHighlight = { title: string; sourceName: string };

type HomeEdition = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  publishedAt: string;
  configName: string;
  configIcon: string | null;
  sections: HomeEditionSection[];
  lead: HomeEditionLead | null;
  highlights: HomeEditionHighlight[];
};

/* ── Helpers ──────────────────────────────────────────────────────── */

const formatPubDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/* ── Cover card ──────────────────────────────────────────────────── */

const CoverCard = ({ edition }: { edition: HomeEdition }): React.ReactElement => {
  const hasImage = !!edition.lead?.imageUrl;

  return (
    <div className="group relative isolate">
      <Link
        to="/editions/$configId/issues/$editionId"
        params={{ configId: edition.editionConfigId, editionId: edition.id }}
        className="block rounded-lg overflow-hidden relative isolate"
      >
        <CoverBackground imageUrl={edition.lead?.imageUrl ?? null} />
        <div className={`flex flex-col justify-between p-5 min-h-56 ${hasImage ? 'text-white' : ''}`}>
          <CoverTopBar configName={edition.configName} publishedAt={edition.publishedAt} hasImage={hasImage} />
          <CoverContent edition={edition} hasImage={hasImage} />
        </div>
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <Link
          to="/editions/$configId/issues"
          params={{ configId: edition.editionConfigId }}
          className="font-mono text-xs tracking-wide text-ink-faint hover:text-ink transition-colors duration-fast"
        >
          All issues →
        </Link>
      </div>
    </div>
  );
};

const CoverBackground = ({ imageUrl }: { imageUrl: string | null }): React.ReactElement => {
  if (imageUrl) {
    return (
      <div className="absolute inset-0 -z-10">
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover transition-transform duration-slow ease-gentle group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/40 to-black/80" />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 -z-10 bg-surface-sunken group-hover:bg-surface-raised transition-colors duration-fast" />
  );
};

const CoverTopBar = ({
  configName,
  publishedAt,
  hasImage,
}: {
  configName: string;
  publishedAt: string;
  hasImage: boolean;
}): React.ReactElement => (
  <div className="flex items-baseline justify-between gap-3">
    <span className={`font-mono text-xs tracking-wide uppercase ${hasImage ? 'text-white/80' : 'text-accent'}`}>
      {configName}
    </span>
    <span className={`font-mono text-xs tracking-wide ${hasImage ? 'text-white/50' : 'text-ink-faint'}`}>
      {formatPubDate(publishedAt)}
    </span>
  </div>
);

const CoverContent = ({ edition, hasImage }: { edition: HomeEdition; hasImage: boolean }): React.ReactElement => (
  <div className="mt-auto pt-4">
    {edition.lead && (
      <>
        <div className={`font-mono text-xs tracking-wide mb-2 ${hasImage ? 'text-white/60' : 'text-ink-faint'}`}>
          {edition.lead.sourceName}
        </div>
        <h3
          className={`font-serif text-xl md:text-2xl font-medium tracking-tight leading-snug mb-3 ${hasImage ? 'text-white' : 'text-ink'}`}
        >
          {edition.lead.title}
        </h3>
      </>
    )}
    {edition.sections.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mb-3">
        {edition.sections.map((s) => (
          <span
            key={s.focusName}
            className={`text-xs px-2 py-0.5 rounded-full ${hasImage ? 'bg-white/15 text-white/80' : 'bg-surface-sunken text-ink-tertiary'}`}
          >
            {s.focusName}
          </span>
        ))}
      </div>
    )}
    <div
      className={`font-mono text-xs tracking-wide flex items-center gap-3 ${hasImage ? 'text-white/50' : 'text-ink-faint'}`}
    >
      <span>{edition.articleCount} articles</span>
      {edition.totalReadingMinutes != null && (
        <>
          <span className={hasImage ? 'text-white/30' : 'text-ink-faint'}>·</span>
          <span>{edition.totalReadingMinutes} min</span>
        </>
      )}
      <span className={hasImage ? 'text-white/30' : 'text-ink-faint'}>·</span>
      <span>{edition.sections.length} sections</span>
    </div>
  </div>
);

/* ── Caught-up card (config with no unread edition) ───────────────── */

type HomeConfig = { id: string; name: string; icon: string | null };

type HomeSlot = {
  config: HomeConfig;
  edition: HomeEdition | null;
};

const CaughtUpCard = ({ config }: { config: HomeConfig }): React.ReactElement => (
  <div>
    <div className="rounded-lg bg-surface-sunken p-5 min-h-32 flex flex-col justify-between">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-xs tracking-wide uppercase text-accent">{config.name}</span>
      </div>
      <div className="mt-auto pt-4">
        <p className="font-serif text-lg text-ink-tertiary tracking-tight">All caught up</p>
      </div>
    </div>
    <div className="mt-2 flex items-center justify-between">
      <Link
        to="/editions/$configId/issues"
        params={{ configId: config.id }}
        className="font-mono text-xs tracking-wide text-ink-faint hover:text-ink transition-colors duration-fast"
      >
        All issues →
      </Link>
    </div>
  </div>
);

const SlotCard = ({ slot }: { slot: HomeSlot }): React.ReactElement =>
  slot.edition ? <CoverCard edition={slot.edition} /> : <CaughtUpCard config={slot.config} />;

export type { HomeEdition, HomeSlot, HomeConfig };
export { CoverCard, CaughtUpCard, SlotCard, formatPubDate };
