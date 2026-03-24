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
    <Link
      to="/editions/$configId/issues/$editionId"
      params={{ configId: edition.editionConfigId, editionId: edition.id }}
      className="group block rounded-lg overflow-hidden relative isolate"
    >
      <CoverBackground imageUrl={edition.lead?.imageUrl ?? null} />
      <div className={`flex flex-col justify-between p-5 min-h-56 ${hasImage ? 'text-white' : ''}`}>
        <CoverTopBar configName={edition.configName} publishedAt={edition.publishedAt} hasImage={hasImage} />
        <CoverContent edition={edition} hasImage={hasImage} />
      </div>
    </Link>
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

/* ── Edition teaser ──────────────────────────────────────────────── */

const EditionTeaser = ({ edition }: { edition: HomeEdition }): React.ReactElement => (
  <Link
    to="/editions/$configId/issues/$editionId"
    params={{ configId: edition.editionConfigId, editionId: edition.id }}
    className="group block py-4 border-t border-border hover:border-accent transition-colors duration-fast"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs tracking-wide text-accent uppercase mb-1.5">
          {edition.configName} · {formatPubDate(edition.publishedAt)}
        </div>
        <div className="font-serif text-lg font-medium tracking-tight text-ink group-hover:text-accent transition-colors duration-fast leading-snug">
          {edition.title}
        </div>
        <div className="font-mono text-xs text-ink-faint mt-1.5 tracking-wide">
          {edition.articleCount} articles
          {edition.totalReadingMinutes != null && ` · ${edition.totalReadingMinutes} min`}
        </div>
      </div>
      {edition.lead?.imageUrl && (
        <div className="shrink-0 w-16 h-16 rounded-md overflow-hidden bg-surface-sunken">
          <img src={edition.lead.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  </Link>
);

export type { HomeEdition };
export { CoverCard, EditionTeaser };
