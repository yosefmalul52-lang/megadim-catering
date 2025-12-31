import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Testimonial {
  id: string;
  name: string;
  event: string;
  quote: string;
  rating?: number;
  date?: Date;
  location?: string;
  imageUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TestimonialsService {
  private http = inject(HttpClient);
  
  private testimonialsSubject = new BehaviorSubject<Testimonial[]>([]);
  public testimonials$ = this.testimonialsSubject.asObservable();

  // Mock testimonials data
  private mockTestimonials: Testimonial[] = [
    {
      id: '1',
      name: 'משפחת כהן',
      event: 'בר מצווה ל-80 איש בפתח תקווה',
      quote: 'האוכל היה פשוט מושלם, טעם ביתי אבל ברמת שף. כל האורחים שאלו מי הקייטרינג. השירות מקצועי והאוכל הגיע חם ומסודר בדיוק בזמן.',
      rating: 5,
      date: new Date('2024-01-10'),
      location: 'פתח תקווה'
    },
    {
      id: '2',
      name: 'מיכל ל.',
      event: 'אירוע שבת חתן',
      quote: 'סידרו לנו הכול, מהרמה של הסלטים עד ההגשה, אין מילים. הצ\'ולנט היה הכי טעים שאכלתי בחיים. תודה על חוויה מיוחדת!',
      rating: 5,
      date: new Date('2024-01-05'),
      location: 'ירושלים'
    },
    {
      id: '3',
      name: 'דוד ושרה מזרחי',
      event: 'חתונה - 150 אורחים',
      quote: 'הזמנו קייטרינג לחתונה של הבת שלנו. הכל היה מושלם! האוכל טעים, ההגשה יפה והשירות מקצועי. ממליצים בחום!',
      rating: 5,
      date: new Date('2023-12-28'),
      location: 'תל אביב'
    },
    {
      id: '4',
      name: 'חברת היי-טק בהרצליה',
      event: 'אירוע חברה - 200 עובדים',
      quote: 'הזמנו קייטרינג לאירוע חברה והתוצאה הייתה מעל לציפיות. האוכל היה מגוון, טרי וטעים. שירות מצוין ומחירים הוגנים.',
      rating: 5,
      date: new Date('2023-12-20'),
      location: 'הרצליה'
    },
    {
      id: '5',
      name: 'רחל גולדברג',
      event: 'ברית מילה - 50 אורחים',
      quote: 'הזמנתי אוכל לברית של הנכד. הגיע בזמן, טעים ברטוב. כל המשפחה התרשמה. בהחלט נזמין שוב!',
      rating: 5,
      date: new Date('2023-12-15'),
      location: 'בני ברק'
    },
    {
      id: '6',
      name: 'משפחת לוי',
      event: 'שבת שבע ברכות',
      quote: 'אוכל מעולה, הגשה יפה ושירות מהיר. החומוס והסלטים היו טריים במיוחד. תודה רבה על השבת המיוחדת!',
      rating: 5,
      date: new Date('2023-12-08'),
      location: 'רמת גן'
    }
  ];

  constructor() {
    // Initialize with mock data
    this.loadTestimonials();
  }

  loadTestimonials(): Observable<Testimonial[]> {
    // In production, this would be an HTTP call to the backend
    // return this.http.get<Testimonial[]>(`${environment.apiUrl}/testimonials`);
    
    // For now, use mock data
    return of(this.mockTestimonials).pipe(
      tap(testimonials => {
        this.testimonialsSubject.next(testimonials);
      })
    );
  }

  getTestimonials(): Observable<any[]> {
    // Transform testimonials to match home component format
    const transformedTestimonials = this.testimonialsSubject.value.map(testimonial => ({
      id: testimonial.id,
      content: testimonial.quote,
      authorName: testimonial.name,
      eventType: testimonial.event,
      rating: testimonial.rating,
      date: testimonial.date,
      location: testimonial.location
    }));
    
    return of(transformedTestimonials);
  }

  getTestimonialsRaw(): Testimonial[] {
    return this.testimonialsSubject.value;
  }

  getFeaturedTestimonials(limit: number = 3): Testimonial[] {
    return this.testimonialsSubject.value
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, limit);
  }

  getTestimonialById(id: string): Testimonial | undefined {
    return this.testimonialsSubject.value.find(testimonial => testimonial.id === id);
  }

  // Admin methods for testimonial management
  addTestimonial(testimonial: Omit<Testimonial, 'id'>): Observable<Testimonial> {
    const newTestimonial: Testimonial = {
      ...testimonial,
      id: Date.now().toString(),
      date: new Date()
    };
    
    const currentTestimonials = this.testimonialsSubject.value;
    const updatedTestimonials = [...currentTestimonials, newTestimonial];
    this.testimonialsSubject.next(updatedTestimonials);
    
    // In production, this would be an HTTP call
    // return this.http.post<Testimonial>(`${environment.apiUrl}/testimonials`, testimonial);
    
    return of(newTestimonial);
  }

  updateTestimonial(id: string, updates: Partial<Testimonial>): Observable<Testimonial> {
    const testimonials = this.testimonialsSubject.value;
    const testimonialIndex = testimonials.findIndex(t => t.id === id);
    
    if (testimonialIndex > -1) {
      testimonials[testimonialIndex] = { ...testimonials[testimonialIndex], ...updates };
      this.testimonialsSubject.next([...testimonials]);
      
      // In production, this would be an HTTP call
      // return this.http.put<Testimonial>(`${environment.apiUrl}/testimonials/${id}`, updates);
      
      return of(testimonials[testimonialIndex]);
    }
    
    throw new Error(`Testimonial with id ${id} not found`);
  }

  deleteTestimonial(id: string): Observable<boolean> {
    const testimonials = this.testimonialsSubject.value.filter(t => t.id !== id);
    this.testimonialsSubject.next(testimonials);
    
    // In production, this would be an HTTP call
    // return this.http.delete<boolean>(`${environment.apiUrl}/testimonials/${id}`);
    
    return of(true);
  }

  // Method to get testimonials statistics
  getTestimonialsStats(): {
    total: number;
    averageRating: number;
    byLocation: { [key: string]: number };
    recentCount: number;
  } {
    const testimonials = this.testimonialsSubject.value;
    const total = testimonials.length;
    const ratingsSum = testimonials.reduce((sum, t) => sum + (t.rating || 0), 0);
    const averageRating = total > 0 ? ratingsSum / total : 0;
    
    const byLocation: { [key: string]: number } = {};
    testimonials.forEach(t => {
      if (t.location) {
        byLocation[t.location] = (byLocation[t.location] || 0) + 1;
      }
    });
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const recentCount = testimonials.filter(t => 
      t.date && t.date > oneMonthAgo
    ).length;
    
    return {
      total,
      averageRating: Math.round(averageRating * 10) / 10,
      byLocation,
      recentCount
    };
  }
}
