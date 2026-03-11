'use client';

import { useState } from 'react';
import { MapPin, Check, X, Shield, Clock, Globe, ChevronRight, Star, Navigation } from 'lucide-react';

// ================= TIMELINE CARD COMPONENT =================
function TimelineCard({ time, title, image, subtitle, description, dotClass, borderClass, textClass }: any) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="pl-6 sm:pl-8 relative w-full">
      <div className={`absolute -left-[9px] top-0 w-4 h-4 ${dotClass} border-4 border-[#F9FAFB] rounded-full shadow-sm`} />
      <div className="font-extrabold text-xs sm:text-sm text-neutral-900 mb-2 sm:mb-3">{time}</div>
      
      <div className={`bg-white rounded-xl sm:rounded-2xl shadow-sm border-l-4 ${borderClass} overflow-hidden`}>
        <div className="relative h-48 sm:h-56 w-full">
          <img src={image} alt={title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4 sm:p-6">
            <h3 className="font-extrabold text-white text-lg sm:text-2xl drop-shadow-md tracking-tight">{title}</h3>
          </div>
        </div>
        
        <div className="p-4 sm:p-6">
          <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-2 ${textClass}`}>{subtitle}</p>
          <div className={`text-xs sm:text-sm text-neutral-600 leading-relaxed font-medium transition-all duration-300 ${isExpanded ? '' : 'line-clamp-1'}`}>
            {description}
          </div>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-sky-600 font-bold text-[11px] sm:text-xs hover:text-sky-800 transition-colors focus:outline-none"
          >
            {isExpanded ? '접기' : '더 보기'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TourDetailPage() {
  
  const timelineData = [
    {
      time: "09:00 AM",
      title: "Hotel Pickup & Departure",
      image: "https://images.unsplash.com/photo-1542314831-c6a4d1424b91?auto=format&fit=crop&q=80",
      subtitle: "Jeju City Center",
      description: "Relax on a scenic drive through the beautiful island as we head south. Our comfortable, air-conditioned vehicle and expert guide ensure a pleasant and informative start to your day.",
      dotClass: "bg-[#E85D22]",
      borderClass: "border-[#E85D22]",
      textClass: "text-[#E85D22]"
    },
    {
      time: "10:30 AM",
      title: "Jeongbang Waterfall",
      image: "https://images.unsplash.com/photo-1543731068-7e0f5beff43a?auto=format&fit=crop&q=80",
      subtitle: "Ocean-bound Waterfall",
      description: "Experience the only waterfall in Asia that falls directly into the ocean. Feel the mist, hear the crashing waves, and capture breathtaking photos by the majestic basalt cliffs.",
      dotClass: "bg-[#0EA5E9]",
      borderClass: "border-[#0EA5E9]",
      textClass: "text-[#0EA5E9]"
    },
    {
      time: "13:00 PM",
      title: "Camellia Hill",
      image: "https://images.unsplash.com/photo-1617066927352-780c102a0b33?auto=format&fit=crop&q=80",
      subtitle: "Jeju's Blossoming Paradise",
      description: "Home to over 6,000 camellia trees, this sprawling botanical garden blooms magnificently from winter to spring. Take an optional tangerine-picking experience and stroll through beautifully curated floral paths.",
      dotClass: "bg-[#F59E0B]",
      borderClass: "border-[#F59E0B]",
      textClass: "text-[#F59E0B]"
    }
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-neutral-900 font-sans pb-32 lg:pb-24">
      
      {/* ================= HERO SECTION ================= */}
      <div className="relative w-full h-[380px] sm:h-[450px] lg:h-[550px]">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516025068211-1a40307ecbd5?auto=format&fit=crop&q=80')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pt-4 sm:pt-10">
          <span className="bg-[#E85D22] text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-3 sm:px-4 py-1.5 rounded-full mb-3 shadow-lg">
            Trusted by 50,000+ Travelers
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-md px-2 max-w-4xl leading-tight">
            Jeju: Southern Top UNESCO Spots Bus Tour
          </h1>
          <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-white/90 drop-shadow-sm px-4">
            <div className="flex items-center space-x-1 text-amber-400">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </div>
            <span className="text-base sm:text-lg font-bold">4.9</span>
            <span className="text-xs sm:text-sm font-medium opacity-90">(637 reviews)</span>
          </div>
        </div>
      </div>

      {/* ================= MAIN CONTENT & SIDEBAR ================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 -mt-16 sm:-mt-24 lg:-mt-32 flex flex-col lg:flex-row gap-8 lg:gap-12">
        
        {/* 🟢 LEFT: MAIN CONTENT */}
        <div className="lg:w-2/3 flex flex-col gap-10 sm:gap-16">
          
          {/* 1. Why Choose Us (초압축 슬림 디자인) */}
          <div className="bg-white rounded-2xl sm:rounded-full p-4 sm:px-8 sm:py-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)] lg:mx-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs text-neutral-900 leading-none">Secure Deposit</h3>
                <p className="text-[10px] text-neutral-500 mt-1 font-medium">Pay the rest on site</p>
              </div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-neutral-100"></div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-sky-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs text-neutral-900 leading-none">10+ Years Exp.</h3>
                <p className="text-[10px] text-neutral-500 mt-1 font-medium">Expert local guides</p>
              </div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-neutral-100"></div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs text-neutral-900 leading-none">Verified LLC</h3>
                <p className="text-[10px] text-neutral-500 mt-1 font-medium">Globally standardized</p>
              </div>
            </div>
          </div>

          {/* 2. Photo Gallery */}
          <div className="flex flex-col items-center">
            <span className="bg-rose-50 text-rose-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 shadow-inner">Gallery</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 sm:mb-8 text-neutral-900">Captured Moments</h2>
            
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:px-6">
              <div className="relative h-48 sm:h-80 w-full rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-sm">
                <img src="https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&q=80" alt="Jeju Waterfall" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="grid grid-rows-2 gap-3 sm:gap-4 h-48 sm:h-80 w-full">
                <div className="relative w-full h-full rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-sm">
                  <img src="https://images.unsplash.com/photo-1560969567-930f3c5ec8cb?auto=format&fit=crop&q=80" alt="Jeju Scenery" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="relative w-full h-full rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-sm cursor-pointer group">
                  <img src="https://images.unsplash.com/photo-1628155930542-3c7a64e2c848?auto=format&fit=crop&q=80" alt="Jeju Culture" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                    <span className="text-white font-extrabold text-lg tracking-wide">+12 Photos</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Timeline Section (넓어진 컨테이너 max-w-4xl) */}
          <div className="flex flex-col items-center">
            <span className="bg-sky-50 text-sky-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 shadow-inner">Your Day at a Glance</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 text-center text-neutral-900">The Adventure Unfolds</h2>
            <p className="text-sm sm:text-base text-neutral-500 font-medium text-center mb-8 sm:mb-12">A cinematic day trip through Korea's most iconic landscapes</p>
            
            <div className="w-full max-w-4xl relative border-l-2 border-neutral-200 ml-4 sm:ml-8 space-y-8 sm:space-y-12">
              {timelineData.map((item, index) => (
                <TimelineCard key={index} {...item} />
              ))}
            </div>
          </div>

          {/* 4. Meeting & Pickup Details (새롭고 깔끔한 레이아웃) */}
          <div className="flex flex-col items-center">
            <span className="bg-indigo-50 text-indigo-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 shadow-inner">Logistics</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 sm:mb-8 text-neutral-900">Meeting & Pickup</h2>
            
            <div className="w-full bg-white rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 shadow-sm border border-neutral-100 flex flex-col lg:flex-row gap-8 items-stretch lg:px-8">
              
              {/* 좌측: 리스트 형태의 텍스트 설명 */}
              <div className="flex-1 flex flex-col justify-center space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h3 className="font-extrabold text-lg sm:text-xl text-neutral-900">Pickup Points</h3>
                </div>
                
                <ul className="space-y-4">
                  <li className="flex items-start gap-4 p-4 rounded-2xl bg-[#F9F8F6] border border-neutral-100 transition-colors hover:border-indigo-200">
                    <div className="w-6 h-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center font-bold text-xs shrink-0 text-neutral-700 shadow-sm">1</div>
                    <div>
                      <h4 className="font-bold text-sm text-neutral-900">Jeju Airport (Gate 3)</h4>
                      <p className="text-xs text-neutral-500 mt-1 font-medium">08:30 AM</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4 p-4 rounded-2xl bg-[#F9F8F6] border border-neutral-100 transition-colors hover:border-indigo-200">
                    <div className="w-6 h-6 rounded-full bg-white border border-neutral-200 flex items-center justify-center font-bold text-xs shrink-0 text-neutral-700 shadow-sm">2</div>
                    <div>
                      <h4 className="font-bold text-sm text-neutral-900">Jeju City Center Hotel</h4>
                      <p className="text-xs text-neutral-500 mt-1 font-medium">09:00 AM (Confirmed via WhatsApp)</p>
                    </div>
                  </li>
                </ul>

                <div className="bg-indigo-50/50 rounded-xl p-4 flex items-center gap-3 mt-2">
                  <Navigation className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span className="text-xs font-medium text-neutral-600 leading-relaxed">Exact pickup times will be communicated 1 day prior to the tour.</span>
                </div>
              </div>

              {/* 우측: 깔끔한 지도 이미지 */}
              <div className="flex-1 w-full min-h-[250px]">
                <img 
                  src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80" 
                  alt="Map Location Placeholder" 
                  className="w-full h-full object-cover rounded-[1.5rem] shadow-inner border border-neutral-100" 
                />
              </div>
            </div>
          </div>

          {/* 5. At a Glance Section */}
          <div className="flex flex-col items-center">
            <span className="bg-yellow-50 text-amber-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 shadow-inner">Quick Info</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 sm:mb-8 text-neutral-900">At a Glance</h2>
            
            <div className="w-full grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4 lg:px-6">
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 flex flex-col items-center justify-center text-center shadow-sm border border-neutral-100">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-orange-50 flex items-center justify-center mb-2 sm:mb-3 shadow-inner">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Duration</span>
                <span className="font-extrabold text-sm sm:text-base text-neutral-900">10 hours</span>
              </div>
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 flex flex-col items-center justify-center text-center shadow-sm border border-neutral-100">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-sky-50 flex items-center justify-center mb-2 sm:mb-3 shadow-inner">
                  <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Languages</span>
                <span className="font-extrabold text-xs sm:text-base text-neutral-900">En, 中文, KR</span>
              </div>
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:px-6">
              <div className="bg-[#F0FDF4] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 border border-emerald-100/50 shadow-sm">
                <h3 className="font-bold flex items-center gap-2 mb-3 sm:mb-4 text-sm sm:text-base text-neutral-900">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" /> Included
                </h3>
                <ul className="space-y-2 sm:space-y-3">
                  {['All entry tickets (admission fees)', 'UNESCO bus tour', 'English and Chinese-speaking guide', 'Toll fee', 'Parking fee', 'Fuel fee'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-neutral-700 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#FEF2F2] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 border border-red-100/50 shadow-sm">
                <h3 className="font-bold flex items-center gap-2 mb-3 sm:mb-4 text-sm sm:text-base text-neutral-900">
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" /> Not included
                </h3>
                <ul className="space-y-2 sm:space-y-3">
                  {['Food (Lunch Fees)', 'Personal Expenses', 'Personal travel insurance'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-neutral-700 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

        </div>

        {/* 🟢 RIGHT: CHECKOUT FORM (럭셔리 샌드 & 스카이 톤 전면 개편) */}
        <div className="lg:w-1/3 mt-4 lg:mt-0">
          <div className="sticky top-8 bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-neutral-100">
            
            {/* Price Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-2 text-neutral-400 mb-1">
                <span className="line-through text-lg">₩80,000</span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md shadow-inner">13% Off</span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold tracking-tight text-neutral-900">₩70,000</span>
                <span className="text-neutral-500 font-medium">/ person</span>
              </div>
            </div>

            {/* Form Inputs (샌드톤 배경) */}
            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Select Date</label>
                <input type="date" className="w-full bg-[#F9F8F6] border-none text-neutral-900 font-medium rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-neutral-200 transition-all shadow-inner" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Guests</label>
                  <div className="flex items-center justify-between bg-[#F9F8F6] rounded-xl px-4 py-3.5 shadow-inner">
                    <button className="text-neutral-400 hover:text-neutral-900 font-bold">-</button>
                    <span className="font-extrabold text-neutral-900">1</span>
                    <button className="text-neutral-400 hover:text-neutral-900 font-bold">+</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Pickup</label>
                  <select className="w-full bg-[#F9F8F6] border-none text-neutral-900 font-medium rounded-xl px-4 py-3.5 outline-none appearance-none shadow-inner">
                    <option>Select Location</option>
                    <option>Jeju Center</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Payment Methods (샌드 & 스카이 톤) */}
            <div className="space-y-3 mb-8">
              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Payment Option</label>
              <label className="relative flex cursor-pointer rounded-xl border border-sky-100 bg-[#EEF2F6] p-4 focus:outline-none transition-colors">
                <input type="radio" name="payment" className="sr-only" defaultChecked />
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 rounded-full border-[5px] border-neutral-900 bg-white shadow-sm" />
                  <div>
                    <p className="font-bold text-neutral-900 text-sm">Deposit + Cash</p>
                    <p className="text-xs text-neutral-500 font-medium mt-0.5">Pay ₩1,000 now, rest on site</p>
                  </div>
                </div>
              </label>
              <label className="relative flex cursor-pointer rounded-xl border border-transparent bg-[#F4F1EA] p-4 focus:outline-none hover:border-neutral-200 transition-colors">
                <input type="radio" name="payment" className="sr-only" />
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 rounded-full border-2 border-neutral-300 bg-white shadow-sm" />
                  <div>
                    <p className="font-bold text-neutral-900 text-sm">Full Payment</p>
                    <p className="text-xs text-neutral-500 font-medium mt-0.5">Pay ₩70,000 online now</p>
                  </div>
                </div>
              </label>
            </div>

            {/* Desktop CTA */}
            <div className="border-t border-neutral-100 pt-6 hidden lg:block">
              <div className="flex items-center justify-between mb-6">
                <span className="text-neutral-500 font-medium">Due Today (Deposit)</span>
                <span className="text-2xl font-extrabold text-neutral-900">₩1,000</span>
              </div>
              <button className="w-full bg-neutral-900 text-white rounded-xl py-4 font-bold tracking-wide flex items-center justify-center space-x-2 hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-900/20">
                <span>Confirm Booking</span>
                <ChevronRight className="w-5 h-5" />
              </button>
              <p className="text-center text-xs text-neutral-400 mt-4">Free cancellation up to 24 hours before</p>
            </div>
          </div>
        </div>

      </div>

      {/* ================= 🔵 MOBILE STICKY BOTTOM BAR ================= */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-neutral-200/50 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-baseline space-x-1">
              <span className="text-lg font-bold text-neutral-900">₩70,000</span>
              <span className="text-xs text-neutral-500 font-medium">/ person</span>
            </div>
            <p className="text-[10px] text-emerald-600 font-medium">₩1,000 Deposit Today</p>
          </div>
          <button className="flex-1 bg-neutral-900 text-white rounded-xl py-4 font-bold tracking-wide flex items-center justify-center space-x-2 hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-900/20">
            <span>Book Now</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
