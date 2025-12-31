export interface Testimonial {
  id: string;
  name: string;
  event: string;
  quote: string;
  rating?: number;
  date?: Date;
  location?: string;
  imageUrl?: string;
  isApproved?: boolean;
  isPublished?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateTestimonialRequest {
  name: string;
  event: string;
  quote: string;
  rating?: number;
  location?: string;
  imageUrl?: string;
}

export interface UpdateTestimonialRequest {
  name?: string;
  event?: string;
  quote?: string;
  rating?: number;
  location?: string;
  imageUrl?: string;
  isApproved?: boolean;
  isPublished?: boolean;
}
