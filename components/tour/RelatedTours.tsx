'use client';

import TourCard from '@/components/TourCard';

interface RelatedTour {
  id: number;
  title: string;
  location: string;
  type: string;
  price: number;
  image: string;
  badge?: string;
  rating: number;
  reviewCount: number;
}

interface RelatedToursProps {
  tours: RelatedTour[];
  currentTourId: number;
}

export default function RelatedTours({ tours, currentTourId }: RelatedToursProps) {
  const relatedTours = tours.filter((tour) => tour.id !== currentTourId).slice(0, 4);

  if (relatedTours.length === 0) return null;

  return (
    <section className="py-12 bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            You might also like
          </h2>
          <p className="text-gray-600">Similar tours in the same destination</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {relatedTours.map((tour) => (
            <TourCard
              key={tour.id}
              id={tour.id}
              title={tour.title}
              location={tour.location}
              type={tour.type}
              price={tour.price}
              priceType="person"
              image={tour.image}
              badge={tour.badge}
              rating={tour.rating}
              reviewCount={tour.reviewCount}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

