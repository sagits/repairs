/**
 * One field: its label, its input and the line that carries its message.
 *
 * It lived inside `NewJobScreen.tsx` until the login form arrived, on the recorded argument that a field
 * component in the design system would be `@repairs/ui`'s first dependency on React Hook Form acquired
 * for a single consumer. There are two consumers now, and the same entry named this as the move — so the
 * dependency is here, as a peer, and the error treatment is one declaration again rather than two that
 * drift. `DECISIONS.md` supersedes the old entry rather than deleting it.
 *
 * It is generic over the form's values because the two forms have nothing in common but their shape:
 * `Control<NewJobInput>` would have made this a new-job component living in the wrong package.
 *
 * `Controller` rather than `register`, because React Native has no DOM refs for `register` to attach to.
 *
 * `testID` is a prop rather than derived from `name`: the ids are what the Detox specs drive, and two
 * forms both minting `field-${name}` would collide the moment they shared a field name.
 */
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../tokens';

export function FormField<TValues extends FieldValues>({
  control,
  name,
  testID,
  label,
  placeholder,
  multiline,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
}: {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  testID: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-ink">{label}</Text>
          <TextInput
            testID={testID}
            accessibilityLabel={label}
            value={(field.value as string | undefined) ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={placeholder}
            placeholderTextColor={colors.inkMuted}
            multiline={multiline}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            className={`rounded-card border bg-surface px-4 py-3 text-base text-ink ${
              fieldState.error ? 'border-danger' : 'border-border'
            } ${multiline ? 'h-28' : ''}`}
            style={multiline ? { textAlignVertical: 'top' } : undefined}
          />
          {fieldState.error ? (
            <Text testID={`${testID}-error`} className="text-sm leading-5 text-danger">
              {fieldState.error.message}
            </Text>
          ) : null}
        </View>
      )}
    />
  );
}
