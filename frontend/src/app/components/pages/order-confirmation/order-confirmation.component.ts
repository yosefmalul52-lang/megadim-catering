import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CONTACT_WHATSAPP_HREF } from '../../../constants/contact.constants';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { Order } from '../../../services/order.service';

@Component({
  selector: 'app-order-confirmation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-confirmation.component.html',
  styleUrls: ['./order-confirmation.component.scss']
})
export class OrderConfirmationComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private siteSettings = inject(SiteSettingsService);

  order: Order | null = null;
  orderId: string | null = null;
  copied = false;
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;

  get displayOrderNumber(): string | null {
    if (this.order?.orderNumber) {
      return this.order.orderNumber;
    }
    const rawId = (this.order?._id || this.order?.id || this.orderId) ?? null;
    if (!rawId) return null;
    return rawId.toString().slice(-8);
  }

  get whatsappHref(): string {
    const base = this.siteSettings.getCurrentSettings()?.whatsappLink || CONTACT_WHATSAPP_HREF;
    const code = this.displayOrderNumber || this.orderId;
    const message = code
      ? `שלום, יש לי שאלה לגבי ההזמנה שלי #${code}`
      : 'שלום, יש לי שאלה';
    return `${base}?text=${encodeURIComponent(message)}`;
  }

  ngOnInit(): void {
    const nav = this.router.getCurrentNavigation();
    const stateOrder = (nav?.extras?.state as { order?: Order } | undefined)?.order;
    this.order = stateOrder ?? null;
    this.orderId =
      this.route.snapshot.paramMap.get('id') ||
      (this.order?._id || this.order?.id)?.toString() ||
      null;
  }

  ngOnDestroy(): void {
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
  }

  copyOrderId(): void {
    const value = this.displayOrderNumber || this.orderId;
    if (!value) return;
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    navigator.clipboard.writeText(value).then(() => {
      this.copied = true;
      this.copyTimeout = setTimeout(() => { this.copied = false; }, 2000);
    });
  }
}
