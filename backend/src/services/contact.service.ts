import mongoose from 'mongoose';
import { ContactRequest, ContactResponse, UpdateContactRequest } from '../models/contact.model';
import Contact from '../models/Contact';
import { emailService } from './email.service';
import { fireWebhook, sanitizeMarketingData } from '../utils/webhook.util';

interface ContactFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

interface ContactAnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
}

type LeanContactDoc = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  status?: string;
  source?: string;
  notes?: string;
  marketingData?: Record<string, string>;
  createdAt?: Date;
  updatedAt?: Date;
};

function leanToContactRequest(doc: LeanContactDoc | null): ContactRequest | null {
  if (!doc?._id) return null;
  return {
    id: String(doc._id),
    name: String(doc.name ?? ''),
    email: String(doc.email ?? ''),
    phone: String(doc.phone ?? ''),
    message: String(doc.message ?? ''),
    status: (doc.status as ContactRequest['status']) || 'new',
    source: doc.source != null ? String(doc.source) : undefined,
    notes: doc.notes != null ? String(doc.notes) : undefined,
    marketingData: doc.marketingData,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

export class ContactService {
  // Submit new contact form — persist first, then notify by email (fail-open).
  async submitContactForm(contactData: ContactRequest): Promise<ContactResponse> {
    const marketingData = sanitizeMarketingData(contactData.marketingData);

    const doc = await Contact.create({
      name: contactData.name.trim(),
      email: (contactData.email || '').trim(),
      phone: contactData.phone.trim(),
      message: contactData.message.trim(),
      source: (contactData.source || 'website').trim() || 'website',
      status: 'new',
      ...(marketingData ? { marketingData } : {})
    });

    const contactId = doc._id.toString();
    console.log(`📧 New contact form saved: ${contactId} (${doc.name}, ${doc.phone})`);

    const contactForWebhook = typeof (doc as any).toObject === 'function' ? (doc as any).toObject() : doc;
    void fireWebhook(process.env.N8N_CONTACT_WEBHOOK_URL, contactForWebhook);

    void emailService
      .sendContactFormToBusiness({
        name: doc.name,
        phone: doc.phone,
        email: doc.email,
        message: doc.message
      })
      .catch((emailErr: unknown) => {
        console.error('Contact form: email notification failed (contactId=%s):', contactId, emailErr);
      });

    return {
      success: true,
      message: 'הודעתך נשלחה בהצלחה, נחזור אליך בהקדם.',
      contactId
    };
  }

  async getAllContactRequests(filters: ContactFilters = {}): Promise<{
    contacts: ContactRequest[];
    total: number;
  }> {
    const query: Record<string, string> = {};
    if (filters.status && ['new', 'read', 'handled'].includes(filters.status)) {
      query.status = filters.status;
    }

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const offset = Math.max(filters.offset ?? 0, 0);

    const [total, docs] = await Promise.all([
      Contact.countDocuments(query),
      Contact.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean()
    ]);

    const contacts = docs
      .map((d) => leanToContactRequest(d as LeanContactDoc))
      .filter((c): c is ContactRequest => c !== null);

    return { contacts, total };
  }

  async getContactRequestById(id: string): Promise<ContactRequest | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await Contact.findById(id).lean();
    return leanToContactRequest(doc as LeanContactDoc | null);
  }

  async updateContactStatus(id: string, updateData: UpdateContactRequest): Promise<ContactRequest | null> {
    if (!updateData.status) return null;
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const doc = await Contact.findByIdAndUpdate(
      id,
      {
        $set: {
          status: updateData.status,
          ...(updateData.notes !== undefined ? { notes: updateData.notes } : {})
        }
      },
      { new: true, runValidators: true }
    ).lean();

    if (doc) {
      console.log(`📝 Contact ${id} status updated to ${updateData.status}`);
    }

    return leanToContactRequest(doc as LeanContactDoc | null);
  }

  async deleteContactRequest(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await Contact.findByIdAndDelete(id);
    if (result) {
      console.log(`🗑️ Contact request ${id} deleted`);
      return true;
    }
    return false;
  }

  async getContactStatistics(): Promise<{
    total: number;
    byStatus: { [status: string]: number };
    bySource: { [source: string]: number };
    /** Legacy shape; not stored on Contact documents. */
    byEventType: { [eventType: string]: number };
    recentCount: number;
    conversionRate: number;
  }> {
    const total = await Contact.countDocuments();

    const [statusAgg, sourceAgg] = await Promise.all([
      Contact.aggregate<{ _id: string | null; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Contact.aggregate<{ _id: string | null; count: number }>([
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ])
    ]);

    const byStatus: { [status: string]: number } = {};
    for (const row of statusAgg) {
      byStatus[row._id || 'unknown'] = row.count;
    }

    const bySource: { [source: string]: number } = {};
    for (const row of sourceAgg) {
      bySource[row._id || 'unknown'] = row.count;
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentCount = await Contact.countDocuments({ createdAt: { $gt: weekAgo } });

    const handled = byStatus['handled'] || 0;
    const conversionRate = total > 0 ? Math.round((handled / total) * 10000) / 100 : 0;

    return {
      total,
      byStatus,
      bySource,
      byEventType: {},
      recentCount,
      conversionRate
    };
  }

  async searchContacts(query: string): Promise<ContactRequest[]> {
    const term = (query || '').trim();
    if (!term) return [];

    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');

    const docs = await Contact.find({
      $or: [{ name: rx }, { phone: rx }, { email: rx }, { message: rx }]
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return docs
      .map((d) => leanToContactRequest(d as LeanContactDoc))
      .filter((c): c is ContactRequest => c !== null);
  }

  /**
   * Aggregate leads volume by marketing source (utm_source).
   * Missing/empty values are bucketed as "direct".
   */
  async getLeadsBySource(filters?: ContactAnalyticsFilters): Promise<Array<{ source: string; leadsCount: number }>> {
    const match: Record<string, unknown> = {};
    if (filters?.startDate || filters?.endDate) {
      match.createdAt = {};
      if (filters.startDate) (match.createdAt as Record<string, Date>)['$gte'] = filters.startDate;
      if (filters.endDate) (match.createdAt as Record<string, Date>)['$lte'] = filters.endDate;
    }

    const rows = await Contact.aggregate([
      { $match: match },
      {
        $project: {
          source: {
            $let: {
              vars: { src: { $ifNull: ['$marketingData.utm_source', ''] } },
              in: {
                $cond: [
                  { $gt: [{ $strLenCP: { $trim: { input: '$$src' } } }, 0] },
                  { $toLower: { $trim: { input: '$$src' } } },
                  'direct'
                ]
              }
            }
          }
        }
      },
      {
        $group: {
          _id: '$source',
          leadsCount: { $sum: 1 }
        }
      },
      { $sort: { leadsCount: -1 } },
      {
        $project: {
          _id: 0,
          source: '$_id',
          leadsCount: 1
        }
      }
    ]);

    return rows as Array<{ source: string; leadsCount: number }>;
  }
}
