/**
 * New job — a placeholder, and the route the `+` on posted jobs pushes.
 *
 * It is here rather than left for `#8` because typed routes make it the difference between a `+` that
 * works and one that does not compile: `expo-router` generates its `Href` union from the files under
 * `app/`, so `router.push('/job/new')` is a type error until the route exists, and a cast to make it
 * pass would be a lie that survives into the ticket that fixes it. Same reasoning as the two tab
 * placeholders — a route has to land somewhere to be a route.
 *
 * **`#8` — "A Client posts a job and it appears as open" — owns everything below the header**: the form,
 * the validation, the mutation, and the `RoleGuard allow="client"` wrap that `DECISIONS.md` records as
 * this component's pending second use of the guard.
 */
import { Text, View } from 'react-native';
import { HeaderBand, Screen } from '@repairs/ui';

export function NewJobScreen() {
  return (
    <Screen>
      <HeaderBand title="Post a job" />
      <View className="px-5 py-6">
        <Text className="text-base leading-6 text-slate">
          The form for posting a job will appear here.
        </Text>
      </View>
    </Screen>
  );
}
