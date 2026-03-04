'use client';

import { useTranslations } from '@/lib/i18n';

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
  const t = useTranslations();
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
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

        <div className="space-y-3">
          {processedItems.map((processed, idx) => {
            const colorClass = dotColors[processed.index % dotColors.length];
            
            if (processed.type === 'pickup' && processed.pickupPoints && processed.pickupPoints.length > 0) {
              return (
                <div key={`pickup-${idx}`} className="relative flex gap-3 pl-10">
                  <div className={`absolute left-0 top-2.5 w-2.5 h-2.5 rounded-full ${colorClass} border-2 border-white z-10 -translate-x-[5px]`} />
                  <div className="flex-1 pb-2">
                    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        {processed.pickupTime && (
                          <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">{processed.pickupTime}</span>
                        )}
                        <span className="text-sm font-medium text-gray-900">{t('tour.pickup')}</span>
                      </div>
                      <div className="space-y-1">
                        {processed.pickupPoints.map((point) => (
                          <div key={point.id} className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                            <span className="font-medium text-gray-800">{point.name}</span>
                            {point.pickup_time && (
                              <span className="text-gray-400">({point.pickup_time})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            } else if (processed.type === 'normal' && processed.item) {
              return (
                <div key={idx} className="relative flex gap-3 pl-10">
                  <div className={`absolute left-0 top-2.5 w-2.5 h-2.5 rounded-full ${colorClass} border-2 border-white z-10 -translate-x-[5px]`} />
                  <div className="flex-1 pb-2">
                    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">{processed.item.time}</span>
                        <h3 className="text-sm font-medium text-gray-900">{processed.item.title}</h3>
                      </div>
                      {processed.item.description && (
                        <p className="text-xs text-gray-600 leading-relaxed mt-1">{processed.item.description}</p>
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

