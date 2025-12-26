import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/contact
 * Submit contact form inquiry
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullName,
      email,
      subject,
      message,
      bookingReference,
      tourDate,
      phoneWhatsapp,
      attachmentUrl = [],
      privacyConsent,
    } = body;

    // Validate required fields
    if (!fullName || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Full name, email, subject, and message are required' },
        { status: 400 }
      );
    }

    if (!privacyConsent) {
      return NextResponse.json(
        { error: 'Privacy consent is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Insert contact inquiry
    const { data: inquiry, error: insertError } = await supabase
      .from('contact_inquiries')
      .insert({
        full_name: fullName,
        email,
        subject,
        message,
        booking_reference: bookingReference || null,
        tour_date: tourDate || null,
        phone_whatsapp: phoneWhatsapp || null,
        attachment_urls: Array.isArray(attachmentUrl) ? attachmentUrl : [],
        privacy_consent: privacyConsent,
        status: 'new',
        is_read: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting contact inquiry:', insertError);
      return NextResponse.json(
        { error: 'Failed to submit contact form', details: insertError.message },
        { status: 500 }
      );
    }

    // Send auto-reply email
    try {
      await sendAutoReplyEmail(email, fullName);
    } catch (emailError) {
      console.error('Error sending auto-reply email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Contact form submitted successfully',
        inquiryId: inquiry.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Contact form submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit contact form', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Send auto-reply email to the customer
 */
async function sendAutoReplyEmail(toEmail: string, fullName: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured, skipping auto-reply email');
    return;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(resendApiKey);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .chargeback-notice { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ATOC KOREA</h1>
          </div>
          <div class="content">
            <p>Hello ${fullName},</p>
            <p>Thank you for contacting ATOC KOREA support. We have received your message and will respond within 24–48 business hours.</p>
            
            <div class="info-box">
              <p style="margin: 0; font-weight: bold; margin-bottom: 10px;">To help us assist you faster, please reply to this email with any of the following (if applicable):</p>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Booking Reference / Booking ID</li>
                <li>Tour date and participant count</li>
                <li>A short summary of the issue (booking, payment, refund, etc.)</li>
              </ul>
            </div>

            <div class="info-box">
              <p style="margin: 0; font-weight: bold;">Important:</p>
              <p style="margin: 10px 0 0 0;">ATOC KOREA LLC operates solely as a booking intermediary. Tours are delivered by independent third-party providers identified in your booking confirmation.</p>
            </div>

            <div class="chargeback-notice">
              <p style="margin: 0; font-weight: bold;">For booking-related issues, please contact us before initiating a chargeback.</p>
            </div>

            <p>Thank you,<br>ATOC KOREA Support Team<br><a href="mailto:support@atockorea.com">support@atockorea.com</a></p>
          </div>
          <div class="footer">
            <p>© 2024 ATOC KOREA LLC. All rights reserved.</p>
            <p>This email was sent from support@atockorea.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `Hello ${fullName},

Thank you for contacting ATOC KOREA support. We have received your message and will respond within 24–48 business hours.

To help us assist you faster, please reply to this email with any of the following (if applicable):

- Booking Reference / Booking ID
- Tour date and participant count
- A short summary of the issue (booking, payment, refund, etc.)

Important: ATOC KOREA LLC operates solely as a booking intermediary. Tours are delivered by independent third-party providers identified in your booking confirmation.

If your inquiry is urgent and related to payment disputes, please contact us first before initiating a chargeback so we can review and resolve the matter promptly.

For booking-related issues, please contact us before initiating a chargeback.

Thank you,
ATOC KOREA Support Team
support@atockorea.com

© 2024 ATOC KOREA LLC. All rights reserved.
This email was sent from support@atockorea.com`;

    await resend.emails.send({
      from: 'ATOC KOREA <support@atockorea.com>',
      to: toEmail,
      replyTo: 'support@atockorea.com',
      subject: 'We received your request (ATOC KOREA Support)',
      html: htmlContent,
      text: textContent,
    });
  } catch (error) {
    console.error('Error sending auto-reply email:', error);
    throw error;
  }
}

