import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ContactService } from '../../../services/contact.service';

@Component({
  selector: 'app-events-catering',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './events-catering.component.html',
  styleUrls: ['./events-catering.component.scss']
})
export class EventsCateringComponent {
  contactService = inject(ContactService);
}
