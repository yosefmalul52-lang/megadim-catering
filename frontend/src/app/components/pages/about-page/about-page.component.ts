import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { SeoService } from '../../../services/seo.service';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, MatIconModule],
  templateUrl: './about-page.component.html',
  styleUrls: ['./about-page.component.scss']
})
export class AboutPageComponent implements OnInit {
  private seoService = inject(SeoService);

  ngOnInit(): void {
    this.seoService.updatePage('about');
  }
}

