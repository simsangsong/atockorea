// app/jeju/[slug]/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { detailedTours } from "../../../data/tours";

type Review = {
  id: number;
  author: string;
  rating: number;
  title: string;
  content: string;
  date: string;
  helpfulVotes: number;
};

type ReviewSort = "ratingDesc" | "ratingAsc" | "newest" | "oldest" | "helpful";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function JejuTourDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { slug } = params;

  const tour = useMemo(
    () => detailedTours.find((t) => t.city === "Jeju" && t.slug === slug),
    [slug]
  );

  const [selectedImage, setSelectedImage] = useState<string | null>(
    tour?.imageUrl ?? null
  );
  const [date, setDate] = useState<string>("");
  const [guests, setGuests] = useState<number>(2);

  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  const [showAllReviews, setShowAllReviews] = useState(false);
  const [sortBy, setSortBy] = useState<ReviewSort>("ratingDesc");
  const [reviews, setReviews] = useState<Review[]>(tour?.reviews ?? []);

  const [newReview, setNewReview] = useState<{
    author: string;
    rating: number;
    title: string;
    content: string;
  }>({
    author: "",
    rating: 5,
    title: "",
    content: "",
  });

  if (!tour) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] text-[#111] flex items-center justify-center">
        <div className="rounded-2xl bg-white px-6 py-8 shadow-sm">
          <h1 className="mb-2 text-lg font-semibold">Tour not found</h1>
          <p className="text-sm text-[#555]">
            The Jeju tour you are looking for does not exist or is no longer
            available.
          </p>
        </div>
      </div>
    );
  }

  const heroImage = selectedImage ?? tour.imageUrl;
  const gallery = tour.galleryImages?.length
    ? tour.galleryImages
    : [tour.imageUrl];

  const averageRating =
    reviews.length === 0
      ? 0
      : reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  const sortedReviews = useMemo(() => {
    const arr = [...reviews];
    switch (sortBy) {
      case "ratingAsc":
        return arr.sort((a, b) => a.rating - b.rating);
      case "newest":
        return arr.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      case "oldest":
        return arr.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      case "helpful":
        return arr.sort((a, b) => b.helpfulVotes - a.helpfulVotes);
      case "ratingDesc":
      default:
        return arr.sort((a, b) => b.rating - a.rating);
    }
  }, [reviews, sortBy]);

  const visibleReviews = showAllReviews
    ? sortedReviews
    : sortedReviews.slice(0, 3);

  const handleBookNow = () => {
    if (!date) {
      alert("Please select a date first.");
      return;
    }

    const query = new URLSearchParams({
      tourSlug: tour.slug ?? "",
      date,
      guests: String(guests),
    }).toString();

    router.push(`/checkout?${query}`);
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReview.author || !newReview.title || !newReview.content) {
      alert("Please fill in your name, title, and review text.");
      return;
    }

    const review: Review = {
      id: Date.now(),
      author: newReview.author,
      rating: newReview.rating,
      title: newReview.title,
      content: newReview.content,
      date: new Date().toISOString().slice(0, 10),
      helpfulVotes: 0,
    };

    setReviews((prev) => [review, ...prev]);
    setNewReview({
      author: "",
      rating: 5,
      title: "",
      content: "",
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#111]">
      <main className="mx-auto max-w-5xl pb-16 sm:pb-24">
        {/* HERO */}
        <section className="relative">
          <div className="aspect-[16/10] w-full overflow-hidden bg-black sm:rounded-b-[32px]">
            <img
              src={heroImage}
              alt={tour.title}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="mx-auto max-w-3xl px-4">
            <div className="-mt-8 rounded-2xl bg-white p-4 shadow-md sm:-mt-10 sm:p-6">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#888]">
                {tour.tag}
              </p>
              <h1 className="mt-1 text-[20px] font-semibold sm:text-[24px]">
                {tour.title}
              </h1>
              {tour.subtitle && (
                <p className="mt-1 text-[13px] text-[#555] sm:text-[14px]">
                  {tour.subtitle}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] sm:text-[13px]">
                <div className="flex items-center gap-1">
                  <span className="text-[15px]">⭐</span>
                  <span className="font-semibold">
                    {averageRating.toFixed(1)}
                  </span>
                  <span className="text-[#777]">
                    &nbsp;· {reviews.length} reviews
                  </span>
                </div>
                <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-[#555]">
                  {tour.duration}
                </span>
                <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-[#555]">
                  {tour.price}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* MAIN: LEFT 내용 + RIGHT 예약 카드 */}
        <section className="mt-4 grid gap-6 px-4 sm:mt-6 sm:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] sm:px-6 lg:px-8">
          {/* LEFT */}
          <div className="space-y-6">
            {/* Photos */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-[15px] font-semibold">Photos</h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {gallery
                  .slice(0, showAllPhotos ? gallery.length : 4)
                  .map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setSelectedImage(url)}
                      className={`relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-xl border ${
                        heroImage === url
                          ? "border-[#007aff]"
                          : "border-transparent"
                      }`}
                    >
                      <img
                        src={url}
                        alt="Jeju tour thumbnail"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
              </div>
              {gallery.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllPhotos((v) => !v)}
                  className="mt-3 text-[13px] font-medium text-[#007aff]"
                >
                  {showAllPhotos ? "Hide extra photos" : "Show more photos"}
                </button>
              )}
            </div>

            {/* Highlights */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-[15px] font-semibold">
                Why you’ll love this tour
              </h2>
              {tour.description && (
                <p className="mb-3 text-[13px] text-[#555]">
                  {tour.description}
                </p>
              )}
              {tour.highlights && (
                <ul className="space-y-1 text-[13px] text-[#444]">
                  {tour.highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <span className="mt-[3px] text-[12px]">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Itinerary */}
            {tour.schedule && (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold">Itinerary</h2>
                  <button
                    type="button"
                    onClick={() => setShowFullSchedule((v) => !v)}
                    className="text-[13px] font-medium text-[#007aff]"
                  >
                    {showFullSchedule ? "Hide" : "Show full itinerary"}
                  </button>
                </div>

                <div
                  className={`mt-3 space-y-3 text-[13px] text-[#444] ${
                    !showFullSchedule ? "max-h-40 overflow-hidden" : ""
                  }`}
                >
                  {tour.schedule.map((item) => (
                    <div
                      key={item.time + item.title}
                      className="flex gap-3 rounded-xl bg-[#f8f8fa] px-3 py-2"
                    >
                      <div className="mt-1 w-14 flex-shrink-0 text-[12px] font-semibold text-[#007aff]">
                        {item.time}
                      </div>
                      <div>
                        <div className="font-medium">{item.title}</div>
                        {item.description && (
                          <div className="mt-1 text-[12px] text-[#666]">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {!showFullSchedule && tour.schedule.length > 3 && (
                  <div className="mt-2 text-[11px] text-[#999]">
                    Itinerary may change depending on weather and traffic.
                  </div>
                )}
              </div>
            )}

            {/* Includes / Excludes */}
            {(tour.includes || tour.excludes) && (
              <div className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2">
                {tour.includes && (
                  <div>
                    <h3 className="mb-2 text-[14px] font-semibold">
                      What’s included
                    </h3>
                    <ul className="space-y-1 text-[13px] text-[#444]">
                      {tour.includes.map((inc) => (
                        <li key={inc} className="flex gap-2">
                          <span className="mt-[2px] text-[11px]">✓</span>
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tour.excludes && (
                  <div>
                    <h3 className="mb-2 text-[14px] font-semibold">
                      Not included
                    </h3>
                    <ul className="space-y-1 text-[13px] text-[#444]">
                      {tour.excludes.map((ex) => (
                        <li key={ex} className="flex gap-2">
                          <span className="mt-[2px] text-[11px]">✕</span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Pickup */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-[15px] font-semibold">Pickup</h2>
              <p className="text-[13px] text-[#444]">{tour.pickupInfo}</p>
              {tour.notes && (
                <p className="mt-2 text-[12px] text-[#888]">{tour.notes}</p>
              )}
            </div>

            {/* Reviews */}
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold">Reviews</h2>
                  <div className="mt-1 flex items-center gap-2 text-[13px]">
                    <span className="text-[18px]">⭐</span>
                    <span className="font-semibold">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-[#777]">
                      &nbsp;· {reviews.length} reviews
                    </span>
                  </div>
                </div>

                {showAllReviews && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="text-[#666]">Sort by</span>
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as ReviewSort)
                      }
                      className="rounded-full border border-[#ddd] bg-white px-3 py-1"
                    >
                      <option value="ratingDesc">Highest rating</option>
                      <option value="ratingAsc">Lowest rating</option>
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="helpful">Most helpful</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {visibleReviews.map((r) => (
                  <article
                    key={r.id}
                    className="rounded-2xl border border-[#f0f0f2] bg-[#fafafa] px-3 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-medium">{r.author}</div>
                      <div className="flex items-center gap-1 text-[12px] text-[#777]">
                        <span>⭐ {r.rating.toFixed(1)}</span>
                        <span>· {r.date}</span>
                      </div>
                    </div>
                    <div className="mt-1 text-[13px] font-semibold">
                      {r.title}
                    </div>
                    <p className="mt-1 text-[12px] text-[#555]">
                      {r.content}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#999]">
                      <span>{r.helpfulVotes} people found this helpful</span>
                    </div>
                  </article>
                ))}
              </div>

              {reviews.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllReviews((v) => !v)}
                  className="mt-3 w-full rounded-full border border-[#ddd] bg-white py-2 text-[13px] font-medium text-[#007aff]"
                >
                  {showAllReviews ? "Show top reviews only" : "View all reviews"}
                </button>
              )}

              {/* 리뷰 작성 폼 */}
              <div className="mt-6 border-t border-[#f0f0f2] pt-4">
                <h3 className="mb-2 text-[14px] font-semibold">
                  Write a review
                </h3>
                <form
                  onSubmit={handleSubmitReview}
                  className="space-y-3 text-[13px]"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[12px] text-[#666]">
                        Your name
                      </label>
                      <input
                        type="text"
                        value={newReview.author}
                        onChange={(e) =>
                          setNewReview((prev) => ({
                            ...prev,
                            author: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-[#ddd] px-3 py-2 outline-none focus:border-[#007aff]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-[#666]">
                        Rating
                      </label>
                      <select
                        value={newReview.rating}
                        onChange={(e) =>
                          setNewReview((prev) => ({
                            ...prev,
                            rating: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded-xl border border-[#ddd] px-3 py-2 outline-none focus:border-[#007aff]"
                      >
                        {[5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>
                            {r} stars
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] text-[#666]">
                      Review title
                    </label>
                    <input
                      type="text"
                      value={newReview.title}
                      onChange={(e) =>
                        setNewReview((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[#ddd] px-3 py-2 outline-none focus:border-[#007aff]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[12px] text-[#666]">
                      Your experience
                    </label>
                    <textarea
                      value={newReview.content}
                      onChange={(e) =>
                        setNewReview((prev) => ({
                          ...prev,
                          content: e.target.value,
                        }))
                      }
                      rows={4}
                      className="w-full rounded-xl border border-[#ddd] px-3 py-2 outline-none focus:border-[#007aff]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-full bg-[#111] py-2.5 text-[13px] font-medium text-white"
                  >
                    Submit review
                  </button>
                </form>
              </div>
            </section>
          </div>

          {/* RIGHT: 예약 카드 */}
          <aside className="self-start rounded-2xl bg-white p-4 shadow-md sm:sticky sm:top-4">
            <div className="mb-3 text-[12px] font-medium uppercase tracking-wide text-[#888]">
              Check availability
            </div>

            <div className="mb-2 text-[20px] font-semibold">{tour.price}</div>
            <div className="mb-4 text-[12px] text-[#666]">
              Free cancellation up to 24 hours before (local time).
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className="mb-1 block text-[12px] text-[#666]">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-[#ddd] px-3 py-2 outline-none focus:border-[#007aff]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] text-[#666]">
                  Travelers
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGuests((g) => (g > 1 ? g - 1 : 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd]"
                  >
                    –
                  </button>
                  <div className="w-16 text-center text-[14px] font-medium">
                    {guests}
                  </div>
                  <button
                    type="button"
                    onClick={() => setGuests((g) => g + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd]"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBookNow}
                className="mt-2 w-full rounded-full bg-[#007aff] py-2.5 text-[14px] font-semibold text-white shadow-sm"
              >
                Check availability &amp; pay deposit
              </button>

              <p className="mt-2 text-[11px] text-[#999]">
                You’ll be redirected to the next step to complete your booking.
                Remaining balance can be paid in cash on the tour day.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
