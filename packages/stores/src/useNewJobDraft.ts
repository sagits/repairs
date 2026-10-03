/**
 * What was typed into the new-job form and not yet posted. **The one store here that is not persisted**,
 * and the one that holds no domain truth at all: a draft is not a Job, and `GLOSSARY.md` says so in as
 * many words — a Job is a posted repair request, and this is a half-filled form.
 *
 * ## Why it exists when React Hook Form already holds the form
 *
 * It holds the draft **across unmounts**, which React Hook Form cannot: pushing `job/new`, backing out of
 * it and pushing it again tears the form down and builds a new one, and everything typed into the first
 * one went with it. So the two meet at exactly two points and nowhere else — the form reads this once for
 * its `defaultValues`, and a subscription writes values back as they change.
 *
 * It is read with `getState()` rather than through the hook on purpose. Subscribing would re-render the
 * form on every keystroke, and the keystroke is what caused the write.
 *
 * ## Why in memory rather than persisted
 *
 * A draft is scoped to one visit to the app, not to the device. Someone who closes Repairs and comes back
 * tomorrow is not resuming a sentence they half-typed, and finding one waiting would be a surprise rather
 * than a convenience — so this deliberately does not survive a relaunch, which is also why it needs no
 * storage key, no `partialize` and no hydration gate.
 */
import { create } from 'zustand';
import type { NewJobInput } from '@repairs/types';

type NewJobDraftState = {
  /** Partial because a draft is by definition unfinished; the schema is what finishes it. */
  draft: Partial<NewJobInput>;
  save: (draft: Partial<NewJobInput>) => void;
  /** Called on a successful post, because the Job it was a draft of now exists. */
  clear: () => void;
};

export const useNewJobDraft = create<NewJobDraftState>()((set) => ({
  draft: {},
  save: (draft) => set({ draft }),
  clear: () => set({ draft: {} }),
}));
