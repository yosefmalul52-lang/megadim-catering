import { Component, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminContactsService,
  AdminContact,
  AdminContactStatus,
  LeadsBySourcePoint
} from '../../../services/admin-contacts.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-admin-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './admin-leads.component.html',
  styleUrls: ['./admin-leads.component.scss']
})
export class AdminLeadsComponent implements OnInit {
  private adminContactsService = inject(AdminContactsService);
  private toast = inject(ToastService);

  leads: AdminContact[] = [];
  isLoading = true;
  isUpdatingId: string | null = null;
  isDeletingId: string | null = null;
  isBulkDeleting = false;
  errorMessage = '';
  searchTerm = '';
  sourceFilter = 'all';
  followupFilter: 'all' | 'overdue' | 'today' = 'all';

  statusFilter: 'all' | AdminContactStatus = 'all';
  readonly pageSize = 25;
  offset = 0;
  total = 0;
  hasMore = false;

  leadsBySource: LeadsBySourcePoint[] = [];
  isLoadingRoi = false;
  leadsViewStartedAt = Date.now();
  private readonly mobileBreakpoint = 900;
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  adoptionKpis = {
    statusChanges: 0,
    followupsSet: 0,
    notesSaved: 0
  };
  selectedLeadIds = new Set<string>();
  leadDrafts: Record<
    string,
    {
      status: AdminContactStatus;
      leadScore: 'A' | 'B' | 'C';
      nextFollowUpAt: string;
      ownerNotes: string;
    }
  > = {};

  readonly statusOptions: Array<{ value: AdminContactStatus; label: string }> = [
    { value: 'new', label: 'חדש' },
    { value: 'attempted_contact', label: 'ניסיון יצירת קשר' },
    { value: 'qualified', label: 'מתאים' },
    { value: 'unqualified', label: 'לא מתאים' },
    { value: 'won', label: 'נסגר בהצלחה' },
    { value: 'lost', label: 'אבוד' }
  ];

  ngOnInit(): void {
    this.hydrateAdoptionKpis();
    this.loadLeads();
    this.loadRoi();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (typeof window === 'undefined') return;
    this.viewportWidth = window.innerWidth;
  }

  loadLeads(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.adminContactsService
      .getContacts({
        status: this.statusFilter,
        limit: this.pageSize,
        offset: this.offset
      })
      .subscribe({
        next: ({ contacts, pagination }) => {
          this.leads = contacts;
          this.seedDraftsForContacts(contacts);
          this.pruneSelection(contacts);
          this.total = pagination.total;
          this.hasMore = pagination.hasMore;
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'שגיאה בטעינת הלידים';
          this.isLoading = false;
        }
      });
  }

  onFilterChange(): void {
    this.offset = 0;
    this.loadLeads();
    this.loadRoi();
  }

  onPageChange(delta: number): void {
    const nextOffset = this.offset + delta;
    if (nextOffset < 0) return;
    this.offset = nextOffset;
    this.loadLeads();
  }

  changeStatus(lead: AdminContact, nextStatus: AdminContactStatus): void {
    this.getDraft(lead).status = nextStatus;
  }

  updateLeadScore(lead: AdminContact, score: 'A' | 'B' | 'C'): void {
    this.getDraft(lead).leadScore = score;
  }

  saveFollowUp(lead: AdminContact, value: string): void {
    this.getDraft(lead).nextFollowUpAt = value || '';
  }

  saveOwnerNotes(lead: AdminContact, value: string): void {
    this.getDraft(lead).ownerNotes = value || '';
  }

  saveLeadChanges(lead: AdminContact): void {
    const id = lead.id;
    if (!id || this.isUpdatingId === id) return;
    const draft = this.getDraft(lead);
    const payload = {
      status: draft.status,
      leadScore: draft.leadScore,
      nextFollowUpAt: draft.nextFollowUpAt || null,
      ownerNotes: draft.ownerNotes,
      lastContactAt: new Date().toISOString()
    };
    this.isUpdatingId = id;
    this.adminContactsService.updateContactStatus(id, payload).subscribe({
      next: (updated) => {
        this.isUpdatingId = null;
        if (!updated) {
          this.toast.error('שמירת ליד נכשלה');
          return;
        }
        const previous = this.leads.find((l) => l.id === id);
        this.leads = this.leads.map((l) => (l.id === id ? { ...l, ...updated } : l));
        this.seedDraftsForContacts(this.leads);
        if (previous && previous.status !== updated.status) this.bumpAdoption('statusChanges');
        if (previous && (previous.nextFollowUpAt || '') !== (updated.nextFollowUpAt || '')) this.bumpAdoption('followupsSet');
        if (previous && (previous.ownerNotes || '') !== (updated.ownerNotes || '')) this.bumpAdoption('notesSaved');
        this.loadRoi();
        this.toast.success('הליד נשמר בהצלחה');
      },
      error: () => {
        this.isUpdatingId = null;
        this.toast.error('שמירת ליד נכשלה');
      }
    });
  }

  loadRoi(): void {
    this.isLoadingRoi = true;
    this.adminContactsService.getLeadsBySource().subscribe({
      next: (rows) => {
        this.leadsBySource = rows || [];
        this.isLoadingRoi = false;
      },
      error: () => {
        this.isLoadingRoi = false;
      }
    });
  }

  getUtmSource(lead: AdminContact): string {
    return lead.marketingData?.utm_source?.trim() || 'אורגני';
  }

  getUtmMedium(lead: AdminContact): string {
    return lead.marketingData?.utm_medium?.trim() || '-';
  }

  getSourceOptions(): string[] {
    const set = new Set(this.leads.map((l) => this.getUtmSource(l)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  get filteredLeads(): AdminContact[] {
    const term = this.searchTerm.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return this.leads.filter((lead) => {
      if (this.sourceFilter !== 'all' && this.getUtmSource(lead) !== this.sourceFilter) return false;
      if (this.followupFilter !== 'all') {
        const follow = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
        if (!follow || Number.isNaN(follow.getTime())) return false;
        if (this.followupFilter === 'overdue' && !(follow < startOfToday)) return false;
        if (this.followupFilter === 'today' && !(follow >= startOfToday && follow <= endOfToday)) return false;
      }
      if (!term) return true;
      const blob = `${lead.name} ${lead.email} ${lead.phone} ${lead.message} ${this.getUtmSource(lead)}`.toLowerCase();
      return blob.includes(term);
    });
  }

  get isMobileView(): boolean {
    return this.viewportWidth < this.mobileBreakpoint;
  }

  get visibleFrom(): number {
    if (!this.filteredLeads.length) return 0;
    return this.offset + 1;
  }

  get visibleTo(): number {
    return this.offset + this.filteredLeads.length;
  }

  get newTodayCount(): number {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.leads.filter((l) => l.createdAt && new Date(l.createdAt) >= start).length;
  }

  get overdueFollowupsCount(): number {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.leads.filter((l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt) < start).length;
  }

  get wonThisWeekCount(): number {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return this.leads.filter((l) => l.status === 'won' && l.updatedAt && new Date(l.updatedAt) >= monday).length;
  }

  get avgFirstResponseHours(): number {
    const rows = this.leads.filter((l) => l.createdAt && l.lastContactAt);
    if (!rows.length) return 0;
    const sum = rows.reduce((acc, l) => acc + (new Date(l.lastContactAt as string).getTime() - new Date(l.createdAt as string).getTime()), 0);
    return Math.max(0, Math.round((sum / rows.length / (1000 * 60 * 60)) * 10) / 10);
  }

  get topSources(): LeadsBySourcePoint[] {
    return [...this.leadsBySource].sort((a, b) => b.wonRate - a.wonRate).slice(0, 3);
  }

  get bottomSources(): LeadsBySourcePoint[] {
    return [...this.leadsBySource].sort((a, b) => a.wonRate - b.wonRate).slice(0, 3);
  }

  get adoptionSummary(): { responseHours: number; followupCoveragePct: number; notesCoveragePct: number; statusChanges: number } {
    const total = this.leads.length || 1;
    const followupCoverage = Math.round((this.leads.filter((l) => !!l.nextFollowUpAt).length / total) * 100);
    const notesCoverage = Math.round((this.leads.filter((l) => !!(l.ownerNotes || '').trim()).length / total) * 100);
    return {
      responseHours: this.avgFirstResponseHours,
      followupCoveragePct: followupCoverage,
      notesCoveragePct: notesCoverage,
      statusChanges: this.adoptionKpis.statusChanges
    };
  }

  getStatusLabel(status: AdminContactStatus): string {
    const map: Record<AdminContactStatus, string> = {
      new: 'חדש',
      attempted_contact: 'ניסיון יצירת קשר',
      qualified: 'מתאים',
      unqualified: 'לא מתאים',
      won: 'נסגר בהצלחה',
      lost: 'אבוד'
    };
    return map[status];
  }

  getLeadScoreLabel(lead: AdminContact): 'A' | 'B' | 'C' {
    const score = String(lead.leadScore || 'B').toUpperCase();
    if (score === 'A' || score === 'B' || score === 'C') return score;
    return 'B';
  }

  getFollowupDateInputValue(lead: AdminContact): string {
    if (!lead.nextFollowUpAt) return '';
    const date = new Date(lead.nextFollowUpAt);
    if (Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getDraft(lead: AdminContact): {
    status: AdminContactStatus;
    leadScore: 'A' | 'B' | 'C';
    nextFollowUpAt: string;
    ownerNotes: string;
  } {
    const existing = this.leadDrafts[lead.id];
    if (existing) return existing;
    const draft = {
      status: lead.status,
      leadScore: this.getLeadScoreLabel(lead),
      nextFollowUpAt: this.getFollowupDateInputValue(lead),
      ownerNotes: lead.ownerNotes || ''
    };
    this.leadDrafts[lead.id] = draft;
    return draft;
  }

  hasUnsavedChanges(lead: AdminContact): boolean {
    const draft = this.getDraft(lead);
    return (
      draft.status !== lead.status ||
      draft.leadScore !== this.getLeadScoreLabel(lead) ||
      draft.nextFollowUpAt !== this.getFollowupDateInputValue(lead) ||
      draft.ownerNotes !== (lead.ownerNotes || '')
    );
  }

  deleteLead(lead: AdminContact): void {
    const id = lead.id;
    if (!id || this.isDeletingId === id) return;
    const ok = typeof window === 'undefined' ? true : window.confirm(`למחוק את הליד של ${lead.name}?`);
    if (!ok) return;
    this.isDeletingId = id;
    this.adminContactsService.deleteContact(id).subscribe({
      next: (success) => {
        this.isDeletingId = null;
        if (!success) {
          this.toast.error('מחיקה נכשלה');
          return;
        }
        this.leads = this.leads.filter((l) => l.id !== id);
        delete this.leadDrafts[id];
        this.selectedLeadIds.delete(id);
        this.total = Math.max(0, this.total - 1);
        this.toast.success('הליד נמחק');
      },
      error: () => {
        this.isDeletingId = null;
        this.toast.error('מחיקה נכשלה');
      }
    });
  }

  toggleLeadSelection(leadId: string, checked: boolean): void {
    if (checked) this.selectedLeadIds.add(leadId);
    else this.selectedLeadIds.delete(leadId);
  }

  isLeadSelected(leadId: string): boolean {
    return this.selectedLeadIds.has(leadId);
  }

  toggleSelectAllVisible(checked: boolean): void {
    const ids = this.filteredLeads.map((l) => l.id).filter(Boolean);
    if (checked) ids.forEach((id) => this.selectedLeadIds.add(id));
    else ids.forEach((id) => this.selectedLeadIds.delete(id));
  }

  get allVisibleSelected(): boolean {
    const ids = this.filteredLeads.map((l) => l.id).filter(Boolean);
    return ids.length > 0 && ids.every((id) => this.selectedLeadIds.has(id));
  }

  get selectedCount(): number {
    return this.selectedLeadIds.size;
  }

  clearSelection(): void {
    this.selectedLeadIds.clear();
  }

  async deleteSelectedLeads(): Promise<void> {
    if (!this.selectedLeadIds.size || this.isBulkDeleting) return;
    const ids = Array.from(this.selectedLeadIds);
    const ok = typeof window === 'undefined' ? true : window.confirm(`למחוק ${ids.length} לידים נבחרים?`);
    if (!ok) return;
    this.isBulkDeleting = true;
    let failed = 0;
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      const success = await new Promise<boolean>((resolve) => {
        this.adminContactsService.deleteContact(id).subscribe({
          next: (result) => resolve(result),
          error: () => resolve(false)
        });
      });
      if (success) {
        this.leads = this.leads.filter((l) => l.id !== id);
        delete this.leadDrafts[id];
        this.selectedLeadIds.delete(id);
        this.total = Math.max(0, this.total - 1);
      } else {
        failed += 1;
      }
    }
    this.isBulkDeleting = false;
    if (failed > 0) this.toast.error(`מחיקה חלקית: ${failed} נכשלו`);
    else this.toast.success('מחיקה מרובה הושלמה');
  }

  async deleteAllVisibleLeads(): Promise<void> {
    const ids = this.filteredLeads.map((l) => l.id).filter(Boolean);
    if (!ids.length || this.isBulkDeleting) return;
    const ok = typeof window === 'undefined' ? true : window.confirm(`למחוק את כל ${ids.length} הלידים בתצוגה?`);
    if (!ok) return;
    this.selectedLeadIds = new Set(ids);
    await this.deleteSelectedLeads();
  }

  private seedDraftsForContacts(contacts: AdminContact[]): void {
    const next: typeof this.leadDrafts = {};
    contacts.forEach((lead) => {
      next[lead.id] = {
        status: lead.status,
        leadScore: this.getLeadScoreLabel(lead),
        nextFollowUpAt: this.getFollowupDateInputValue(lead),
        ownerNotes: lead.ownerNotes || ''
      };
    });
    this.leadDrafts = next;
  }

  private pruneSelection(contacts: AdminContact[]): void {
    const existing = new Set(contacts.map((l) => l.id));
    this.selectedLeadIds.forEach((id) => {
      if (!existing.has(id)) this.selectedLeadIds.delete(id);
    });
  }

  private bumpAdoption(key: keyof typeof this.adoptionKpis): void {
    this.adoptionKpis[key] += 1;
    localStorage.setItem('admin_leads_adoption_kpis_v1', JSON.stringify(this.adoptionKpis));
  }

  private hydrateAdoptionKpis(): void {
    try {
      const raw = localStorage.getItem('admin_leads_adoption_kpis_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<typeof this.adoptionKpis>;
      this.adoptionKpis = {
        statusChanges: Number(parsed.statusChanges || 0),
        followupsSet: Number(parsed.followupsSet || 0),
        notesSaved: Number(parsed.notesSaved || 0)
      };
    } catch {
      // ignore local storage errors
    }
  }

  trackByLead(_index: number, lead: AdminContact): string {
    return lead.id;
  }
}
