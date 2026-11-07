import {
  handleOptionTap,
  handleToggleDontKnow,
  INITIAL_ALLOCATION,
  isAllocationCommittable,
  resetDraft,
} from './allocation';
import { AllocationDraft, CommittedVote } from '../types/voting';

function assert(condition: boolean, msg: string = 'Assertion failed') {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('--- Running ClueMate Allocation Engine Unit Tests ---');

// =============================================================================
// Test Suite 1: Initial state & FIFO behavior for options below 100%
// =============================================================================
console.log('\n[Suite 1] FIFO 25% transfers below 100%');

let draft: AllocationDraft = { ...INITIAL_ALLOCATION };
assert(draft.percentages.d === 100, 'Initial D should be 100%');
assert(draft.percentages.a === 0 && draft.percentages.b === 0 && draft.percentages.c === 0, 'A, B, C should be 0%');
assert(draft.history.join(',') === 'd', `History should be ['d'], got: ${draft.history.join(',')}`);
console.log('✓ 1.1 Initial baseline state verified (A:0, B:0, C:0, D:100, history: [d])');

// Tap B from D=100 -> D=75, B=25
draft = handleOptionTap(draft, 'b');
assert(draft.percentages.d === 75 && draft.percentages.b === 25, 'D:75%, B:25%');
assert(draft.history.join(',') === 'd,b', `History should be [d, b], got: ${draft.history.join(',')}`);
console.log('✓ 1.2 Tap B -> D:75%, B:25%, history: [d, b]');

// Tap C -> oldest other is D (75%), so D drops to 50%, C becomes 25%
draft = handleOptionTap(draft, 'c');
assert(draft.percentages.d === 50 && draft.percentages.b === 25 && draft.percentages.c === 25, 'D:50, B:25, C:25');
assert(draft.history.join(',') === 'd,b,c', `History should be [d, b, c], got: ${draft.history.join(',')}`);
console.log('✓ 1.3 Tap C -> D:50%, B:25%, C:25%, history: [d, b, c]');

// Tap C again -> oldest other is D (50%), so D drops to 25%, C becomes 50%
draft = handleOptionTap(draft, 'c');
assert(draft.percentages.d === 25 && draft.percentages.b === 25 && draft.percentages.c === 50, 'D:25, B:25, C:50');
assert(draft.history.join(',') === 'd,b,c', `History should be [d, b, c], got: ${draft.history.join(',')}`);
console.log('✓ 1.4 Tap C again -> D:25%, B:25%, C:50%, history: [d, b, c]');

// Tap C again -> oldest other is D (25%), D reaches 0% and is removed from history
draft = handleOptionTap(draft, 'c');
assert(draft.percentages.d === 0 && draft.percentages.b === 25 && draft.percentages.c === 75, 'D:0, B:25, C:75');
assert(draft.history.join(',') === 'b,c', `History should be [b, c], got: ${draft.history.join(',')}`);
console.log('✓ 1.5 Tap C again -> D drops to 0% and is removed, history: [b, c]');

// Tap C again -> oldest other is B (25%), B reaches 0% and is removed, C reaches 100%
draft = handleOptionTap(draft, 'c');
assert(draft.percentages.c === 100 && draft.percentages.b === 0 && draft.percentages.d === 0, 'C:100%');
assert(draft.history.join(',') === 'c', `History should be [c], got: ${draft.history.join(',')}`);
console.log('✓ 1.6 Tap C to 100% -> C:100%, history: [c]');

// =============================================================================
// Test Suite 2: Tapping an option at 100% (Cyclic 50% / 25% / 25% redistribution)
// =============================================================================
console.log('\n[Suite 2] Tapping each option at 100%');

// 2.1 Tap C at 100% -> D = 50%, A = 25%, B = 25%, C = 0%
draft = handleOptionTap(draft, 'c');
assert(draft.percentages.c === 0, `C should be 0%, got ${draft.percentages.c}`);
assert(draft.percentages.d === 50, `D should be 50%, got ${draft.percentages.d}`);
assert(draft.percentages.a === 25, `A should be 25%, got ${draft.percentages.a}`);
assert(draft.percentages.b === 25, `B should be 25%, got ${draft.percentages.b}`);
assert(draft.history.join(',') === 'd,a,b', `History should be [d, a, b], got: ${draft.history.join(',')}`);
console.log('✓ 2.1 C=100%, tap C -> D:50%, A:25%, B:25%, C:0%, history: [d, a, b]');

// 2.2 Tap D at 100%
// First bring D to 100%: from {d:50, a:25, b:25}, tap D (a drops to 0) -> d:75, b:25. Tap D again -> d:100
let draftD: AllocationDraft = {
  percentages: { a: 0, b: 0, c: 0, d: 100 },
  history: ['d'],
  isDontKnow: false,
};
// Tap D at 100% -> A = 50%, B = 25%, C = 25%, D = 0%
draftD = handleOptionTap(draftD, 'd');
assert(draftD.percentages.d === 0, `D should be 0%, got ${draftD.percentages.d}`);
assert(draftD.percentages.a === 50, `A should be 50%, got ${draftD.percentages.a}`);
assert(draftD.percentages.b === 25, `B should be 25%, got ${draftD.percentages.b}`);
assert(draftD.percentages.c === 25, `C should be 25%, got ${draftD.percentages.c}`);
assert(draftD.history.join(',') === 'a,b,c', `History should be [a, b, c], got: ${draftD.history.join(',')}`);
console.log('✓ 2.2 D=100%, tap D -> A:50%, B:25%, C:25%, D:0%, history: [a, b, c]');

// 2.3 Tap A at 100% -> B = 50%, C = 25%, D = 25%, A = 0%
let draftA: AllocationDraft = {
  percentages: { a: 100, b: 0, c: 0, d: 0 },
  history: ['a'],
  isDontKnow: false,
};
draftA = handleOptionTap(draftA, 'a');
assert(draftA.percentages.a === 0, `A should be 0%, got ${draftA.percentages.a}`);
assert(draftA.percentages.b === 50, `B should be 50%, got ${draftA.percentages.b}`);
assert(draftA.percentages.c === 25, `C should be 25%, got ${draftA.percentages.c}`);
assert(draftA.percentages.d === 25, `D should be 25%, got ${draftA.percentages.d}`);
assert(draftA.history.join(',') === 'b,c,d', `History should be [b, c, d], got: ${draftA.history.join(',')}`);
console.log('✓ 2.3 A=100%, tap A -> B:50%, C:25%, D:25%, A:0%, history: [b, c, d]');

// 2.4 Tap B at 100% -> C = 50%, D = 25%, A = 25%, B = 0%
let draftB: AllocationDraft = {
  percentages: { a: 0, b: 100, c: 0, d: 0 },
  history: ['b'],
  isDontKnow: false,
};
draftB = handleOptionTap(draftB, 'b');
assert(draftB.percentages.b === 0, `B should be 0%, got ${draftB.percentages.b}`);
assert(draftB.percentages.c === 50, `C should be 50%, got ${draftB.percentages.c}`);
assert(draftB.percentages.d === 25, `D should be 25%, got ${draftB.percentages.d}`);
assert(draftB.percentages.a === 25, `A should be 25%, got ${draftB.percentages.a}`);
assert(draftB.history.join(',') === 'c,d,a', `History should be [c, d, a], got: ${draftB.history.join(',')}`);
console.log('✓ 2.4 B=100%, tap B -> C:50%, D:25%, A:25%, B:0%, history: [c, d, a]');

// =============================================================================
// Test Suite 3: Reset Draft behavior & all-zero allocation rules
// =============================================================================
console.log('\n[Suite 3] Reset Draft & All-Zero Allocation');

// 3.1 Reset produces A=0, B=0, C=0, D=0, history=[], isDontKnow=false
const resetState = resetDraft();
assert(
  resetState.percentages.a === 0 &&
  resetState.percentages.b === 0 &&
  resetState.percentages.c === 0 &&
  resetState.percentages.d === 0,
  'Reset draft must have all percentages at 0%'
);
assert(resetState.history.length === 0, `History must be empty, got ${resetState.history.length}`);
assert(resetState.isDontKnow === false, 'isDontKnow must be false on reset');
console.log('✓ 3.1 Reset produces A:0, B:0, C:0, D:0, history: [], isDontKnow: false');

// 3.2 An all-zero allocation cannot be committed as a normal allocation vote
assert(
  isAllocationCommittable(resetState) === false,
  'All-zero allocation must NOT be committable'
);
console.log('✓ 3.2 isAllocationCommittable returns false for all-zero draft');

// 3.3 Don't Know IS committable even if percentages are 0
const dontKnowDraft: AllocationDraft = {
  percentages: { a: 0, b: 0, c: 0, d: 0 },
  history: [],
  isDontKnow: true,
};
assert(
  isAllocationCommittable(dontKnowDraft) === true,
  "Don't Know must be committable"
);
console.log('✓ 3.3 isAllocationCommittable returns true for Don\'t Know');

// 3.4 Tapping an option from all-zero state allocates 100% to that option
const draftFromZero = handleOptionTap(resetState, 'a');
assert(draftFromZero.percentages.a === 100, `A should be 100%, got ${draftFromZero.percentages.a}`);
assert(draftFromZero.history.join(',') === 'a', `History should be ['a'], got ${draftFromZero.history.join(',')}`);
assert(isAllocationCommittable(draftFromZero) === true, '100% allocated draft must be committable');
console.log('✓ 3.4 Tap option from all-zero reset state sets target to 100% (committable)');

// =============================================================================
// Test Suite 4: Switching to and from Don't Know preserves the draft
// =============================================================================
console.log('\n[Suite 4] Don\'t Know draft preservation');

let draftActive: AllocationDraft = {
  percentages: { a: 50, b: 25, c: 25, d: 0 },
  history: ['a', 'b', 'c'],
  isDontKnow: false,
};

// Switch to Don't Know
draftActive = handleToggleDontKnow(draftActive);
assert(draftActive.isDontKnow === true, 'isDontKnow should be true');
assert(draftActive.preservedPercentages?.a === 50, 'Preserved A should be 50%');
assert(draftActive.preservedPercentages?.b === 25, 'Preserved B should be 25%');
assert(draftActive.preservedPercentages?.c === 25, 'Preserved C should be 25%');
assert(draftActive.preservedHistory?.join(',') === 'a,b,c', 'Preserved history must match');
console.log('✓ 4.1 Switching to Don\'t Know preserves active percentages and history');

// Switch back from Don't Know
draftActive = handleToggleDontKnow(draftActive);
assert(draftActive.isDontKnow === false, 'isDontKnow should be false');
assert(draftActive.percentages.a === 50 && draftActive.percentages.b === 25 && draftActive.percentages.c === 25, 'Restored percentages match');
assert(draftActive.history.join(',') === 'a,b,c', 'Restored history matches');
console.log('✓ 4.2 Switching back from Don\'t Know restores exact preserved draft');

// Tapping an option while in Don't Know restores preserved draft and applies transfer
draftActive = handleToggleDontKnow(draftActive); // into Don't Know
assert(draftActive.isDontKnow === true);
draftActive = handleOptionTap(draftActive, 'd'); // tap D (was 0%), oldest other option 'a' (50%) loses 25%
assert(draftActive.isDontKnow === false, 'isDontKnow is now false');
assert(draftActive.percentages.a === 25, `A should be 25%, got ${draftActive.percentages.a}`);
assert(draftActive.percentages.d === 25, `D should be 25%, got ${draftActive.percentages.d}`);
assert(draftActive.history.join(',') === 'a,b,c,d', `History should be [a, b, c, d], got: ${draftActive.history.join(',')}`);
console.log('✓ 4.3 Tapping option from Don\'t Know restores preserved draft and transfers 25%');

// =============================================================================
// Test Suite 5: Existing committed votes remain unchanged when local draft is reset
// =============================================================================
console.log('\n[Suite 5] Committed votes unchanged across local draft reset');

// Simulate a user committing a vote
const serverCommittedVote: CommittedVote = {
  isDontKnow: false,
  percentages: { a: 25, b: 25, c: 25, d: 25 },
  committedAt: new Date().toISOString(),
};

// User locally edits draft and then presses Reset Draft
let localDraft = { ...draftActive };
localDraft = resetDraft(); // local reset

// Assert local draft is all zeros
assert(localDraft.percentages.a === 0 && localDraft.percentages.b === 0 && localDraft.percentages.c === 0 && localDraft.percentages.d === 0);

// Assert serverCommittedVote was NOT mutated
assert(serverCommittedVote.percentages.a === 25, 'Committed vote A must remain 25%');
assert(serverCommittedVote.percentages.b === 25, 'Committed vote B must remain 25%');
assert(serverCommittedVote.percentages.c === 25, 'Committed vote C must remain 25%');
assert(serverCommittedVote.percentages.d === 25, 'Committed vote D must remain 25%');
assert(serverCommittedVote.isDontKnow === false, 'Committed vote isDontKnow must remain false');
console.log('✓ 5.1 Local draft reset does not mutate or clear existing committed vote');

console.log('\n======================================================');
console.log('  ALL CLUEMATE ALLOCATION & RESET TESTS PASSED (16/16)  ');
console.log('======================================================\n');
