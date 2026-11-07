export type OptionKey = 'a' | 'b' | 'c' | 'd';

export const OPTION_KEYS: readonly OptionKey[] = ['a', 'b', 'c', 'd'] as const;

export interface AllocationDraft {
  percentages: Record<OptionKey, number>;
  history: OptionKey[];
  isDontKnow: boolean;
  preservedPercentages?: Record<OptionKey, number>;
  preservedHistory?: OptionKey[];
}

export interface CommittedVote {
  isDontKnow: boolean;
  percentages: Record<OptionKey, number>;
  committedAt: string;
}
