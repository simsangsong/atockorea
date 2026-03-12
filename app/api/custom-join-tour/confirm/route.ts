import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { CUSTOM_JOIN_TOUR, getCustomJoinTourPricing } from '@/lib/constants/custom-join-tour';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

export interface SchedulePlace {
  name: string;
  address: string;
}

export interface DaySchedule {
  day: number;
  places: SchedulePlace[];
}

export interface CustomJoinTourConfirmRequest {
  schedule: DaySchedule[];
  numberOfParticipants: number;
}

export interface CustomJoinTourConfirmResponse {
  success: boolean;
  guideMessage: string;
  /** 제주에서 하루에 동·서 양쪽 방문 시 true */
  jejuCrossRegion: boolean;
  /** 추가 요금 (원). 동서 양쪽 방문 시 70,000원 */
  jejuCrossRegionExtraFeeKrw: number | null;
  /** 당일 가이드에게 현금 지불 안내 문구 */
  jejuCrossRegionNotice: string | null;
  pricing: ReturnType<typeof getCustomJoinTourPricing> | null;
}

const EXTRA_FEE = CUSTOM_JOIN_TOUR.JEJU_CROSS_REGION_EXTRA_FEE_KRW;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CustomJoinTourConfirmRequest;
    const schedule = Array.isArray(body.schedule) ? body.schedule : [];
    const numberOfParticipants = Number(body.numberOfParticipants) || 0;

    if (schedule.length === 0) {
      return NextResponse.json({ error: 'Schedule is required.' }, { status: 400 });
    }
    if (
      numberOfParticipants < CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS ||
      numberOfParticipants > CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS
    ) {
      return NextResponse.json(
        { error: `참가 인원은 ${CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS}~${CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS}명으로 입력해 주세요.` },
        { status: 400 }
      );
    }

    let guideMessage = '일정이 확정되었습니다. 즐거운 여행 되세요.';
    let jejuCrossRegion = false;
    let jejuCrossRegionNotice: string | null = null;

    if (process.env.ANTHROPIC_API_KEY) {
      const claudePrompt = `You are a professional travel guide for Atockorea (Korea tours).

FINAL REVIEW TASK:
1. Review this confirmed itinerary for accuracy and completeness. Reply with a short, professional confirmation message in Korean (1-2 sentences) for "guideMessage".
2. JEJU RULE: In Jeju, you CANNOT do East and West on the same day (too far). West + South (or Southwest) CAN be on the same day.
   - For each day, if places are in Jeju and the day has BOTH east-area AND west-area places (e.g. Seongsan + Hallim on same day), set "jejuCrossRegion": true. West + South same day is OK—do not set jejuCrossRegion for that.
   - East: 성산, Seongsan, 동부, east, 성산일출봉, 우도. West: 한림, Hallim, 애월, Aewol, 서부, west. South: 서귀포, Seogwipo, 남부, south.
   - If jejuCrossRegion is true, set "jejuCrossRegionNotice" to a short Korean message: this day crosses East and West so an extra fee of 70,000 KRW applies, payable in cash to the guide on the day (당일 가이드에게 현금으로 지불).

Return ONLY a valid JSON object, no markdown or code fences. Use this exact structure:
{"guideMessage": "your confirmation message in Korean", "jejuCrossRegion": false or true, "jejuCrossRegionNotice": null or "당일 동·서 양쪽 방문으로 추가 요금 70,000원이 발생하며, 당일 가이드에게 현금으로 지불해 주시기 바랍니다."}

Itinerary to review:
${JSON.stringify(schedule, null, 2)}`;

      try {
        const res = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: claudePrompt }],
        });
        const firstBlock = res.content[0];
        const text =
          firstBlock && typeof firstBlock === 'object' && 'text' in firstBlock
            ? (firstBlock as { text: string }).text
            : '';
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const parsed = JSON.parse(text.slice(jsonStart, jsonEnd)) as {
            guideMessage?: string;
            jejuCrossRegion?: boolean;
            jejuCrossRegionNotice?: string | null;
          };
          if (typeof parsed.guideMessage === 'string') guideMessage = parsed.guideMessage;
          if (typeof parsed.jejuCrossRegion === 'boolean') jejuCrossRegion = parsed.jejuCrossRegion;
          if (parsed.jejuCrossRegionNotice != null) jejuCrossRegionNotice = parsed.jejuCrossRegionNotice;
        }
      } catch (e) {
        console.error('Claude confirm review error:', e);
      }
    }

    if (jejuCrossRegion && !jejuCrossRegionNotice) {
      jejuCrossRegionNotice = `제주도에서 하루에 동쪽·서쪽 양쪽을 방문하시는 경우 추가 요금 ${(EXTRA_FEE / 10000).toFixed(0)}만 원이 발생합니다. 당일 가이드에게 현금으로 지불해 주시기 바랍니다.`;
    }

    const pricing = getCustomJoinTourPricing(numberOfParticipants);

    const response: CustomJoinTourConfirmResponse = {
      success: true,
      guideMessage,
      jejuCrossRegion,
      jejuCrossRegionExtraFeeKrw: jejuCrossRegion ? EXTRA_FEE : null,
      jejuCrossRegionNotice,
      pricing,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Custom join tour confirm error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm itinerary.' },
      { status: 500 }
    );
  }
}
