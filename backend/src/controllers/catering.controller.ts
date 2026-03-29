import { Request, Response } from 'express';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';
import { emailService } from '../services/email.service';
import Order from '../models/Order';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function mealTimeToLabel(mealTime: string): string {
  const map: Record<string, string> = { evening: 'ערב שבת', morning: 'שבת בבוקר', both: 'ערב + בוקר' };
  return map[mealTime] || mealTime;
}

export class CateringController {
  /**
   * POST /api/catering – submit Shabbat & Holiday Catering form.
   * Sends the same style of confirmation email as "אוכל מוכן" (admin + customer receipt).
   */
  submitCateringOrder = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    if (!body.fullName || typeof body.fullName !== 'string' || !body.fullName.trim()) {
      throw createValidationError('fullName is required');
    }
    if (!body.phone || typeof body.phone !== 'string' || !body.phone.trim()) {
      throw createValidationError('phone is required');
    }
    if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
      throw createValidationError('email is required');
    }
    if (!isValidEmail((body.email as string).trim())) {
      throw createValidationError('email must be a valid email address');
    }
    if (body.numberOfPortions === undefined || body.numberOfPortions === null || String(body.numberOfPortions).trim() === '') {
      throw createValidationError('numberOfPortions is required');
    }
    if (!body.eventDate || typeof body.eventDate !== 'string' || !body.eventDate.trim()) {
      throw createValidationError('eventDate is required');
    }
    const mealTime = body.mealTime as string;
    if (!mealTime || !['evening', 'morning', 'both'].includes(mealTime)) {
      throw createValidationError('mealTime must be evening, morning, or both');
    }
    const deliveryType = body.deliveryType as string;
    if (!deliveryType || !['pickup', 'delivery'].includes(deliveryType)) {
      throw createValidationError('deliveryType must be pickup or delivery');
    }

    const payload = {
      fullName: (body.fullName as string).trim(),
      phone: (body.phone as string).trim(),
      email: (body.email as string).trim(),
      numberOfPortions: String(body.numberOfPortions ?? '').trim(),
      eventDate: (body.eventDate as string).trim(),
      mealTime: mealTime as 'evening' | 'morning' | 'both',
      salads: Array.isArray(body.salads) ? (body.salads as unknown[]).filter((s) => s != null && String(s).trim()).map((s) => String(s).trim()) : [],
      firstCourses: Array.isArray(body.firstCourses) ? (body.firstCourses as unknown[]).filter((s) => s != null && String(s).trim()).map((s) => String(s).trim()) : [],
      mainCourses: Array.isArray(body.mainCourses) ? (body.mainCourses as unknown[]).filter((s) => s != null && String(s).trim()).map((s) => String(s).trim()) : [],
      sidesEvening: Array.isArray(body.sidesEvening) ? (body.sidesEvening as unknown[]).filter((s) => s != null && String(s).trim()).map((s) => String(s).trim()) : [],
      sidesMorning: Array.isArray(body.sidesMorning) ? (body.sidesMorning as unknown[]).filter((s) => s != null && String(s).trim()).map((s) => String(s).trim()) : [],
      seudaShlishit: body.seudaShlishit === 'yes' ? 'yes' : 'no',
      deliveryType: deliveryType as 'pickup' | 'delivery',
      address: typeof body.address === 'string' ? body.address.trim() : '',
      remarks: typeof body.remarks === 'string' ? body.remarks.trim() : ''
    };

    const ownerEmail = (process.env.OWNER_EMAIL || '').trim();

    // Persist catering order first — never block success on email delivery.
    const orderDoc = {
      orderType: 'catering' as const,
      customerDetails: {
        fullName: payload.fullName,
        phone: payload.phone,
        email: payload.email,
        eventDate: payload.eventDate,
        address: payload.address || undefined,
        notes: payload.remarks || undefined
      },
      items: [],
      totalPrice: 0,
      status: 'pending',
      numberOfPortions: payload.numberOfPortions,
      mealTime: payload.mealTime,
      mealTypes: mealTimeToLabel(payload.mealTime)
    };

    let created;
    try {
      created = await Order.create(orderDoc);
    } catch (dbErr: unknown) {
      console.error('Catering: failed to save order to database:', dbErr);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בשמירת ההזמנה. נסה שוב או צור קשר.',
        timestamp: new Date().toISOString()
      });
    }

    if (ownerEmail && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await emailService.sendCateringOrderEmails(payload, ownerEmail, payload.email);
      } catch (emailErr: unknown) {
        console.error(
          'Catering: email failed after order was saved (orderId=%s):',
          created?._id?.toString(),
          emailErr
        );
      }
    } else {
      console.warn(
        'Catering: skipping notification email — OWNER_EMAIL or EMAIL_USER/EMAIL_PASS not configured (orderId=%s)',
        created?._id?.toString()
      );
    }

    res.status(201).json({
      success: true,
      message: 'ההזמנה נשלחה בהצלחה',
      orderId: created._id?.toString(),
      timestamp: new Date().toISOString()
    });
  });
}
