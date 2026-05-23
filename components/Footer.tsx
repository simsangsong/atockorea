'use client';

import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type FooterProps = {
  /** Softer hierarchy and spacing after premium light tour-detail pages (small-group). */
  premiumHandoff?: boolean;
};

export default function Footer({ premiumHandoff }: FooterProps) {
  const t = useTranslations();

  return (
    <footer
      data-footer-variant={premiumHandoff ? 'premium-handoff' : undefined}
      className={cn(
        'relative z-10 border-t border-slate-800/80 bg-slate-950 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-300 [color-scheme:dark]',
        premiumHandoff && 'at-footer-premium-handoff'
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3.5 pb-[max(5.25rem,calc(0.875rem+env(safe-area-inset-bottom,0px)+4.25rem))] md:py-4 md:pb-4">

        {/* Company + contact + addresses — one trust cluster */}
        <div className="mb-2 space-y-2 sm:mb-2.5 sm:space-y-2.5" data-footer-section="identity">
          <div data-footer-section="company">
            <h3 className="mb-1 text-xs font-bold tracking-tight text-white sm:text-sm">
              {t('home.footer.company')}
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] leading-snug text-slate-300 sm:gap-x-6 sm:text-xs sm:leading-normal">
              <p>
                <span className="font-semibold text-slate-200">{t('home.footer.platformOperatorLabel')}:</span>{' '}
                {t('home.footer.platformOperator')}
              </p>
              <p>
                <span className="font-semibold text-slate-200">{t('home.footer.stateLabel')}:</span>{' '}
                {t('home.footer.state')}, USA
              </p>
              <p>
                <span className="font-semibold text-slate-200">{t('home.footer.koreaOperationsLabel')}:</span>{' '}
                {t('home.footer.koreaOperator')}
              </p>
              <p>
                <span className="font-semibold text-slate-200">{t('home.footer.industryLabel')}:</span>{' '}
                {t('home.footer.koreaBusinessType')}
              </p>
              <p>
                <span className="font-semibold text-slate-200">{t('home.footer.businessReg')}:</span>{' '}
                {t('home.footer.businessRegNo')}
              </p>
            </div>
          </div>

          <div className="text-[11px] leading-snug text-slate-300 sm:text-xs sm:leading-normal" data-footer-section="contact">
            <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6">
              <p>
                <span className="font-semibold text-slate-200">{t('home.footer.contact')}:</span>
                <br />
                <a href="/contact" className="text-slate-300 transition-colors hover:text-white">
                  {t('home.footer.contactUs')}
                </a>
                <br />
                <a href="/support" className="text-slate-300 transition-colors hover:text-white">
                  {t('home.footer.bookingHelp')}
                </a>
              </p>
              <p>
                <span className="font-semibold text-slate-200">{t('home.footer.customerServiceEmail')}:</span>
                <br />
                <a href="mailto:support@atockorea.com" className="text-slate-300 transition-colors hover:text-white">
                  support@atockorea.com
                </a>
              </p>
            </div>
            <p className="mt-1.5 pt-1.5 border-t border-slate-800/80 sm:mt-2 sm:pt-2">
              <span className="font-semibold text-slate-200">{t('home.footer.address')}:</span>{' '}
              {t('home.footer.koreaAddress')}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-slate-200">{t('home.footer.registeredAddressLabel')}:</span>
              <br />
              {t('home.footer.registeredAddress')}
            </p>
          </div>
        </div>

        {/* About, Support, Legal */}
        <div
          className="mb-2 grid grid-cols-3 gap-x-2.5 gap-y-1 border-t border-slate-800/90 pt-2.5 sm:mb-2.5 sm:gap-x-4 sm:pt-3 md:gap-x-6"
          data-footer-section="nav"
        >
          <div className="min-w-0">
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-xs sm:normal-case sm:tracking-normal sm:text-slate-200">
              {t('home.footer.aboutUs')}
            </h3>
            <ul className="space-y-px text-[10px] leading-snug sm:space-y-0.5 sm:text-xs sm:leading-normal">
              <li>
                <a href="/about" className="text-slate-400 transition-colors hover:text-white sm:text-slate-300">
                  {t('home.footer.ourStory')}
                </a>
              </li>
              <li>
                <a href="/about" className="text-slate-400 transition-colors hover:text-white sm:text-slate-300">
                  {t('home.footer.whyChooseUs')}
                </a>
              </li>
            </ul>
          </div>
          <div className="min-w-0">
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-xs sm:normal-case sm:tracking-normal sm:text-slate-200">
              {t('home.footer.support')}
            </h3>
            <ul className="space-y-px text-[10px] leading-snug sm:space-y-0.5 sm:text-xs sm:leading-normal">
              <li>
                <a href="/support" className="text-slate-400 transition-colors hover:text-white sm:text-slate-300">
                  {t('home.footer.bookingHelp')}
                </a>
              </li>
              <li>
                <a href="/contact" className="text-slate-400 transition-colors hover:text-white sm:text-slate-300">
                  {t('home.footer.contactUs')}
                </a>
              </li>
              <li>
                <a href="/support" className="text-slate-400 transition-colors hover:text-white sm:text-slate-300">
                  {t('home.footer.faq')}
                </a>
              </li>
            </ul>
          </div>
          <div className="min-w-0">
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-xs sm:normal-case sm:tracking-normal sm:text-slate-200">
              {t('home.footer.legal')}
            </h3>
            <ul className="space-y-px text-[10px] leading-snug sm:space-y-0.5 sm:text-xs sm:leading-normal">
              <li>
                <a href="/terms" className="text-slate-400 transition-colors hover:text-white sm:text-slate-300">
                  {t('home.footer.terms')}
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-slate-400 transition-colors hover:text-white sm:text-slate-300">
                  {t('home.footer.privacy')}
                </a>
              </li>
              <li>
                <a href="/cookies" className="text-slate-400 transition-colors hover:text-white sm:text-slate-300">
                  {t('home.footer.cookies')}
                </a>
              </li>
              <li>
                <a href="/refund-policy" className="text-slate-400 transition-colors hover:text-white sm:text-slate-300">
                  {t('home.footer.refundPolicy')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Stripe */}
        <div
          className="flex justify-center border-t border-slate-800/90 py-1 sm:py-1.5"
          data-footer-section="stripe"
        >
          <a
            href="https://stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-col items-center gap-1 opacity-90 transition-opacity hover:opacity-100"
            aria-label="Powered by Stripe"
          >
            <img
              src="/images/stripe/stripe-wordmark.svg"
              alt="Stripe"
              width={72}
              height={28}
              className="h-[1.35rem] w-auto object-contain sm:h-6"
            />
            <img
              src="/images/stripe/powered-by-stripe.svg"
              alt="Powered by Stripe"
              width={118}
              height={26}
              className="h-[1.15rem] w-auto object-contain sm:h-5"
            />
          </a>
        </div>

        {/* Trust strip + Legal Summary + Copyright */}
        <div
          className="border-t border-slate-800/90 pt-1.5 text-center sm:pt-2"
          data-footer-section="legal"
        >
          <p className="text-[11px] font-semibold leading-snug text-slate-300 sm:text-xs sm:leading-relaxed">
            {t('home.footer.description')}
          </p>
          <p className="mt-1 text-[11px] font-medium leading-snug text-slate-500 sm:mt-1.5 sm:text-xs sm:leading-relaxed">
            {t('home.footer.legalSummary')}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-slate-600 sm:mt-1.5 sm:text-[11px]">
            {t('home.footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}

