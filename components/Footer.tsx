'use client';

import { useTranslations } from '@/lib/i18n';

export default function Footer() {
  const t = useTranslations();
  
  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-300 border-t border-gray-700/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Company Info */}
        <div className="mb-6">
          <h3 className="text-white font-bold text-lg mb-3">{t('home.footer.company')}</h3>
          <div className="text-xs space-y-1.5 mb-3">
            <p><span className="font-semibold">{t('home.footer.name')}:</span> {t('home.footer.companyName')}</p>
            <p><span className="font-semibold">{t('home.footer.entityLabel')}:</span> {t('home.footer.entity')}</p>
            <p><span className="font-semibold">{t('home.footer.stateLabel')}:</span> {t('home.footer.state')}</p>
            <p><span className="font-semibold">{t('home.footer.registeredAddressLabel')}:</span> {t('home.footer.registeredAddress')}</p>
            <p><span className="font-semibold">{t('home.footer.industryLabel')}:</span> {t('home.footer.industry')}</p>
            <p>{t('home.footer.companyDescription')}</p>
          </div>
        </div>

        {/* Contact Info - Single Row (연락처 그대로) */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Address */}
            <div>
              <p className="text-xs">
                <span className="font-semibold">{t('home.footer.address')}:</span> 302, 32, Doryeong-ro 7-gil, Jeju-si, Jeju-do
              </p>
            </div>
            {/* Contact */}
            <div>
              <p className="text-xs mb-1">
                <span className="font-semibold">{t('home.footer.contact')}:</span> +82 10 9780 8027
              </p>
              <p className="text-xs">
                <span className="font-semibold">{t('home.footer.customerServiceEmail')}:</span>{' '}
                <a href="mailto:support@atockorea.com" className="hover:text-white transition-colors">support@atockorea.com</a>
              </p>
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
                <a href="/contact" className="hover:text-white transition-colors">
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
                <a href="/terms" className="hover:text-white transition-colors">
                  {t('home.footer.terms')}
                </a>
              </li>
              <li>
                <a href="/privacy" className="hover:text-white transition-colors">
                  {t('home.footer.privacy')}
                </a>
              </li>
              <li>
                <a href="/cookies" className="hover:text-white transition-colors">
                  {t('home.footer.cookies')}
                </a>
              </li>
              <li>
                <a href="/refund-policy" className="hover:text-white transition-colors">
                  {t('home.footer.refundPolicy')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Summary */}
        <div className="text-center text-xs text-gray-400 mb-4 pt-4 border-t border-gray-800">
          <p>{t('home.footer.legalSummary')}</p>
        </div>

        {/* Copyright */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-800">
          <p>{t('home.footer.copyright')}</p>
        </div>
      </div>
    </footer>
  );
}

