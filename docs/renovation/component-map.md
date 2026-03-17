# Component Map (Phase 0)

**Purpose:** Identify shared components and their usage for incremental UI renovation. No behavior changes.

---

## 1. Shell / Layout (high reuse)

| Component | Path | Used by (pages) |
|-----------|------|------------------|
| Header | `components/Header.tsx` | page (home), [locale], signin, signup, cart, checkout, support, refund-policy, legal, contact, about, dsa, forgot-password, forgot-id, reset-password, tour/[id], tour/[id]/checkout, tour/[id]/confirmation, custom-join-tour, custom-join-tour/proposed, mypage/layout, tours/list, admin/emails |
| Footer | `components/Footer.tsx` | Same set as Header wherever shell is used |
| BottomNav | `components/BottomNav.tsx` | Same set as Header (except admin/emails) |
| ErrorBoundary | `components/ErrorBoundary.tsx` | app/layout.tsx |

**Notes:** Header contains auth state (Supabase session), currency selector, search, nav links. Do not change auth or navigation logic during presentation-only refactors.

---

## 2. Homepage-specific

| Component | Path | Used by |
|-----------|------|--------|
| HeroSection | `components/HeroSection.tsx` | page, [locale] |
| CompactTrustBar | `components/CompactTrustBar.tsx` | page |
| TrustBar | `components/TrustBar.tsx` | [locale] |
| HeroTrustBar | `components/HeroTrustBar.tsx` | (internal or unused in app) |
| HeroPaymentStrip | `components/HeroPaymentStrip.tsx` | (internal or unused in app) |
| DestinationsCards | `components/DestinationsCards.tsx` | page, [locale] |
| HomeTourSections | `components/HomeTourSections.tsx` | page |
| TourSectionRow | `components/TourSectionRow.tsx` | HomeTourSections |
| TourList | `components/TourList.tsx` | [locale] |
| PaymentMethodInfo | `components/PaymentMethodInfo.tsx` | [locale] |
| LocaleHomeClient | `components/LocaleHomeClient.tsx` | [locale] |
| ProposeButton | `components/ProposeButton.tsx` | DestinationsCards (ProposeTransitionLink) |

---

## 3. Tour cards and list

| Component | Path | Used by |
|-----------|------|--------|
| TourCard | `components/TourCard.tsx` | jeju page, TourSectionRow, tour/RelatedTours |
| TourCardDetail | `components/TourCardDetail.tsx` | search, tours/list |
| DetailedTourCard | `components/tours/DetailedTourCard.tsx` | (tours feature) |
| TourList | `components/TourList.tsx` | [locale] |
| TourSectionRow | `components/TourSectionRow.tsx` | HomeTourSections |

---

## 4. Tour detail page

| Component | Path | Used by |
|-----------|------|--------|
| TourOverviewContent | `components/tour/TourOverviewContent.tsx` | tour/[id], jeju/[slug] |
| FaqAccordion | `components/tour/FaqAccordion.tsx` | tour/[id] |
| ImportantNotesContent | `components/tour/ImportantNotesContent.tsx` | tour/[id] |
| TourReviewsSection | `components/tour/TourReviewsSection.tsx` | tour/[id] |
| EnhancedBookingSidebar | `components/tour/EnhancedBookingSidebar.tsx` | tour/[id] (dynamic import) |
| BookingSidebar | `components/tour/BookingSidebar.tsx` | (likely used inside Enhanced or legacy path) |
| InteractiveMap | `components/maps/InteractiveMap.tsx` | tour/[id] (dynamic), tour/MeetingPoint |
| GalleryGrid | `components/tour/GalleryGrid.tsx` | jeju/[slug] |
| RelatedTours | `components/tour/RelatedTours.tsx` | (detail related) |
| HeroImage | `components/tour/HeroImage.tsx` | (detail hero) |
| KeyInfoBar | `components/tour/KeyInfoBar.tsx` | (detail key info) |
| VisualItinerary | `components/tour/VisualItinerary.tsx` | (detail itinerary) |
| ItineraryTimeline | `components/tour/ItineraryTimeline.tsx` | (detail timeline) |
| ActionButtons | `components/tour/ActionButtons.tsx` | (detail actions) |
| MeetingPoint | `components/tour/MeetingPoint.tsx` | (detail meeting) |
| CollapsibleSection | `components/tour/CollapsibleSection.tsx` | (detail sections) |

---

## 5. Maps and place/hotel

| Component | Path | Used by |
|-----------|------|--------|
| HotelMapPicker | `components/maps/HotelMapPicker.tsx` | custom-join-tour (dynamic) |
| PlaceSearch | `components/maps/PlaceSearch.tsx` | (builder/search) |
| PickupPointSelector | `components/maps/PickupPointSelector.tsx` | tour/BookingSidebar, admin/products |
| ItineraryMapWithSearch | `components/maps/ItineraryMapWithSearch.tsx` | custom-join-tour (dynamic) |
| InteractiveMap | `components/maps/InteractiveMap.tsx` | tour/[id], MeetingPoint |

---

## 6. Picker / form primitives

| Component | Path | Used by |
|-----------|------|--------|
| CustomCalendar | `components/CustomCalendar.tsx` | custom-join-tour |
| CustomPicker (CustomTimePicker, CustomSelect) | `components/CustomPicker.tsx` | custom-join-tour |

---

## 7. Builder / custom-join-tour

| Component | Path | Used by |
|-----------|------|--------|
| RobotMascot | `components/RobotMascot.tsx` | custom-join-tour |
| HotelMapPicker | `components/maps/HotelMapPicker.tsx` | custom-join-tour |
| ItineraryMapWithSearch | `components/maps/ItineraryMapWithSearch.tsx` | custom-join-tour |
| CustomCalendar | `components/CustomCalendar.tsx` | custom-join-tour |
| CustomPicker | `components/CustomPicker.tsx` | custom-join-tour |

---

## 8. Checkout / payment / contact

| Component | Path | Used by |
|-----------|------|--------|
| PaymentMethodInfo | `components/PaymentMethodInfo.tsx` | [locale] |
| ContactForm | `components/ContactForm.tsx` | contact |

Checkout page (`tour/[id]/checkout`) uses inline form and order summary; no dedicated shared checkout components listed here.

---

## 9. Icons and UI primitives

| Component | Path | Used by |
|-----------|------|--------|
| Icons | `components/Icons.tsx` | Many: cart, mypage/*, tour/EnhancedBookingSidebar, tour/BookingSidebar, tour/ActionButtons, tours/DetailedTourCard, DestinationsCards, etc. |
| Logo | `components/Logo.tsx` | Header (assumed) |
| LanguageSwitcher | `components/LanguageSwitcher.tsx` | Header (assumed) |

---

## 10. Admin

| Component | Path | Used by |
|-----------|------|--------|
| BookingStatusBadge | `components/admin/BookingStatusBadge.tsx` | admin/orders, admin/page |
| ImageUploader | `components/admin/ImageUploader.tsx` | admin/upload |
| PickupPointSelector | `components/maps/PickupPointSelector.tsx` | admin/products |

---

## 11. Design system (existing, not yet wired)

| Asset | Path | Notes |
|-------|------|--------|
| timeline | `src/components/ui/timeline.tsx` | UI primitive (spec: booking timeline) |
| tokens | `src/design/tokens.ts` | Design tokens |
| copy | `src/design/copy.ts` | Copy constants |
| status | `src/design/status.ts` | Status config |
| motion | `src/design/motion.ts` | Motion config |
| analytics | `src/design/analytics.ts` | Analytics helpers |

---

## 12. Summary for migration

- **Highest impact (many pages):** Header, Footer, BottomNav. Change only presentation (e.g. design tokens, spacing); keep auth and nav behavior.
- **Homepage-only (safe to restyle first):** HeroSection, CompactTrustBar, TrustBar, DestinationsCards, HomeTourSections, TourSectionRow, TourList, PaymentMethodInfo.
- **Tour detail:** EnhancedBookingSidebar, TourOverviewContent, FaqAccordion, ImportantNotesContent, TourReviewsSection. Sidebar touches booking/pricing — treat as higher risk; wrap with adapters before changing data flow.
- **Tour cards:** TourCard, TourCardDetail. List/detail pages consume API data; introduce adapters (e.g. tours-adapter) before changing card props.
- **Builder:** custom-join-tour page is a single large component with maps, calendar, and payment; refactor in steps (presentation first, then adapter for proposed/generate payloads).
- **Checkout/My Tour:** Inline forms and API calls; add trust copy and layout first, do not change POST/GET flows or payment redirects.

This map should be used together with `risk-map.md` and `migration-plan.md` to decide order of refactors.
