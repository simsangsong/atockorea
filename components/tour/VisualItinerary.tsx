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
    <div className="fade-in-delay-2">
      <div className="relative">
        {/* Vertical Timeline Line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 via-blue-400 to-orange-400" />

        <div className="space-y-6">
          {processedItems.map((processed, idx) => {
            const colorClass = dotColors[processed.index % dotColors.length];
            
            if (processed.type === 'pickup' && processed.pickupPoints && processed.pickupPoints.length > 0) {
              // Render pickup section with grouped pickup points
              return (
                <div key={`pickup-${idx}`} className="relative flex gap-4 pl-8">
                  {/* Timeline Dot */}
                  <div className={`absolute left-0 top-2 w-3 h-3 rounded-full ${colorClass} border-2 border-white shadow-md z-10 -translate-x-[5px]`} />

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex flex-col gap-2 mb-2">
                      {processed.pickupTime && (
                        <span className="text-base font-bold text-blue-600">{processed.pickupTime}</span>
                      )}
                      <h3 className="text-lg font-semibold text-gray-900">Pickup</h3>
                    </div>
                    <div className="mt-2 space-y-1.5 pl-1">
                      {processed.pickupPoints.map((point) => (
                        <div key={point.id} className="text-xs text-gray-600 leading-relaxed">
                          <span>{point.name}</span>
                          {point.pickup_time && (
                            <span className="ml-2 text-gray-500">({point.pickup_time})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            } else if (processed.type === 'normal' && processed.item) {
              // Render normal itinerary item
              return (
                <div key={idx} className="relative flex gap-4 pl-8">
                  {/* Timeline Dot with varied colors */}
                  <div className={`absolute left-0 top-2 w-3 h-3 rounded-full ${colorClass} border-2 border-white shadow-md z-10 -translate-x-[5px]`} />

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex flex-col gap-2 mb-2">
                      <span className="text-base font-bold text-blue-600">{processed.item.time}</span>
                      <h3 className="text-lg font-semibold text-gray-900">{processed.item.title}</h3>
                    </div>
                    {processed.item.description && (
                      <p className="text-sm text-gray-600 leading-relaxed">{processed.item.description}</p>
                    )}
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

