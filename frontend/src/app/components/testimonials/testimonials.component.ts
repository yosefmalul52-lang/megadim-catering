import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-testimonials',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './testimonials.component.html',
  styleUrls: ['./testimonials.component.scss']
})
export class TestimonialsComponent {
  testimonials = [
    {
      name: 'רחל כהן',
      initials: 'ר.כ',
      role: 'אירחה שבת חתן',
      text: 'הזמנו קייטרינג ל-50 איש והכל הגיע חם, טרי ובשפע. האורחים לא הפסיקו לשבח את האוכל, במיוחד את הצלי בקר והדגים. תודה על שירות מדהים!',
      stars: [1, 2, 3, 4, 5]
    },
    {
      name: 'משפחת לוי',
      initials: 'מ.ל',
      role: 'לקוחות קבועים',
      text: 'אין כמו האוכל של מגדים. הטעם הביתי, הניקיון והשירות עושים את ההבדל. כל יום שישי אנחנו מגיעים לקחת אוכל וזה פשוט סוגר לנו את השבת ברוגע.',
      stars: [1, 2, 3, 4, 5]
    },
    {
      name: 'דוד אברהמי',
      initials: 'ד.א',
      role: 'מפיק אירועים',
      text: 'כמפיק, אני מחפש ספקים שאפשר לסמוך עליהם בעיניים עצומות. מגדים מספקים רמה אחרת של מקצועיות, כשרות מהודרת וטעמים שלא מוצאים בכל מקום.',
      stars: [1, 2, 3, 4, 5]
    }
  ];
}
