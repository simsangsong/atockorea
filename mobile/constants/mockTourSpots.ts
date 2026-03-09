/**
 * Mock tour spots for the audio guide feature.
 * In production, replace with API data or local JSON.
 */

export interface TourSpot {
  id: string;
  title: string;
  description: string;
  /** URL to MP3 audio file (dummy links for demo; replace with real CDN URLs) */
  audioUrl: string;
  latitude: number;
  longitude: number;
  /** Radius in meters; when user enters this range, the spot's audio auto-plays */
  triggerRadius: number;
}

/** Dummy MP3 URLs - use short public demo audio or replace with your CDN */
const DEMO_MP3 =
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

export const MOCK_TOUR_SPOTS: TourSpot[] = [
  {
    id: '1',
    title: 'Gyeongbokgung Palace Gate',
    description: 'The main gate of Gyeongbokgung, the largest of the Five Grand Palaces built during the Joseon Dynasty.',
    audioUrl: DEMO_MP3,
    latitude: 37.5796,
    longitude: 126.977,
    triggerRadius: 80,
  },
  {
    id: '2',
    title: 'Bukchon Hanok Village',
    description: 'A traditional Korean village with well-preserved hanok houses, offering a glimpse of old Seoul.',
    audioUrl: DEMO_MP3,
    latitude: 37.5822,
    longitude: 126.9854,
    triggerRadius: 60,
  },
  {
    id: '3',
    title: 'Insadong Cultural Street',
    description: 'A street known for traditional tea houses, galleries, and handicrafts in the heart of Seoul.',
    audioUrl: DEMO_MP3,
    latitude: 37.5745,
    longitude: 126.9859,
    triggerRadius: 70,
  },
  {
    id: '4',
    title: 'Jogyesa Temple',
    description: 'The chief temple of the Jogye Order of Korean Buddhism, located in the center of Seoul.',
    audioUrl: DEMO_MP3,
    latitude: 37.5744,
    longitude: 126.9929,
    triggerRadius: 50,
  },
  {
    id: '5',
    title: 'Cheonggyecheon Stream',
    description: 'A modern public recreation space built over a restored stream that runs through downtown Seoul.',
    audioUrl: DEMO_MP3,
    latitude: 37.5698,
    longitude: 126.9769,
    triggerRadius: 100,
  },
];
