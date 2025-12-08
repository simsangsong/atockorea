'use client';

import { MapIcon } from '@/components/Icons';
import InteractiveMap from '@/components/maps/InteractiveMap';

interface PickupPoint {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface MeetingPointProps {
  points: PickupPoint[];
}

export default function MeetingPoint({ points }: MeetingPointProps) {
  if (!points || points.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Meeting Point</h2>
        <p className="text-gray-600">No pickup points available.</p>
      </div>
    );
  }

  const primaryPoint = points[0];
  const hasApiKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Meeting Point</h2>

      {/* Map - 使用交互式地图（如果有 API Key）或回退到 iframe */}
      <div className="relative w-full h-64 rounded-lg overflow-hidden mb-4 bg-gray-200">
        {hasApiKey ? (
          <InteractiveMap
            locations={points.map(p => ({
              lat: p.lat,
              lng: p.lng,
              name: p.name,
              address: p.address,
              id: p.id,
            }))}
            center={{ lat: primaryPoint.lat, lng: primaryPoint.lng }}
            zoom={points.length > 1 ? 12 : 15}
            height="100%"
            showInfoWindow={true}
          />
        ) : (
          <iframe
            src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3168.5!2d${primaryPoint.lng}!3d${primaryPoint.lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzXCsDA2JzU2LjIiTiAxMjnCsDAyJzMyLjAiRQ!5e0!3m2!1sen!2sus!4v1234567890&q=${encodeURIComponent(primaryPoint.address)}`}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0"
          />
        )}
      </div>

      {/* Address */}
      <div className="flex items-start gap-3">
        <MapIcon className="w-6 h-6 text-indigo-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{primaryPoint.name}</h3>
          <p className="text-sm text-gray-600">{primaryPoint.address}</p>
        </div>
        <a
          href={`https://www.google.com/maps?q=${primaryPoint.lat},${primaryPoint.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-700 text-sm font-medium whitespace-nowrap"
        >
          Directions →
        </a>
      </div>

      {/* Additional Pickup Points */}
      {points.length > 1 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Other pickup points available:</p>
          <ul className="space-y-2">
            {points.slice(1).map((point) => (
              <li key={point.id} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                {point.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

