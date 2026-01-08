import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-kosher-certificate',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './kosher-certificate.component.html',
  styleUrls: ['./kosher-certificate.component.scss']
})
export class KosherCertificateComponent {}
