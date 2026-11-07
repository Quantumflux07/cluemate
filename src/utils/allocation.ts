import { AllocationDraft, OptionKey, OPTION_KEYS } from '../types/voting';

export const INITIAL_ALLOCATION: AllocationDraft = {
  percentages: {
    a: 0,
    b: 0,
    c: 0,
    d: 100,
  },
  history: ['d'],
  isDontKnow: false,
};

export const RESET_DRAFT: AllocationDraft = {
  percentages: {
    a: 0,
    b: 0,
    c: 0,
    d: 0,
  },
  history: [],
  isDontKnow: false,
};

const CYCLIC_ORDER: readonly OptionKey[] = ['a', 'b', 'c', 'd'] as const;

/**
 * Returns the other 3 options in cyclic alphabetical order starting from the option after target.
 * e.g., 'd' -> ['a', 'b', 'c']
 *       'a' -> ['b', 'c', 'd']
 *       'b' -> ['c', 'd', 'a']
 *       'c' -> ['d', 'a', 'b']
 */
export function getOtherOptionsCyclic(target: OptionKey): [OptionKey, OptionKey, OptionKey] {
  const idx = CYCLIC_ORDER.indexOf(target);
  return [
    CYCLIC_ORDER[(idx + 1) % 4],
    CYCLIC_ORDER[(idx + 2) % 4],
    CYCLIC_ORDER[(idx + 3) % 4],
  ];
}

/**
 * Validates whether an allocation draft is ready and valid to commit:
 * - Don't Know is valid.
 * - For normal allocation, sum must be exactly 100% (all-zero reset drafts cannot be committed).
 */
export function isAllocationCommittable(draft: AllocationDraft): boolean {
  if (draft.isDontKnow) return true;
  const total = OPTION_KEYS.reduce((sum, key) => sum + (draft.percentages[key] || 0), 0);
  return total === 100;
}

/**
 * Applies confidence allocation transfer when an option key is tapped.
 *
 * Rules:
 * 1. If currently in Don't Know mode, restores preserved draft before applying tap.
 * 2. If draft is in all-zero reset state (total = 0%), target option receives 100% (history = [target]).
 * 3. If target option is already at 100%:
 *    - Target option becomes 0%.
 *    - The remaining 100% is distributed cyclically: next option gets 50%, the other two get 25% each.
 *    - allocationHistory is updated to [opt1, opt2, opt3].
 * 4. If target option is below 100%:
 *    - Transfers 25% to target from the oldest currently allocated option other than target.
 *    - If source option reaches 0%, it is removed from history.
 *    - Target option is updated to the newest position in history.
 */
export function handleOptionTap(
  current: AllocationDraft,
  target: OptionKey
): AllocationDraft {
  let percentages = { ...current.percentages };
  let history = [...current.history];

  // If currently in Don't Know mode, restore preserved allocation first
  if (current.isDontKnow) {
    if (current.preservedPercentages && current.preservedHistory) {
      percentages = { ...current.preservedPercentages };
      history = [...current.preservedHistory];
    } else {
      percentages = { ...RESET_DRAFT.percentages };
      history = [...RESET_DRAFT.history];
    }
  }

  const currentTotal = OPTION_KEYS.reduce((sum, key) => sum + (percentages[key] || 0), 0);

  // Case 0: Draft is in all-zero reset state -> Allocate 100% to target
  if (currentTotal === 0) {
    percentages = { a: 0, b: 0, c: 0, d: 0 };
    percentages[target] = 100;
    history = [target];

    return {
      percentages,
      history,
      isDontKnow: false,
      preservedPercentages: undefined,
      preservedHistory: undefined,
    };
  }

  // Case 1: Target is already at 100% -> Cyclic 50% / 25% / 25% distribution
  if (percentages[target] === 100) {
    const [opt1, opt2, opt3] = getOtherOptionsCyclic(target);

    percentages[target] = 0;
    percentages[opt1] = 50;
    percentages[opt2] = 25;
    percentages[opt3] = 25;

    history = [opt1, opt2, opt3];

    return {
      percentages,
      history,
      isDontKnow: false,
      preservedPercentages: undefined,
      preservedHistory: undefined,
    };
  }

  // Case 2: Target is < 100% -> FIFO 25% transfer from oldest positive option
  const sourceIndex = history.findIndex((key) => key !== target && percentages[key] > 0);
  if (sourceIndex === -1) {
    return current;
  }

  const sourceKey = history[sourceIndex];
  percentages[sourceKey] -= 25;
  percentages[target] += 25;

  // Clean up source from history if it reached 0%
  if (percentages[sourceKey] === 0) {
    history = history.filter((key, idx) => idx !== sourceIndex);
  }

  // Update target in history (move to newest position)
  history = history.filter((key) => key !== target);
  history.push(target);

  return {
    percentages,
    history,
    isDontKnow: false,
    preservedPercentages: undefined,
    preservedHistory: undefined,
  };
}

/**
 * Toggles Don't Know draft state while preserving previous A/B/C/D draft.
 */
export function handleToggleDontKnow(current: AllocationDraft): AllocationDraft {
  if (current.isDontKnow) {
    // Revert back to preserved allocation
    return {
      percentages: current.preservedPercentages ? { ...current.preservedPercentages } : { ...RESET_DRAFT.percentages },
      history: current.preservedHistory ? [...current.preservedHistory] : [...RESET_DRAFT.history],
      isDontKnow: false,
      preservedPercentages: undefined,
      preservedHistory: undefined,
    };
  }

  // Transition to Don't Know and preserve current allocation
  return {
    percentages: { a: 0, b: 0, c: 0, d: 0 },
    history: [],
    isDontKnow: true,
    preservedPercentages: { ...current.percentages },
    preservedHistory: [...current.history],
  };
}

/**
 * Resets the draft to the all-zero unallocated state.
 *
 * Sets A=0%, B=0%, C=0%, D=0%, history=[], and isDontKnow=false.
 * Note: Does not touch or overwrite committed votes.
 */
export function resetDraft(): AllocationDraft {
  return {
    percentages: { a: 0, b: 0, c: 0, d: 0 },
    history: [],
    isDontKnow: false,
    preservedPercentages: undefined,
    preservedHistory: undefined,
  };
}
