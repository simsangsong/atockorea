# Tour Mode Setup

Tour Mode is for customers who have a booking: they see their tour’s guide content, bus details, facilities, and departure alarms in the app.

## 1. Database migration

Run the migration in Supabase SQL Editor:

- File: `supabase/migrations/tour_mode_schema.sql`

This creates:

- **tour_guide_spots** – Audio spots per tour (title, description, audio_url, lat/lng, trigger_radius_m).
- **tour_facilities** – Restrooms, ticket offices, convenience, restaurants (type, name, lat/lng, details).
- **tour_bus_details** – Bus info per tour date (payload JSON: bus_number, driver_phone, departure_time, etc.).
- **bookings.booking_reference** – Optional short reference for guest lookup.

## 2. APIs

### App (customer)

- **GET /api/tour-mode/bookings**  
  - Auth required.  
  - Returns current user’s upcoming **confirmed** bookings (tour_date ≥ today).

- **GET /api/tour-mode/booking/[id]/content**  
  - Returns full Tour Mode content for one booking.  
  - **Access:**  
    - Logged-in user who owns the booking, or  
    - Guest: query params `contactName`, `contactEmail` (or `contactPhone`) must match the booking.  
  - **Response:**  
    - booking (id, tour_date, tour_time, tours, pickup_points)  
    - tour_guide_spots  
    - tour_facilities  
    - bus_detail (if set for that tour_date)  
    - schedule (for departure alarms)

### Admin

- **PATCH /api/admin/tours/[id]**  
  - Body can include:  
    - **tour_guide_spots**: array of `{ title, description, audio_url, latitude, longitude, trigger_radius_m, sort_order }`.  
    - **tour_facilities**: array of `{ type, name, latitude, longitude, details?, sort_order }`.  
  - Replaces all guide spots and all facilities for that tour.

- **GET /api/admin/tours/[id]/tour-mode**  
  - Returns current tour_guide_spots and tour_facilities for the tour (for admin edit form).

- **POST /api/admin/tours/[id]/bus-detail**  
  - Body: `{ tour_date: "YYYY-MM-DD", payload: { bus_number?, driver_phone?, departure_time?, ... } }`.  
  - Upserts bus detail for that tour date (e.g. sent the day before).

- **GET /api/admin/tours/[id]/bus-detail?tour_date=YYYY-MM-DD**  
  - Returns bus detail for that tour date.

## 3. Schedule and departure alarms

- **tours.schedule** can include **departure_time** per item (e.g. `"09:00"`).  
- In the app, Tour Mode uses **tour_date** + **departure_time** to schedule in-app alerts **10, 5, and 2 minutes** before each departure.  
- If the user toggles **“I’m on the bus”**, remaining departure alarms for that day are not shown.

## 4. App flow

1. **Tour Mode** tab:  
   - Logged in: list of upcoming confirmed bookings.  
   - Not logged in: **Guest lookup** (Booking ID + name + email).
2. User selects a booking or completes guest lookup → app calls **GET /api/tour-mode/booking/[id]/content** and shows:  
   - Bus details (if sent).  
   - “I’m on the bus” toggle.  
   - Schedule (with “Alarm 10/5/2 min before” note where departure_time exists).  
   - Audio spots (GPS auto-play + manual play).  
   - Facilities (restroom, ticket office, etc.).
3. Departure alarms run in the background for the current day; they are cleared when the user turns on “I’m on the bus”.

## 5. Optional: real-time bus location

- Not implemented in this phase.  
- Later: admin/driver can send bus location; app can poll or subscribe and show it on a map.  
- Tables/APIs above do not change; add a separate “bus location” endpoint/table when needed.
