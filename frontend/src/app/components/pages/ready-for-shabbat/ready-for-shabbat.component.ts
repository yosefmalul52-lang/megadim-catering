import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-ready-for-shabbat',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],
  templateUrl: './ready-for-shabbat.component.html',
  styleUrls: ['./ready-for-shabbat.component.scss']
})
export class ReadyForShabbatComponent {
  // This component now acts as a layout shell only
  // Navigation is handled by ShabbatMenuComponent
  // Category pages are loaded via router-outlet
}
