import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoteCard } from '../components/VoteCard';
import { samplePoll } from './fixtures';

function renderCard(overrides: Partial<Parameters<typeof VoteCard>[0]> = {}) {
  const props: Parameters<typeof VoteCard>[0] = {
    poll: samplePoll,
    selectedOptionId: null,
    hasVoted: false,
    onOptionSelect: vi.fn(),
    onSubmitVote: vi.fn(),
    ...overrides,
  };
  render(<VoteCard {...props} />);
  return props;
}

describe('VoteCard', () => {
  it('renders default state with radiogroup and unchecked options', () => {
    renderCard();
    const group = screen.getByRole('radiogroup');
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    radios.forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByRole('button', { name: 'Cast Vote' })).toBeDisabled();
  });

  it('selects an option locally then submits via Cast Vote', async () => {
    const user = userEvent.setup();
    const props = renderCard();
    await user.click(screen.getByRole('radio', { name: /Notifications/ }));
    expect(props.onOptionSelect).toHaveBeenCalledWith(12);
  });

  it('submits the selected option when Cast Vote is clicked', async () => {
    const user = userEvent.setup();
    const onSubmitVote = vi.fn();
    renderCard({ selectedOptionId: 12, onSubmitVote });
    await user.click(screen.getByRole('button', { name: 'Cast Vote' }));
    expect(onSubmitVote).toHaveBeenCalledWith(12);
  });

  it('shows the voted state: options disabled, cast button disabled', () => {
    renderCard({ selectedOptionId: 11, hasVoted: true });
    const card = screen.getByTestId('vote-card');
    expect(card).toHaveAttribute('data-state', 'voted');
    screen.getAllByRole('radio').forEach((radio) => expect(radio).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Vote cast' })).toBeDisabled();
  });

  it('shows the disabled state: everything disabled, no selection possible', () => {
    renderCard({ disabled: true });
    expect(screen.getByTestId('vote-card')).toHaveAttribute('data-state', 'disabled');
    screen.getAllByRole('radio').forEach((radio) => expect(radio).toBeDisabled());
  });

  it('supports arrow-key navigation between radios', async () => {
    const user = userEvent.setup();
    renderCard();
    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]);
    await user.keyboard('{ArrowDown}');
    expect(radios[1]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(radios[0]).toHaveFocus();
  });
});
