'use client';

interface ItineraryItem {
  time: string;
  title: string;
  description: string;
  icon?: string;
}

interface PickupPoint {
  id: string;
  name: string;
  address?: string;
  pickup_time?: string;
}

interface VisualItineraryProps {
  items: ItineraryItem[];
  pickupPoints?: PickupPoint[];
}

export default function VisualItinerary({ items, pickupPoints = [] }: VisualItineraryProps) {
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

  // Group items, handling pickup points specially
  const processedItems: Array<{
    type: 'normal' | 'pickup';
    item?: ItineraryItem;
    pickupPoints?: PickupPoint[];
    pickupTime?: string;
    index: number;
  }> = [];
  
  let colorIndex = 0;
  
  items.forEach((item, originalIndex) => {
    const titleLower = item.title?.toLowerCase() || '';
    
    // Check if this is a pickup item
    if (titleLower.includes('pickup') || titleLower.includes('pick-up') || titleLower.includes('pick up')) {
      // Find the first pickup item and group all pickup points
      const existingPickup = processedItems.find(p => p.type === 'pickup');
      
      if (!existingPickup && pickupPoints.length > 0) {
        // Extract time from the first pickup item
        processedItems.push({
          type: 'pickup',
          pickupPoints: pickupPoints,
          pickupTime: item.time,
          index: colorIndex++,
        });
      }
      // Skip additional pickup items
    } else {
      // Normal itinerary item
      processedItems.push({
        type: 'normal',
        item: item,
        index: colorIndex++,
      });
    }
  });

  return (
    <div>
      <div className="relative">
        {/* Vertical Timeline Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-blue-300 to-orange-300" />

        <div className="space-y-5">
          {processedItems.map((processed, idx) => {
            const colorClass = dotColors[processed.index % dotColors.length];
            
            if (processed.type === 'pickup' && processed.pickupPoints && processed.pickupPoints.length > 0) {
              // Render pickup section with grouped pickup points
              return (
                <div key={`pickup-${idx}`} className="relative flex gap-4 pl-12">
                  {/* Timeline Dot */}
                  <div className={`absolute left-0 top-3 w-4 h-4 rounded-full ${colorClass} border-3 border-white shadow-lg z-10 -translate-x-[10px]`} />

                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {processed.pickupTime && (
                          <span className="text-sm font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">{processed.pickupTime}</span>
                        )}
                        <h3 className="text-base font-semibold text-gray-900">Pickup</h3>
                      </div>
                      <div className="space-y-2">
                        {processed.pickupPoints.map((point) => (
                          <div key={point.id} className="flex items-center gap-2 text-sm text-gray-700">
                            <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="font-medium">{point.name}</span>
                            {point.pickup_time && (
                              <span className="text-gray-500">({point.pickup_time})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            } else if (processed.type === 'normal' && processed.item) {
              // Render normal itinerary item
              return (
                <div key={idx} className="relative flex gap-4 pl-12">
                  {/* Timeline Dot with varied colors */}
                  <div className={`absolute left-0 top-3 w-4 h-4 rounded-full ${colorClass} border-3 border-white shadow-lg z-10 -translate-x-[10px]`} />

                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">{processed.item.time}</span>
                        <h3 className="text-base font-semibold text-gray-900">{processed.item.title}</h3>
                      </div>
                      {processed.item.description && (
                        <p className="text-sm text-gray-700 leading-relaxed mt-2">{processed.item.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

