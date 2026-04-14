import type {
  SmallGroupAfterBookingStep,
  SmallGroupAtAGlanceCard,
  SmallGroupBestForLine,
  SmallGroupEditorialDetail,
  SmallGroupFaqItem,
  SmallGroupFlowAdjustment,
  SmallGroupFlowReason,
  SmallGroupRelatedTourCard,
  SmallGroupRouteStop,
  SmallGroupTrustPoint,
  SmallGroupTrustReview,
} from '../smallGroupDetailContent';

/** Hero fallback when tour gallery is empty — matches Detailpage reference. */
export const EAST_DETAILPAGE_HERO_IMAGE =
  'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1400&q=85';

/** Geology-to-coast East route (itinerary cards): Stone Park → Micheongul → Seongeup → Seongsan → Seopjikoji. Lunch is operational only (not a card). */
export const EAST_DETAILPAGE_ROUTE_STOPS: SmallGroupRouteStop[] = [
  {
    id: 'stone',
    title: 'Jeju Stone Park',
    displayTime: '09:00',
    sequenceLabel: 'First Stop',
    highlightLabel: 'Geology & Stone Culture',
    cardSummary:
      "This is where the day begins to make sense. Stone Park gives the group a clear introduction to Jeju's volcanic identity before the route opens into coast, crater, cave, and village landscapes.",
    cardFacts: ['60 min', 'Easy to moderate walking', 'Opens the route with geology context'],
    description:
      "This is where the day begins to make sense. Stone Park gives the group a clear introduction to Jeju's volcanic identity before the route opens into coast, crater, cave, and village landscapes.",
    whyIncluded:
      'Starting here gives the later coastal, crater, and lava-tube stops a clearer frame.',
    stayDuration: '60 min',
    walkingLevel: 'Easy to moderate',
    photoTip: 'Wide compositions work better here than tight close-ups.',
    restroom: 'Entrance and museum area',
    weatherNote: '',
    delayNote: '',
    tags: ['Stone rows', 'Museum', 'Geology'],
    imageUrl: 'https://images.unsplash.com/photo-1544077960-604201fe74bc?w=800&q=85',
    detailLayer: {
      detailIntro:
        "This is where the day begins to make sense. Stone Park gives the group a clear introduction to Jeju's volcanic identity before the route opens into coast, crater, cave, and village landscapes.",
      highlights: [
        'Stone figures, towers, and wide open grounds',
        "Strong introduction to Jeju's stone culture",
        'Clean photo zones with broad visual spacing',
        'Indoor museum elements that deepen the geology story',
      ],
      experienceFlow: [
        'Short orientation walk through the main stone zone',
        'Photo and explanation time around the open stone fields',
        'Museum section or closing interpretation before departure',
      ],
      routeReason:
        'Starting here gives the later coastal, crater, and lava-tube stops a clearer frame.',
      practicalDetails: {
        officialHours: '09:00–18:00',
        holiday: 'Mondays',
        fee: 'Adults 5,000 / Teens 3,500 KRW',
        restroom: 'Entrance and museum area',
        parking: 'Available',
      },
      photoDetails: 'Wide compositions work better here than tight close-ups.',
      facilityDetails: 'Clean restroom and museum support in the early part of the route.',
      smartTip: 'This stop works best as a calm opener, not a rushed photo stop.',
      commonReaction:
        'Guests often expect a simple photo stop, but the museum makes the stop feel more substantial than expected.',
      skipNote:
        'If a guest dislikes museums, keep this stop visually led and avoid making the explanation too long.',
      weatherNote: 'Good early stop on warm or drizzly days because the museum gives shelter.',
      delayNote: 'Easy stop to trim by 15–20 minutes if traffic or late pickup affects the morning.',
    },
  },
  {
    id: 'micheongul',
    title: 'Ilchulland (Micheongul Cave)',
    displayTime: '10:35',
    sequenceLabel: 'Second Stop',
    highlightLabel: 'Lava Tube Interior',
    cardSummary:
      'A cave-centered stop that shifts the route from above-ground geology into a real lava-tube environment.',
    cardFacts: ['Stay 55–70 min', 'Moderate walking', 'Cooler and dimmer than the rest of the route'],
    description:
      'A cave-centered stop that shifts the route from above-ground geology into a real lava-tube environment.',
    whyIncluded:
      'Putting the cave right after Stone Park keeps the geology story tight before the route shifts into cultural and coastal stops.',
    stayDuration: '55–70 min',
    walkingLevel: 'Moderate walking',
    photoTip: '',
    restroom: '',
    weatherNote: '',
    delayNote: '',
    tags: ['Lava cave', 'Cool interior', 'Weather buffer'],
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=85',
    detailLayer: {
      detailIntro:
        'Micheongul is the underground counterpart to Stone Park. Instead of talking about Jeju\'s volcanic formation only in theory, this stop lets guests feel the cooler air, darker rock, and tunnel-like space directly.',
      highlights: [
        'Visitor-accessible lava-tube experience',
        'Cool interior compared with the open coast',
        'Dark basalt textures and cave-like tunnel atmosphere',
        'Useful contrast to the museum and village stops',
      ],
      experienceFlow: [
        'Enter through the main Ilchulland grounds',
        'Focus on the cave as the core experience',
        'Keep surrounding garden areas secondary unless time is generous',
      ],
      routeReason:
        'Putting the cave right after Stone Park keeps the geology story tight before the route shifts into cultural and coastal stops.',
      practicalDetails: {
        officialHours: '08:30–18:00',
        holiday: 'Open all year round',
        fee: 'Adults 9,000 KRW / Teenagers 6,000 KRW / Children 5,000 KRW / Seniors 8,000 KRW',
        restroom: 'Available near the main facilities',
        parking: 'Available / free',
      },
      photoDetails:
        'This is not a bright selfie stop. The strongest photos are texture-based or taken near the entrance/transition zones rather than in the darkest interior.',
      facilityDetails: 'Good stop for heat or light rain because it is cooler and more sheltered than the later coast.',
      smartTip:
        'Strollers, slippery soles, and guests who dislike dim cave spaces should be briefed before entering.',
      commonReaction: 'Guests usually spend less time taking photos here but remember the atmosphere well afterward.',
      skipNote:
        'If someone is uneasy with cave interiors, keep the visit short and use it as a focused walkthrough rather than a slow linger.',
      weatherNote: 'Very useful in summer heat and workable in wet weather.',
      delayNote: 'If time is tight, use the cave as the main stop and reduce time in the surrounding grounds.',
    },
  },
  {
    id: 'seongeup',
    title: 'Seongeup Folk Village',
    displayTime: '12:05',
    sequenceLabel: 'Third Stop',
    highlightLabel: 'Village Texture',
    cardSummary:
      'Thatched roofs, lava-stone walls, and traditional village layout add human texture between the geology stops and the coast.',
    cardFacts: ['Stay 35–50 min', 'Low to moderate walking', 'Free entry'],
    description:
      'Thatched roofs, lava-stone walls, and traditional village layout add human texture between the geology stops and the coast.',
    whyIncluded: 'This is the bridge stop of the route: geology first, then lived culture, then the coast.',
    stayDuration: '35–50 min',
    walkingLevel: 'Low to moderate walking',
    photoTip: '',
    restroom: '',
    weatherNote: '',
    delayNote: '',
    tags: ['Stone walls', 'Thatched roofs', 'Culture'],
    imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=85',
    detailLayer: {
      detailIntro:
        'This stop is less about one big landmark and more about how old Jeju settlements were actually built. It helps the route shift from geology into lived island culture.',
      highlights: [
        'Thatched-roof houses',
        'Black lava-stone walls built for local wind conditions',
        'Traditional village layout and preserved house forms',
        'A stop that adds human scale after the museum-and-cave morning',
      ],
      experienceFlow: [
        'Short guided walk through the village core',
        'Focus on roofs, walls, and layout rather than trying to cover every corner',
        'Keep the stop tight before lunch and the Seongsan block',
      ],
      routeReason: 'This is the bridge stop of the route: geology first, then lived culture, then the coast.',
      practicalDetails: {
        officialHours: '10:00–17:00',
        holiday: 'Open all year round',
        fee: 'Free (except some hands-on programs)',
        restroom: 'Available',
        parking: 'Available / free',
        officialAverageTime: '30 min',
      },
      photoDetails:
        'The better shots are usually wall-and-roof textures, not wide empty-ground photos. Look for side angles where the wall lines and roof shapes overlap.',
      facilityDetails: 'Usually easier than the coast in terms of wind and fatigue.',
      smartTip: 'Do not overstay here if the group plans to take the Seongsan summit route later.',
      commonReaction:
        'Guests who expect a quick pass-through often engage more once the guide explains why Jeju walls and roofs look different from mainland villages.',
      skipNote:
        'If a group is highly scenic-view oriented and low on time, keep this as a focused texture stop rather than a long culture lecture.',
      weatherNote: 'More comfortable than the open coast when wind is strong.',
      delayNote: 'Easy stop to keep concise if the afternoon needs more buffer.',
    },
  },
  {
    id: 'seongsan',
    title: 'Seongsan Ilchulbong',
    displayTime: '14:20',
    sequenceLabel: 'Fourth Stop',
    highlightLabel: 'Crater & Route Choice',
    cardSummary:
      'The day\'s main decision stop: easier free coastal path on one side, paid summit stairs on the other.',
    cardFacts: ['Stay 70–90 min', 'Free side / paid summit', 'Main walking variable of the route'],
    description:
      'The day\'s main decision stop: easier free coastal path on one side, paid summit stairs on the other.',
    whyIncluded:
      'This belongs after lunch because guests need fresher legs here than at any other point in the route.',
    stayDuration: '70–90 min',
    walkingLevel: 'Free side / paid summit',
    photoTip: '',
    restroom: '',
    weatherNote: '',
    delayNote: '',
    tags: ['Crater', 'Free vs paid', 'UNESCO'],
    imageUrl: 'https://images.unsplash.com/photo-1551845041-63e8e76836ea?w=800&q=85',
    detailLayer: {
      detailIntro:
        'This stop works best when guests understand before walking that there are two different experiences here, not one. The easier free section is better for a sea-level stroll; the paid route is for the crater-top viewpoint.',
      highlights: [
        'Tuff cone formed by an underwater eruption',
        'Crater around 600 m wide and 90 m deep',
        'Summit view over the crater and sea toward Udo',
        'Separate free and paid walking sections',
      ],
      experienceFlow: [
        'Free section: gentler coastal-side walk',
        'Paid section: summit route with stairs',
        'Summit climb usually feels like the hardest walking point of the day',
      ],
      routeReason:
        'This belongs after lunch because guests need fresher legs here than at any other point in the route.',
      practicalDetails: {
        officialHours:
          'Mar–Apr / Sep–Oct 05:00–19:00, May–Aug 04:30–20:00, Nov–Feb 06:00–18:00',
        lastTicketing: '1 hour before closing',
        holiday: 'First Monday of every month',
        fee: 'Adults 5,000 KRW / Teenagers & Children 2,500 KRW',
        restroom: 'Available',
        parking: 'Available / free',
      },
      photoDetails:
        'Use the summit for crater structure. Use the easier side for shoreline, black rock, and sea-level context.',
      facilityDetails:
        'Good parking and restroom support, but this is still one of the most wind-exposed points of the route.',
      smartTip:
        'Do not promise a fixed haenyeo show time on the public page. Treat it as a weather- and season-dependent bonus near the Seongsan area, not a guaranteed schedule item.',
      commonReaction:
        'Guests often underestimate the summit stairs and overestimate how much of both sides they can cover comfortably in one stop.',
      skipNote:
        'For seniors, families with tired kids, or windy days, the easier side is often the better experience.',
      weatherNote: 'Strong wind changes the feel of this stop more than the posted climb time suggests.',
      delayNote: 'If the group chooses the summit, keep the next stop tighter.',
    },
  },
  {
    id: 'seopjikoji',
    title: 'Seopjikoji',
    displayTime: '16:10',
    sequenceLabel: 'Fifth Stop',
    highlightLabel: 'Open Ridge Coastline',
    cardSummary:
      'A ridge-style coastal walk with lighthouse line, exposed sea edge, and black rock formations below.',
    cardFacts: ['Stay 40–55 min', 'Moderate walking', 'Free entry'],
    description:
      'A ridge-style coastal walk with lighthouse line, exposed sea edge, and black rock formations below.',
    whyIncluded:
      'This works best after Seongsan because both belong to the same eastern coastal block and should not be split apart by backtracking.',
    stayDuration: '40–55 min',
    walkingLevel: 'Moderate walking',
    photoTip: '',
    restroom: '',
    weatherNote: '',
    delayNote: '',
    tags: ['Lighthouse', 'Ridge walk', 'Coast'],
    imageUrl: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=800&q=85',
    detailLayer: {
      detailIntro:
        'Seopjikoji is best treated as an open coastal walk, not just a viewpoint. After Seongsan, this stop gives the route one final exposed coastline section without adding another ticketed climb.',
      highlights: [
        'White lighthouse on the ridge',
        'Open sea-facing walking line',
        'Black volcanic rock along the edge',
        'Clear contrast with the crater-focused Seongsan stop',
      ],
      experienceFlow: [
        'Start from the main access area',
        'Walk the ridge far enough to open the coastal line',
        'Decide on a shorter or longer linger based on what the group already used at Seongsan',
      ],
      routeReason:
        'This works best after Seongsan because both belong to the same eastern coastal block and should not be split apart by backtracking.',
      practicalDetails: {
        officialHours: 'Open 24 hr',
        holiday: 'Open all year round',
        fee: 'Free',
        restroom: 'Available',
        parking: 'Available',
      },
      photoDetails:
        'The strongest frame is usually not directly beside the lighthouse. Step back enough to include the walking line, slope, and sea edge together.',
      facilityDetails: 'Simple and easy stop operationally, but very exposed to wind.',
      smartTip:
        'If Seongsan already used the group\'s energy, do a focused ridge walk here instead of forcing a long coastal linger.',
      commonReaction:
        'Guests often enjoy this more when it is presented as a final coastal stretch rather than as a second \'big attraction\' competing with Seongsan.',
      skipNote: 'On very windy days, shorten the walk and keep it as a concise photo-and-view stop.',
      weatherNote: 'Wind matters more here than heat.',
      delayNote: 'This is the easiest stop to compress if the route is running late after Seongsan.',
    },
  },
];

const AT_A_GLANCE: SmallGroupAtAGlanceCard[] = [
  {
    id: 'photo',
    label: 'Photo Value',
    value: 'High',
    detail: 'Stone, cave, village, crater, and ridge each give a different frame.',
    rating: 5,
    icon: 'camera',
  },
  {
    id: 'scenic',
    label: 'Scenic',
    value: 'High',
    detail: 'Geology, cave, village texture, crater, and open east coast in one route.',
    rating: 5,
    icon: 'compass',
  },
  {
    id: 'walk',
    label: 'Walking',
    value: 'Moderate',
    detail: 'Seongsan is the variable stop: easier free side or paid summit stairs.',
    rating: 3,
    icon: 'footprints',
  },
  {
    id: 'rain',
    label: 'Rain Safety',
    value: 'Medium',
    detail: 'Morning has museum and cave; the two final coast stops stay exposed.',
    rating: 3,
    icon: 'cloudSun',
  },
  {
    id: 'family',
    label: 'Family Fit',
    value: 'Good',
    detail: 'Smoothest for ages 8+; cave and summit choice matter for younger kids.',
    rating: 4,
    icon: 'users',
  },
  {
    id: 'outdoor',
    label: 'Balance',
    value: 'Mixed',
    detail: 'Museum and cave anchor the first half; the route shifts outdoors after.',
    rating: 4,
    icon: 'treePine',
  },
];

const BEST_IDEAL: SmallGroupBestForLine[] = [
  {
    text: 'First-time visitors, couples, adult families',
    detail: 'Guests who want East Jeju to read as one connected route',
  },
  {
    text: 'Travelers who like geology and context',
    detail: 'Stone Park, Micheongul, and Seongsan land better with explanation',
  },
  {
    text: 'Guests okay with a decision stop at Seongsan',
    detail: 'Free coastal side or paid summit depending on pace and wind',
  },
  {
    text: 'Active seniors',
    detail: 'Often best when Seongsan uses the easier coastal side',
  },
];

const BEST_NOT: SmallGroupBestForLine[] = [
  {
    text: 'Guests avoiding stairs or cave interiors',
    detail: 'Micheongul is cave-like; summit stairs are optional but real',
  },
  {
    text: 'Stroller-heavy or very young children',
    detail: 'Older kids and lighter gear make the day easier',
  },
  {
    text: 'Slow café-first itineraries',
    detail: 'This route is landmark- and pacing-driven',
  },
];

const FLOW_REASONS: SmallGroupFlowReason[] = [
  {
    id: 'fr1',
    icon: 'sun',
    title: 'Morning Context First',
    summary: 'Stone Park explains Jeju before the route becomes coast-heavy',
    description: 'The route feels more coherent when the island\'s formation and stone culture come first.',
  },
  {
    id: 'fr2',
    icon: 'mapPin',
    title: 'Museum to Cave Logic',
    summary: 'Stone Park and Micheongul form the clearest morning pair',
    description:
      'One explains Jeju above ground, the other lets guests feel a lava-tube environment directly.',
  },
  {
    id: 'fr3',
    icon: 'mapPin',
    title: 'Village as the Transition Stop',
    summary: 'Seongeup changes the route from geology into lived culture',
    description: 'It keeps the middle of the day from becoming too repetitive before the big coastal block.',
  },
  {
    id: 'fr4',
    icon: 'utensils',
    title: 'Lunch Before the Decision Stop',
    summary: 'Energy matters more at Seongsan than anywhere else',
    description: 'Lunch usually belongs before Seongsan, even if it is not shown as an itinerary card.',
  },
  {
    id: 'fr5',
    icon: 'sunset',
    title: 'Crater Then Ridge',
    summary: 'Seongsan first, Seopjikoji after',
    description:
      'That order lets the group use its energy where the route choice matters most and end with a simpler coastal walk.',
  },
];

const FLOW_ADJUSTMENTS: SmallGroupFlowAdjustment[] = [
  {
    id: 'fa1',
    icon: 'cloudRain',
    title: 'Public Closure Days',
    description: 'Stone Park closes on Mondays, and Seongsan Ilchulbong closes on the first Monday of each month.',
  },
  {
    id: 'fa2',
    icon: 'wind',
    title: 'Wind Conditions',
    description: 'Wind affects Seongsan and Seopjikoji far more than the earlier stops.',
  },
  {
    id: 'fa3',
    icon: 'users',
    title: 'Crowding',
    description: 'Seongsan is the stop most likely to need tighter time control on busy days.',
  },
  {
    id: 'fa4',
    icon: 'mapPin',
    title: 'Walking Balance',
    description:
      'If the group uses the paid Seongsan summit route, Seopjikoji should usually be run more efficiently afterward.',
  },
];

const TRUST_POINTS: SmallGroupTrustPoint[] = [
  {
    id: 'tp1',
    title: 'Licensed local operation',
    description: 'Jeju-licensed guiding and vehicles—routing built for this coast, not generic lists.',
  },
  {
    id: 'tp2',
    title: 'Experienced route handling',
    description: 'Pacing and walking balance tuned to how this east route actually runs.',
  },
  {
    id: 'tp3',
    title: 'Small-group comfort',
    description: 'Capped at eight guests so the day stays readable and calm.',
  },
];

const TRUST_REVIEWS: SmallGroupTrustReview[] = [];

const AFTER_STEPS: SmallGroupAfterBookingStep[] = [
  {
    id: 'ab1',
    title: 'Instant Confirmation',
    timing: 'Immediately',
    description:
      'Booking confirmation email with the route summary and contact details.',
    detail: 'Keep this for your booking reference and support information.',
  },
  {
    id: 'ab2',
    title: '12-Hour Reminder',
    timing: '12 hours before',
    description: 'WhatsApp message with final pickup time and weather notes.',
    detail: 'We also note any route handling changes if conditions matter.',
  },
  {
    id: 'ab3',
    title: 'Final Pickup Guide',
    timing: 'Evening before',
    description: 'Vehicle description and clear pickup instructions.',
    detail: 'Useful when multiple pickups are coordinated on a small-group morning.',
  },
  {
    id: 'ab4',
    title: 'Day-Of Route Notes',
    timing: 'Morning of tour',
    description: 'A practical summary of the day\'s flow and Seongsan route expectations.',
    detail: 'This helps guests prepare shoes, pace, and expectations.',
  },
  {
    id: 'ab5',
    title: 'Stop-by-Stop Tips',
    timing: 'During tour',
    description: 'Your guide shares the details that matter at each stop.',
    detail: 'Especially useful at Stone Park, Micheongul, and Seongsan.',
  },
  {
    id: 'ab6',
    title: 'Post-Tour Support',
    timing: 'After tour',
    description: 'Need dinner suggestions or next-day ideas? We can still help.',
    detail: 'Our WhatsApp remains open for follow-up questions.',
  },
];

/** Primary stack uses `decisionRank` 1–5; remaining rows surface under “More questions”. */
const DETAILPAGE_FAQS: SmallGroupFaqItem[] = [
  {
    decisionRank: 1,
    question: 'Is this East Jeju route good for first-time visitors?',
    answer:
      'Yes. The day is structured so geology and village context land before the big coastal stops—ideal when Jeju is new and you want one coherent east-coast story, not a random checklist.',
  },
  {
    decisionRank: 2,
    question: 'Is the walking difficult?',
    answer:
      'Most of the route is moderate. Seongsan is the main variable: the paid summit stairs are the hardest stretch if you choose them; the free coastal side is much lighter. Micheongul is darker and a bit uneven underfoot but short.',
  },
  {
    decisionRank: 3,
    question: 'Can the tour still run if it rains?',
    answer:
      'Usually yes. The morning half stays more usable thanks to indoor and cave time; exposed coastal sections may be shortened or adjusted if wind and conditions demand it.',
  },
  {
    decisionRank: 4,
    question: 'Is this okay for families and seniors?',
    answer:
      'Often a strong fit for older children and active seniors—especially when Seongsan is handled via the easier side. Stroller-heavy groups or guests avoiding stairs and caves may find the day tight.',
  },
  {
    decisionRank: 5,
    question: 'Is lunch included—and how does pickup work?',
    answer:
      'Lunch is not included in the rate; we usually place it between Seongeup and Seongsan so the group reaches the main walking choice with better energy. Pickup is hotel-lobby style in the Jeju City area, typically between 8:20–9:00 AM depending on where you stay—exact timing is confirmed before the day.',
  },
  {
    question: 'What time does the tour start and end?',
    answer:
      'Pickup is usually between 8:20–9:00 AM depending on guest area, and return time depends on traffic and the final coastal stop.',
  },
  {
    question: 'Does this exact route run every day?',
    answer:
      'Not always. Stone Park is closed on Mondays, and Seongsan Ilchulbong is closed on the first Monday of each month.',
  },
  {
    question: 'Is the Seongsan summit climb mandatory?',
    answer: 'No. Seongsan can be handled via the easier free side or the paid summit route.',
  },
  {
    question: 'How hard is Seongsan Ilchulbong?',
    answer:
      'It is the hardest walking point of the day if guests choose the paid summit stairs. The easier side is much lighter.',
  },
  {
    question: 'Can we see the haenyeo performance at Seongsan?',
    answer:
      'Treat it as a variable bonus, not a fixed promise. Seongsan-area haenyeo activity depends on season and weather conditions.',
  },
  {
    question: 'Is Micheongul Cave difficult?',
    answer:
      'It is manageable for most guests, but darker and slightly more uneven than a normal museum path.',
  },
];

const RELATED_RICH: SmallGroupRelatedTourCard[] = [
  {
    id: 'rel1',
    title: 'East Nature + Cafe Relax',
    href: '/tours',
    subtitle: 'Forest and cave balance with a softer, café-weighted finish—built for relaxed pacing.',
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=85',
    duration: '8h',
    stopCount: 6,
    difficulty: 'Easy–Moderate',
    badge: 'Relaxed pacing',
  },
  {
    id: 'rel2',
    title: 'East Family & Rain-Safe',
    href: '/tours',
    subtitle: 'Indoor-forward mornings when weather turns; coastal finales when conditions allow.',
    imageUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=85',
    duration: '8h',
    stopCount: 5,
    difficulty: 'Easy',
    badge: 'Rain-safer',
  },
  {
    id: 'rel3',
    title: 'East Signature Coast Focus',
    href: '/tours',
    subtitle: 'Scenic east highlights with more sea time and a lighter geology load on the day.',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=85',
    duration: '8h',
    stopCount: 5,
    difficulty: 'Moderate',
    badge: 'Coast-first',
  },
];

export function getEastSignatureDetailPageEditorial(): SmallGroupEditorialDetail {
  return {
    heroEyebrow: 'Signature Collection',
    routePreviewLine:
      'Stone Park — Micheongul Cave — Seongeup Folk Village — Seongsan Ilchulbong — Seopjikoji',
    ratingLine: '',
    atAGlance: AT_A_GLANCE,
    bestForIdeal: BEST_IDEAL,
    bestForNotIdeal: BEST_NOT,
    flowReasons: FLOW_REASONS,
    flowAdjustments: FLOW_ADJUSTMENTS,
    trustPoints: TRUST_POINTS,
    trustReviews: TRUST_REVIEWS,
    afterBookingSteps: AFTER_STEPS,
  };
}

export function getEastDetailPageFaqs(): SmallGroupFaqItem[] {
  return DETAILPAGE_FAQS;
}

export function getEastDetailPageRelatedTours(): SmallGroupRelatedTourCard[] {
  return RELATED_RICH;
}

export function mapAfterStepsToSupportItems(steps: SmallGroupAfterBookingStep[]) {
  return steps.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    timing: s.timing,
    detail: s.detail,
  }));
}
