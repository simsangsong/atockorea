import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-300 border-t border-gray-700/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Company Info */}
        <div className="mb-6">
          <h3 className="text-white font-bold text-lg mb-3">AtoC Korea</h3>
          <p className="text-xs mb-3">
            Licensed Korea-based platform for Korea's day tours. Direct partnership with local travel agencies.
          </p>
          <div className="space-y-1 text-xs">
            <p>Business Registration: 09898099</p>
            <p>E-commerce Registration: Jeju Yeondong-0000</p>
          </div>
        </div>

        {/* Contact & Payment Info - Single Row */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Address */}
            <div>
              <p className="text-xs">
                <span className="font-semibold">Address:</span> Yeondong, Jeju City, xxxx, xxho
              </p>
            </div>
            {/* Contact */}
            <div>
              <p className="text-xs mb-1">
                <span className="font-semibold">Contact:</span> 010-8973-0913
              </p>
              <p className="text-xs">
                <span className="font-semibold">Email:</span> support@atoc.kr
              </p>
            </div>
            {/* Payment Methods */}
            <div>
              <p className="text-xs mb-2 font-semibold">Secure Payment Methods</p>
              <div className="flex items-center gap-3">
                {/* PayPal Logo */}
                <div className="px-3 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center justify-center h-10 min-w-[70px]">
                  <svg width="70" height="20" viewBox="0 0 70 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* PayPal Double P Icon */}
                    <g>
                      {/* First P - Dark Blue */}
                      <path d="M6 3H2V17H6C8.2 17 10 15.2 10 13C10 10.8 8.2 9 6 9H4V3H6Z" fill="#003087"/>
                      <path d="M4 11H6C7.1 11 8 11.9 8 13C8 14.1 7.1 15 6 15H4V11Z" fill="#003087"/>
                      {/* Second P - Light Blue (overlapping) */}
                      <path d="M9 3H5V17H9C11.2 17 13 15.2 13 13C13 10.8 11.2 9 9 9H7V3H9Z" fill="#009CDE"/>
                      <path d="M7 11H9C10.1 11 11 11.9 11 13C11 14.1 10.1 15 9 15H7V11Z" fill="#009CDE"/>
                    </g>
                    {/* PayPal Text */}
                    <text x="18" y="14" fontSize="11" fontWeight="700" fill="#003087" fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="-0.3">PayPal</text>
                  </svg>
                </div>
                {/* Stripe Logo */}
                <div className="px-3 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center justify-center h-10 overflow-hidden">
                  <Image
                    src="https://cdn.worldvectorlogo.com/logos/stripe-4.svg"
                    alt="Stripe"
                    width={50}
                    height={18}
                    className="object-contain max-w-full max-h-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* About, Support, Legal - Same Row */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-6">
          {/* About */}
          <div>
            <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">About Us</h3>
            <ul className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Our Story
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Why Choose Us
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Partners
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Careers
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">Support</h3>
            <ul className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  FAQs
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Cancellation Policy
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">Legal</h3>
            <ul className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Cookie Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-800">
          <p>© 2025 AtoC Korea. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

