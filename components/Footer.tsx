'use client';

import { useTranslations } from '@/lib/i18n';

export default function Footer() {
  const t = useTranslations();
  
  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-300 border-t border-gray-700/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">

        {/* Company Info — 2열 그리드 */}
        <div className="mb-3">
          <h3 className="text-white font-bold text-sm mb-2">{t('home.footer.company')}</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
            <p><span className="font-semibold">{t('home.footer.name')}:</span> {t('home.footer.companyName')}</p>
            <p><span className="font-semibold">{t('home.footer.entityLabel')}:</span> {t('home.footer.entity')}</p>
            <p><span className="font-semibold">{t('home.footer.stateLabel')}:</span> {t('home.footer.state')}</p>
            <p><span className="font-semibold">{t('home.footer.industryLabel')}:</span> {t('home.footer.industry')}</p>
          </div>
        </div>

        {/* Contact Info */}
        <div className="text-xs mb-3 space-y-0.5">
          {/* Contact + Customer Service — 2열 */}
          <div className="grid grid-cols-2 gap-x-6">
            <p>
              <span className="font-semibold">{t('home.footer.contact')}:</span><br />
              <a href="tel:+821097808027" className="hover:text-white transition-colors">+82 10 9780 8027</a><br />
              <a href="tel:+13075332194" className="hover:text-white transition-colors">+1 (307) 533 2194</a>
            </p>
            <p>
              <span className="font-semibold">{t('home.footer.customerServiceEmail')}:</span><br />
              <a href="mailto:support@atockorea.com" className="hover:text-white transition-colors">support@atockorea.com</a>
            </p>
          </div>
          {/* Address */}
          <p className="pt-2">
            <span className="font-semibold">{t('home.footer.address')}:</span> 302, 32, Doryeong-ro 7-gil, Jeju-si, Jeju-do
          </p>
          {/* Registered Address */}
          <p>
            <span className="font-semibold">{t('home.footer.registeredAddressLabel')}:</span><br />
            {t('home.footer.registeredAddress')}
          </p>
        </div>

        {/* About, Support, Legal */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-3 pt-3 border-t border-gray-800">
          <div>
            <h3 className="text-white font-semibold mb-1.5 text-xs">{t('home.footer.aboutUs')}</h3>
            <ul className="space-y-0.5 text-[10px] sm:text-xs">
              <li><a href="/about" className="hover:text-white transition-colors">{t('home.footer.ourStory')}</a></li>
              <li><a href="/about" className="hover:text-white transition-colors">{t('home.footer.whyChooseUs')}</a></li>
              <li><a href="/about" className="hover:text-white transition-colors">{t('home.footer.partners')}</a></li>
              <li><a href="/about" className="hover:text-white transition-colors">{t('home.footer.careers')}</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1.5 text-xs">{t('home.footer.support')}</h3>
            <ul className="space-y-0.5 text-[10px] sm:text-xs">
              <li><a href="/support" className="hover:text-white transition-colors">{t('home.footer.bookingHelp')}</a></li>
              <li><a href="/contact" className="hover:text-white transition-colors">{t('home.footer.contactUs')}</a></li>
              <li><a href="/support" className="hover:text-white transition-colors">{t('home.footer.faq')}</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1.5 text-xs">{t('home.footer.legal')}</h3>
            <ul className="space-y-0.5 text-[10px] sm:text-xs">
              <li><a href="/terms" className="hover:text-white transition-colors">{t('home.footer.terms')}</a></li>
              <li><a href="/privacy" className="hover:text-white transition-colors">{t('home.footer.privacy')}</a></li>
              <li><a href="/cookies" className="hover:text-white transition-colors">{t('home.footer.cookies')}</a></li>
              <li><a href="/refund-policy" className="hover:text-white transition-colors">{t('home.footer.refundPolicy')}</a></li>
            </ul>
          </div>
        </div>

        {/* Stripe */}
        <div className="flex items-center justify-center py-2 border-t border-gray-800">
          <a
            href="https://stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-col items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity"
            aria-label="Powered by Stripe"
          >
            <img src="/images/stripe/stripe-wordmark.svg" alt="Stripe" width={80} height={32} className="h-6 w-auto object-contain" />
            <img src="/images/stripe/powered-by-stripe.svg" alt="Powered by Stripe" width={128} height={28} className="h-5 w-auto object-contain" />
          </a>
        </div>

        {/* Legal Summary + Copyright */}
        <div className="border-t border-gray-800 pt-2 text-center text-xs text-gray-400 space-y-1">
          <p>{t('home.footer.legalSummary')}</p>
          <p>{t('home.footer.copyright')}</p>
        </div>

      </div>
    </footer>
  );
}

