import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  MagazineLayout,
  MagazineCover,
  MagazineToc,
  MagazineSection,
  MagazineArticle,
  MagazineFinale,
} from "../../components/magazine/magazine.tsx";

/* ── Sample article content (extracted HTML) ──────────────────────── */

const readerDesignContent = `
<p>For the better part of a decade, the dominant paradigm in digital reading has been the infinite scroll. Twitter pioneered it, Facebook perfected it, and RSS readers adopted it wholesale. The assumption was simple: more content, delivered faster, in an unbroken stream. But a growing number of designers and developers are questioning whether that assumption ever served readers at all.</p>

<p>The problem isn't technical — it's attentional. When everything arrives in a single undifferentiated stream, nothing feels important. A three-thousand-word investigation sits alongside a two-sentence hot take. A post from a friend you haven't heard from in months drowns under a flood of content from accounts you barely remember following. The firehose doesn't discriminate, and neither can the reader.</p>

<h3>The finite alternative</h3>

<p>"The most radical thing you can do in 2026 is give someone an ending," says Mira Chen, lead designer at Streamline, a reading app that launched last month to quiet enthusiasm. "Every other app in the attention economy is designed to keep you scrolling. We designed ours so you reach the bottom and feel <em>done</em>."</p>

<p>Streamline isn't alone. A wave of new reading apps — Editions, Reeder, Newsprint, Matter — share a common philosophy: reading should be bounded, curated, and calm. They draw inspiration not from social media feeds but from print magazines and morning newspapers, media that arrived finite by nature.</p>

<blockquote>
<p>We're not building a feed. We're building something closer to a daily newspaper — assembled with intention, bounded by design, and meant to be finished.</p>
</blockquote>

<h3>Source budgeting</h3>

<p>One technique gaining traction is "source budgeting" — algorithmically limiting how many articles from any single source can appear in a reading session. The idea is proportional representation: a prolific news wire shouldn't crowd out a small blog that publishes once a week. The reader subscribed to both for a reason.</p>

<p>This approach requires a fundamental rethink of how feeds are assembled. Instead of sorting by recency and calling it done, these apps build curated editions: selecting a bounded set of articles that balance topics, sources, reading time, and importance. The result feels less like drinking from a firehose and more like reading a well-edited magazine.</p>

<h3>Reading time as a first-class concept</h3>

<p>Perhaps the most user-visible change is the emphasis on reading time. Rather than showing article counts — "47 unread" — these apps frame everything in minutes. "Your morning edition: 12 minutes." The shift is psychological as much as practical: it transforms reading from an obligation (clear the backlog) into a choice (I have fifteen minutes, here's what's worth reading).</p>

<p>For this to work, apps need to know how long articles actually take to read — which means extracting the full text, not just the RSS summary. Article extraction has gotten remarkably good, and the investment pays dividends beyond time estimation: it enables better topic classification, offline reading, and a consistent visual experience.</p>

<h3>What comes next</h3>

<p>The quiet revolution in reader design isn't about features. It's about philosophy. These apps are betting that readers don't want more — they want enough. That the scroll isn't sacred. That "you're all caught up" is the most satisfying thing a reading app can say.</p>

<p>Whether the broader market agrees remains to be seen. But for a growing community of intentional readers, the firehose era is already over.</p>
`;

const patternMatchingContent = `
<p>The TypeScript team has officially merged the pattern matching RFC into the main branch, marking one of the most anticipated language additions since the introduction of template literal types. Pattern matching, long available in languages like Rust, Scala, and Haskell, brings exhaustive destructuring and conditional logic to TypeScript's type system in a way that feels both powerful and natural.</p>

<p>The new <code>match</code> expression allows developers to branch on the shape of data with compile-time exhaustiveness checking — meaning the compiler will error if you forget to handle a case. This is particularly valuable when working with discriminated unions, a pattern already common in TypeScript codebases.</p>

<h3>The syntax</h3>

<p>The RFC introduces a new <code>match</code> keyword that works as an expression (it returns a value). The basic form mirrors what you'd find in Rust:</p>

<p>Each arm of the match is checked at compile time. If you add a new variant to the union but forget to add a corresponding match arm, TypeScript will flag it as an error. This turns runtime bugs into compile-time errors — exactly the kind of safety TypeScript users have come to expect.</p>

<h3>Beyond discriminated unions</h3>

<p>Pattern matching isn't limited to unions. The RFC supports matching on object shapes, array patterns, literal values, and even nested structures. You can bind variables within patterns, use guard clauses for additional conditions, and combine patterns with the <code>or</code> operator.</p>

<p>This expressiveness means that many common patterns — deeply nested conditionals, chains of <code>if/else</code> type narrowing, switch statements with manual type assertions — can be replaced with a single, readable <code>match</code> expression.</p>

<h3>Community reception</h3>

<p>The response has been overwhelmingly positive, though not without debate. Some developers worry about the learning curve, particularly for teams less familiar with functional programming concepts. Others argue that pattern matching will become as essential to TypeScript as generics — initially intimidating, eventually indispensable.</p>

<p>The feature is expected to ship in TypeScript 6.0, currently scheduled for a fall release. In the meantime, the TypeScript Playground already supports an experimental flag for those eager to try it out.</p>
`;

const sqliteContent = `
<p>There's a quiet irony in the database world: the most widely deployed database engine on the planet is the one most backend developers have never seriously considered for production server applications. SQLite powers every iPhone, every Android device, every Mac, every Windows 10+ machine, every major web browser. It handles more concurrent users than any other database in existence. And yet, when it comes time to choose a database for a new web application, developers reach for PostgreSQL or MySQL almost reflexively.</p>

<p>That's starting to change. A growing cohort of developers — particularly in the self-hosted and small-scale application space — are discovering that SQLite isn't just "that embedded thing for mobile apps." For the right workload, it's a genuine superpower.</p>

<h3>Why now?</h3>

<p>Several converging trends have made SQLite viable for server applications in ways it wasn't five years ago. WAL mode (Write-Ahead Logging) solved the most painful concurrency limitation: readers no longer block writers. Litestream enables real-time replication to S3-compatible storage, giving you backup and disaster recovery without operational complexity. And frameworks like Litestack, LiteFS, and Turso have built tooling that makes SQLite feel like a first-class server database.</p>

<blockquote>
<p>The best database is the one you don't have to operate. SQLite is a library, not a service — there's no daemon to monitor, no connection pool to tune, no cluster to coordinate.</p>
</blockquote>

<h3>The performance story</h3>

<p>For read-heavy workloads — which describes most web applications — SQLite is remarkably fast. There's no network roundtrip, no serialization overhead, no connection establishment. A query goes from your application code to the database engine via a function call. The data lives in a single file on the same machine. Latency is measured in microseconds, not milliseconds.</p>

<p>Write performance is more nuanced. SQLite serializes writes, which means a single writer at a time. For applications with modest write volumes — and "modest" is higher than most developers assume — this is a non-issue. A well-tuned SQLite instance on modern hardware can handle thousands of writes per second.</p>

<h3>The deployment story</h3>

<p>This is where SQLite truly shines for small-scale self-hosted applications. Your entire database is a single file. Backup is <code>cp</code>. Migration to a new server is <code>scp</code>. There's no database service to install, configure, secure, update, or monitor. The operational complexity drops to nearly zero.</p>

<p>For a personal app, a small team tool, or a self-hosted service with a handful of users, this simplicity is transformative. You're not trading capability for convenience — you're recognizing that the capability you actually need is well within what SQLite provides, and the operational simplicity is a genuine feature.</p>

<h3>When to look elsewhere</h3>

<p>SQLite isn't the answer to everything. If you need multiple application servers writing to the same database, you need a client-server database. If your write volume genuinely requires concurrent writers, you need PostgreSQL. If you're building a multi-tenant SaaS platform, SQLite's single-file-per-database model becomes unwieldy at scale.</p>

<p>But for the surprisingly large category of applications that serve one user, one team, or one small community — the database you didn't know you needed has been on your machine all along.</p>
`;

const jwstContent = `
<p>The James Webb Space Telescope has done it again. In a paper published today in Nature Astronomy, a team led by Dr. Emily Carter at the Space Telescope Science Institute reports the detection of spectroscopically confirmed galaxies at redshift z ≈ 16.4 — placing them roughly 230 million years after the Big Bang. If confirmed by independent analysis, these are the oldest galaxies ever observed, surpassing the previous record by nearly 50 million years.</p>

<p>The discovery was made using JWST's Near-Infrared Spectrograph (NIRSpec), which captured detailed spectra of three candidate galaxies first identified as photometric dropouts in deep imaging from the JADES survey. The spectra reveal emission lines consistent with young stellar populations and very low metallicity — hallmarks of galaxies forming their first generation of stars.</p>

<h3>Challenging the models</h3>

<p>What makes these observations particularly significant isn't just the record-breaking distance. It's that the galaxies appear more massive and more luminous than current models of early universe star formation predict. Standard Lambda-CDM cosmology expects the first galaxies to be small, faint, and slowly assembling — not the surprisingly bright objects JWST keeps finding.</p>

<blockquote>
<p>We're not seeing the tiny, tentative galaxies our models predict. We're seeing something more vigorous, more luminous, and frankly more puzzling. The early universe was busier than we thought.</p>
</blockquote>

<p>This isn't the first time JWST has challenged expectations about the early universe. Since its first deep field observations in 2022, the telescope has consistently revealed galaxies at high redshifts that appear "too big, too bright, too soon" — a phrase that has become something of a refrain in the astronomical community.</p>

<h3>Possible explanations</h3>

<p>Several hypotheses are being explored. Star formation in the early universe may have been more efficient than assumed, with a higher fraction of gas converting to stars. The initial mass function — the distribution of stellar masses — may have been top-heavy, producing more luminous massive stars. Or there may be physical processes not yet captured in simulations that accelerated early galaxy assembly.</p>

<p>Some theorists have proposed more radical explanations, including modifications to dark matter models or even challenges to aspects of standard cosmology. But most researchers counsel patience: the observations are still new, and the systematic uncertainties at these extreme redshifts are significant.</p>

<h3>What's next</h3>

<p>The JWST team plans to follow up with deeper spectroscopic observations during Cycle 4, targeting these and other high-redshift candidates with longer exposure times. The goal is to measure stellar masses, star formation rates, and chemical abundances with enough precision to meaningfully constrain theoretical models.</p>

<p>For now, the message from the edge of the observable universe is clear: the cosmos got started faster than we expected, and our theories have some catching up to do.</p>
`;

const euDataContent = `
<p>When the European Union's Digital Markets Act entered its first phase in 2023, the tech industry largely treated it as a compliance exercise — inconvenient but manageable. Three years later, as DMA Phase II takes effect this month, the mood has shifted. The new requirements go beyond tweaks to app store policies and default browser choices. They mandate genuine platform interoperability, data portability, and algorithmic transparency at a level no major jurisdiction has attempted before.</p>

<p>For everyday users, the changes will be both visible and invisible. Some will appear as new buttons and options in familiar apps. Others will reshape how data flows between services in ways that matter enormously but happen entirely behind the scenes.</p>

<h3>Interoperability in practice</h3>

<p>The headline requirement is messaging interoperability. Under DMA Phase II, designated "gatekeepers" — currently Apple, Google, Meta, Microsoft, Amazon, and ByteDance — must allow third-party messaging services to interoperate with their platforms. In practical terms: a Signal user should be able to send a message to a WhatsApp user, and vice versa, without either party switching apps.</p>

<p>The technical challenges are significant. End-to-end encryption must be maintained across protocols, message formats must be translated, and group messaging adds further complexity. The EU has given platforms 30 months to implement full group messaging interoperability, with basic one-to-one messaging required by October.</p>

<h3>Data sovereignty</h3>

<p>The second major pillar is data portability and sovereignty. Users must be able to export their data from any gatekeeper platform in a machine-readable, interoperable format — not just as a data dump, but in a form that can be meaningfully imported into a competing service. This applies to social graphs, content archives, purchase histories, and algorithmic preferences.</p>

<blockquote>
<p>The goal isn't just to let users leave a platform. It's to ensure that switching costs don't become a form of lock-in. Your data, your relationships, your preferences — they should travel with you.</p>
</blockquote>

<h3>What it means for smaller players</h3>

<p>Perhaps the most consequential long-term effect will be on market dynamics. By lowering switching costs and enabling interoperability, the DMA aims to create space for smaller competitors who currently can't overcome the network effects of incumbent platforms. A new messaging app doesn't need to convince all your friends to switch — it just needs to offer a better experience while maintaining access to your existing conversations.</p>

<p>Whether this plays out as intended remains an open question. Critics argue that forced interoperability could reduce incentives for innovation, create security vulnerabilities, or simply be implemented in bad faith with technically compliant but practically useless interfaces. Supporters counter that the same arguments were made against number portability in telephony — and that today, nobody questions the right to keep your phone number when you switch carriers.</p>

<p>The next twelve months will determine whether DMA Phase II becomes a genuine inflection point for digital markets or another regulatory framework that sounds transformative on paper but changes little in practice.</p>
`;

const tradeContent = `
<p>After three years of negotiations that nearly collapsed twice, the Comprehensive Pacific Economic Partnership (CPEP) was formally ratified today in a ceremony in Auckland. The agreement, signed by twelve nations spanning from Chile to Japan, creates the world's largest free trade zone by GDP — surpassing both the EU single market and USMCA.</p>

<p>The agreement eliminates tariffs on over 95% of goods traded between member nations over a ten-year phase-in period. It also includes provisions for digital trade, intellectual property harmonization, labor standards, and environmental commitments — making it one of the most comprehensive trade agreements in history.</p>

<p>Reaction has been cautiously optimistic. Trade economists project modest but meaningful GDP gains for most member nations, with smaller Pacific island economies expected to benefit disproportionately from improved market access. Critics, particularly labor unions in larger economies, warn that the agreement's enforcement mechanisms for labor and environmental standards lack teeth.</p>

<p>The agreement enters into force in ninety days, with the first tariff reductions beginning in Q2 of next year.</p>
`;

/* ── Sample data ──────────────────────────────────────────────────── */

const now = Date.now();

const sampleEdition = {
  title: "Morning Briefing",
  date: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  totalReadingMinutes: 14,
  articleCount: 7,
  sections: [
    {
      focusName: "Technology",
      articles: [
        {
          title: "The quiet revolution in reader design",
          sourceName: "Ars Technica",
          author: "Samuel Axon",
          summary:
            "How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span. The old paradigm of infinite scroll is giving way to something more intentional.",
          publishedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
          consumptionTimeSeconds: 480,
          imageUrl: "https://picsum.photos/seed/reader-mag/800/600",
          content: readerDesignContent,
        },
        {
          title: "TypeScript 6.0 introduces pattern matching",
          sourceName: "Hacker News",
          summary:
            "The long-awaited pattern matching RFC lands in TypeScript, bringing exhaustive checks and destructuring to a new level.",
          publishedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
          consumptionTimeSeconds: 180,
          content: patternMatchingContent,
        },
        {
          title: "Why SQLite is the database you didn't know you needed",
          sourceName: "Hacker News",
          author: "Richard Hipp",
          summary:
            "A deep dive into why embedded databases are making a comeback in server-side applications, and what the trade-offs really look like at scale.",
          publishedAt: new Date(now - 9 * 60 * 60 * 1000).toISOString(),
          consumptionTimeSeconds: 720,
          imageUrl: "https://picsum.photos/seed/sqlite-mag/800/600",
          content: sqliteContent,
        },
      ],
    },
    {
      focusName: "Science",
      articles: [
        {
          title: "JWST captures light from the universe's first galaxies",
          sourceName: "Nature",
          author: "Dr. Emily Carter",
          summary:
            "New observations push the frontier of known galaxies back another 200 million years, challenging existing models of early star formation and cosmic evolution.",
          publishedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
          consumptionTimeSeconds: 360,
          imageUrl: "https://picsum.photos/seed/jwst-mag/800/600",
          content: jwstContent,
        },
      ],
    },
    {
      focusName: "Global News",
      articles: [
        {
          title: "Europe's new data sovereignty framework explained",
          sourceName: "The Guardian",
          author: "Alex Hern",
          summary:
            "The Digital Markets Act enters its second phase, requiring tech giants to open their platforms to interoperability. What it means for everyday users and the companies that serve them.",
          publishedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
          consumptionTimeSeconds: 240,
          imageUrl: "https://picsum.photos/seed/eu-data-mag/800/600",
          content: euDataContent,
        },
        {
          title: "Pacific trade agreement reaches final ratification",
          sourceName: "Reuters",
          summary:
            "Twelve nations sign the landmark agreement after three years of negotiations, creating the world's largest free trade zone.",
          publishedAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
          consumptionTimeSeconds: 120,
          content: tradeContent,
        },
      ],
    },
  ],
};

/* ── Story helpers ────────────────────────────────────────────────── */

/**
 * Builds the page sequence from edition data:
 * cover → toc → (section divider → articles)* → finale
 */
const buildPages = (
  edition: typeof sampleEdition,
  onNavigate: (page: number) => void,
): React.ReactElement[] => {
  const pages: React.ReactElement[] = [];

  // Track page numbers for TOC
  let pageIdx = 2; // cover=0, toc=1, first content=2
  const tocSections = edition.sections.map((s) => {
    const startPage = pageIdx;
    pageIdx += 1 + s.articles.length; // section divider + articles
    return {
      focusName: s.focusName,
      articles: s.articles,
      startPage,
    };
  });

  // Cover
  pages.push(
    <MagazineCover
      key="cover"
      editionTitle={edition.title}
      date={edition.date}
      totalReadingMinutes={edition.totalReadingMinutes}
      articleCount={edition.articleCount}
      focusCount={edition.sections.length}
      lead={edition.sections[0]!.articles[0]!}
      highlights={[
        edition.sections[1]?.articles[0],
        edition.sections[2]?.articles[0],
      ].filter((a): a is (typeof edition.sections)[number]["articles"][number] => !!a)}
    />,
  );

  // TOC
  pages.push(
    <MagazineToc
      key="toc"
      editionTitle={edition.title}
      sections={tocSections}
      onNavigate={onNavigate}
    />,
  );

  // Section dividers + articles
  edition.sections.forEach((section, sIdx) => {
    const sectionMinutes = Math.round(
      section.articles.reduce((sum, a) => sum + (a.consumptionTimeSeconds ?? 0), 0) / 60,
    );

    pages.push(
      <MagazineSection
        key={`section-${sIdx}`}
        focusName={section.focusName}
        index={sIdx}
        articleCount={section.articles.length}
        totalReadingMinutes={sectionMinutes}
      />,
    );

    section.articles.forEach((article, aIdx) => {
      pages.push(
        <MagazineArticle
          key={`article-${sIdx}-${aIdx}`}
          {...article}
          positionInSection={aIdx}
        />,
      );
    });
  });

  // Finale
  pages.push(
    <MagazineFinale
      key="finale"
      articleCount={edition.articleCount}
      totalReadingMinutes={edition.totalReadingMinutes}
      editionTitle={edition.title}
    />,
  );

  return pages;
};

/* ── Stories ───────────────────────────────────────────────────────── */

const meta: Meta = {
  title: "Design System/Compositions/Magazine View",
  parameters: { layout: "fullscreen" },
};

type Story = StoryObj;

/* Full magazine: all pages with navigation */
const FullMagazine: Story = {
  render: () => {
    const [page, setPage] = useState(0);
    const pages = buildPages(sampleEdition, setPage);
    return (
      <MagazineLayout page={page} onPageChange={setPage}>
        {pages}
      </MagazineLayout>
    );
  },
};

/* Cover page in isolation */
const Cover: Story = {
  render: () => (
    <MagazineCover
      editionTitle={sampleEdition.title}
      date={sampleEdition.date}
      totalReadingMinutes={sampleEdition.totalReadingMinutes}
      articleCount={sampleEdition.articleCount}
      focusCount={sampleEdition.sections.length}
      lead={sampleEdition.sections[0]!.articles[0]!}
      highlights={[
        sampleEdition.sections[1]!.articles[0]!,
        sampleEdition.sections[2]!.articles[0]!,
      ]}
    />
  ),
};

/* Table of contents in isolation */
const TableOfContents: Story = {
  render: () => (
    <MagazineToc
      editionTitle={sampleEdition.title}
      sections={sampleEdition.sections.map((s, i) => ({
        focusName: s.focusName,
        articles: s.articles,
        startPage: i * 4 + 2,
      }))}
    />
  ),
};

/* Section divider in isolation */
const SectionDivider: Story = {
  render: () => (
    <MagazineSection
      focusName="Technology"
      index={0}
      articleCount={3}
      totalReadingMinutes={8}
    />
  ),
};

/* Article spread: hero layout with full content */
const ArticleHero: Story = {
  render: () => (
    <div className="h-screen overflow-y-auto">
      <MagazineArticle
        title="The quiet revolution in reader design"
        sourceName="Ars Technica"
        author="Samuel Axon"
        summary="How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span. The old paradigm of infinite scroll is giving way to something more intentional."
        publishedAt={new Date(now - 3 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={480}
        imageUrl="https://picsum.photos/seed/reader-mag/800/600"
        content={readerDesignContent}
        positionInSection={0}
      />
    </div>
  ),
};

/* Article spread: editorial (centered) layout with full content */
const ArticleEditorial: Story = {
  render: () => (
    <div className="h-screen overflow-y-auto">
      <MagazineArticle
        title="TypeScript 6.0 introduces pattern matching"
        sourceName="Hacker News"
        summary="The long-awaited pattern matching RFC lands in TypeScript, bringing exhaustive checks and destructuring to a new level."
        publishedAt={new Date(now - 5 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={180}
        content={patternMatchingContent}
        positionInSection={1}
      />
    </div>
  ),
};

/* Article spread: compact (sidebar) layout with full content */
const ArticleCompact: Story = {
  render: () => (
    <div className="h-screen overflow-y-auto">
      <MagazineArticle
        title="Why SQLite is the database you didn't know you needed"
        sourceName="Hacker News"
        author="Richard Hipp"
        summary="A deep dive into why embedded databases are making a comeback in server-side applications, and what the trade-offs really look like at scale."
        publishedAt={new Date(now - 9 * 60 * 60 * 1000).toISOString()}
        consumptionTimeSeconds={720}
        imageUrl="https://picsum.photos/seed/sqlite-mag/800/600"
        content={sqliteContent}
        positionInSection={2}
      />
    </div>
  ),
};

/* Finale page */
const Finale: Story = {
  render: () => (
    <MagazineFinale
      articleCount={7}
      totalReadingMinutes={14}
      editionTitle="Morning Briefing"
    />
  ),
};

export default meta;
export {
  FullMagazine,
  Cover,
  TableOfContents,
  SectionDivider,
  ArticleHero,
  ArticleEditorial,
  ArticleCompact,
  Finale,
};
