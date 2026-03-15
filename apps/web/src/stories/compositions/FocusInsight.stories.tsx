import type { Meta, StoryObj } from '@storybook/react-vite';

import { FocusInsight } from '../../components/focus-insight.tsx';
import type { FocusClassification } from '../../components/focus-insight.tsx';

const sampleClassifications: FocusClassification[] = [
  { focusId: '1', focusName: 'Technology', focusIcon: '💻', confidence: 0.92 },
  { focusId: '2', focusName: 'Science', focusIcon: '🔬', confidence: 0.61 },
  { focusId: '3', focusName: 'Global News', focusIcon: '🌍', confidence: 0.28 },
  { focusId: '4', focusName: 'Local News', focusIcon: null, confidence: 0.09 },
];

const meta: Meta<typeof FocusInsight> = {
  title: 'Design System/Compositions/Focus Insight',
  component: FocusInsight,
  parameters: { layout: 'centered' },
  render: (args) => (
    <div style={{ width: '40rem' }} className="p-6 bg-surface rounded-lg">
      <div className="font-serif text-xl text-ink mb-3 text-center">End of article</div>
      <div className="border-t border-border pt-4">
        <FocusInsight {...args} />
      </div>
    </div>
  ),
};

type Story = StoryObj<typeof FocusInsight>;

const Default: Story = {
  args: {
    classifications: sampleClassifications,
  },
};

const SingleFocus: Story = {
  args: {
    classifications: [{ focusId: '1', focusName: 'Climate', focusIcon: '🌱', confidence: 0.87 }],
  },
};

const ManyFocuses: Story = {
  args: {
    classifications: [
      { focusId: '1', focusName: 'Technology', focusIcon: '💻', confidence: 0.95 },
      { focusId: '2', focusName: 'Science', focusIcon: '🔬', confidence: 0.82 },
      { focusId: '3', focusName: 'Business', focusIcon: '📊', confidence: 0.71 },
      { focusId: '4', focusName: 'Global News', focusIcon: '🌍', confidence: 0.45 },
      { focusId: '5', focusName: 'Culture', focusIcon: '🎭', confidence: 0.33 },
      { focusId: '6', focusName: 'Sports', focusIcon: '⚽', confidence: 0.12 },
      { focusId: '7', focusName: 'Local News', focusIcon: null, confidence: 0.05 },
    ],
  },
};

const LowConfidence: Story = {
  args: {
    classifications: [
      { focusId: '1', focusName: 'Technology', focusIcon: '💻', confidence: 0.22 },
      { focusId: '2', focusName: 'Science', focusIcon: '🔬', confidence: 0.15 },
      { focusId: '3', focusName: 'Global News', focusIcon: '🌍', confidence: 0.08 },
    ],
  },
};

const NoIcons: Story = {
  args: {
    classifications: [
      { focusId: '1', focusName: 'Technology', focusIcon: null, confidence: 0.89 },
      { focusId: '2', focusName: 'Science', focusIcon: null, confidence: 0.54 },
      { focusId: '3', focusName: 'Politics', focusIcon: null, confidence: 0.31 },
    ],
  },
};

const Empty: Story = {
  args: {
    classifications: [],
  },
};

export default meta;
export { Default, SingleFocus, ManyFocuses, LowConfidence, NoIcons, Empty };
