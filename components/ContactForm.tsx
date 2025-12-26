'use client';

import { useState } from 'react';

const SUBJECT_OPTIONS = [
  'Booking Confirmation / Changes',
  'Payment Issue',
  'Cancellation / Refund Request',
  'Tour Provider Communication',
  'Technical Issue (Website)',
  'Partnership Inquiry',
  'Other',
];

export default function ContactForm() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    subject: '',
    message: '',
    bookingReference: '',
    tourDate: '',
    phoneWhatsapp: '',
    privacyConsent: false,
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // TODO: File upload will be implemented later
      // For now, we'll skip file uploads to keep it simple
      // If attachment is provided, we'll note it but not upload
      
      // Submit contact form
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          attachmentUrl: [], // File upload to be implemented later
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit contact form');
      }

      setSuccess(true);
      // Reset form
      setFormData({
        fullName: '',
        email: '',
        subject: '',
        message: '',
        bookingReference: '',
        tourDate: '',
        phoneWhatsapp: '',
        privacyConsent: false,
      });
      setAttachment(null);
      
      // Reset file input
      const fileInput = document.getElementById('attachment') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank you for contacting us!</h2>
        <p className="text-gray-700 mb-4">
          We have received your message and will respond within 24–48 business hours.
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
      {/* Form Intro */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
        <p className="text-sm text-gray-700">
          <strong>For faster assistance, please include your Booking Reference (if available).</strong>
          <br />
          We support booking and payment-related matters. Tour operation questions will be forwarded to the tour provider when necessary.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Required Fields */}
        <div className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-semibold text-gray-900 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              required
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-semibold text-gray-900 mb-1.5">
              Subject <span className="text-red-500">*</span>
            </label>
            <select
              id="subject"
              name="subject"
              required
              value={formData.subject}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Please select a subject</option>
              {SUBJECT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-semibold text-gray-900 mb-1.5">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={6}
              value={formData.message}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* Optional Fields */}
        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">Additional Information (Optional but Recommended)</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bookingReference" className="block text-sm font-medium text-gray-900 mb-1.5">
                Booking Reference / Booking ID
              </label>
              <input
                type="text"
                id="bookingReference"
                name="bookingReference"
                value={formData.bookingReference}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label htmlFor="tourDate" className="block text-sm font-medium text-gray-900 mb-1.5">
                Tour Date
              </label>
              <input
                type="date"
                id="tourDate"
                name="tourDate"
                value={formData.tourDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="phoneWhatsapp" className="block text-sm font-medium text-gray-900 mb-1.5">
              Phone / WhatsApp (optional)
            </label>
            <input
              type="tel"
              id="phoneWhatsapp"
              name="phoneWhatsapp"
              value={formData.phoneWhatsapp}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="mt-4">
            <label htmlFor="attachment" className="block text-sm font-medium text-gray-900 mb-1.5">
              Attachment (optional)
            </label>
            <input
              type="file"
              id="attachment"
              name="attachment"
              onChange={handleFileChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            {attachment && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {attachment.name} ({(attachment.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>
        </div>

        {/* Privacy Consent */}
        <div className="border-t border-gray-200 pt-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="privacyConsent"
              checked={formData.privacyConsent}
              onChange={handleChange}
              required
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              I understand that ATOC KOREA LLC will use my information to respond to this inquiry in accordance with the{' '}
              <a href="/legal" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              . <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {/* Chargeback Notice */}
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
          <p className="text-sm text-amber-900">
            <strong>Chargeback Notice:</strong> If your request relates to a payment dispute, please contact us before initiating a chargeback. Chargebacks that conflict with clearly disclosed and accepted policies may be disputed.
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </form>
    </div>
  );
}

