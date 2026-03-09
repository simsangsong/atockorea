import { Stack } from 'expo-router';

export default function TourLayout() {
  return (
    <Stack>
      <Stack.Screen name="[id]" options={{ title: 'Tour' }} />
    </Stack>
  );
}
