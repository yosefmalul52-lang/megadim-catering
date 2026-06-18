import { Request, Response } from 'express';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';
import { emailService } from '../services/email.service';
import Order from '../models/Order';
import {
  normalizeCateringLineItems,
  pushCateringOrderItems,
  resolveMealCourseLines
} from '../utils/catering-lines';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOrderNumber(): string {
  return 'MG-' + Math.floor(100000 + Math.random() * 900000).toString();
}

function toStrArr(v: unknown): string[] {
  return Array.isArray(v)
    ? (v as unknown[]).filter(s => s != null && String(s).trim()).map(s => String(s).trim())
    : [];
}

function buildEventCateringItems(body: Record<string, unknown>): {
  name: string;
  price: number;
  quantity: number;
  category: string;
}[] {
  const list: { name: string; price: number; quantity: number; category: string }[] = [];

  const baseTitle =
    typeof body.basePackageTitle === 'string' && body.basePackageTitle.trim()
      ? body.basePackageTitle.trim()
      : 'תפריט בסיסי לאירוע';
  list.push({ name: `${baseTitle} (₪70 למנה)`, price: 0, quantity: 1, category: 'תפריט בסיס' });

  if (body.receptionBar === true) {
    const variant = typeof body.receptionBarVariant === 'string' ? body.receptionBarVariant : '';
    const label =
      variant === 'premium'
        ? 'בר קבלת פנים משודרג — 6 סוגים (+₪45 למנה)'
        : variant === 'standard'
          ? 'בר קבלת פנים — 4 סוגים (+₪30 למנה)'
          : 'בר קבלת פנים';
    list.push({ name: label, price: 0, quantity: 1, category: 'בר קבלת פנים' });
  }

  const firstCourses = toStrArr(body.firstCourses);
  const firstCourseUpgrade =
    body.firstCourseUpgrade === true || firstCourses.length > 0;
  if (firstCourseUpgrade) {
    if (firstCourses.length === 0) {
      list.push({
        name: 'תוספת מנה ראשונה (+₪20 למנה)',
        price: 0,
        quantity: 1,
        category: 'שדרוגים'
      });
    } else {
      firstCourses.forEach(s =>
        list.push({ name: s, price: 0, quantity: 1, category: 'מנות ראשונות' })
      );
    }
  }

  toStrArr(body.salads).forEach(s =>
    list.push({ name: s, price: 0, quantity: 1, category: 'סלטים' })
  );
  toStrArr(body.mainCourses).forEach(s =>
    list.push({ name: s, price: 0, quantity: 1, category: 'מנות עיקריות' })
  );
  toStrArr(body.sides).forEach(s =>
    list.push({ name: s, price: 0, quantity: 1, category: 'תוספות' })
  );

  if (body.desserts === true) {
    list.push({
      name: 'תוספת קינוחים (+₪8 למנה)',
      price: 0,
      quantity: 1,
      category: 'שדרוגים'
    });
  }

  if (body.kosherUpgrade === true) {
    list.push({
      name: 'כשרות מהדרין מחפוד (+₪7 למנה)',
      price: 0,
      quantity: 1,
      category: 'שדרוגים'
    });
  }

  return list;
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

    const firstCourses = resolveMealCourseLines(
      body,
      mealTime,
      'firstCoursesEvening',
      'firstCoursesMorning',
      'firstCourses'
    );
    const mainCourses = resolveMealCourseLines(
      body,
      mealTime,
      'mainCoursesEvening',
      'mainCoursesMorning',
      'mainCourses'
    );

    const payload = {
      fullName: (body.fullName as string).trim(),
      phone: (body.phone as string).trim(),
      email: (body.email as string).trim(),
      numberOfPortions: String(body.numberOfPortions ?? '').trim(),
      eventDate: (body.eventDate as string).trim(),
      mealTime: mealTime as 'evening' | 'morning' | 'both',
      salads: normalizeCateringLineItems(body.salads),
      firstCoursesEvening: firstCourses.evening,
      firstCoursesMorning: firstCourses.morning,
      mainCoursesEvening: mainCourses.evening,
      mainCoursesMorning: mainCourses.morning,
      sidesEvening: normalizeCateringLineItems(body.sidesEvening),
      sidesMorning: normalizeCateringLineItems(body.sidesMorning),
      miscItems: normalizeCateringLineItems(body.miscItems),
      seudaShlishit: body.seudaShlishit === 'yes' ? 'yes' : 'no',
      deliveryType: deliveryType as 'pickup' | 'delivery',
      address: typeof body.address === 'string' ? body.address.trim() : '',
      remarks: typeof body.remarks === 'string' ? body.remarks.trim() : ''
    };

    const ownerEmail = (process.env.OWNER_EMAIL || '').trim();

    const buildCateringItems = () => {
      const list: {
        name: string;
        price: number;
        quantity: number;
        category: string;
        description?: string;
      }[] = [];
      pushCateringOrderItems(list, payload.salads, 'סלטים');
      pushCateringOrderItems(list, payload.firstCoursesEvening, 'מנות ראשונות — ערב');
      pushCateringOrderItems(list, payload.firstCoursesMorning, 'מנות ראשונות — בוקר');
      pushCateringOrderItems(list, payload.mainCoursesEvening, 'מנות עיקריות — ערב');
      pushCateringOrderItems(list, payload.mainCoursesMorning, 'מנות עיקריות — בוקר');
      pushCateringOrderItems(list, payload.sidesEvening, 'תוספות ערב');
      pushCateringOrderItems(list, payload.sidesMorning, 'תוספות בוקר');
      pushCateringOrderItems(list, payload.miscItems, 'שונות');
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
      deliveryType:
        typeof body.deliveryType === 'string' && body.deliveryType === 'delivery'
          ? 'delivery'
          : 'pickup',
      address: typeof body.address === 'string' ? body.address.trim() : ''
    };

    const pricePerPortion = Number(body.pricePerPortion) || 0;
    const totalEventPrice = Number(body.totalEventPrice) || 0;
    const evItems = buildEventCateringItems(body);
    const orderNumber = generateOrderNumber();

    let evCreated;
    try {
      evCreated = await Order.create({
        orderType: 'catering' as const,
        cateringKind: 'events' as const,
        orderNumber,
        customerDetails: {
          fullName: evPayload.fullName,
          phone: evPayload.phone,
          email: evPayload.email,
          eventDate: evPayload.eventDate,
          address:
            evPayload.deliveryType === 'delivery'
              ? evPayload.address || undefined
              : evPayload.venue || undefined,
          deliveryType: evPayload.deliveryType,
          pricePerPortion: pricePerPortion || undefined,
          notes: evPayload.notes || undefined
        },
        items: evItems,
        totalPrice: totalEventPrice,
        subtotal: pricePerPortion || null,
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
          deliveryType: evPayload.deliveryType as 'pickup' | 'delivery',
          address:
            evPayload.deliveryType === 'delivery'
              ? evPayload.address || undefined
              : evPayload.venue || undefined,
          notes: evPayload.notes || undefined,
          items: evItems.map(i => ({ ...i, id: '' })),
          subtotal: pricePerPortion || undefined,
          deliveryFee: undefined,
          total: totalEventPrice,
          orderNumber,
          cateringKind: 'events',
          cateringExtraInfo: [
            { label: 'סוג אירוע', value: evPayload.eventType },
            { label: 'מספר אורחים משוער', value: String(evPayload.guestCount) },
            {
              label: 'אספקה',
              value: evPayload.deliveryType === 'delivery' ? 'משלוח לכתובת' : 'איסוף עצמי'
            },
            pricePerPortion > 0
              ? { label: 'מחיר למנה (משוער)', value: `₪${pricePerPortion}` }
              : null,
            totalEventPrice > 0
              ? { label: 'סה״כ לתשלום (משוער)', value: `₪${totalEventPrice}` }
              : null,
            evPayload.venue ? { label: 'מיקום האירוע', value: evPayload.venue } : null,
            evPayload.deliveryType === 'delivery' && evPayload.address
              ? { label: 'כתובת למשלוח', value: evPayload.address }
              : null
          ].filter(Boolean) as Array<{ label: string; value: string }>
        }, evOwnerEmail, evPayload.email);
      } catch (emailErr: unknown) {
        console.error(
          'Events catering: email failed after order was saved (orderId=%s):',
          evCreated?._id?.toString(),
          emailErr
        );
      }
    } else {
      console.warn(
        'Events catering: skipping notification email — OWNER_EMAIL or EMAIL_USER/EMAIL_PASS not configured (orderId=%s)',
        evCreated?._id?.toString()
      );
    }

    res.status(201).json({
      success: true,
      message: 'הבקשה נשלחה בהצלחה! ניצור איתך קשר בהקדם.',
      orderId: evCreated._id?.toString(),
      timestamp: new Date().toISOString()
    });
  });
}
