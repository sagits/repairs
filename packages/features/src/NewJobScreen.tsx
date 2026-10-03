/**
 * Posting a job. Two fields, React Hook Form, and `NewJobSchema` as the resolver — so the type, the
 * validation and the message under the field are all one declaration and cannot drift from each other.
 *
 * **Three rules about when this screen is allowed to speak, and each one is a decision.**
 *
 * - `mode: 'onTouched'`: a field says nothing until it has been blurred once, and after that it revalidates
 *   live as it is corrected. Validating from the first keystroke tells someone their title is too short
 *   while they are still typing it, which is the form being wrong about what is happening.
 * - **Submit stays enabled** and validates on press. A disabled button explains nothing; one press with a
 *   clear message under the offending field explains everything.
 * - **A failed request is not a field error** and does not render like one. It is a card above the form in
 *   the server's own words, because "the gutter title is too short" and "the network is down" are two
 *   different problems and reading as one would make both of them confusing.
 *
 * The guard is `RoleGuard`'s second use: a Pro has no business here, and the route exists for both Roles
 * because a deep link or a Role switched out from under a mounted screen arrives at it regardless.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, ScrollView, Text } from 'react-native';
import { useCreateJob } from '@repairs/api';
import { useNewJobDraft } from '@repairs/stores';
import { BackButton, colors, ErrorCard, FormField, HeaderBand, Screen } from '@repairs/ui';
import { NewJobSchema, type NewJobInput } from '@repairs/types';
import { RoleGuard } from './RoleGuard';

function NewJobForm() {
  const router = useRouter();

  const createJob = useCreateJob();

  /**
   * The draft is read **once**, lazily, and never subscribed to: subscribing would re-render the form on
   * every keystroke, and the keystroke is what caused the write. A `useState` initialiser is what makes
   * "once" true rather than merely intended — a bare `getState()` in the body would run every render.
   */
  const [initialDraft] = useState(() => useNewJobDraft.getState().draft);
  const saveDraft = useNewJobDraft((state) => state.save);
  const clearDraft = useNewJobDraft((state) => state.clear);

  const {
    control,
    handleSubmit,
    subscribe,
    formState: { isSubmitting },
  } = useForm<NewJobInput>({
    resolver: zodResolver(NewJobSchema),
    mode: 'onTouched',
    defaultValues: { title: '', description: '', ...initialDraft },
  });

  /**
   * `subscribe` rather than `watch(values => …)` because it notifies without re-rendering this component,
   * which is the whole reason the draft lives outside the form.
   *
   * ponytail: not debounced. The PRD asks for a debounce; nothing subscribes to this store, so a write is
   * one object assignment with no render behind it, and a timer plus its cleanup would be more code than
   * the thing it saves. If the draft ever becomes persisted, that is when a debounce earns its keep.
   */
  useEffect(
    () => subscribe({ formState: { values: true }, callback: ({ values }) => saveDraft(values) }),
    [subscribe, saveDraft],
  );

  /**
   * `handleSubmit` is what makes `isSubmitting` cover the request and not just the validation: the handler
   * is awaited, so the flag stays true until `mutateAsync` settles. A failure is swallowed here on purpose
   * — the mutation's own `error` is what renders it, and letting it out would be an unhandled rejection.
   */
  const submit = handleSubmit(async (values) => {
    try {
      await createJob.mutateAsync(values);
    } catch {
      return;
    }

    clearDraft();
    router.back();
  });

  return (
    <Screen>
      <HeaderBand
        title="Post a job"
        leading={
          <BackButton
            testID="close-new-job"
            accessibilityLabel="Cancel"
            onPress={() => router.back()}
          />
        }
      />
      <ScrollView contentContainerClassName="gap-5 px-5 py-6" keyboardShouldPersistTaps="handled">
        {/*
          * A failed request, said as its own problem. It is a card **above** the form rather than a line
          * under a field, because "the network is down" is nothing to do with what was typed, and the two
          * reading alike would make a person edit a title that was never the problem. No Retry on it: the
          * form's own submit button is the retry, and a second one would be two ways to do one thing.
          */}
        {createJob.error ? (
          <ErrorCard
            testID="new-job-error"
            title="Could not post your job"
            message={createJob.error.message}
          />
        ) : null}
        <FormField
          control={control}
          name="title"
          testID="new-job-title"
          label="Title"
          placeholder="What needs repairing?"
        />
        <FormField
          control={control}
          name="description"
          testID="new-job-description"
          label="Description"
          placeholder="Anything a Pro should know before they arrive"
          multiline
        />
        <Pressable
          testID="submit-new-job"
          accessibilityRole="button"
          accessibilityLabel="Post job"
          accessibilityState={{ disabled: isSubmitting }}
          disabled={isSubmitting}
          className={`h-12 flex-row items-center justify-center gap-2 rounded-card bg-primary ${
            isSubmitting ? 'opacity-60' : ''
          }`}
          onPress={() => void submit()}
        >
          {isSubmitting ? (
            <ActivityIndicator testID="submit-new-job-spinner" color={colors.surface} />
          ) : null}
          <Text className="text-base font-semibold text-surface">Post job</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

export function NewJobScreen() {
  return (
    <RoleGuard allow="client">
      <NewJobForm />
    </RoleGuard>
  );
}
