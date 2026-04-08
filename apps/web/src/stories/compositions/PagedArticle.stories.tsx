import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PagedArticleView, type ArticleInput } from '../../components/paged-article/paged-article.ts';

/* ── Sample content ───────────────────────────────────────────── */

const readerDesignContent = `For the better part of a decade, the dominant paradigm in digital reading has been the infinite scroll. Twitter pioneered it, Facebook perfected it, and RSS readers adopted it wholesale. The assumption was simple: more content, delivered faster, in an unbroken stream. But a growing number of designers and developers are questioning whether that assumption ever served readers at all.

The problem isn't technical — it's attentional. When everything arrives in a single undifferentiated stream, nothing feels important. A three-thousand-word investigation sits alongside a two-sentence hot take. A post from a friend you haven't heard from in months drowns under a flood of content from accounts you barely remember following. The firehose doesn't discriminate, and neither can the reader.

### The finite alternative

"The most radical thing you can do in 2026 is give someone an ending," says Mira Chen, lead designer at Streamline, a reading app that launched last month to quiet enthusiasm. "Every other app in the attention economy is designed to keep you scrolling. We designed ours so you reach the bottom and feel *done*."

Streamline isn't alone. A wave of new reading apps — Editions, Reeder, Newsprint, Matter — share a common philosophy: reading should be bounded, curated, and calm. They draw inspiration not from social media feeds but from print magazines and morning newspapers, media that arrived finite by nature.

> We're not building a feed. We're building something closer to a daily newspaper — assembled with intention, bounded by design, and meant to be finished.

### Source budgeting

![A stack of well-worn print magazines on a wooden table](https://picsum.photos/seed/magazines-stack/800/400)

One technique gaining traction is "source budgeting" — algorithmically limiting how many articles from any single source can appear in a reading session. The idea is proportional representation: a prolific news wire shouldn't crowd out a small blog that publishes once a week. The reader subscribed to both for a reason.

This approach requires a fundamental rethink of how feeds are assembled. Instead of sorting by recency and calling it done, these apps build curated editions: selecting a bounded set of articles that balance topics, sources, reading time, and importance. The result feels less like drinking from a firehose and more like reading a well-edited magazine.

### Reading time as a first-class concept

Perhaps the most user-visible change is the emphasis on reading time. Rather than showing article counts — "47 unread" — these apps frame everything in minutes. "Your morning edition: 12 minutes." The shift is psychological as much as practical: it transforms reading from an obligation (clear the backlog) into a choice (I have fifteen minutes, here's what's worth reading).

For this to work, apps need to know how long articles actually take to read — which means extracting the full text, not just the RSS summary. Article extraction has gotten remarkably good, and the investment pays dividends beyond time estimation: it enables better topic classification, offline reading, and a consistent visual experience.

### What comes next

The quiet revolution in reader design isn't about features. It's about philosophy. These apps are betting that readers don't want more — they want enough. That the scroll isn't sacred. That "you're all caught up" is the most satisfying thing a reading app can say.

Whether the broader market agrees remains to be seen. But for a growing community of intentional readers, the firehose era is already over.`;

const jwstContent = `The James Webb Space Telescope has done it again. In a paper published today in Nature Astronomy, a team led by Dr. Emily Carter at the Space Telescope Science Institute reports the detection of spectroscopically confirmed galaxies at redshift z ≈ 16.4 — placing them roughly 230 million years after the Big Bang. If confirmed by independent analysis, these are the oldest galaxies ever observed, surpassing the previous record by nearly 50 million years.

The discovery was made using JWST's Near-Infrared Spectrograph (NIRSpec), which captured detailed spectra of three candidate galaxies first identified as photometric dropouts in deep imaging from the JADES survey. The spectra reveal emission lines consistent with young stellar populations and very low metallicity — hallmarks of galaxies forming their first generation of stars.

### Challenging the models

What makes these observations particularly significant isn't just the record-breaking distance. It's that the galaxies appear more massive and more luminous than current models of early universe star formation predict. Standard Lambda-CDM cosmology expects the first galaxies to be small, faint, and slowly assembling — not the surprisingly bright objects JWST keeps finding.

> We're not seeing the tiny, tentative galaxies our models predict. We're seeing something more vigorous, more luminous, and frankly more puzzling. The early universe was busier than we thought.

This isn't the first time JWST has challenged expectations about the early universe. Since its first deep field observations in 2022, the telescope has consistently revealed galaxies at high redshifts that appear "too big, too bright, too soon" — a phrase that has become something of a refrain in the astronomical community.

![JWST deep field image showing thousands of galaxies in a tiny patch of sky](https://picsum.photos/seed/jwst-deep/800/500)

### Possible explanations

Several hypotheses are being explored. Star formation in the early universe may have been more efficient than assumed, with a higher fraction of gas converting to stars. The initial mass function — the distribution of stellar masses — may have been top-heavy, producing more luminous massive stars. Or there may be physical processes not yet captured in simulations that accelerated early galaxy assembly.

Some theorists have proposed more radical explanations, including modifications to dark matter models or even challenges to aspects of standard cosmology. But most researchers counsel patience: the observations are still new, and the systematic uncertainties at these extreme redshifts are significant.

### What's next

The JWST team plans to follow up with deeper spectroscopic observations during Cycle 4, targeting these and other high-redshift candidates with longer exposure times. The goal is to measure stellar masses, star formation rates, and chemical abundances with enough precision to meaningfully constrain theoretical models.

For now, the message from the edge of the observable universe is clear: the cosmos got started faster than we expected, and our theories have some catching up to do.`;

const shortArticle = `After three years of negotiations that nearly collapsed twice, the Comprehensive Pacific Economic Partnership (CPEP) was formally ratified today in a ceremony in Auckland. The agreement, signed by twelve nations spanning from Chile to Japan, creates the world's largest free trade zone by GDP — surpassing both the EU single market and USMCA.

The agreement eliminates tariffs on over 95% of goods traded between member nations over a ten-year phase-in period. It also includes provisions for digital trade, intellectual property harmonization, labor standards, and environmental commitments — making it one of the most comprehensive trade agreements in history.

Reaction has been cautiously optimistic. Trade economists project modest but meaningful GDP gains for most member nations, with smaller Pacific island economies expected to benefit disproportionately from improved market access. Critics, particularly labor unions in larger economies, warn that the agreement's enforcement mechanisms for labor and environmental standards lack teeth.

The agreement enters into force in ninety days, with the first tariff reductions beginning in Q2 of next year.`;

/* ── Sample articles ──────────────────────────────────────────── */

const now = Date.now();

const longArticle: ArticleInput = {
  title: 'The quiet revolution in reader design',
  sourceName: 'Ars Technica',
  author: 'Samuel Axon',
  summary: "How a new generation of reading apps is rethinking the relationship between content, interface, and the reader's attention span.",
  publishedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  consumptionTimeSeconds: 480,
  imageUrl: 'https://picsum.photos/seed/reader-paged/800/600',
  content: readerDesignContent,
};

const scienceArticle: ArticleInput = {
  title: "JWST captures light from the universe's first galaxies",
  sourceName: 'Nature',
  author: 'Dr. Emily Carter',
  summary: 'New observations push the frontier of known galaxies back another 200 million years.',
  publishedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
  consumptionTimeSeconds: 360,
  imageUrl: 'https://picsum.photos/seed/jwst-paged/800/600',
  content: jwstContent,
};

const briefArticle: ArticleInput = {
  title: 'Pacific trade agreement reaches final ratification',
  sourceName: 'Reuters',
  summary: "Twelve nations sign the landmark agreement, creating the world's largest free trade zone.",
  publishedAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
  consumptionTimeSeconds: 120,
  content: shortArticle,
};

const noImageArticle: ArticleInput = {
  title: 'TypeScript 6.0 introduces pattern matching',
  sourceName: 'Hacker News',
  summary: 'The long-awaited pattern matching RFC lands in TypeScript.',
  publishedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
  consumptionTimeSeconds: 180,
  content: readerDesignContent,
};

/* ── Footer ───────────────────────────────────────────────────── */

const SampleFooter = (): React.ReactElement => (
  <div className="flex items-center justify-between border-t border-border pt-4">
    <span className="text-xs font-mono text-ink-tertiary">End of article</span>
    <div className="flex gap-3">
      <button className="text-xs font-mono text-ink-tertiary hover:text-accent transition-colors">Share</button>
      <button className="text-xs font-mono text-ink-tertiary hover:text-accent transition-colors">Bookmark</button>
    </div>
  </div>
);

/* ── Meta ─────────────────────────────────────────────────────── */

const meta: Meta = {
  title: 'Design System/Compositions/Paged Article',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1000, height: '100dvh', margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
};

type Story = StoryObj;

/* ── Stories ───────────────────────────────────────────────────── */

/** Feature style — large title, summary, hero image, two-column body on desktop */
const Feature: Story = {
  render: () => <PagedArticleView article={longArticle} style="feature" footer={<SampleFooter />} />,
};

/** Standard style — clean opener with image, readable body */
const Standard: Story = {
  render: () => <PagedArticleView article={scienceArticle} style="standard" footer={<SampleFooter />} />,
};

/** Minimal style — subtle, compact opener for shorter pieces */
const Minimal: Story = {
  render: () => <PagedArticleView article={briefArticle} style="minimal" footer={<SampleFooter />} />,
};

/** Long article without a hero image */
const NoImage: Story = {
  render: () => <PagedArticleView article={noImageArticle} style="standard" footer={<SampleFooter />} />,
};

/** Short article — fits on 1-2 pages */
const ShortArticle: Story = {
  render: () => <PagedArticleView article={briefArticle} style="standard" footer={<SampleFooter />} />,
};

/** With page change callback (check console) */
const WithCallback: Story = {
  render: () => (
    <PagedArticleView
      article={longArticle}
      style="feature"
      onPageChange={(page, total) => console.log(`Page ${page + 1} of ${total}`)}
      footer={<SampleFooter />}
    />
  ),
};

export default meta;
export { Feature, Standard, Minimal, NoImage, ShortArticle, WithCallback };
