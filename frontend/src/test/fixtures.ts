import type { PollDetailDTO, ResultBucketDTO } from '@community/shared';

export const samplePoll: PollDetailDTO = {
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
  options: [
    { id: 11, label: 'Dark mode', position: 1, voteCount: 0 },
    { id: 12, label: 'Notifications', position: 2, voteCount: 0 },
    { id: 13, label: 'Mobile app', position: 3, voteCount: 0 },
  ],
};

export const sampleResults: ResultBucketDTO[] = [
  { optionId: 11, label: 'Dark mode', voteCount: 58, percentage: 45 },
  { optionId: 12, label: 'Notifications', voteCount: 39, percentage: 30 },
  { optionId: 13, label: 'Mobile app', voteCount: 31, percentage: 25 },
];
