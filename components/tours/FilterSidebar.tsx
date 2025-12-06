'use client';

import { useState } from 'react';

interface FilterSidebarProps {
  destinations: string[];
  filters: {
    destinations: string[];
    priceRange: [number, number];
    duration: string[];
    features: string[];
  };
  onFiltersChange: (filters: any) => void;
}

const durations = ['Half day', 'Full day', '3-4 hours', '2 Days'];
const features = ['Tickets Included', 'Meals Included', 'Guide Included', 'Transportation', 'Hotel Pickup'];

export default function FilterSidebar({ destinations, filters, onFiltersChange }: FilterSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDestination = (destination: string) => {
    const newDestinations = filters.destinations.includes(destination)
      ? filters.destinations.filter((d) => d !== destination)
      : [...filters.destinations, destination];
    onFiltersChange({ ...filters, destinations: newDestinations });
  };

  const toggleDuration = (duration: string) => {
    const newDurations = filters.duration.includes(duration)
      ? filters.duration.filter((d) => d !== duration)
      : [...filters.duration, duration];
    onFiltersChange({ ...filters, duration: newDurations });
  };

  const toggleFeature = (feature: string) => {
    const newFeatures = filters.features.includes(feature)
      ? filters.features.filter((f) => f !== feature)
      : [...filters.features, feature];
    onFiltersChange({ ...filters, features: newFeatures });
  };

  const handlePriceChange = (index: number, value: number) => {
    const newRange: [number, number] = [...filters.priceRange];
    newRange[index] = value;
    onFiltersChange({ ...filters, priceRange: newRange });
  };

  const clearFilters = () => {
    onFiltersChange({
      destinations: [],
      priceRange: [0, 500],
      duration: [],
      features: [],
    });
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden w-full mb-4 px-4 py-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 flex items-center justify-between"
      >
        <span className="font-semibold text-gray-900">Filters</span>
        <svg
          className={`w-5 h-5 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Sidebar */}
      <div
        className={`${
          isOpen ? 'block' : 'hidden'
        } lg:block bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 sticky top-20`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">Filters</h2>
          <button
            onClick={clearFilters}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Clear All
          </button>
        </div>

        {/* Destinations */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Destinations</h3>
          <div className="space-y-2">
            {destinations.map((destination) => (
              <label key={destination} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.destinations.includes(destination)}
                  onChange={() => toggleDestination(destination)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{destination}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Price Range</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={filters.priceRange[0]}
                onChange={(e) => handlePriceChange(0, Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
                placeholder="Min"
              />
              <span className="text-gray-500">-</span>
              <input
                type="number"
                value={filters.priceRange[1]}
                onChange={(e) => handlePriceChange(1, Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
                placeholder="Max"
              />
            </div>
            <input
              type="range"
              min="0"
              max="500"
              value={filters.priceRange[1]}
              onChange={(e) => handlePriceChange(1, Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Duration */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Duration</h3>
          <div className="space-y-2">
            {durations.map((duration) => (
              <label key={duration} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.duration.includes(duration)}
                  onChange={() => toggleDuration(duration)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{duration}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Features */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Inclusions</h3>
          <div className="space-y-2">
            {features.map((feature) => (
              <label key={feature} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.features.includes(feature)}
                  onChange={() => toggleFeature(feature)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{feature}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

