import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Language = 'he' | 'en';

export interface LanguageStrings {
  // Navigation
  home: string;
  about: string;
  eventsCatering: string;
  readyForShabbat: string;
  mainDishes: string;
  sides: string;
  salads: string;
  desserts: string;
  cholentBar: string;
  holidayFood: string;
  kosherCertificate: string;
  contact: string;
  
  // Header
  orderByPhone: string;
  phoneNumber: string;
  login: string;
  register: string;
  search: string;
  cart: string;
  
  // Hero Section
  heroTitle: string;
  heroSubtitle: string;
  heroCallToAction: string;
  
  // Services
  servicesTitle: string;
  eventsCateringTitle: string;
  eventsCateringDescription: string;
  eventsCateringButton: string;
  shabbatCateringTitle: string;
  shabbatCateringDescription: string;
  shabbatCateringButton: string;
  readyFoodTitle: string;
  readyFoodDescription: string;
  readyFoodButton: string;
  
  // Why Choose Us
  whyChooseUsTitle: string;
  kosherSupervised: string;
  freshDaily: string;
  varietyOfSalads: string;
  experienceInEvents: string;
  
  // Testimonials
  testimonialsTitle: string;
  
  // Contact
  contactTeaserTitle: string;
  contactTeaserDescription: string;
  name: string;
  phone: string;
  eventType: string;
  message: string;
  send: string;
  
  // Cart
  cartTitle: string;
  quantity: string;
  price: string;
  total: string;
  continueToOrder: string;
  addToCart: string;
  
  // Common
  loading: string;
  error: string;
  success: string;
  cancel: string;
  save: string;
  edit: string;
  delete: string;
  close: string;
  
  // Footer
  quickLinks: string;
  businessHours: string;
  serviceAreas: string;
  rights: string;
}

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private currentLanguageSubject = new BehaviorSubject<Language>('he');
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  private hebrewStrings: LanguageStrings = {
    // Navigation
    home: 'דף הבית',
    about: 'אודות',
    eventsCatering: 'קייטרינג לאירועים',
    readyForShabbat: 'אוכל מוכן לשבת',
    mainDishes: 'מנות עיקריות',
    sides: 'תוספות',
    salads: 'סלטים',
    desserts: 'ממולאים',
    cholentBar: 'צ\'ולנט בר',
    holidayFood: 'אוכל לחג',
    kosherCertificate: 'תעודת כשרות',
    contact: 'צור קשר',
    
    // Header
    orderByPhone: 'להזמנות התקשרו',
    phoneNumber: '0528240230',
    login: 'התחברות',
    register: 'הרשמה',
    search: 'חיפוש',
    cart: 'עגלת קניות',
    
    // Hero Section
    heroTitle: 'מגדים',
    heroSubtitle: ' קייטרינג ברמה אחרת',
    heroCallToAction: 'דברו איתנו עכשיו',
    
    // Services
    servicesTitle: 'השירותים שלנו',
    eventsCateringTitle: 'קייטרינג לאירועים',
    eventsCateringDescription: 'אנחנו ב־מגדים מאמינים שאוכל טוב מתחיל באהבה ובחומרי גלם איכותיים. אצלנו תיהנו ממנות ביתיות עשירות, מבושלות בדיוק כמו בבית – אבל במראה וברמה של שף. בין אם מדובר באירוע פרטי, עסקי או שולחן שבת מפואר – אנו דואגים לכל פרט, מהטעם ועד ההגשה, כדי שתוכלו פשוט ליהנות מהחוויה',
    eventsCateringButton: 'קבלת תפריט',
    shabbatCateringTitle: 'קייטרינג לשבת וחג',
    shabbatCateringDescription: 'חוויית שבת וחג בטעם של מגדים. אנו מציעים מגוון מנות מעוצבות ומוקפדות, המשלבות בין טעם ביתי מסורתי לבין הגשה יוקרתית ומכובדת. האוכל מוכן באהבה, בכשרות מהודרת, ומוגש באלגנטיות שמכבדת כל שולחן שבת או חג משפחתי.',
    shabbatCateringButton: 'הצג מנות לשבת',
    readyFoodTitle: 'אוכל מוכן לשבת',
    readyFoodDescription: 'טעם של בית, ברמה של קייטרינג. בכל יום שישי אנו מבשלים במיוחד עבורכם מנות חגיגיות, עשירות ונעימות להגשה – לשולחן שבת מושלם. אוכל איכותי, טרי ומהודר, שממלא את הבית בריח של שבת ורוגע.',
    readyFoodButton: 'תפריט מוכן לשבת',
    
    // Why Choose Us
    whyChooseUsTitle: 'למה לבחור בנו',
    kosherSupervised: 'כשר מפוקח',
    freshDaily: 'טרי ומוכן באותו היום',
    varietyOfSalads: 'מגוון ענק של סלטים ביתיים',
    experienceInEvents: 'ניסיון באירועים גדולים ומשפחתיים',
    
    // Testimonials
    testimonialsTitle: 'לקוחות ממליצים',
    
    // Contact
    contactTeaserTitle: 'רוצה הצעת מחיר לאירוע?',
    contactTeaserDescription: 'השאר פרטים ונחזור אליך בהקדם',
    name: 'שם',
    phone: 'טלפון',
    eventType: 'סוג אירוע',
    message: 'הודעה',
    send: 'שלח',
    
    // Cart
    cartTitle: 'עגלת קניות',
    quantity: 'כמות',
    price: 'מחיר',
    total: 'סה"כ',
    continueToOrder: 'המשך לתיאום הזמנה',
    addToCart: 'הוסף לסל',
    
    // Common
    loading: 'טוען...',
    error: 'שגיאה',
    success: 'הצלחה',
    cancel: 'ביטול',
    save: 'שמירה',
    edit: 'עריכה',
    delete: 'מחיקה',
    close: 'סגירה',
    
    // Footer
    quickLinks: 'קישורים מהירים',
    businessHours: 'שעות פעילות',
    serviceAreas: 'אזורי שירות',
    rights: 'כל הזכויות שמורות למגדים קייטרינג'
  };

  private englishStrings: LanguageStrings = {
    // Navigation
    home: 'Home',
    about: 'About',
    eventsCatering: 'Event Catering',
    readyForShabbat: 'Ready for Shabbat',
    mainDishes: 'Main Dishes',
    sides: 'Sides',
    salads: 'Salads',
    desserts: 'Desserts',
    cholentBar: 'Cholent Bar',
    holidayFood: 'Holiday Food',
    kosherCertificate: 'Kosher Certificate',
    contact: 'Contact',
    
    // Header
    orderByPhone: 'Call to Order',
    phoneNumber: '0528240230',
    login: 'Login',
    register: 'Register',
    search: 'Search',
    cart: 'Shopping Cart',
    
    // Hero Section
    heroTitle: 'Megadim',
    heroSubtitle: 'Premium Kosher Catering',
    heroCallToAction: 'Contact Us Now',
    
    // Services
    servicesTitle: 'Our Services',
    eventsCateringTitle: 'Event Catering',
    eventsCateringDescription: 'We cook, arrange and accompany private and corporate events at the highest level. Years of experience in family and social events.',
    eventsCateringButton: 'Get Menu',
    shabbatCateringTitle: 'Shabbat & Holiday Catering',
    shabbatCateringDescription: 'Special ready-made dishes for Shabbat, holidays and family celebrations. Everything prepared in advance and served at the highest standard.',
    shabbatCateringButton: 'View Shabbat Dishes',
    readyFoodTitle: 'Ready-to-Take Food',
    readyFoodDescription: 'Home-style quality, fresh daily, kosher supervised. Taste of home at chef level.',
    readyFoodButton: 'Shabbat Menu',
    
    // Why Choose Us
    whyChooseUsTitle: 'Why Choose Us',
    kosherSupervised: 'Kosher Supervised',
    freshDaily: 'Fresh & Made Daily',
    varietyOfSalads: 'Huge Variety of Homemade Salads',
    experienceInEvents: 'Experience in Large & Family Events',
    
    // Testimonials
    testimonialsTitle: 'Customer Testimonials',
    
    // Contact
    contactTeaserTitle: 'Want a Quote for Your Event?',
    contactTeaserDescription: 'Leave your details and we\'ll get back to you soon',
    name: 'Name',
    phone: 'Phone',
    eventType: 'Event Type',
    message: 'Message',
    send: 'Send',
    
    // Cart
    cartTitle: 'Shopping Cart',
    quantity: 'Quantity',
    price: 'Price',
    total: 'Total',
    continueToOrder: 'Continue to Order',
    addToCart: 'Add to Cart',
    
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    close: 'Close',
    
    // Footer
    quickLinks: 'Quick Links',
    businessHours: 'Business Hours',
    serviceAreas: 'Service Areas',
    rights: 'All rights reserved to Megadim Catering'
  };

  get currentLanguage(): Language {
    return this.currentLanguageSubject.value;
  }

  get strings(): LanguageStrings {
    return this.currentLanguage === 'he' ? this.hebrewStrings : this.englishStrings;
  }

  setLanguage(language: Language): void {
    this.currentLanguageSubject.next(language);
    this.updateDocumentLanguage(language);
  }

  toggleLanguage(): void {
    const newLanguage = this.currentLanguage === 'he' ? 'en' : 'he';
    this.setLanguage(newLanguage);
  }

  private updateDocumentLanguage(language: Language): void {
    // Update lang attribute only, NOT dir (html stays ltr for scrollbar position)
    // The content direction is handled by app.component.ts via textDir property
    document.documentElement.setAttribute('lang', language);
  }

  // Helper method to get a specific string
  getString(key: keyof LanguageStrings): string {
    return this.strings[key];
  }
}
