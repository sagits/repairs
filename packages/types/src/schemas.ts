/**
 * The Client-side validation boundary: what a person typed, on its way in.
 *
 * It is a Zod schema rather than a hand-written check because the form and the create mutation both
 * have to agree with it, and `z.infer` is what stops the TypeScript type, the form's message and the
 * mutation's guard from drifting — change the minimum title length here and all three move together.
 *
 * The messages are part of the contract. They are the exact words the new-job form shows under the
 * field, which is why the tests assert on them: a reworded message is a user-visible change and
 * should read as one in a diff.
 */
import { z } from 'zod';

/**
 * `trim()` runs before the length checks, so "   " is three characters on the way in and zero by the
 * time `min(3)` sees it — which is the behaviour the form needs, since a title of only spaces is a
 * missing title. The trimmed value is also what comes out, so nothing downstream has to re-trim.
 *
 * `description` is optional because a Server job has a title and nothing else: DummyJSON's `todo` is
 * one string, and inventing a description for the Jobs it already holds would be a lie. See the
 * Domain model section of `PRD.md` for why the honest gap is the right answer.
 */
export const NewJobSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Give the job a title')
    .max(80, 'Keep the title under 80 characters'),
  description: z.string().trim().max(500, 'Keep the description under 500 characters').optional(),
});

export type NewJobInput = z.infer<typeof NewJobSchema>;

/**
 * The login boundary. It is deliberately the thinnest check that can be called validation: the email
 * has to look like an email and the password has to be something rather than nothing. There is no
 * credential to check it against — `useSession` still holds two hardcoded people and the Role switch
 * on the form is what decides which of them you become — so anything past "is this plausibly filled
 * in" would be the form pretending to an authority it does not have.
 *
 * The messages are the exact words under the field, same contract as `NewJobSchema`'s: rewording one
 * is a user-visible change and the tests assert on it so that it reads as one in a diff.
 */
export const LoginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
