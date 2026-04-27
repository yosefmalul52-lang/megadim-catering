import { Request, Response } from 'express';
import Customer from '../models/Customer';
import type { CustomerCategory, CustomerManualStatus } from '../models/Customer';
import Order from '../models/Order';
import Contact from '../models/Contact';
const User = require('../models/User');

const SLEEPING_DAYS = 30;
const SLEEPING_MS = SLEEPING_DAYS * 24 * 60 * 60 * 1000;
const ADMIN_EMAILS = [
  'yosefmalul52@gmail.com',
  'jtsolutions.officee@gmail.com',
  'tirtzma@gmail.com',
  'benny@megadim-catering.com',
  'office@megadim-catering.com'
];

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type SyncedCustomerCategory = 'all' | 'returning' | 'sleeping' | 'vip' | 'registered';

function toCategory(raw: unknown): SyncedCustomerCategory {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (value === 'returning' || value === 'sleeping' || value === 'vip' || value === 'registered') {
    return value;
  }
  return 'all';
}

function getSyncedCategory(customer: any, nowMs: number): SyncedCustomerCategory {
  const current = toCategory(customer.customerCategory);
  const orderCount = Number(customer.orderCount || 0);
  const hasOrders = orderCount > 0;
  const lastOrderDate = customer.lastOrderDate ? new Date(customer.lastOrderDate) : null;
  const lastOrderMs = lastOrderDate && !Number.isNaN(lastOrderDate.getTime()) ? lastOrderDate.getTime() : null;
  const isSleepingByActivity = !!(hasOrders && lastOrderMs !== null && nowMs - lastOrderMs >= SLEEPING_MS);
  const isReg = customer.isRegistered === true;

  if (current === 'vip') return 'vip';

  if (isSleepingByActivity) return 'sleeping';

  if (current === 'sleeping') {
    if (!hasOrders) return 'all';
    if (orderCount > 1) return 'returning';
    return isReg ? 'registered' : 'all';
  }

  if (current === 'registered') {
    return isReg ? 'registered' : 'all';
  }

  if (current === 'returning') return 'returning';

  if (isReg) return 'registered';

  return 'all';
}

function normalizePhone(raw: unknown): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00972')) digits = digits.slice(5);
  else if (digits.startsWith('972')) digits = digits.slice(3);
  if (!digits.startsWith('0')) digits = `0${digits}`;
  return digits;
}

function buildUserPhoneCandidates(phone: string): string[] {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  const noZero = normalized.replace(/^0/, '');
  return [normalized, `972${noZero}`, `+972${noZero}`];
}

async function resolveLinkedSiteUserForCustomer(customer: any): Promise<any | null> {
  const email = String(customer?.email || '')
    .trim()
    .toLowerCase();
  const phone = normalizePhone(customer?.normalizedPhone);
  const phoneCandidates = buildUserPhoneCandidates(phone);

  if (email && !isBusinessEmail(email)) {
    const byUsername = await User.findOne({
      role: { $ne: 'admin' },
      username: email
    });
    if (byUsername) return byUsername;
  }

  if (phoneCandidates.length > 0) {
    const byPhone = await User.findOne({
      role: { $ne: 'admin' },
      phone: { $in: phoneCandidates }
    });
    if (byPhone) return byPhone;
  }

  return null;
}

function isOrderCountableForCustomerStats(order: any): boolean {
  if (order?.isDeleted === true) return false;
  const status = String(order?.status || '')
    .trim()
    .toLowerCase();
  if (!status) return true;
  // Defensive filter for legacy duplicated/superseded order documents.
  if (['cancelled', 'canceled', 'archived', 'superseded', 'replaced', 'deleted'].includes(status)) {
    return false;
  }
  return true;
}

function isBusinessEmail(raw: unknown): boolean {
  const email = String(raw || '')
    .trim()
    .toLowerCase();
  if (!email) return false;
  if (ADMIN_EMAILS.includes(email)) return true;
  if (email.includes('jtsolutions.officee')) return true;
  if (email.endsWith('@megadim-catering.com')) return true;
  return false;
}

function normalizeNameForCompare(raw: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Relative Levenshtein distance in [0, 1]. */
function nameDifferenceRatio(a: string, b: string): number {
  const s = normalizeNameForCompare(a);
  const t = normalizeNameForCompare(b);
  if (!s && !t) return 0;
  const maxLen = Math.max(s.length, t.length, 1);
  let prev = new Array<number>(t.length + 1);
  let curr = new Array<number>(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[t.length] / maxLen;
}

type PhoneAggregate = {
  orderCount: number;
  totalSpent: number;
  latestOrderName: string;
  latestOrderCreatedAt: Date | null;
};

function buildLatestOrdersByNumber(orders: any[]): Map<string, any> {
  const latestOrdersByNumber = new Map<string, any>();
  for (const order of orders) {
    const key = String(order?.orderNumber || order?._id || '').trim();
    if (!key) continue;
    if (order?.isDeleted === true) continue;
    const current = latestOrdersByNumber.get(key);
    if (!current) {
      latestOrdersByNumber.set(key, order);
      continue;
    }
    const currentUpdatedAt = current?.updatedAt ? new Date(current.updatedAt).getTime() : 0;
    const nextUpdatedAt = order?.updatedAt ? new Date(order.updatedAt).getTime() : 0;
    if (nextUpdatedAt >= currentUpdatedAt) {
      latestOrdersByNumber.set(key, order);
    }
  }
  return latestOrdersByNumber;
}

function aggregateOrdersByPhone(latestOrdersByNumber: Map<string, any>): Map<string, PhoneAggregate> {
  const byPhone = new Map<string, PhoneAggregate>();
  const getAgg = (phone: string): PhoneAggregate => {
    let a = byPhone.get(phone);
    if (!a) {
      a = {
        orderCount: 0,
        totalSpent: 0,
        latestOrderName: '',
        latestOrderCreatedAt: null
      };
      byPhone.set(phone, a);
    }
    return a;
  };

  for (const order of latestOrdersByNumber.values()) {
    if (!isOrderCountableForCustomerStats(order)) continue;
    const phone = normalizePhone(order?.customerDetails?.phone);
    if (!phone) continue;
    const agg = getAgg(phone);
    agg.orderCount += 1;
    const totalPrice = Number(order?.totalPrice || 0);
    if (Number.isFinite(totalPrice) && totalPrice > 0) {
      agg.totalSpent += totalPrice;
    }
    const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
    const name = String(order?.customerDetails?.fullName || order?.customerDetails?.name || '').trim();
    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      if (!agg.latestOrderCreatedAt || createdAt > agg.latestOrderCreatedAt) {
        agg.latestOrderCreatedAt = createdAt;
        agg.latestOrderName = name;
      }
    }
  }

  for (const agg of byPhone.values()) {
    agg.totalSpent = Math.round((agg.totalSpent || 0) * 100) / 100;
  }
  return byPhone;
}

function findPersonalEmailForPhone(
  phone: string,
  userByPhone: Map<string, { username?: string; email?: string }>,
  allOrders: any[]
): string | null {
  const u = userByPhone.get(phone);
  if (u) {
    const cand = String(u.username || u.email || '')
      .trim()
      .toLowerCase();
    if (cand && !isBusinessEmail(cand)) return cand;
  }
  for (const order of allOrders) {
    const p = normalizePhone(order?.customerDetails?.phone);
    if (p !== phone) continue;
    const cand = String(order?.customerDetails?.email || '')
      .trim()
      .toLowerCase();
    if (cand && !isBusinessEmail(cand)) return cand;
  }
  return null;
}

/**
 * Site users are identified by username (email) and optionally phone.
 * isRegistered must be true if either matches a non-admin User — not phone-only (legacy migrate).
 */
async function syncCustomerIsRegisteredFromUsers(): Promise<void> {
  const users = await User.find({}, { phone: 1, username: 1, role: 1 }).lean();
  const registeredPhones = new Set<string>();
  const registeredEmails = new Set<string>();
  for (const u of users as any[]) {
    if (String(u?.role || '').toLowerCase() === 'admin') continue;
    const p = normalizePhone(u?.phone);
    if (p) registeredPhones.add(p);
    const em = String(u?.username || '')
      .trim()
      .toLowerCase();
    if (em) registeredEmails.add(em);
  }

  const customers = await Customer.find(
    {},
    { normalizedPhone: 1, email: 1, isRegistered: 1, customerCategory: 1 }
  ).lean();
  const ops: Array<{
    updateOne: { filter: { _id: unknown }; update: { $set: Record<string, unknown> } };
  }> = [];

  for (const c of customers as any[]) {
    const phone = normalizePhone(c?.normalizedPhone);
    const email = String(c?.email || '')
      .trim()
      .toLowerCase();
    const byPhone = !!phone && registeredPhones.has(phone);
    const byEmail = !!email && !isBusinessEmail(email) && registeredEmails.has(email);
    const next = byPhone || byEmail;
    const rawCat = String(c?.customerCategory || '')
      .trim()
      .toLowerCase();

    const set: Record<string, unknown> = {};
    if (c.isRegistered !== next) set.isRegistered = next;
    if (next && rawCat === 'all') set.customerCategory = 'registered';
    if (!next && rawCat === 'registered') set.customerCategory = 'all';

    if (Object.keys(set).length === 0) continue;
    ops.push({
      updateOne: {
        filter: { _id: c._id },
        update: { $set: set }
      }
    });
  }

  const BATCH = 500;
  for (let i = 0; i < ops.length; i += BATCH) {
    await Customer.bulkWrite(ops.slice(i, i + BATCH) as any);
  }
}

export async function getCustomers(req: Request, res: Response): Promise<void> {
  try {
    await syncCustomerIsRegisteredFromUsers();

    const search = String(req.query.search || '').trim();
    const manualStatus = String(req.query.manualStatus || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);

    const filter: Record<string, any> = {};
    if (manualStatus && ['NONE', 'VIP', 'BLACKLIST'].includes(manualStatus)) {
      filter.manualStatus = manualStatus;
    }
    const isRegisteredQ = String(req.query.isRegistered || '').trim().toLowerCase();
    if (isRegisteredQ === 'true') {
      filter.isRegistered = true;
    }
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ fullName: rx }, { email: rx }, { normalizedPhone: rx }];
    }

    const customers = await Customer.find(filter)
      .sort({ lastOrderDate: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const nowMs = Date.now();
    const syncOps = customers
      .map((c: any) => {
        const syncedCategory = getSyncedCategory(c, nowMs) as CustomerCategory;
        const currentCategory = toCategory(c.customerCategory);
        if (syncedCategory === currentCategory) return null;
        return {
          updateOne: {
            filter: { _id: c._id },
            update: { $set: { customerCategory: syncedCategory } }
          }
        };
      })
      .filter(Boolean) as Array<{ updateOne: { filter: { _id: any }; update: { $set: { customerCategory: CustomerCategory } } } }>;

    if (syncOps.length > 0) {
      await Customer.bulkWrite(syncOps);
    }

    const response = customers.map((c: any) => ({
      _id: String(c._id),
      fullName: c.fullName || '',
      username: c.email || '',
      email: c.email || '',
      phone: c.normalizedPhone || '',
      address: c.address || '',
      role: 'customer',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      orderCount: c.orderCount || 0,
      totalSpent: c.totalSpent || 0,
      lastOrderDate: c.lastOrderDate || null,
      manualStatus: c.manualStatus || 'NONE',
      customerCategory: getSyncedCategory(c, nowMs),
      tags: Array.isArray(c.tags) ? c.tags : [],
      adminNotes: c.adminNotes || '',
      dietaryInfo: c.dietaryInfo || '',
      isRegistered: c.isRegistered === true
    }));

    res.json(response);
  } catch (err: any) {
    console.error('getCustomers error:', err);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת רשימת הלקוחות'
    });
  }
}

export async function updateCustomerCrm(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const existingCustomer = await Customer.findById(id).lean();
    if (!existingCustomer) {
      res.status(404).json({ success: false, message: 'לקוח לא נמצא' });
      return;
    }

    const update: Record<string, unknown> = {};
    if (body.tags !== undefined) {
      update.tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : [];
    }
    if (body.fullName !== undefined) {
      update.fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    }
    if (body.email !== undefined) {
      update.email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    }
    if (body.address !== undefined) {
      update.address = typeof body.address === 'string' ? body.address.trim() : '';
    }
    if (body.phone !== undefined) {
      const rawPhone = String(body.phone || '').trim();
      // Allow updating other CRM fields even when phone is empty.
      if (rawPhone) {
        const normalizedPhone = normalizePhone(rawPhone);
        if (!normalizedPhone) {
          res.status(400).json({ success: false, message: 'טלפון לא תקין' });
          return;
        }
        update.normalizedPhone = normalizedPhone;
      }
    }
    if (body.adminNotes !== undefined) {
      update.adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : '';
    }
    if (body.dietaryInfo !== undefined) {
      update.dietaryInfo = typeof body.dietaryInfo === 'string' ? body.dietaryInfo : '';
    }
    if (body.manualStatus !== undefined) {
      const status = String(body.manualStatus || '').trim().toUpperCase();
      if (!['NONE', 'VIP', 'BLACKLIST'].includes(status)) {
        res.status(400).json({ success: false, message: 'manualStatus לא תקין' });
        return;
      }
      update.manualStatus = status;
    }
    if (body.customerCategory !== undefined) {
      const category = String(body.customerCategory || '').trim().toLowerCase();
      if (!['all', 'returning', 'sleeping', 'vip', 'registered'].includes(category)) {
        res.status(400).json({ success: false, message: 'customerCategory לא תקין' });
        return;
      }
      update.customerCategory = category;
      if (category === 'registered') {
        update.isRegistered = true;
      }
    }

    const customer = await Customer.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!customer) {
      res.status(404).json({ success: false, message: 'לקוח לא נמצא' });
      return;
    }

    // Keep linked site User in sync for contact fields changed via CRM panel.
    const linkedUser =
      (await resolveLinkedSiteUserForCustomer(existingCustomer)) ||
      (await resolveLinkedSiteUserForCustomer(customer));
    if (linkedUser) {
      const userSet: Record<string, unknown> = {};
      const nextFullName = String((customer as any).fullName || '').trim();
      const nextEmail = String((customer as any).email || '')
        .trim()
        .toLowerCase();
      const nextPhone = normalizePhone((customer as any).normalizedPhone);

      if (nextFullName && linkedUser.fullName !== nextFullName) {
        userSet.fullName = nextFullName;
      }

      if (nextPhone) {
        const userPhoneCandidates = buildUserPhoneCandidates(String(linkedUser.phone || ''));
        if (!userPhoneCandidates.includes(nextPhone)) {
          userSet.phone = nextPhone;
        }
      }

      if (nextEmail && !isBusinessEmail(nextEmail) && linkedUser.username !== nextEmail) {
        const emailTaken = await User.findOne({
          _id: { $ne: linkedUser._id },
          username: nextEmail
        })
          .select('_id')
          .lean();
        if (emailTaken) {
          res.status(409).json({
            success: false,
            message: 'האימייל כבר משויך למשתמש אחר'
          });
          return;
        }
        userSet.username = nextEmail;
      }

      if (Object.keys(userSet).length > 0) {
        await User.updateOne({ _id: linkedUser._id }, { $set: userSet });
      }
    }

    // Keep registration badge in sync immediately after CRM edits (phone/email/category changes).
    const customerPhone = normalizePhone((customer as any).normalizedPhone);
    const customerEmail = String((customer as any).email || '')
      .trim()
      .toLowerCase();
    let isRegistered = false;
    if (customerPhone || customerEmail) {
      const userFilter: Record<string, any> = { role: { $ne: 'admin' } };
      const or: Array<Record<string, unknown>> = [];
      if (customerPhone) {
        const phoneCandidates = buildUserPhoneCandidates(customerPhone);
        or.push({
          phone: {
            $in: phoneCandidates
          }
        });
      }
      if (customerEmail && !isBusinessEmail(customerEmail)) {
        or.push({ username: customerEmail });
        or.push({ email: customerEmail });
      }
      if (or.length > 0) {
        userFilter.$or = or;
        const linkedUser = await User.findOne(userFilter).select('_id').lean();
        isRegistered = !!linkedUser;
      }
    }
    if ((customer as any).isRegistered !== isRegistered) {
      await Customer.updateOne({ _id: (customer as any)._id }, { $set: { isRegistered } });
      (customer as any).isRegistered = isRegistered;
    }

    const nowMs = Date.now();
    res.json({
      _id: String((customer as any)._id),
      fullName: customer.fullName || '',
      username: customer.email || '',
      email: customer.email || '',
      phone: customer.normalizedPhone || '',
      address: (customer as any).address || '',
      role: 'customer',
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      orderCount: customer.orderCount || 0,
      totalSpent: customer.totalSpent || 0,
      lastOrderDate: customer.lastOrderDate || null,
      manualStatus: customer.manualStatus || 'NONE',
      customerCategory: getSyncedCategory(customer, nowMs),
      tags: Array.isArray(customer.tags) ? customer.tags : [],
      adminNotes: customer.adminNotes || '',
      dietaryInfo: customer.dietaryInfo || '',
      isRegistered: (customer as any).isRegistered === true
    });
  } catch (err: any) {
    console.error('updateCustomerCrm error:', err);
    res.status(500).json({
      success: false,
      message: 'שגיאה בעדכון פרטי הלקוח'
    });
  }
}

export async function deleteCustomer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const customer = await Customer.findByIdAndDelete(id).lean();
    if (!customer) {
      res.status(404).json({ success: false, message: 'לקוח לא נמצא' });
      return;
    }
    res.json({ success: true, message: 'הלקוח נמחק בהצלחה', _id: id });
  } catch (err: any) {
    console.error('deleteCustomer error:', err);
    res.status(500).json({
      success: false,
      message: 'שגיאה במחיקת הלקוח'
    });
  }
}

export async function auditCustomersSync(_req: Request, res: Response): Promise<void> {
  try {
    const [orders, users, customers] = await Promise.all([
      Order.find(
        {},
        {
          customerDetails: 1,
          totalPrice: 1,
          createdAt: 1,
          updatedAt: 1,
          orderNumber: 1,
          isDeleted: 1,
          status: 1
        }
      ).lean(),
      User.find({}, { username: 1, email: 1, phone: 1 }).lean(),
      Customer.find({}, { normalizedPhone: 1, fullName: 1, email: 1, orderCount: 1, totalSpent: 1 }).lean()
    ]);

    const ordersArr = orders as any[];
    const latestMap = buildLatestOrdersByNumber(ordersArr);
    const aggByPhone = aggregateOrdersByPhone(latestMap);

    const userByPhone = new Map<string, { username?: string; email?: string }>();
    for (const u of users as any[]) {
      const phone = normalizePhone(u?.phone);
      if (phone) userByPhone.set(phone, { username: u.username, email: u.email });
    }

    const customerPhones = new Set<string>();
    const issues: Array<{
      phone: string;
      issueType: string;
      valueInCRM: unknown;
      valueInOrders: unknown;
      detail?: string;
    }> = [];

    for (const c of customers as any[]) {
      const phone = normalizePhone(c?.normalizedPhone);
      if (!phone) continue;
      customerPhones.add(phone);

      const agg = aggByPhone.get(phone);
      const crmCount = Number(c.orderCount || 0);
      const crmSpent = Math.round((Number(c.totalSpent) || 0) * 100) / 100;

      if (!agg) {
        if (crmCount !== 0 || crmSpent !== 0) {
          issues.push({
            phone,
            issueType: 'Order Count Mismatch',
            valueInCRM: { orderCount: crmCount, totalSpent: crmSpent },
            valueInOrders: { orderCount: 0, totalSpent: 0 }
          });
        }
      } else {
        if (crmCount !== agg.orderCount) {
          issues.push({
            phone,
            issueType: 'Order Count Mismatch',
            valueInCRM: { orderCount: crmCount, totalSpent: crmSpent },
            valueInOrders: { orderCount: agg.orderCount, totalSpent: agg.totalSpent }
          });
        }
        if (Math.abs(crmSpent - agg.totalSpent) > 0.009) {
          issues.push({
            phone,
            issueType: 'Total Spent Mismatch',
            valueInCRM: { orderCount: crmCount, totalSpent: crmSpent },
            valueInOrders: { orderCount: agg.orderCount, totalSpent: agg.totalSpent }
          });
        }
      }

      const crmEmail = String(c.email || '')
        .trim()
        .toLowerCase();
      const needsIdentity = !crmEmail || isBusinessEmail(crmEmail);
      if (needsIdentity) {
        const found = findPersonalEmailForPhone(phone, userByPhone, ordersArr);
        if (found) {
          issues.push({
            phone,
            issueType: 'Identity Email Candidate',
            valueInCRM: { email: crmEmail || '(empty)' },
            valueInOrders: { email: found },
            detail: 'Personal email exists in User or Order; CRM is empty or business-only'
          });
        }
      }

      const crmName = normalizeNameForCompare(c.fullName);
      if (agg) {
        const orderName = normalizeNameForCompare(agg.latestOrderName);
        if (orderName || crmName) {
          const ratio = nameDifferenceRatio(crmName, orderName);
          if (ratio > 0.2) {
            issues.push({
              phone,
              issueType: 'Name Conflict',
              valueInCRM: { fullName: crmName || '(empty)' },
              valueInOrders: {
                fullName: orderName || '(empty)',
                differenceRatio: Math.round(ratio * 1000) / 1000
              },
              detail: 'CRM fullName differs from latest countable order by more than 20%'
            });
          }
        }
      }
    }

    for (const [phone, agg] of aggByPhone) {
      if (!customerPhones.has(phone)) {
        issues.push({
          phone,
          issueType: 'No Customer Record',
          valueInCRM: null,
          valueInOrders: { orderCount: agg.orderCount, totalSpent: agg.totalSpent },
          detail: 'Phone has countable orders but no Customer document'
        });
      }
    }

    const summary = {
      orderCountMismatches: issues.filter((i) => i.issueType === 'Order Count Mismatch').length,
      totalSpentMismatches: issues.filter((i) => i.issueType === 'Total Spent Mismatch').length,
      identityFlags: issues.filter((i) => i.issueType === 'Identity Email Candidate').length,
      orphans: issues.filter((i) => i.issueType === 'No Customer Record').length,
      nameConflicts: issues.filter((i) => i.issueType === 'Name Conflict').length,
      totalIssues: issues.length
    };

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      summary,
      issues
    });
  } catch (err: any) {
    console.error('auditCustomersSync error:', err);
    res.status(500).json({
      success: false,
      message: 'שגיאה בביקורת נתונים'
    });
  }
}

export async function migrateLegacyData(_req: Request, res: Response): Promise<void> {
  try {
    const [orders, users, contacts, existingCustomers] = await Promise.all([
      Order.find({}, { customerDetails: 1, totalPrice: 1, createdAt: 1, updatedAt: 1, orderNumber: 1, isDeleted: 1, status: 1 }).lean(),
      User.find(
        {},
        { fullName: 1, username: 1, email: 1, phone: 1, role: 1, tags: 1, adminNotes: 1, dietaryInfo: 1, createdAt: 1 }
      ).lean(),
      Contact.find({}).select('name email phone notes createdAt').lean(),
      Customer.find({}, { normalizedPhone: 1, fullName: 1, email: 1 }).lean()
    ]);

    type Bucket = {
      normalizedPhone: string;
      fullName?: string;
      email?: string;
      fullNamePriority: 0 | 1 | 2 | 3;
      emailPriority: 0 | 1 | 2 | 3;
      tags?: string[];
      adminNotes?: string;
      dietaryInfo?: string;
      orderCount: number;
      totalSpent: number;
      lastOrderDate: Date | null;
    };

    const existingByPhone = new Map<string, { fullName?: string; email?: string }>();
    for (const c of existingCustomers as any[]) {
      const phone = normalizePhone(c?.normalizedPhone);
      if (!phone) continue;
      existingByPhone.set(phone, {
        fullName: String(c?.fullName || '').trim(),
        email: String(c?.email || '').trim().toLowerCase()
      });
    }

    const map = new Map<string, Bucket>();
    const getBucket = (phone: string): Bucket => {
      const existing = map.get(phone);
      if (existing) return existing;
      const created: Bucket = {
        normalizedPhone: phone,
        fullNamePriority: 0,
        emailPriority: 0,
        orderCount: 0,
        totalSpent: 0,
        lastOrderDate: null
      };
      map.set(phone, created);
      return created;
    };

    const cleanString = (value: unknown): string => String(value || '').trim();
    const setFullName = (bucket: Bucket, value: unknown, priority: 1 | 2 | 3): void => {
      const next = cleanString(value);
      if (!next) return;
      if (priority >= bucket.fullNamePriority) {
        bucket.fullName = next;
        bucket.fullNamePriority = priority;
      }
    };
    const setEmail = (bucket: Bucket, value: unknown, priority: 1 | 2 | 3, _source: 'user' | 'contact' | 'order'): void => {
      const next = cleanString(value).toLowerCase();
      if (!next) return;
      // Absolute identity guard: never accept business/admin emails from any source.
      if (isBusinessEmail(next)) return;
      if (priority >= bucket.emailPriority) {
        bucket.email = next;
        bucket.emailPriority = priority;
      }
    };

    // Ultimate deduper by orderNumber:
    // keep ONLY latest updatedAt document that is NOT isDeleted for each orderNumber.
    const latestOrdersByNumber = new Map<string, any>();
    for (const order of orders as any[]) {
      const key = String(order?.orderNumber || order?._id || '').trim();
      if (!key) continue;
      if (order?.isDeleted === true) continue;
      const current = latestOrdersByNumber.get(key);
      if (!current) {
        latestOrdersByNumber.set(key, order);
        continue;
      }
      const currentUpdatedAt = current?.updatedAt ? new Date(current.updatedAt).getTime() : 0;
      const nextUpdatedAt = order?.updatedAt ? new Date(order.updatedAt).getTime() : 0;
      if (nextUpdatedAt >= currentUpdatedAt) {
        latestOrdersByNumber.set(key, order);
      }
    }

    // Identity scavenging pass:
    // Even deleted/cancelled orders may contain the original customer email/name.
    // We use them as identity candidates only (never for totals/counts).
    for (const order of orders as any[]) {
      const phone = normalizePhone(order?.customerDetails?.phone);
      if (!phone) continue;
      const bucket = getBucket(phone);
      const details = order?.customerDetails || {};
      setFullName(bucket, details?.fullName || details?.name, 1);
      setEmail(bucket, details?.email, 1, 'order');
    }

    for (const order of latestOrdersByNumber.values()) {
      if (!isOrderCountableForCustomerStats(order)) continue;
      const phone = normalizePhone(order?.customerDetails?.phone);
      if (!phone) continue;
      const bucket = getBucket(phone);
      const totalPrice = Number(order?.totalPrice || 0);
      const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
      bucket.orderCount += 1;
      if (Number.isFinite(totalPrice) && totalPrice > 0) {
        bucket.totalSpent += totalPrice;
      }
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        if (!bucket.lastOrderDate || createdAt > bucket.lastOrderDate) {
          bucket.lastOrderDate = createdAt;
        }
      }
    }

    for (const user of users as any[]) {
      const phone = normalizePhone(user?.phone);
      if (!phone) continue;
      const bucket = getBucket(phone);
      // 1st priority: registered User profile.
      setFullName(bucket, user?.fullName, 3);
      setEmail(bucket, user?.username || user?.email, 3, 'user');
      if (Array.isArray(user?.tags)) bucket.tags = user.tags.filter((t: unknown) => typeof t === 'string');
      if (typeof user?.adminNotes === 'string') bucket.adminNotes = user.adminNotes;
      if (typeof user?.dietaryInfo === 'string') bucket.dietaryInfo = user.dietaryInfo;
    }

    for (const contact of contacts as any[]) {
      const phone = normalizePhone(contact?.phone);
      if (!phone) continue;
      const bucket = getBucket(phone);
      // 2nd priority: Contact/lead record.
      setFullName(bucket, contact?.name, 2);
      setEmail(bucket, contact?.email, 2, 'contact');
      if (!bucket.adminNotes && typeof contact?.notes === 'string') bucket.adminNotes = contact.notes;
    }

    const registeredPhones = new Set<string>();
    const registeredEmails = new Set<string>();
    for (const user of users as any[]) {
      if (String(user?.role || '').toLowerCase() === 'admin') continue;
      const phone = normalizePhone(user?.phone);
      if (phone) registeredPhones.add(phone);
      const em = String(user?.username || '')
        .trim()
        .toLowerCase();
      if (em) registeredEmails.add(em);
    }

    const ops = Array.from(map.values()).map((b) => {
      const existing = existingByPhone.get(b.normalizedPhone);
      const existingFullName = String(existing?.fullName || '').trim();
      const existingEmailRaw = String(existing?.email || '').trim().toLowerCase();
      // Safe fallback: never use business email from existing customer as fallback.
      const existingEmailSanitized = isBusinessEmail(existingEmailRaw) ? '' : existingEmailRaw;
      const finalFullName = b.fullName || existingFullName;
      const finalEmailCandidate = b.email || existingEmailSanitized;
      const finalEmail = isBusinessEmail(finalEmailCandidate) ? '' : finalEmailCandidate;
      const initialManualStatus: CustomerManualStatus = 'NONE';
      const initialCategory: CustomerCategory = 'all';

      return {
      updateOne: {
        filter: { normalizedPhone: b.normalizedPhone },
        update: {
          $set: {
            fullName: finalFullName || '',
            email: finalEmail || '',
            tags: Array.isArray(b.tags) ? b.tags : [],
            adminNotes: b.adminNotes || '',
            dietaryInfo: b.dietaryInfo || '',
            orderCount: b.orderCount,
            totalSpent: Math.round((b.totalSpent || 0) * 100) / 100,
            lastOrderDate: b.lastOrderDate,
            isRegistered:
              registeredPhones.has(b.normalizedPhone) ||
              (!!finalEmail && registeredEmails.has(finalEmail))
          },
          $setOnInsert: {
            manualStatus: initialManualStatus,
            customerCategory: initialCategory
          }
        },
        upsert: true
      }
    };
    }) as Array<{
      updateOne: {
        filter: { normalizedPhone: string };
        update: {
          $set: {
            fullName: string;
            email: string;
            tags: string[];
            adminNotes: string;
            dietaryInfo: string;
            orderCount: number;
            totalSpent: number;
            lastOrderDate: Date | null;
            isRegistered: boolean;
          };
          $setOnInsert: {
            manualStatus: CustomerManualStatus;
            customerCategory: CustomerCategory;
          };
        };
        upsert: true;
      };
    }>;

    if (ops.length > 0) {
      await Customer.bulkWrite(ops);
    }
    // Final global purge: guarantees no business/admin email remains in Customer collection.
    await Customer.updateMany(
      {
        $or: [
          { email: { $in: ADMIN_EMAILS } },
          { email: /jtsolutions\.officee/i },
          { email: /@megadim-catering\.com$/i }
        ]
      },
      { $set: { email: '' } }
    );

    res.json({
      success: true,
      message: 'Legacy data migrated successfully',
      groupedPhones: map.size,
      migratedCustomers: ops.length
    });
  } catch (err: any) {
    console.error('migrateLegacyData error:', err);
    res.status(500).json({
      success: false,
      message: 'שגיאה בייבוא נתוני עבר'
    });
  }
}
