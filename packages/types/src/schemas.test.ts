/**
 * What a Client types, as a pure function. This boundary is the single source of truth for both the
 * new-job form's messages and the create mutation's guard, so the assertions here are on the error
 * *copy* as well as on the pass/fail — the wording is the contract, not an implementation detail.
 */
import { NewJobSchema } from './schemas';

const titleError = (title: string) => {
  const result = NewJobSchema.safeParse({ title });
  return result.success ? undefined : result.error.issues[0]?.message;
};

it('accepts a title on its own, because a Server job has no description either', () => {
  expect(NewJobSchema.parse({ title: 'Kitchen tap drips constantly' })).toEqual({
    title: 'Kitchen tap drips constantly',
  });
});

it('trims the title and the description before anything else sees them', () => {
  expect(NewJobSchema.parse({ title: '  Hallway light flickers  ', description: '  Since Tuesday.  ' })).toEqual({
    title: 'Hallway light flickers',
    description: 'Since Tuesday.',
  });
});

it('rejects a blank title with the message the form will show', () => {
  expect(titleError('')).toBe('Give the job a title');
});

it('rejects a title of only whitespace, which is blank once trimmed', () => {
  expect(titleError('     ')).toBe('Give the job a title');
});

it('rejects a two-character title and accepts a three-character one', () => {
  expect(titleError('ab')).toBe('Give the job a title');
  expect(titleError('abc')).toBeUndefined();
});

it('rejects an 81-character title and accepts an 80-character one', () => {
  expect(titleError('x'.repeat(81))).toBe('Keep the title under 80 characters');
  expect(titleError('x'.repeat(80))).toBeUndefined();
});

it('rejects a 501-character description and accepts a 500-character one', () => {
  const describedWith = (description: string) => NewJobSchema.safeParse({ title: 'Boiler loses pressure', description });

  expect(describedWith('x'.repeat(501)).success).toBe(false);
  expect(describedWith('x'.repeat(501)).error?.issues[0]?.message).toBe(
    'Keep the description under 500 characters',
  );
  expect(describedWith('x'.repeat(500)).success).toBe(true);
});
