"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Contact_1 = __importDefault(require("../models/Contact"));
const email_service_1 = require("./email.service");
const webhook_util_1 = require("../utils/webhook.util");
function leanToContactRequest(doc) {
    var _j, _k, _q, _z;
    if (!(doc === null || doc === void 0 ? void 0 : doc._id))
        return null;
    return {
        id: String(doc._id),
        name: String((_j = doc.name) !== null && _j !== void 0 ? _j : ''),
        email: String((_k = doc.email) !== null && _k !== void 0 ? _k : ''),
        phone: String((_q = doc.phone) !== null && _q !== void 0 ? _q : ''),
        message: String((_z = doc.message) !== null && _z !== void 0 ? _z : ''),
        status: doc.status || 'new',
        source: doc.source != null ? String(doc.source) : undefined,
        notes: doc.notes != null ? String(doc.notes) : undefined,
        leadScore: doc.leadScore,
        lastContactAt: doc.lastContactAt || undefined,
        nextFollowUpAt: doc.nextFollowUpAt || undefined,
        outcomeReason: doc.outcomeReason != null ? String(doc.outcomeReason) : undefined,
        ownerNotes: doc.ownerNotes != null ? String(doc.ownerNotes) : undefined,
        marketingData: doc.marketingData,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
}
class ContactService {
    // Submit new contact form — persist first, then notify by email (fail-open).
    submitContactForm(contactData) {
        return __awaiter(this, void 0, void 0, function* () {
            const marketingData = (0, webhook_util_1.sanitizeMarketingData)(contactData.marketingData);
            const doc = yield Contact_1.default.create(Object.assign({ name: contactData.name.trim(), email: (contactData.email || '').trim(), phone: contactData.phone.trim(), message: contactData.message.trim(), source: (contactData.source || 'website').trim() || 'website', status: 'new' }, (marketingData ? { marketingData } : {})));
            const contactId = doc._id.toString();
            console.log(`📧 New contact form saved: ${contactId} (${doc.name}, ${doc.phone})`);
            const contactForWebhook = typeof doc.toObject === 'function' ? doc.toObject() : doc;
            void (0, webhook_util_1.fireWebhook)(process.env.N8N_CONTACT_WEBHOOK_URL, contactForWebhook);
            void email_service_1.emailService
                .sendContactFormToBusiness({
                name: doc.name,
                phone: doc.phone,
                email: doc.email,
                message: doc.message
            })
                .catch((emailErr) => {
                console.error('Contact form: email notification failed (contactId=%s):', contactId, emailErr);
            });
            return {
                success: true,
                message: 'הודעתך נשלחה בהצלחה, נחזור אליך בהקדם.',
                contactId
            };
        });
    }
    getAllContactRequests() {
        return __awaiter(this, arguments, void 0, function* (filters = {}) {
            var _j, _k;
            const query = {};
            if (filters.status &&
                ['new', 'attempted_contact', 'qualified', 'unqualified', 'won', 'lost'].includes(filters.status)) {
                query.status = filters.status;
            }
            const limit = Math.min(Math.max((_j = filters.limit) !== null && _j !== void 0 ? _j : 50, 1), 200);
            const offset = Math.max((_k = filters.offset) !== null && _k !== void 0 ? _k : 0, 0);
            const [total, docs] = yield Promise.all([
                Contact_1.default.countDocuments(query),
                Contact_1.default.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean()
            ]);
            const contacts = docs
                .map((d) => leanToContactRequest(d))
                .filter((c) => c !== null);
            return { contacts, total };
        });
    }
    getContactRequestById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.default.Types.ObjectId.isValid(id))
                return null;
            const doc = yield Contact_1.default.findById(id).lean();
            return leanToContactRequest(doc);
        });
    }
    updateContactStatus(id, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.default.Types.ObjectId.isValid(id))
                return null;
            const set = {};
            if (updateData.status)
                set.status = updateData.status;
            if (updateData.notes !== undefined)
                set.notes = updateData.notes;
            if (updateData.leadScore !== undefined)
                set.leadScore = updateData.leadScore;
            if (updateData.lastContactAt !== undefined) {
                set.lastContactAt = updateData.lastContactAt ? new Date(updateData.lastContactAt) : null;
            }
            if (updateData.nextFollowUpAt !== undefined) {
                set.nextFollowUpAt = updateData.nextFollowUpAt ? new Date(updateData.nextFollowUpAt) : null;
            }
            if (updateData.outcomeReason !== undefined)
                set.outcomeReason = updateData.outcomeReason;
            if (updateData.ownerNotes !== undefined)
                set.ownerNotes = updateData.ownerNotes;
            if (!Object.keys(set).length)
                return null;
            const doc = yield Contact_1.default.findByIdAndUpdate(id, {
                $set: set
            }, { new: true, runValidators: true }).lean();
            if (doc) {
                console.log(`📝 Contact ${id} updated`);
            }
            return leanToContactRequest(doc);
        });
    }
    deleteContactRequest(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.default.Types.ObjectId.isValid(id))
                return false;
            const result = yield Contact_1.default.findByIdAndDelete(id);
            if (result) {
                console.log(`🗑️ Contact request ${id} deleted`);
                return true;
            }
            return false;
        });
    }
    getContactStatistics() {
        return __awaiter(this, void 0, void 0, function* () {
            const total = yield Contact_1.default.countDocuments();
            const [statusAgg, sourceAgg] = yield Promise.all([
                Contact_1.default.aggregate([
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ]),
                Contact_1.default.aggregate([
                    { $group: { _id: '$source', count: { $sum: 1 } } }
                ])
            ]);
            const byStatus = {};
            for (const row of statusAgg) {
                byStatus[row._id || 'unknown'] = row.count;
            }
            const bySource = {};
            for (const row of sourceAgg) {
                bySource[row._id || 'unknown'] = row.count;
            }
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const recentCount = yield Contact_1.default.countDocuments({ createdAt: { $gt: weekAgo } });
            const won = byStatus['won'] || 0;
            const conversionRate = total > 0 ? Math.round((won / total) * 10000) / 100 : 0;
            return {
                total,
                byStatus,
                bySource,
                byEventType: {},
                recentCount,
                conversionRate
            };
        });
    }
    searchContacts(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const term = (query || '').trim();
            if (!term)
                return [];
            const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(escaped, 'i');
            const docs = yield Contact_1.default.find({
                $or: [{ name: rx }, { phone: rx }, { email: rx }, { message: rx }]
            })
                .sort({ createdAt: -1 })
                .limit(100)
                .lean();
            return docs
                .map((d) => leanToContactRequest(d))
                .filter((c) => c !== null);
        });
    }
    /**
     * Aggregate leads volume by marketing source (utm_source).
     * Missing/empty values are bucketed as "direct".
     */
    getLeadsBySource(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const match = {};
            if ((filters === null || filters === void 0 ? void 0 : filters.startDate) || (filters === null || filters === void 0 ? void 0 : filters.endDate)) {
                match.createdAt = {};
                if (filters.startDate)
                    match.createdAt['$gte'] = filters.startDate;
                if (filters.endDate)
                    match.createdAt['$lte'] = filters.endDate;
            }
            const rows = yield Contact_1.default.aggregate([
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
                        },
                        status: 1,
                        createdAt: 1
                    }
                },
                {
                    $group: {
                        _id: '$source',
                        leadsCount: { $sum: 1 },
                        qualifiedCount: {
                            $sum: { $cond: [{ $in: ['$status', ['qualified', 'won']] }, 1, 0] }
                        },
                        wonCount: {
                            $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] }
                        }
                    }
                },
                { $sort: { leadsCount: -1 } },
                {
                    $project: {
                        _id: 0,
                        source: '$_id',
                        leadsCount: 1,
                        qualifiedCount: 1,
                        wonCount: 1,
                        qualifiedRate: {
                            $cond: [{ $gt: ['$leadsCount', 0] }, { $multiply: [{ $divide: ['$qualifiedCount', '$leadsCount'] }, 100] }, 0]
                        },
                        wonRate: {
                            $cond: [{ $gt: ['$leadsCount', 0] }, { $multiply: [{ $divide: ['$wonCount', '$leadsCount'] }, 100] }, 0]
                        }
                    }
                }
            ]);
            return rows;
        });
    }
}
exports.ContactService = ContactService;
