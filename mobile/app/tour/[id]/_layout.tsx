import { Stack } from 'expo-router';

export default function TourIdLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Tour' }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
    </Stack>
  );
}
