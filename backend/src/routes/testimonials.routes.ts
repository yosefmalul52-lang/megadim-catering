import { Router } from 'express';
import { Request, Response } from 'express';
import { asyncHandler, createValidationError, createNotFoundError } from '../middleware/errorHandler';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Load testimonials from JSON file
const loadTestimonials = async () => {
  try {
    const testimonialsPath = path.join(__dirname, '..', 'data', 'testimonials.json');
    const data = await fs.readFile(testimonialsPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading testimonials:', error);
    return [];
  }
};

// Save testimonials to JSON file
const saveTestimonials = async (testimonials: any[]) => {
  try {
    const testimonialsPath = path.join(__dirname, '..', 'data', 'testimonials.json');
    await fs.writeFile(testimonialsPath, JSON.stringify(testimonials, null, 2));
  } catch (error) {
    console.error('Error saving testimonials:', error);
    throw error;
  }
};

// Get all testimonials (public - only published ones)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const testimonials = await loadTestimonials();
  const publishedTestimonials = testimonials.filter((t: any) => t.isPublished !== false);

  res.status(200).json({
    success: true,
    data: publishedTestimonials,
    count: publishedTestimonials.length,
    timestamp: new Date().toISOString()
  });
}));

// Get featured testimonials
router.get('/featured', asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 3;
  const testimonials = await loadTestimonials();
  
  const featuredTestimonials = testimonials
    .filter((t: any) => t.isPublished !== false)
    .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
    .slice(0, limit);

  res.status(200).json({
    success: true,
    data: featuredTestimonials,
    count: featuredTestimonials.length,
    timestamp: new Date().toISOString()
  });
}));

// Admin: Get all testimonials (including unpublished)
router.get('/admin/all', asyncHandler(async (req: Request, res: Response) => {
  const testimonials = await loadTestimonials();

  res.status(200).json({
    success: true,
    data: testimonials,
    count: testimonials.length,
    timestamp: new Date().toISOString()
  });
}));

// Admin: Create new testimonial
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, event, quote, rating, location, imageUrl } = req.body;

  if (!name || !event || !quote) {
    throw createValidationError('Name, event, and quote are required');
  }

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    throw createValidationError('Rating must be between 1 and 5');
  }

  const testimonials = await loadTestimonials();
  
  const newTestimonial = {
    id: uuidv4(),
    name,
    event,
    quote,
    rating: rating || 5,
    date: new Date().toISOString(),
    location,
    imageUrl,
    isApproved: false,
    isPublished: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  testimonials.push(newTestimonial);
  await saveTestimonials(testimonials);

  res.status(201).json({
    success: true,
    data: newTestimonial,
    message: 'Testimonial created successfully',
    timestamp: new Date().toISOString()
  });
}));

// Admin: Update testimonial
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  if (!id) {
    throw createValidationError('Testimonial ID is required');
  }

  const testimonials = await loadTestimonials();
  const testimonialIndex = testimonials.findIndex((t: any) => t.id === id);

  if (testimonialIndex === -1) {
    throw createNotFoundError('Testimonial');
  }

  testimonials[testimonialIndex] = {
    ...testimonials[testimonialIndex],
    ...updateData,
    updatedAt: new Date().toISOString()
  };

  await saveTestimonials(testimonials);

  res.status(200).json({
    success: true,
    data: testimonials[testimonialIndex],
    message: 'Testimonial updated successfully',
    timestamp: new Date().toISOString()
  });
}));

// Admin: Delete testimonial
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw createValidationError('Testimonial ID is required');
  }

  const testimonials = await loadTestimonials();
  const filteredTestimonials = testimonials.filter((t: any) => t.id !== id);

  if (filteredTestimonials.length === testimonials.length) {
    throw createNotFoundError('Testimonial');
  }

  await saveTestimonials(filteredTestimonials);

  res.status(200).json({
    success: true,
    message: 'Testimonial deleted successfully',
    timestamp: new Date().toISOString()
  });
}));

// Get testimonial statistics
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const testimonials = await loadTestimonials();
  
  const total = testimonials.length;
  const published = testimonials.filter((t: any) => t.isPublished).length;
  const approved = testimonials.filter((t: any) => t.isApproved).length;
  const ratings = testimonials.map((t: any) => t.rating || 0);
  const averageRating = ratings.length > 0 ? ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length : 0;
  
  const locationStats: { [key: string]: number } = {};
  testimonials.forEach((t: any) => {
    if (t.location) {
      locationStats[t.location] = (locationStats[t.location] || 0) + 1;
    }
  });

  res.status(200).json({
    success: true,
    data: {
      total,
      published,
      approved,
      averageRating: Math.round(averageRating * 10) / 10,
      locationStats
    },
    timestamp: new Date().toISOString()
  });
}));

export default router;
