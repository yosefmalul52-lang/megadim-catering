import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  PLATFORM_ID,
  HostListener
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import {
  SitePopupService,
  ActivePopupDto,
  ActivePopupsResponse,
  PopupPageId
} from '../../../services/site-popup.service';
import { LocaleService } from '../../../i18n/locale.service';
import { resolvePopupPageId } from './popup-page-map';

const LS_ONCE = 'megadim_popup_once_';
const LS_VIEWS = 'megadim_popup_views_';
const SS_SESSION = 'megadim_popup_session_';

@Component({
  selector: 'app-site-popups',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './site-popups.component.html',
  styleUrls: ['./site-popups.component.scss']
})
export class SitePopupsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private popupService = inject(SitePopupService);
  private localeService = inject(LocaleService);
  private platformId = inject(PLATFORM_ID);

  modal: ActivePopupDto | null = null;
  banner: ActivePopupDto | null = null;
  sticky: ActivePopupDto | null = null;

  private sub?: Subscription;
  private localeSub?: Subscription;
  private currentPage: PopupPageId | null = null;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.refreshFromUrl(this.router.url);
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.refreshFromUrl(e.urlAfterRedirects || e.url));

    this.localeSub = this.localeService.locale$.subscribe(() => {
      if (this.currentPage) this.fetch(this.currentPage);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.localeSub?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modal) this.dismiss(this.modal, 'modal');
  }

  private refreshFromUrl(url: string): void {
    const page = resolvePopupPageId(url);
    if (page !== this.currentPage) {
      this.recordedViews.clear();
    }
    this.currentPage = page;
    if (!page) {
      this.clearAll();
      return;
    }
    this.fetch(page);
  }

  private fetch(page: PopupPageId): void {
    const locale = this.localeService.locale === 'en' ? 'en' : 'he';
    this.popupService.getActive(page, locale).subscribe({
      next: (data) => this.apply(data),
      error: () => this.clearAll()
    });
  }

  private recordedViews = new Set<string>();

  private apply(data: ActivePopupsResponse): void {
    this.modal = this.shouldShow(data.modal) ? data.modal : null;
    this.banner = this.shouldShow(data.banner_top) ? data.banner_top : null;
    this.sticky = this.shouldShow(data.sticky_bottom) ? data.sticky_bottom : null;

    if (this.modal) this.recordView(this.modal);
    if (this.banner) this.recordView(this.banner);
    if (this.sticky) this.recordView(this.sticky);
  }

  private shouldShow(p: ActivePopupDto | null): p is ActivePopupDto {
    if (!p) return false;
    if (!p.title && !p.body && !p.imageUrl) return false;

    if (p.frequency === 'once') {
      return localStorage.getItem(LS_ONCE + p.id) !== '1';
    }
    if (p.frequency === 'session') {
      return sessionStorage.getItem(SS_SESSION + p.id) !== '1';
    }
    if (p.frequency === 'max') {
      const max = p.maxViews && p.maxViews > 0 ? p.maxViews : 1;
      const views = Number(localStorage.getItem(LS_VIEWS + p.id) || '0');
      return views < max;
    }
    // every
    return true;
  }

  private recordView(p: ActivePopupDto): void {
    if (p.frequency !== 'max') return;
    if (this.recordedViews.has(p.id)) return;
    this.recordedViews.add(p.id);
    const key = LS_VIEWS + p.id;
    const views = Number(localStorage.getItem(key) || '0');
    localStorage.setItem(key, String(views + 1));
  }

  dismiss(p: ActivePopupDto, slot: 'modal' | 'banner' | 'sticky'): void {
    if (p.frequency === 'once') {
      localStorage.setItem(LS_ONCE + p.id, '1');
    } else if (p.frequency === 'session') {
      sessionStorage.setItem(SS_SESSION + p.id, '1');
    }
    // every: hide until next navigation; max: views already recorded on show

    if (slot === 'modal') this.modal = null;
    if (slot === 'banner') this.banner = null;
    if (slot === 'sticky') this.sticky = null;
  }

  onOverlayClick(p: ActivePopupDto): void {
    this.dismiss(p, 'modal');
  }

  onCardClick(event: Event): void {
    event.stopPropagation();
  }

  isExternal(url: string | undefined): boolean {
    if (!url) return false;
    return /^https?:\/\//i.test(url) || url.startsWith('//');
  }

  private clearAll(): void {
    this.modal = null;
    this.banner = null;
    this.sticky = null;
  }
}
