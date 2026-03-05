import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UsersService, AdminUser, UpdateCrmPayload } from '../../../services/users.service';

export type FilterType = 'all' | 'vip' | 'dormant';

const PRESET_TAGS = ['VIP', 'לקוח עסקי', 'לקוח קבוע', 'רגיל'];

const DORMANT_DAYS = 60;

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule],
  templateUrl: './admin-customers.component.html',
  styleUrls: ['./admin-customers.component.scss']
})
export class AdminCustomersComponent implements OnInit {
  private usersService = inject(UsersService);

  users: AdminUser[] = [];
  filteredUsers: AdminUser[] = [];
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  currentFilter: FilterType = 'all';
  readonly filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'כל הלקוחות' },
    { value: 'vip', label: 'לקוחות VIP' },
    { value: 'dormant', label: 'לקוחות רדומים' }
  ];

  selectedUser: AdminUser | null = null;
  panelAdminNotes = '';
  panelDietaryInfo = '';
  panelTags: string[] = [];
  tagInput = '';
  isSavingCrm = false;
  readonly presetTags = PRESET_TAGS;

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.usersService.getUsers().subscribe({
      next: (list) => {
        this.users = list;
        this.applyFilter();
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'שגיאה בטעינת הלקוחות';
      }
    });
  }

  setFilter(filter: FilterType): void {
    this.currentFilter = filter;
    this.applyFilter();
  }

  private applyFilter(): void {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - DORMANT_DAYS);

    switch (this.currentFilter) {
      case 'vip':
        this.filteredUsers = this.users.filter(
          u => (u.tags && u.tags.includes('VIP')) || (u.totalSpent != null && u.totalSpent >= 2000)
        );
        break;
      case 'dormant':
        this.filteredUsers = this.users.filter(u => {
          if (!u.lastOrderDate) return true;
          const last = new Date(u.lastOrderDate);
          return last < cutoff;
        });
        break;
      default:
        this.filteredUsers = [...this.users];
    }
  }

  openPanel(user: AdminUser): void {
    this.selectedUser = user;
    this.panelAdminNotes = user.adminNotes ?? '';
    this.panelDietaryInfo = user.dietaryInfo ?? '';
    this.panelTags = user.tags ? [...user.tags] : [];
    this.tagInput = '';
  }

  closePanel(): void {
    this.selectedUser = null;
  }

  addTag(tag: string): void {
    const t = (tag || this.tagInput || '').trim();
    if (!t || this.panelTags.includes(t)) return;
    this.panelTags = [...this.panelTags, t];
    this.tagInput = '';
  }

  removeTag(tag: string): void {
    this.panelTags = this.panelTags.filter(t => t !== tag);
  }

  saveCrm(): void {
    if (!this.selectedUser) return;
    this.isSavingCrm = true;
    this.errorMessage = '';
    const payload: UpdateCrmPayload = {
      adminNotes: this.panelAdminNotes,
      dietaryInfo: this.panelDietaryInfo,
      tags: this.panelTags
    };
    this.usersService.updateUserCrm(this.selectedUser._id, payload).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u._id === updated._id);
        if (idx !== -1) this.users[idx] = { ...this.users[idx], ...updated };
        this.selectedUser = { ...this.selectedUser!, ...updated };
        this.panelAdminNotes = updated.adminNotes ?? '';
        this.panelDietaryInfo = updated.dietaryInfo ?? '';
        this.panelTags = updated.tags ? [...updated.tags] : [];
        this.applyFilter();
        this.isSavingCrm = false;
        this.successMessage = 'נשמר בהצלחה';
        setTimeout(() => (this.successMessage = ''), 2500);
      },
      error: (err) => {
        this.isSavingCrm = false;
        this.errorMessage = err?.error?.message || 'שגיאה בשמירה';
      }
    });
  }

  getOrdersLink(user: AdminUser): string {
    const params: string[] = [];
    if (user.username) params.push(`customerEmail=${encodeURIComponent(user.username)}`);
    if (user.phone) params.push(`customerPhone=${encodeURIComponent(user.phone)}`);
    if (params.length === 0) return '/admin/orders';
    return `/admin/orders?${params.join('&')}`;
  }

  getWhatsAppLink(user: AdminUser): string {
    let phone = (user.phone || '').replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '972' + phone.slice(1);
    else if (!phone.startsWith('972')) phone = '972' + phone;
    const name = encodeURIComponent((user.fullName || 'לקוח').trim());
    const text = encodeURIComponent(`היי ${user.fullName || 'לקוח'},\n`);
    return `https://wa.me/${phone}?text=${text}`;
  }

  get countAll(): number {
    return this.users.length;
  }

  get countVip(): number {
    return this.users.filter(
      u => (u.tags && u.tags.includes('VIP')) || (u.totalSpent != null && u.totalSpent >= 2000)
    ).length;
  }

  get countDormant(): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DORMANT_DAYS);
    return this.users.filter(u => {
      if (!u.lastOrderDate) return true;
      return new Date(u.lastOrderDate) < cutoff;
    }).length;
  }
}
