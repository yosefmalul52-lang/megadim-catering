/** API / transport shape for contact submissions (aligned with Mongo `Contact` model). */
export interface ContactRequest {
  id?: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  source?: string;
  status?:
    | 'new'
    | 'attempted_contact'
    | 'qualified'
    | 'unqualified'
    | 'won'
    | 'lost';
  notes?: string;
  leadScore?: 'A' | 'B' | 'C' | number;
  lastContactAt?: Date | string;
  nextFollowUpAt?: Date | string;
  outcomeReason?: string;
  ownerNotes?: string;
  /** Optional UTM / campaign attribution from the client. */
  marketingData?: Record<string, string>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ContactResponse {
  success: boolean;
  message: string;
  contactId?: string;
}

export interface UpdateContactRequest {
  status?:
    | 'new'
    | 'attempted_contact'
    | 'qualified'
    | 'unqualified'
    | 'won'
    | 'lost';
  notes?: string;
  leadScore?: 'A' | 'B' | 'C' | number;
  lastContactAt?: Date | string | null;
  nextFollowUpAt?: Date | string | null;
  outcomeReason?: string;
  ownerNotes?: string;
}
