import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-holiday-food',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, FormsModule],
  templateUrl: './holiday-food.component.html',
  styleUrls: ['./holiday-food.component.scss']
})
export class HolidayFoodComponent {
  isOrderFormOpen: boolean = false;
  
  // Arrays for dropdown loops
  saladIndexes = [1, 2, 3, 4, 5, 6, 7, 8];
  firstCourseIndexes = [1, 2, 3, 4];
  mainCourseIndexes = [1, 2, 3, 4];
  sidesEveningIndexes = [1, 2, 3];
  sidesMorningIndexes = [1, 2];
  
  // Salad options
  saladOptions: string[] = [
    'חומוס',
    'טחינה',
    'מטבוחה',
    'חציל פיקנטי',
    'חציל במיונז',
    'חציל בטחינה',
    'סחוג',
    'חילבה',
    'אנטיפסטי',
    'סלט גזר מרוקאי',
    'סלט סלק מזרחי',
    'סלט ביצים',
    'סלט קצוץ ישראלי',
    'סלט וולדורף',
    'גזר מגורד בלימון',
    'כרוב לבן וחמוציות',
    'קולוסלאו',
    'כרוב בסגנון אסיאתי',
    'שרי פסטו',
    'סלט חסה עם שרי',
    'טאבולה',
    'חמוצי הבית',
    'סלט תירס'
  ];
  
  // First course options
  firstCourseOptions: string[] = [
    'פילה אמנון מזרחי',
    'פילה אמנון בעשבי תיבול',
    'פילה סלמון בחרדל ודבש',
    'פילה סלמון בטריאקי',
    'פילה סלמון בעשבי תיבול',
    'גלילות חצילים במילוי בשר',
    'תחתיות ארטישוק במילוי בשר',
    'כבד קצוץ',
    'בצל ממולא בשר ואורז',
    'פלפל ממולא בשר ואורז',
    'בצל ממולא אורז',
    'פלפל ממולא אורז'
  ];
  
  // Main course options
  mainCourseOptions: string[] = [
    'כרעיים עוף בסילאן',
    'כרעיים עוף בעשבי תיבול',
    'אסאדו בסגנון ארגנטינאי',
    'צלי בקר ברוטב',
    'פרגית בטריאקי',
    'פרגית בעשבי תיבול',
    'פרגית מונטריאון',
    'שוקיים בצ\'ילי',
    'שניצל',
    'שניצלונים',
    'שוק טלה',
    'צ\'ולנט'
  ];
  
  // Side dish options
  sideDishOptions: string[] = [
    'אורז לבן',
    'אורז בקארי וירקות',
    'אורז שקדים וצימוקים במייפל',
    'תפו"א פריזיאן בסגנון מזרחי',
    'סירות תפו"א ובטטה',
    'זיתים ברוטב פיקנטי',
    'קוסקוס עם ירקות בסגנון טריפולטאי',
    'ירקות מוקפצים',
    'שעועית ירוקה מוקפצת בסגנון סיני'
  ];
  
  // Form data
  orderForm = {
    fullName: '',
    phone: '',
    email: '',
    numberOfPortions: '',
    eventDate: '',
    mealTime: '',
    salads: [] as string[],
    firstCourses: [] as string[],
    mainCourses: [] as string[],
    sidesEvening: [] as string[],
    sidesMorning: [] as string[],
    seudaShlishit: 'no',
    deliveryType: '',
    address: '',
    remarks: ''
  };
  
  toggleOrderForm() {
    this.isOrderFormOpen = !this.isOrderFormOpen;
    if (this.isOrderFormOpen) {
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    } else {
      document.body.style.overflow = '';
    }
  }
  
  submitOrder() {
    console.log('Order submitted:', this.orderForm);
    // TODO: Implement actual submission logic
    alert('ההזמנה נשלחה בהצלחה!');
    this.toggleOrderForm();
  }
  
  closeModal() {
    this.toggleOrderForm();
  }
}
