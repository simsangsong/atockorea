'use client';

import Image from 'next/image';
import { useTranslations } from '@/lib/i18n';

export default function Footer() {
  const t = useTranslations();
  
  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-300 border-t border-gray-700/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Company Info */}
        <div className="mb-6">
          <h3 className="text-white font-bold text-lg mb-3">{t('home.footer.company')}</h3>
          <p className="text-xs mb-3">
            {t('home.footer.description')}
          </p>
          <div className="space-y-1 text-xs">
            <p>{t('home.footer.businessReg')}: 09898099</p>
            <p>{t('home.footer.ecommerceReg')}: Jeju Yeondong-0000</p>
          </div>
        </div>

        {/* Contact & Payment Info - Single Row */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Address */}
            <div>
              <p className="text-xs">
                <span className="font-semibold">{t('home.footer.address')}:</span> Yeondong, Jeju City, xxxx, xxho
              </p>
            </div>
            {/* Contact */}
            <div>
              <p className="text-xs mb-1">
                <span className="font-semibold">{t('home.footer.contact')}:</span> 010-8973-0913
              </p>
              <p className="text-xs">
                <span className="font-semibold">{t('home.footer.email')}:</span> support@atoc.kr
              </p>
            </div>
            {/* Payment Methods */}
            <div>
              <p className="text-xs mb-2 font-semibold">{t('home.footer.securePayment')}</p>
              <div className="flex items-center gap-3">
                {/* PayPal Logo */}
                <div className="px-3 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center justify-center h-10 min-w-[80px]">
                  <Image
                    src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg"
                    alt="PayPal"
                    width={80}
                    height={22}
                    style={{ width: 'auto', height: 'auto' }}
                    className="object-contain max-w-full max-h-full"
                  />
                </div>
                {/* Stripe Logo */}
                <div className="px-3 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center justify-center h-10 min-w-[60px]">
                  <Image
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Stripe_logo%2C_revised_2014.png/960px-Stripe_logo%2C_revised_2014.png"
                    alt="Stripe"
                    width={60}
                    height={20}
                    style={{ width: 'auto', height: 'auto' }}
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
            <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">{t('home.footer.aboutUs')}</h3>
            <ul className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
              <li>
                <a href="/about" className="hover:text-white transition-colors">
                  {t('home.footer.ourStory')}
                </a>
              </li>
              <li>
                <a href="/about" className="hover:text-white transition-colors">
                  {t('home.footer.whyChooseUs')}
                </a>
              </li>
              <li>
                <a href="/about" className="hover:text-white transition-colors">
                  {t('home.footer.partners')}
                </a>
              </li>
              <li>
                <a href="/about" className="hover:text-white transition-colors">
                  {t('home.footer.careers')}
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">{t('home.footer.support')}</h3>
            <ul className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
              <li>
                <a href="/support" className="hover:text-white transition-colors">
                  {t('home.footer.bookingHelp')}
                </a>
              </li>
              <li>
                <a href="/support" className="hover:text-white transition-colors">
                  {t('home.footer.contactUs')}
                </a>
              </li>
              <li>
                <a href="/support" className="hover:text-white transition-colors">
                  {t('home.footer.faq')}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">{t('home.footer.legal')}</h3>
            <ul className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
              <li>
                <a href="/legal" className="hover:text-white transition-colors">
                  {t('home.footer.terms')}
                </a>
              </li>
              <li>
                <a href="/legal" className="hover:text-white transition-colors">
                  {t('home.footer.privacy')}
                </a>
              </li>
              <li>
                <a href="/legal" className="hover:text-white transition-colors">
                  {t('home.footer.cookies')}
                </a>
              </li>
              <li>
                <a href="/refund-policy" className="hover:text-white transition-colors">
                  Refund Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Summary */}
        <div className="text-center text-xs text-gray-400 mb-4 pt-4 border-t border-gray-800">
          <p>
            ATOC KOREA LLC operates solely as a booking intermediary and does not provide tour services. Tours are delivered by independent third-party providers.
          </p>
        </div>

        {/* Copyright */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-800">
          <p>{t('home.footer.copyright')}</p>
        </div>
      </div>
    </footer>
  );
}

