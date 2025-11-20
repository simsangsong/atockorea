// components/Footer.tsx
export default function Footer() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 pb-20">
      <footer className="rounded-3xl border border-gray-200 bg-white px-5 py-6 shadow-sm sm:px-6 sm:py-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Left Column */}
          <div>
            <div className="text-[13px] sm:text-[14px] font-semibold text-gray-900">
              AtoC Korea
            </div>
            <div className="mt-1 text-[11px] sm:text-[12px] text-gray-600 leading-relaxed space-y-0.5">
              <p>
                <span className="font-medium text-gray-800">Business Registration Number:</span> 09898099
              </p>
              <p>
                <span className="font-medium text-gray-800">E-commerce Registration Number:</span> Jeju Yeondong-0000
              </p>
              <p>
                <span className="font-medium text-gray-800">Address:</span> Yeondong, Jeju City, xxxx, xxho
              </p>
              <p>
                <span className="font-medium text-gray-800">Contact:</span> 010-8973-0913
              </p>
              <p>
                <span className="font-medium text-gray-800">Email:</span>{" "}
                <a href="mailto:support@atoc.kr" className="underline-offset-2 hover:underline">
                  support@atoc.kr
                </a>
              </p>
            </div>

            <div className="flex items-center gap-6 mt-4">
              <span className="text-[11px] sm:text-[12px] text-gray-700 font-medium">
                Contact: 010-8973-0913
              </span>

              <img
                src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg"
                className="h-5"
                alt="PayPal"
              />

              <img
                src="https://upload.wikimedia.org/wikipedia/commons/4/4f/Stripe_Logo%2C_revised_2016.png"
                className="h-5"
                alt="Stripe"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="flex flex-col justify-between">
            <div className="flex flex-wrap gap-3 text-[11px] sm:text-[12px] text-gray-600 mt-1">
              <button className="underline-offset-2 hover:underline">Terms of Service</button>
              <span className="text-gray-300">|</span>
              <button className="underline-offset-2 hover:underline">Privacy Policy</button>
              <span className="text-gray-300 hidden sm:inline">|</span>
              <span className="text-gray-500 hidden sm:inline">EN / 中文 / 日本語 support</span>
            </div>

            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="text-[11px] sm:text-[12px] text-gray-700 font-medium">
                Secure online payments processed via global providers.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-[11px] sm:text-[12px] text-gray-500">
          © AtoC Korea. All rights reserved.
        </p>
      </footer>
    </section>
  );
}
