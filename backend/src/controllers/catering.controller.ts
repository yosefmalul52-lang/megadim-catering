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
    // Build items from catering selections so they are visible in the dashboard and print view.
    // Catering items have no individual price — pricing is per portions count (totalPrice stays 0 until admin updates it).
    const buildCateringItems = () => {
      const list: { name: string; price: number; quantity: number; category: string }[] = [];
      payload.salads.forEach((s) => list.push({ name: s, price: 0, quantity: 1, category: 'סלטים' }));
      payload.firstCourses.forEach((s) => list.push({ name: s, price: 0, quantity: 1, category: 'מנות ראשונות' }));
      payload.mainCourses.forEach((s) => list.push({ name: s, price: 0, quantity: 1, category: 'מנות עיקריות' }));
      payload.sidesEvening.forEach((s) => list.push({ name: s, price: 0, quantity: 1, category: 'תוספות ערב' }));
      payload.sidesMorning.forEach((s) => list.push({ name: s, price: 0, quantity: 1, category: 'תוספות בוקר' }));
      return list;
    };

    const notesparts: string[] = [];
    if (payload.seudaShlishit === 'yes') notesparts.push('סעודה שלישית: כן');
    if (payload.remarks) notesparts.push(payload.remarks);
    const combinedNotes = notesparts.join(' | ') || undefined;

    const orderDoc = {
      orderType: 'catering' as const,
      cateringKind: 'shabbat' as const,
      customerDetails: {
        fullName: payload.fullName,
        phone: payload.phone,
        email: payload.email,
        eventDate: payload.eventDate,
        address: payload.address || undefined,
        notes: combinedNotes
      },
      items: buildCateringItems(),
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

  /**
   * POST /api/catering/events – submit Events Catering inquiry (wedding, corporate, bar mitzvah, etc.).
   * Saves an Order with cateringKind:'events' and sends notification emails.
   */
  submitEventCateringOrder = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    if (!body.fullName || typeof body.fullName !== 'string' || !body.fullName.trim())
      throw createValidationError('fullName is required');
    if (!body.phone || typeof body.phone !== 'string' || !body.phone.trim())
      throw createValidationError('phone is required');
    if (!body.email || typeof body.email !== 'string' || !body.email.trim())
      throw createValidationError('email is required');
    if (!isValidEmail((body.email as string).trim()))
      throw createValidationError('email must be a valid email address');
    if (!body.eventDate || typeof body.eventDate !== 'string' || !body.eventDate.trim())
      throw createValidationError('eventDate is required');
    if (!body.guestCount || Number(body.guestCount) <= 0)
      throw createValidationError('guestCount must be a positive number');
    if (!body.eventType || typeof body.eventType !== 'string' || !body.eventType.trim())
      throw createValidationError('eventType is required');

    const evPayload = {
      fullName: (body.fullName as string).trim(),
      phone: (body.phone as string).trim(),
      email: (body.email as string).trim(),
      eventDate: (body.eventDate as string).trim(),
      guestCount: Number(body.guestCount),
      eventType: (body.eventType as string).trim(),
      venue: typeof body.venue === 'string' ? body.venue.trim() : '',
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
      deliveryType: typeof body.deliveryType === 'string' ? body.deliveryType.trim() : 'pickup',
      address: typeof body.address === 'string' ? body.address.trim() : ''
    };

    const toStrArr = (v: unknown): string[] =>
      Array.isArray(v) ? (v as unknown[]).filter(s => s != null && String(s).trim()).map(s => String(s).trim()) : [];

    // Build items from the new flat form payload
    const buildEventItems = (): { name: string; price: number; quantity: number; category: string }[] => {
      const list: { name: string; price: number; quantity: number; category: string }[] = [];

      // Reception bar
      if (body.receptionBar === true) {
        const variant = typeof body.receptionBarVariant === 'string' ? body.receptionBarVariant : '';
        const label = variant === 'premium'
          ? 'בר קבלת פנים משודרג – 6 סוגים (₪45 למנה)'
          : variant === 'standard'
            ? 'בר קבלת פנים – 4 סוגים (₪30 למנה)'
            : 'בר קבלת פנים';
        list.push({ name: label, price: 0, quantity: 1, category: 'בר קבלת פנים' });
      }

      // Salads
      toStrArr(body.salads).forEach(s => list.push({ name: s, price: 0, quantity: 1, category: 'סלטים' }));

      // First courses
      toStrArr(body.firstCourses).forEach(s => list.push({ name: s, price: 0, quantity: 1, category: 'מנות ראשונות' }));

      // Main courses
      toStrArr(body.mainCourses).forEach(s => list.push({ name: s, price: 0, quantity: 1, category: 'מנות עיקריות' }));

      // Side dishes
      toStrArr(body.sides).forEach(s => list.push({ name: s, price: 0, quantity: 1, category: 'תוספות' }));

      // Desserts
      if (body.desserts === true) {
        list.push({ name: 'קינוחי ביסקוטי (₪8 לאדם)', price: 0, quantity: 1, category: 'קינוחים' });
      }

      // Kosher upgrade
      if (body.kosherUpgrade === true) {
        list.push({ name: 'שדרוג כשרות מהדרין מחפוד (+₪7 למנה)', price: 0, quantity: 1, category: 'תוספות' });
      }

      return list;
    };

    const evItems = buildEventItems();

    let evCreated;
    try {
      evCreated = await Order.create({
        orderType: 'catering' as const,
        cateringKind: 'events' as const,
        customerDetails: {
          fullName: evPayload.fullName,
          phone: evPayload.phone,
          email: evPayload.email,
          eventDate: evPayload.eventDate,
          address: evPayload.address || evPayload.venue || undefined,
          notes: evPayload.notes || undefined
        },
        items: evItems,
        totalPrice: 0,
        status: 'pending',
        eventType: evPayload.eventType,
        guestCount: evPayload.guestCount,
        venue: evPayload.venue || undefined,
        numberOfPortions: evPayload.guestCount
      });
    } catch (dbErr: unknown) {
      console.error('Events catering: failed to save order:', dbErr);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בשמירת ההזמנה. נסה שוב או צור קשר.',
        timestamp: new Date().toISOString()
      });
    }

    const evOwnerEmail = (process.env.OWNER_EMAIL || '').trim();

    if (evOwnerEmail && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await emailService.sendOrderEmails({
          customerName: evPayload.fullName,
          phone: evPayload.phone,
          customerEmail: evPayload.email,
          eventDate: evPayload.eventDate,
          deliveryType: (evPayload.deliveryType as 'pickup' | 'delivery') || 'pickup',
          address: evPayload.address || evPayload.venue || undefined,
          notes: evPayload.notes || undefined,
          items: evItems.map(i => ({ ...i, id: '' })),
          subtotal: undefined,
          deliveryFee: undefined,
          total: 0,
          orderNumber: (evCreated as any).orderNumber,
          cateringKind: 'events',
          cateringExtraInfo: [
            { label: 'סוג אירוע', value: evPayload.eventType },
            { label: 'מספר אורחים משוער', value: String(evPayload.guestCount) },
            evPayload.venue ? { label: 'מיקום האירוע', value: evPayload.venue } : null
          ].filter(Boolean) as Array<{ label: string; value: string }>
        }, evOwnerEmail, evPayload.email);
      } catch (emailErr: unknown) {
        console.error(
          'Events catering: email failed after order was saved (orderId=%s):',
          evCreated?._id?.toString(),
          emailErr
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'הבקשה נשלחה בהצלחה! ניצור איתך קשר בהקדם.',
      orderId: evCreated._id?.toString(),
      timestamp: new Date().toISOString()
    });
  });
}
