import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../components/button.tsx';
import { Separator } from '../../components/separator.tsx';

const meta: Meta = {
  title: 'Design System/Compositions/Reading View',
  parameters: { layout: 'fullscreen' },
};

type Story = StoryObj;

const Header = (): React.ReactElement => (
  <header className="border-b border-border bg-surface">
    <div className="max-w-prose mx-auto px-6 py-4 flex items-center justify-between">
      <Button variant="ghost" size="sm">
        ← Back
      </Button>
      <span className="text-xs text-ink-tertiary hover:text-accent transition-colors duration-fast cursor-pointer">
        View original
      </span>
    </div>
  </header>
);

const ArticleReading: Story = {
  render: () => (
    <div className="min-h-dvh bg-surface">
      <Header />
      <article className="max-w-prose mx-auto px-4 py-8 md:px-6 md:py-12">
      <div className="mb-10">
        <div className="flex items-center gap-1.5 text-xs text-ink-tertiary mb-4">
          <time>15 March 2026</time>
          <span className="text-ink-faint">·</span>
          <span>8 min read</span>
        </div>

        <h1 className="font-serif text-4xl font-medium tracking-tight text-ink leading-tight mb-4">
          The quiet revolution in reader design
        </h1>

        <div className="text-sm text-ink-secondary">By Samuel Axon</div>
      </div>

      <div className="mb-10 -mx-6">
        <img src="https://picsum.photos/seed/reader-hero/1200/600" alt="" className="w-full rounded-lg" />
      </div>

      <div className="font-serif text-lg leading-relaxed text-ink">
        <p className="mb-6">
          Something is shifting in the way we consume the written word online. After years of infinite scrolling,
          algorithmic feeds, and attention-harvesting design patterns, a new generation of reading applications is
          taking a fundamentally different approach.
        </p>

        <p className="mb-6">
          These apps don't try to keep you engaged for as long as possible. They don't surface content designed to
          trigger outrage or curiosity gaps. Instead, they do something remarkably simple: they present articles in a
          way that respects your time and attention, and then they let you go.
        </p>

        <h2 className="font-serif text-2xl font-medium tracking-tight text-ink mt-10 mb-4">
          The attention economy's quiet rebellion
        </h2>

        <p className="mb-6">
          The concept isn't new — Instapaper and Readability pioneered the "reader mode" concept over a decade ago. But
          what's different now is the ambition. Modern reader apps aren't just stripping ads and reformatting text.
          They're rethinking the entire relationship between a person and their information diet.
        </p>

        <blockquote className="border-l-2 border-accent pl-6 my-8 italic text-ink-secondary">
          "The best reading experience is one where you forget you're using an app at all. The interface disappears and
          it's just you and the words."
        </blockquote>

        <p className="mb-6">
          Source budgeting is perhaps the most interesting innovation. Rather than treating all sources equally — where
          a prolific publication drowns out a thoughtful blog that posts once a week — these apps allocate proportional
          representation. The result is a feed that actually reflects the diversity of what you chose to follow.
        </p>

        <h2 className="font-serif text-2xl font-medium tracking-tight text-ink mt-10 mb-4">Typography as interface</h2>

        <p className="mb-6">
          One pattern emerging across these apps is the use of typography itself as the primary interface element.
          Rather than buttons, icons, and navigation bars competing for attention, the hierarchy is established through
          font choices, size, weight, and spacing. A serif typeface signals "this is content to read." A sans-serif
          signals "this is interface to interact with."
        </p>

        <p className="mb-6">
          This dual typography approach creates an almost subliminal distinction between chrome and content. Users
          report that it makes the reading experience feel more "book-like" — calm, focused, and intentionally bounded.
        </p>

        <h2 className="font-serif text-2xl font-medium tracking-tight text-ink mt-10 mb-4">The finite feed</h2>

        <p className="mb-6">
          Perhaps the most radical departure from mainstream feed design is the concept of a finite feed. Traditional
          feeds are deliberately infinite — there's always more to scroll, more to see, more to engage with. The new
          reading apps embrace endings. When you've read everything, you see a clear, satisfying message: you're done.
        </p>

        <p className="mb-6">
          "I am now done" becomes a first-class feature rather than a failure state. The psychology is powerful — it
          transforms reading from an anxious, never-caught-up activity into something that feels completable and
          satisfying.
        </p>
      </div>

      <Separator soft className="mt-12" />
      <div className="py-10 text-center">
        <div className="font-serif text-xl text-ink mb-3">End of article</div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" size="sm">
            ← Back
          </Button>
          <Button variant="secondary" size="sm">
            View original
          </Button>
        </div>
      </div>
      </article>
    </div>
  ),
};

export default meta;
export { ArticleReading };
