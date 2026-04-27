import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminContactsService,
  AdminContact,
  AdminContactStatus
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
  errorMessage = '';

  statusFilter: 'all' | AdminContactStatus = 'all';
  readonly pageSize = 25;
  offset = 0;
  total = 0;
  hasMore = false;

  readonly statusOptions: Array<{ value: AdminContactStatus; label: string }> = [
    { value: 'new', label: 'חדש' },
    { value: 'read', label: 'בטיפול/נקרא' },
    { value: 'handled', label: 'טופל/סגור' }
  ];

  ngOnInit(): void {
    this.loadLeads();
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
  }

  onPageChange(delta: number): void {
    const nextOffset = this.offset + delta;
    if (nextOffset < 0) return;
    this.offset = nextOffset;
    this.loadLeads();
  }

  changeStatus(lead: AdminContact, nextStatus: AdminContactStatus): void {
    const id = lead.id;
    if (!id || lead.status === nextStatus || this.isUpdatingId === id) return;
    this.isUpdatingId = id;

    this.adminContactsService.updateContactStatus(id, nextStatus).subscribe({
      next: (updated) => {
        this.isUpdatingId = null;
        if (!updated) {
          this.toast.error('עדכון סטטוס נכשל');
          return;
        }
        this.leads = this.leads.map((l) => (l.id === id ? { ...l, ...updated } : l));
        this.toast.success('סטטוס ליד עודכן בהצלחה');
      },
      error: () => {
        this.isUpdatingId = null;
        this.toast.error('עדכון סטטוס נכשל');
      }
    });
  }

  getUtmSource(lead: AdminContact): string {
    return lead.marketingData?.utm_source?.trim() || 'אורגני';
  }

  getUtmMedium(lead: AdminContact): string {
    return lead.marketingData?.utm_medium?.trim() || '-';
  }

  trackByLead(_index: number, lead: AdminContact): string {
    return lead.id;
  }
}
