'use client'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative mt-8">
      {/* Gradient Transition */}
      <div className="h-20 bg-gradient-to-b from-transparent via-slate-200/30 to-slate-900" />
      
      {/* Main Footer */}
      <div className="bg-slate-900 text-slate-300 py-14 md:py-16 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Footer Grid */}
          <div className="grid md:grid-cols-4 gap-10 md:gap-12 mb-10 pb-10 border-b border-slate-800">
            {/* Company Info */}
            <div>
              <h4 className="font-semibold text-[11px] text-white/90 mb-5 uppercase tracking-[0.15em]">Company</h4>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li>
                  <span className="text-slate-500">Name:</span> AtoC Korea
                </li>
                <li>
                  <span className="text-slate-500">Entity:</span> LLC
                </li>
                <li>
                  <span className="text-slate-500">State:</span> Wyoming
                </li>
                <li>
                  <span className="text-slate-500">Industry:</span> Travel agency
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-semibold text-[11px] text-white/90 mb-5 uppercase tracking-[0.15em]">Contact</h4>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li>+82 10 9780 8027</li>
                <li>+1 (307) 533-2194</li>
                <li className="text-sky-400/90">support@atockorea.com</li>
              </ul>
              <div className="mt-5 pt-5 border-t border-slate-800">
                <p className="text-xs text-slate-500 leading-relaxed">
                  <span className="text-slate-400">Address:</span>
                  <br />
                  302, 32, Doryeong-ro 7-gil, Jeju-si, Jeju-do
                </p>
                <p className="text-xs text-slate-500 leading-relaxed mt-2">
                  <span className="text-slate-400">Registered:</span>
                  <br />
                  30 N Gould St, STE R, Sheridan, WY 82801, USA
                </p>
              </div>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-semibold text-[11px] text-white/90 mb-5 uppercase tracking-[0.15em]">Support</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="#" className="text-slate-400 hover:text-white transition-colors">
                    Booking Help
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-white transition-colors">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-white transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-[11px] text-white/90 mb-5 uppercase tracking-[0.15em]">Legal</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="#" className="text-slate-400 hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-white transition-colors">
                    Cookie Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-white transition-colors">
                    Refund Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <p className="text-sm text-slate-500">
              &copy; {year} AtoC Korea. All rights reserved.
            </p>
            
            <div className="flex items-center gap-5">
              <span className="text-xs text-slate-500">Licensed & insured travel partner</span>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-md border border-slate-700/50">
                <svg className="w-10 h-6" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 5h40v15H10z" fill="#6772E5"/>
                  <text x="30" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">stripe</text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
