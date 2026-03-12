import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { Client, TravelMode } from '@googlemaps/google-maps-services-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
const mapsClient = new Client({});

interface DraftPlace {
  name: string;
  address: string;
}

interface DraftItinerary {
  places: DraftPlace[];
}

interface FinalItinerary {
  schedule: Array<{ name: string; address?: string }>;
  travel_times: number;
  feasibility_score: 'Green' | 'Yellow' | 'Red';
  guide_message: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const theme = typeof body.theme === 'string' ? body.theme : 'luxury & nature';
    const durationInput = typeof body.duration === 'string' ? body.duration : '3 days';
    const durationNum = parseInt(durationInput, 10) || 3;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
    }

    // STEP 1: Gemini — draft itinerary (2.5-flash: 무료 등급 한도 사용)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const geminiPrompt = `Create a luxury travel itinerary in Jeju for a ${durationNum}-day trip with a "${theme}" theme. Return strictly a JSON object with a single key "places", which is an array of objects, each with "name" and "address" (full address in Jeju, South Korea). Example: {"places":[{"name":"Seongsan Ilchulbong","address":"284 Ilchul-ro, Seogwipo-si, Jeju-do"}]}. Return only valid JSON, no markdown or code fences.`;
    const geminiResult = await model.generateContent(geminiPrompt);
    const rawText = geminiResult.response.text();
    const cleanedJson = rawText.replace(/```json\s*|\s*```/g, '').trim();
    const draftJson: DraftItinerary = JSON.parse(cleanedJson);
    const places = Array.isArray(draftJson.places) ? draftJson.places : [];
    const addresses = places.map((p: DraftPlace) => p.address).filter(Boolean);

    let totalTravelTimeMins = 0;

    if (addresses.length >= 2 && process.env.GOOGLE_MAPS_API_KEY) {
      // STEP 2: Google Maps Distance Matrix — driving times between consecutive spots
      const distanceResponse = await mapsClient.distancematrix({
        params: {
          origins: addresses.slice(0, -1),
          destinations: addresses.slice(1),
          key: process.env.GOOGLE_MAPS_API_KEY,
          mode: TravelMode.driving,
        },
        timeout: 5000,
      });

      const rows = distanceResponse.data?.rows ?? [];
      for (const row of rows) {
        for (const el of row.elements ?? []) {
          if (el.status === 'OK' && el.duration?.value) {
            totalTravelTimeMins += Math.ceil(el.duration.value / 60);
          }
        }
      }
    }

    // Total tour time: duration in days × 8 active hours (approximate)
    const totalTourTimeMins = durationNum * 8 * 60;
    const ratio = totalTourTimeMins > 0 ? totalTravelTimeMins / totalTourTimeMins : 0;
    const feasibilityScore: 'Green' | 'Yellow' | 'Red' =
      ratio > 0.5 ? 'Red' : ratio > 0.3 ? 'Yellow' : 'Green';

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        schedule: places.map((p) => ({ name: p.name, address: p.address })),
        travel_times: totalTravelTimeMins,
        feasibility_score: feasibilityScore,
        guide_message: `Total drive time: ${totalTravelTimeMins} minutes. ${ratio > 0.5 ? 'Consider reducing stops for a more relaxed pace.' : 'Pace looks comfortable for a luxury experience.'}`,
      } as FinalItinerary);
    }

    // STEP 3: Claude 3.5 Sonnet — review and final message
    const claudePrompt = `You are a professional luxury travel guide for Atockorea. Review this drafted Jeju itinerary:

Draft: ${JSON.stringify({ places })}
Total travel time (driving): ${totalTravelTimeMins} minutes.
Total tour time (approx. active hours): ${totalTourTimeMins} minutes.
Ratio (travel / tour): ${(ratio * 100).toFixed(0)}%.

${ratio > 0.5 ? 'This is a "Tired Schedule" — too much time on the road. Suggest which 1–2 stops to remove to optimize comfort and enjoyment.' : 'The pace is acceptable. Add a brief, elegant 1–2 sentence guide message.'}

Respond with a single JSON object only, no markdown or code fences. Use this exact structure:
{"schedule": [{"name":"Place Name","address":"Full Address"}], "travel_times": ${totalTravelTimeMins}, "feasibility_score": "${feasibilityScore}", "guide_message": "Your professional, luxury-tone message here."}
Keep "schedule" as the same places array (you may shorten it if suggesting removals). "guide_message" must be a short, refined sentence suitable for a high-end travel platform.`;

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: claudePrompt }],
    });

    const firstBlock = claudeResponse.content[0];
    const text =
      firstBlock && typeof firstBlock === 'object' && 'text' in firstBlock
        ? (firstBlock as { text: string }).text
        : '';
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const jsonStr = jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd) : '{}';
    const finalItinerary: FinalItinerary = JSON.parse(jsonStr);

    return NextResponse.json(finalItinerary);
  } catch (error) {
    console.error('Pipeline Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate itinerary.' },
      { status: 500 }
    );
  }
}
