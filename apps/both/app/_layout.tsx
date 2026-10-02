/**
 * The root layout, and the only file that will differ between the three apps once they exist: the
 * Role lock is passed in here. Importing the stylesheet is what loads NativeWind's base layer.
 */
import { Stack } from 'expo-router';
import '../global.css';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
