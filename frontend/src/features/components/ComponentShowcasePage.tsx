import { useState, type ReactNode } from 'react';
import type { PollDetailDTO, ResultBucketDTO } from '@community/shared';
import {
  Badge,
  BarChart,
  Button,
  EmptyState,
  Modal,
  ProgressBar,
  Skeleton,
  Spinner,
  ToastProvider,
  VoteCard,
  useToast,
} from '../../components';

const samplePoll: PollDetailDTO = {
  id: 1,
  title: 'Favorite community feature?',
  description: 'Which feature should we build next sprint?',
  status: 'open',
  isAnonymous: true,
  allowRevote: false,
  opensAt: null,
  closesAt: null,
  totalVotes: 0,
  leadOptionLabel: null,
  createdBy: 'admin',
  createdAt: '2026-01-01T00:00:00Z',
  userVotedOptionId: null,
  options: [
    { id: 11, label: 'Dark mode', position: 1, voteCount: 0 },
    { id: 12, label: 'Notifications', position: 2, voteCount: 0 },
    { id: 13, label: 'Mobile app', position: 3, voteCount: 0 },
  ],
};

const sampleResults: ResultBucketDTO[] = [
  { optionId: 11, label: 'Dark mode', voteCount: 58, percentage: 45 },
  { optionId: 12, label: 'Notifications', voteCount: 39, percentage: 30 },
  { optionId: 13, label: 'Mobile app', voteCount: 31, percentage: 25 },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-[--radius-card] border border-border bg-surface p-4 md:p-6">
      <h2 className="text-title font-semibold text-ink">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

function ToasterDemo() {
  const { push } = useToast();
  return (
    <Section title="Toaster">
      <Button variant="primary" onClick={() => push({ tone: 'success', message: 'Vote recorded successfully' })}>
        Success toast
      </Button>
      <Button variant="danger" onClick={() => push({ tone: 'error', message: 'Duplicate vote rejected' })}>
        Error toast
      </Button>
      <Button variant="secondary" onClick={() => push({ tone: 'info', message: 'Results refresh every 5s' })}>
        Info toast
      </Button>
    </Section>
  );
}

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Modal">
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open modal
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Confirm your vote"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Confirm
            </Button>
          </>
        }
      >
        Once cast, your vote is final for this poll.
      </Modal>
    </Section>
  );
}

function Showcase() {
  const [selected, setSelected] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);
  return (
    <div className="space-y-6">
      <h2 className="text-headline font-bold text-ink">Component Showcase</h2>

      <Section title="Button">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="primary" size="lg">
          Large
        </Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <Button variant="primary" loading>
          Loading
        </Button>
      </Section>

      <Section title="Badge">
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="open">Open</Badge>
        <Badge tone="closed">Closed</Badge>
        <Badge tone="draft">Draft</Badge>
        <Badge tone="warning">Closing soon</Badge>
      </Section>

      <Section title="VoteCard">
        <div className="grid w-full gap-4 md:grid-cols-2">
          <VoteCard
            poll={samplePoll}
            selectedOptionId={selected}
            hasVoted={voted}
            onOptionSelect={(id: number) => {
              setSelected(id);
              setVoted(false);
            }}
            onSubmitVote={() => setVoted(true)}
            expiryLabel="Closes in 2h"
            onOpenResults={() => {}}
          />
          <VoteCard poll={samplePoll} selectedOptionId={12} hasVoted onOptionSelect={() => {}} onSubmitVote={() => {}} />
          <VoteCard poll={samplePoll} selectedOptionId={null} hasVoted={false} disabled onOptionSelect={() => {}} onSubmitVote={() => {}} />
        </div>
      </Section>

      <Section title="BarChart">
        <div className="w-full max-w-xl">
          <BarChart data={sampleResults} highlightOptionId={11} />
        </div>
      </Section>

      <Section title="ProgressBar">
        <div className="w-full max-w-md space-y-3">
          <ProgressBar value={72} label="Votes counted" />
          <ProgressBar value={40} size="sm" label="Small progress" />
          <ProgressBar value={90} color="#059669" label="Green progress" />
        </div>
      </Section>

      <ModalDemo />
      <ToasterDemo />

      <Section title="Skeleton">
        <div className="w-full max-w-md space-y-3">
          <Skeleton variant="text" count={3} />
          <Skeleton variant="bar-row" count={3} />
          <Skeleton variant="card" />
        </div>
      </Section>

      <Section title="EmptyState">
        <div className="w-full max-w-md">
          <EmptyState
            title="No polls yet"
            description="Polls created by the community will appear here."
            action={<Button variant="primary">Create poll</Button>}
          />
        </div>
      </Section>

      <Section title="Spinner">
        <Spinner size={16} />
        <Spinner size={24} />
        <Spinner size={32} label="Loading results" />
      </Section>
    </div>
  );
}

export function ComponentShowcasePage() {
  return (
    <ToastProvider>
      <Showcase />
    </ToastProvider>
  );
}
