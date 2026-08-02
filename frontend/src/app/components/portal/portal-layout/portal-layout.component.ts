import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatButtonModule, MatIconModule],
  templateUrl: './portal-layout.component.html',
  styleUrls: ['./portal-layout.component.scss']
})
export class PortalLayoutComponent {
  private authService = inject(AuthService);

  readonly logoUrl =
    'https://megadim-media.megadim.workers.dev/frontend/static/33e71892b429580c/original.png';

  logout(): void {
    this.authService.logout();
  }
}
