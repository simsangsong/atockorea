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

  // Separate pickup items from other items
  const pickupItems: ItineraryItem[] = [];
  const otherItems: ItineraryItem[] = [];
  
  items.forEach((item) => {
    if (item.title.toLowerCase().includes('pickup') || item.title.toLowerCase().includes('接送')) {
      pickupItems.push(item);
    } else {
      otherItems.push(item);
    }
  });

  // Combine pickup items into a summary
  const pickupSummary = pickupItems.length > 0 ? {
    time: `${pickupItems[0].time} - ${pickupItems[pickupItems.length - 1].time}`,
    title: 'Pickup Points',
    pickupList: pickupItems.map(p => `${p.time} ${p.title.replace(/^Pickup - /i, '')}`),
    icon: '🚗',
    isPickupSummary: true,
  } : null;

  // Combine all items: pickup summary first, then other items
  const displayItems = pickupSummary ? [pickupSummary, ...otherItems] : otherItems;

  // Color palette for timeline dots: Yellow, Blue, Cyan, Black, Purple
  const dotColors = [
    'bg-yellow-500',
    'bg-blue-500',
    'bg-cyan-500',
    'bg-gray-800',
    'bg-purple-500',
  ];

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 p-6 fade-in-delay-2">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Itinerary</h2>
      <div className="relative">
        {/* Vertical Timeline Line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-300 via-blue-300 to-purple-300" />

        <div className="space-y-6">
          {displayItems.map((item, index) => {
            const colorClass = dotColors[index % dotColors.length];
            const isPickupSummary = (item as any).isPickupSummary;
            
            return (
              <div key={index} className="relative flex gap-4 pl-8">
                {/* Timeline Dot with varied colors */}
                <div className={`absolute left-0 top-2 w-3 h-3 rounded-full ${colorClass} border-2 border-white shadow-md z-10 -translate-x-[5px]`} />

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="flex flex-col gap-2 mb-2">
                    <span className="text-base font-bold text-indigo-600">{item.time}</span>
                    <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  </div>
                  {isPickupSummary ? (
                    <div className="space-y-1 mt-1">
                      {(item as any).pickupList?.map((location: string, idx: number) => (
                        <p key={idx} className="text-xs text-gray-500 leading-relaxed">
                          {location}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

