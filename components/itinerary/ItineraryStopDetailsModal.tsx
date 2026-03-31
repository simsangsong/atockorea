'use client';

import type { ReactNode } from 'react';
import type { GeneratedItineraryResponse, ItineraryPhotoGalleryItem } from '@/lib/itinerary/types';
import {
  stopHasPrimaryGallery,
  stopRepresentativeImageUrl,
} from '@/lib/itinerary/stop-image-priority';

type Stop = GeneratedItineraryResponse['stops'][number];

function GalleryFigure({
  ph,
  variant,
}: {
  ph: ItineraryPhotoGalleryItem;
  variant: 'single' | 'hero' | 'grid';
}) {
  const imgClass =
    variant === 'grid'
      ? 'w-full h-32 object-cover'
      : variant === 'hero'
        ? 'w-full h-48 object-cover'
        : 'w-full h-56 sm:h-64 object-cover';
  return (
    <figure className="rounded-lg overflow-hidden border border-neutral-100 bg-neutral-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ph.imageUrl}
        alt={ph.galTitle || ph.galleryGroupTitle || 'Gallery photo'}
        className={imgClass}
        loading="lazy"
      />
      <figcaption className="px-2 py-1.5 text-[11px] text-neutral-600 leading-snug space-y-0.5">
        {ph.galleryGroupTitle && (
          <p className="font-medium text-neutral-700 line-clamp-2">{ph.galleryGroupTitle}</p>
        )}
        {ph.galTitle && ph.galTitle !== ph.galleryGroupTitle && (
          <p className="line-clamp-2">{ph.galTitle}</p>
        )}
        {(ph.photographyMonth || ph.photographyLocation) && (
          <p className="text-neutral-400">
            {[ph.photographyMonth, ph.photographyLocation].filter(Boolean).join(' · ')}
          </p>
        )}
      </figcaption>
    </figure>
  );
}

export function ItineraryStopDetailsModal(props: {
  stop: Stop | null;
  reason: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { stop, reason, open, onClose } = props;
  if (!open || !stop) return null;

  const rep = stopRepresentativeImageUrl(stop);

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: ReactNode;
  }) => (
    <div className="border-b border-neutral-100 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">{title}</h4>
      <div className="text-sm text-neutral-800 font-light leading-relaxed">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-neutral-100 p-6 sm:p-8 text-left"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900 text-sm"
        >
          Close
        </button>
        <h3 className="text-xl font-medium text-neutral-900 pr-10 mb-1">{stop.title}</h3>
        <p className="text-xs text-neutral-500 mb-4">
          Stop {stop.sortOrder}
          {stop.plannedDurationMin != null ? ` · ~${stop.plannedDurationMin} min` : ''}
        </p>

        {/* Priority: photoGallery → representative image → empty state */}
        {stopHasPrimaryGallery(stop) ? (
          <div className="mb-4 space-y-4">
            {stop.photoGallery.length === 1 ? (
              <GalleryFigure ph={stop.photoGallery[0]} variant="single" />
            ) : (
              <>
                <GalleryFigure ph={stop.photoGallery[0]} variant="hero" />
                <div>
                  <p className="text-xs text-neutral-500 mb-2">
                    {stop.photoGallery.length} photos from the Korea Tourism gallery linked to this
                    place.
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-[min(50vh,440px)] overflow-y-auto pr-1">
                    {stop.photoGallery.slice(1).map((ph, idx) => (
                      <GalleryFigure key={`${ph.imageUrl}-${idx + 1}`} ph={ph} variant="grid" />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : rep ? (
          <div className="mb-4 rounded-xl overflow-hidden border border-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={rep} alt="" className="w-full h-48 object-cover" />
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-400">
            No photos for this stop
          </div>
        )}

        {stop.overview && (
          <Section title="Overview">
            <p className="whitespace-pre-wrap">{stop.overview}</p>
          </Section>
        )}

        {(stop.adminNoteKo || stop.adminNoteEn) && (
          <Section title="Experience notes (operator)">
            {stop.adminNoteKo && <p className="mb-2">{stop.adminNoteKo}</p>}
            {stop.adminNoteEn && <p className="text-neutral-600">{stop.adminNoteEn}</p>}
          </Section>
        )}

        {reason && (
          <Section title="Why this stop (AI suggestion)">
            <p>{reason}</p>
          </Section>
        )}

        <Section title="Address & contact">
          <p>{[stop.addr1, stop.addr2].filter(Boolean).join(' · ') || '—'}</p>
          {stop.tel && <p className="mt-1">Tel: {stop.tel}</p>}
          {stop.homepage && (
            <a
              href={stop.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline mt-1 inline-block"
            >
              Website
            </a>
          )}
        </Section>

        <Section title="Hours & fees">
          <p>Hours: {stop.useTimeText || '—'}</p>
          <p className="mt-1">Fee: {stop.feeText || '—'}</p>
          <p className="mt-1">Closed: {stop.restDate || '—'}</p>
        </Section>

        <Section title="Parking & booking">
          <p>{stop.parkingInfo || '—'}</p>
          <p className="mt-1">{stop.reservationInfo || '—'}</p>
        </Section>

        <Section title="Map">
          {stop.mapx != null && stop.mapy != null ? (
            <div className="font-mono text-xs space-y-1">
              <p>Longitude (mapx): {stop.mapx}</p>
              <p>Latitude (mapy): {stop.mapy}</p>
            </div>
          ) : (
            <p>—</p>
          )}
        </Section>

        <Section title="Tags & attributes">
          <p className="flex flex-wrap gap-2">
            {stop.tags?.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-neutral-100 text-xs text-neutral-700">
                {t}
              </span>
            ))}
            {(!stop.tags || stop.tags.length === 0) && <span className="text-neutral-400">—</span>}
          </p>
          <p className="mt-2 text-xs text-neutral-600">
            Indoor: {stop.isIndoor == null ? '—' : stop.isIndoor ? 'yes' : 'no'} · Outdoor:{' '}
            {stop.isOutdoor == null ? '—' : stop.isOutdoor ? 'yes' : 'no'} · Free:{' '}
            {stop.isFree == null ? '—' : stop.isFree ? 'yes' : 'no'} · Paid:{' '}
            {stop.isPaid == null ? '—' : stop.isPaid ? 'yes' : 'no'}
          </p>
          {stop.regionGroup && (
            <p className="mt-1 text-xs text-neutral-500">Region: {stop.regionGroup}</p>
          )}
        </Section>
      </div>
    </div>
  );
}
