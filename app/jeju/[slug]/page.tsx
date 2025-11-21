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

type FAQItem = {
  question: string;
  answer: string;
};

type PageProps = {
  params: {
    slug: string;
  };
};

export default function JejuTourDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { slug } = params;

  // 이 페이지는 Jeju 전용
  const tour = useMemo(
    () => detailedTours.find((t) => t.city === "Jeju" && t.slug === slug),
    [slug]
  );

  const [date, setDate] = useState<string>("");
  const [guests, setGuests] = useState<number>(2);

  const [showFullItinerary, setShowFullItinerary] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  const [showAllReviews, setShowAllReviews] = useState(false);
  const [sortBy, setSortBy] = useState<ReviewSort>("ratingDesc");
  const [reviews, setReviews] = useState<Review[]>(() =>
    (tour?.reviews as Review[] | undefined) ?? []
  );

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

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  if (!tour) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] text-[#111]">
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

  const images =
    tour.galleryImages && tour.galleryImages.length > 0
      ? tour.galleryImages
      : [tour.imageUrl];

  const [selectedImage, setSelectedImage] = useState<string | null>(images[0]);

  const heroImage = selectedImage ?? images[0];

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
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      case "oldest":
        return arr.sort(
          (a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
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

  const faqs: FAQItem[] = (tour.faqs as FAQItem[] | undefined) ?? [];

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
      {/* ===== HERO SECTION (Apple style + Klook/Viator 느낌) ===== */}
      <section className="bg-black">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-b-[28px] sm:rounded-b-[36px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt={tour.title}
              className="h-[220px] w-full object-cover sm:h-[320px] md:h-[380px]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />

            {/* 상단 오른쪽 작은 라벨들 (Klook/Viator 느낌) */}
            <div className="absolute left-4 right-4 top-4 flex justify-between text-[11px] text-white sm:left-6 sm:right-6">
              <span className="rounded-full bg-black/40 px-3 py-1">
                Jeju · Korea
              </span>
              <span className="rounded-full bg-black/40 px-3 py-1">
                Small-group &amp; private tours
              </span>
            </div>

            {/* 하단 제목 + 평점 + 가격 */}
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#f5f5f7]/80">
                {tour.tag}
              </p>
              <h1 className="mt-1 text-[20px] font-semibold text-white sm:text-[24px]">
                {tour.title}
              </h1>
              {tour.subtitle && (
                <p className="mt-1 max-w-xl text-[12px] text-[#f5f5f7]/85 sm:text-[13px]">
                  {tour.subtitle}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] sm:text-[13px]">
                <div className="flex items-center gap-1 rounded-full bg-black/45 px-3 py-1.5">
                  <span>⭐</span>
                  <span className="font-semibold">
                    {averageRating.toFixed(1)}
                  </span>
                  <span className="text-[#d0d0d5]">
                    &nbsp;· {reviews.length} reviews
                  </span>
                </div>
                <span className="rounded-full bg-black/45 px-3 py-1.5 text-[#f5f5f7]">
                  {tour.duration}
                </span>
                <span className="rounded-full bg-[#0c66ff] px-3 py-1.5 text-[11px] font-semibold text-white sm:text-[12px]">
                  {tour.price}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MAIN CONTENT ===== */}
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-4 sm:px-6 md:pt-6">
        <section className="grid gap-6 md:grid-cols-[minmax(0,2.1fr)_minmax(280px,1fr)]">
          {/* ------- LEFT COLUMN ------- */}
          <div className="space-y-6">
            {/* Photos strip (갤러리 스와이프) */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-[15px] font-semibold">Photos</h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images
                  .slice(0, showAllPhotos ? images.length : 5)
                  .map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setSelectedImage(url)}
                      className={`relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-xl border ${
                        heroImage === url
                          ? "border-[#0c66ff]"
                          : "border-transparent"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Gallery thumbnail"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
              </div>
              {images.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllPhotos((v) => !v)}
                  className="mt-3 text-[13px] font-medium text-[#0c66ff]"
                >
                  {showAllPhotos ? "Show fewer photos" : "Show more photos"}
                </button>
              )}
            </div>

            {/* Why you’ll love this tour (Highlights) */}
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
                <ul className="space-y-1.5 text-[13px] text-[#333]">
                  {tour.highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <span className="mt-[4px] text-[12px] text-[#0c66ff]">
                        •
                      </span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Includes / Not included */}
            {(tour.includes || tour.excludes) && (
              <div className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-2">
                {tour.includes && (
                  <div>
                    <h3 className="mb-2 text-[14px] font-semibold">
                      What’s included
                    </h3>
                    <ul className="space-y-1 text-[13px] text-[#333]">
                      {tour.includes.map((inc) => (
                        <li key={inc} className="flex gap-2">
                          <span className="mt-[2px] text-[11px] text-[#34c759]">
                            ✓
                          </span>
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
                    <ul className="space-y-1 text-[13px] text-[#333]">
                      {tour.excludes.map((ex) => (
                        <li key={ex} className="flex gap-2">
                          <span className="mt-[2px] text-[11px] text-[#ff3b30]">
                            ✕
                          </span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Itinerary (Klook 스타일 접기/펼치기 + Apple 타임라인 카드) */}
            {tour.schedule && (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold">Itinerary</h2>
                  <button
                    type="button"
                    onClick={() => setShowFullItinerary((v) => !v)}
                    className="text-[13px] font-medium text-[#0c66ff]"
                  >
                    {showFullItinerary ? "Hide full itinerary" : "Show full itinerary"}
                  </button>
                </div>

                <div
                  className={`mt-3 space-y-3 text-[13px] text-[#444] ${
                    !showFullItinerary ? "max-h-48 overflow-hidden" : ""
                  }`}
                >
                  {tour.schedule.map((item) => (
                    <div
                      key={item.time + item.title}
                      className="flex gap-3 rounded-xl bg-[#f8f8fa] px-3 py-2.5"
                    >
                      <div className="mt-1 w-16 flex-shrink-0 text-[12px] font-semibold text-[#0c66ff]">
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

                {!showFullItinerary && tour.schedule.length > 3 && (
                  <div className="mt-2 text-[11px] text-[#999]">
                    Itinerary may change depending on weather and traffic.
                  </div>
                )}
              </div>
            )}

            {/* Pickup info */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-[15px] font-semibold">Pickup & meeting point</h2>
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
                    <div className="mt-2 text-[11px] text-[#999]">
                      {r.helpfulVotes} people found this helpful
                    </div>
                  </article>
                ))}
              </div>

              {reviews.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllReviews((v) => !v)}
                  className="mt-3 w-full rounded-full border border-[#ddd] bg-white py-2 text-[13px] font-medium text-[#0c66ff]"
                >
                  {showAllReviews ? "Show top reviews only" : "View all reviews"}
                </button>
              )}

              {/* 리뷰 작성 (Klook/Viator 스타일 간단폼) */}
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
                        className="w-full rounded-xl border border-[#ddd] px-3 py-2 outline-none focus:border-[#0c66ff]"
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
                        className="w-full rounded-xl border border-[#ddd] px-3 py-2 outline-none focus:border-[#0c66ff]"
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
                      className="w-full rounded-xl border border-[#ddd] px-3 py-2 outline-none focus:border-[#0c66ff]"
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
                      className="w-full rounded-xl border border-[#ddd] px-3 py-2 outline-none focus:border-[#0c66ff]"
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

            {/* FAQ (Klook 스타일 아코디언) */}
            {faqs.length > 0 && (
              <section className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-[15px] font-semibold">FAQs</h2>
                <div className="divide-y divide-[#f0f0f2]">
                  {faqs.map((faq, index) => {
                    const open = openFaqIndex === index;
                    return (
                      <button
                        key={faq.question}
                        type="button"
                        onClick={() =>
                          setOpenFaqIndex(open ? null : index)
                        }
                        className="flex w-full flex-col items-stretch py-3 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-[#111]">
                            {faq.question}
                          </span>
                          <span className="text-[16px] text-[#999]">
                            {open ? "–" : "+"}
                          </span>
                        </div>
                        {open && (
                          <p className="mt-1 text-[12px] text-[#555]">
                            {faq.answer}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* ------- RIGHT COLUMN: Sticky 예약 카드 ------- */}
          <aside className="self-start rounded-2xl bg-white p-4 shadow-md md:sticky md:top-4">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#888]">
              Check availability
            </div>

            <div className="mb-1 text-[20px] font-semibold">
              {tour.price}
            </div>
            <div className="mb-3 text-[12px] text-[#666]">
              Free cancellation up to 24 hours before (local time).
              <br />
              Reserve now &amp; pay deposit online. Pay the balance in cash on
              the tour day.
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
                  className="w-full rounded-xl border border-[#ddd] px-3 py-2 outline-none focus:border-[#0c66ff]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] text-[#666]">
                  Travelers
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setGuests((g) => (g > 1 ? g - 1 : 1))
                    }
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
                className="mt-2 w-full rounded-full bg-[#0c66ff] py-2.5 text-[14px] font-semibold text-white shadow-sm"
              >
                Check availability &amp; pay deposit
              </button>

              <p className="mt-2 text-[11px] text-[#999]">
                You’ll be redirected to the next step to complete your booking.
                Remaining balance can be paid in cash on the tour day.
              </p>

              <div className="mt-3 space-y-1 text-[11px] text-[#777]">
                <div>• Instant confirmation for available dates</div>
                <div>• Mobile voucher accepted</div>
                <div>• Live guide: English (other languages on request)</div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
