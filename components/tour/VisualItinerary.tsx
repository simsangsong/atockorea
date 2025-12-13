'use client';

interface ItineraryItem {
  time: string;
  title: string;
  description: string;
  icon?: string;
}

interface VisualItineraryProps {
  items: ItineraryItem[];
}

export default function VisualItinerary({ items }: VisualItineraryProps) {
  if (!items || items.length === 0) {
    return null;
  }

  // Color palette for timeline dots: Blue and Orange variations
  const dotColors = [
    'bg-blue-500',
    'bg-blue-600',
    'bg-orange-500',
    'bg-orange-600',
    'bg-blue-400',
  ];

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 p-6 fade-in-delay-2">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Itinerary</h2>
      <div className="relative">
        {/* Vertical Timeline Line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 via-blue-400 to-orange-400" />

        <div className="space-y-6">
          {items.map((item, index) => {
            const colorClass = dotColors[index % dotColors.length];
            return (
              <div key={index} className="relative flex gap-4 pl-8">
                {/* Timeline Dot with varied colors */}
                <div className={`absolute left-0 top-2 w-3 h-3 rounded-full ${colorClass} border-2 border-white shadow-md z-10 -translate-x-[5px]`} />

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="flex flex-col gap-2 mb-2">
                    <span className="text-base font-bold text-blue-600">{item.time}</span>
                    <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

