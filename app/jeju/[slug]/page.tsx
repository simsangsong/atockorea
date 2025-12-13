// app/jeju/[slug]/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { detailedTours } from "../../../data/tours";

// ===== 타입 정의 =====
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

type FAQItem = {
  question: string;
  answer: string;
};

// ===== 페이지 컴포넌트 =====
export default function JejuTourDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { slug } = params;

  // slug로 투어 찾기 (도시 상관없이 slug만 기준)
  const tour = useMemo(
    () => detailedTours.find((t) => t.slug === slug),
    [slug]
  );

  // 투어 없을 때
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

  // ===== 기본 데이터 =====
  const gallery =
    tour.galleryImages && tour.galleryImages.length > 0
      ? tour.galleryImages
      : [tour.imageUrl];

  const [selectedImage, setSelectedImage] = useState<string | null>(
    gallery[0]
  );
  const heroImage = selectedImage ?? gallery[0];

  const initialReviews: Review[] = (tour.reviews || []) as Review[];
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [sortBy, setSortBy] = useState<ReviewSort>("ratingDesc");

  const [showFullItinerary, setShowFullItinerary] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  const [date, setDate] = useState<string>("");
  const [guests, setGuests] = useState<number>(2);

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

  const averageRating =
    reviews.length === 0
      ? 0
      : reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  // 정렬된 리뷰
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

  // FAQ – 간단 템플릿 (필요하면 나중에 slug별로 분기 가능)
  const faqs: FAQItem[] = [
    {
      question: "What is the pickup time and location?",
      answer:
        "Pickup usually starts around 08:30–09:00 from Jeju City meeting points or your hotel (if included). Exact time and location will be confirmed in the confirmation email after booking.",
    },
    {
      question: "Is lunch included?",
      answer:
        tour.lunchIncluded
          ? "Lunch is included. Your guide will take you to a recommended local restaurant."
          : "Lunch is not included. The guide will recommend local restaurants where you can choose and pay on the spot.",
    },
    {
      question: "Can I join with a suitcase or luggage?",
      answer:
        "Yes, small and medium-size luggage can be stored in the vehicle. For very large luggage, please inform us in advance so we can prepare enough space.",
    },
    {
      question: "What happens in case of bad weather?",
      answer:
        "For safety reasons, outdoor activities or Haenyeo shows may be cancelled or replaced with alternative spots. The itinerary can change depending on weather and traffic conditions.",
    },
  ];

  // ===== 액션 핸들러 =====
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

  // ===== 렌더링 =====
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#111]">
      <main className="mx-auto max-w-5xl px-3 pb-20 pt-4 sm:px-6 sm:pb-28 lg:px-8">
        {/* ===== 1. 상단 갤러리 + 기본 정보 (Apple 스타일) ===== */}
        <section className="rounded-3xl bg-white shadow-sm">
          {/* 메인 이미지 + 썸네일 스와이프 (모바일) */}
          <div className="border-b border-[#eee]">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-3xl bg-black sm:aspect-[16/9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={tour.title}
                className="h-full w-full object-cover"
              />
              {/* 작은 배지 */}
              <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-[11px] text-white backdrop-blur-sm">
                {tour.tag}
              </div>
            </div>

            {/* 썸네일 가로 스크롤 */}
            <div className="flex gap-2 overflow-x-auto px-3 pb-3 pt-2 sm:px-4">
              {gallery
                .slice(0, showAllPhotos ? gallery.length : 6)
                .map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setSelectedImage(url)}
                    className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-2xl border ${
                      heroImage === url
                        ? "border-[#007aff]"
                        : "border-[#e5e5ea]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Jeju tour thumbnail"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              {gallery.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllPhotos((v) => !v)}
                  className="flex h-16 w-20 flex-shrink-0 items-center justify-center rounded-2xl border border-dashed border-[#d1d1d6] text-[11px] text-[#555]"
                >
                  {showAllPhotos ? "Hide" : `+${gallery.length - 6} more`}
                </button>
              )}
            </div>
          </div>

          {/* 기본 정보 블럭 (Klook/Viator 느낌) */}
          <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
            <h1 className="text-[20px] font-semibold sm:text-[24px]">
              {tour.title}
            </h1>
            {tour.subtitle && (
              <p className="mt-1 text-[13px] text-[#555] sm:text-[14px]">
                {tour.subtitle}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] sm:text-[13px]">
              <div className="flex items-center gap-1">
                <span className="text-[16px]">⭐</span>
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
              <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-[#111]">
                {tour.price}
              </span>
            </div>
          </div>
        </section>

        {/* ===== 2. 본문 레이아웃: Left 내용 + Right 예약 카드 (sticky) ===== */}
        <section className="mt-4 grid gap-6 sm:mt-6 sm:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          {/* ----- LEFT: 내용 ----- */}
          <div className="space-y-6">
            {/* 하이라이트 */}
            <section
              id="highlights"
              className="rounded-3xl bg-white p-4 shadow-sm sm:p-5"
            >
              <h2 className="text-[15px] font-semibold sm:text-[16px]">
                Why you’ll love this tour
              </h2>
              {tour.description && (
                <p className="mt-2 text-[13px] text-[#555] sm:text-[14px]">
                  {tour.description}
                </p>
              )}
              {tour.highlights && (
                <ul className="mt-3 space-y-1.5 text-[13px] text-[#444] sm:text-[14px]">
                  {tour.highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <span className="mt-[4px] h-1.5 w-1.5 rounded-full bg-[#0c66ff]" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 일정표 – Klook/Viator 스타일 + Apple 카드 */}
            {tour.schedule && tour.schedule.length > 0 && (
              <section
                id="itinerary"
                className="rounded-3xl bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold sm:text-[16px]">
                    Itinerary
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowFullItinerary((v) => !v)}
                    className="text-[12px] font-medium text-[#007aff]"
                  >
                    {showFullItinerary ? "Collapse" : "Show full itinerary"}
                  </button>
                </div>

                <div
                  className={`mt-3 space-y-2 text-[13px] text-[#444] sm:text-[14px] ${
                    !showFullItinerary ? "max-h-56 overflow-hidden" : ""
                  }`}
                >
                  {tour.schedule.map((item) => (
                    <div
                      key={item.time + item.title}
                      className="flex gap-3 rounded-2xl bg-[#f8f8fa] px-3 py-2.5"
                    >
                      <div className="mt-1 w-16 flex-shrink-0 text-[12px] font-semibold text-[#007aff]">
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
                  <p className="mt-2 text-[11px] text-[#999]">
                    Itinerary may change depending on weather and traffic.
                  </p>
                )}
              </section>
            )}

            {/* 포함/불포함 */}
            {(tour.includes || tour.excludes) && (
              <section className="grid gap-4 rounded-3xl bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5">
                {tour.includes && (
                  <div>
                    <h3 className="mb-2 text-[14px] font-semibold">
                      What’s included
                    </h3>
                    <ul className="space-y-1.5 text-[13px] text-[#444] sm:text-[14px]">
                      {tour.includes.map((inc) => (
                        <li key={inc} className="flex gap-2">
                          <span className="mt-[3px] text-[11px]">✓</span>
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
                    <ul className="space-y-1.5 text-[13px] text-[#444] sm:text-[14px]">
                      {tour.excludes.map((ex) => (
                        <li key={ex} className="flex gap-2">
                          <span className="mt-[3px] text-[11px]">✕</span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* 픽업 정보 */}
            <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-2 text-[15px] font-semibold sm:text-[16px]">
                Pickup & drop-off
              </h2>
              <p className="text-[13px] text-[#444] sm:text-[14px]">
                {tour.pickupInfo}
              </p>
              {tour.notes && (
                <p className="mt-2 text-[12px] text-[#888] sm:text-[13px]">
                  {tour.notes}
                </p>
              )}
            </section>

            {/* 리뷰 */}
            <section
              id="reviews"
              className="rounded-3xl bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold sm:text-[16px]">
                    Reviews
                  </h2>
                  <div className="mt-1 flex items-center gap-2 text-[13px] sm:text-[14px]">
                    <span className="text-[18px]">⭐</span>
                    <span className="font-semibold">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-[#777]">
                      &nbsp;· {reviews.length} reviews
                    </span>
                  </div>
                </div>

                {showAllReviews && reviews.length > 0 && (
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

                {reviews.length === 0 && (
                  <p className="text-[13px] text-[#777]">
                    There are no reviews yet. Be the first to share your
                    experience.
                  </p>
                )}
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
                      rows={4}
                      value={newReview.content}
                      onChange={(e) =>
                        setNewReview((prev) => ({
                          ...prev,
                          content: e.target.value,
                        }))
                      }
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

            {/* FAQ */}
            <section
              id="faq"
              className="rounded-3xl bg-white p-4 shadow-sm sm:p-5"
            >
              <h2 className="mb-2 text-[15px] font-semibold sm:text-[16px]">
                FAQs
              </h2>
              <div className="divide-y divide-[#f0f0f2]">
                {faqs.map((faq, idx) => (
                  <details
                    key={faq.question}
                    className="py-2 text-[13px] sm:text-[14px]"
                    open={idx === 0}
                  >
                    <summary className="cursor-pointer list-none font-medium text-[#111]">
                      {faq.question}
                    </summary>
                    <p className="mt-1 text-[13px] text-[#555] sm:text-[14px]">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          </div>

          {/* ----- RIGHT: 예약 카드 (sticky) ----- */}
          <aside className="sm:sticky sm:top-24">
            <div className="rounded-3xl bg-white p-4 shadow-md sm:p-5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[#888]">
                Check availability
              </div>

              <div className="mt-2 text-[20px] font-semibold sm:text-[22px]">
                {tour.price}
              </div>
              <div className="mt-1 text-[12px] text-[#666]">
                Free cancellation up to 24 hours before (local time).
              </div>

              <div className="mt-4 space-y-3 text-[13px]">
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
                  className="mt-2 w-full rounded-full bg-[#007aff] py-2.5 text-[14px] font-semibold text-white shadow-sm"
                >
                  Check availability &amp; pay deposit
                </button>

                <p className="mt-2 text-[11px] text-[#999]">
                  You’ll be redirected to the next step to complete your
                  booking. Remaining balance can be paid in cash on the tour
                  day.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
