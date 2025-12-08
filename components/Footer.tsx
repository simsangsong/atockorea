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
                <div className="px-3 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center justify-center h-10 min-w-[80px]">
                  <Image
                    src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg"
                    alt="PayPal"
                    width={80}
                    height={22}
                    className="object-contain max-w-full max-h-full"
                  />
                </div>
                {/* Stripe Logo */}
                <div className="px-3 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center justify-center h-10 min-w-[60px]">
                  <Image
                    src="https://cdn.brandfetch.io/idxAg10C0L/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX&t=1746435914582"
                    alt="Stripe"
                    width={60}
                    height={20}
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

