import { Router } from 'express';
import { Request, Response } from 'express';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';
import { MenuService } from '../services/menu.service';

const router = Router();
const menuService = new MenuService();

// Search endpoint
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    throw createValidationError('Search query parameter "q" is required');
  }

  if (q.length < 2) {
    throw createValidationError('Search query must be at least 2 characters long');
  }

  // Search menu items
  const menuResults = await menuService.searchMenuItems(q);

  // Mock page results
  const pageResults = [
    {
      type: 'page',
      id: 'home',
      name: 'דף הבית',
      description: 'עמוד הבית של מגדים קייטרינג',
      route: '/'
    },
    {
      type: 'page',
      id: 'about',
      name: 'אודות',
      description: 'על מגדים קייטרינג - הסיפור שלנו',
      route: '/about'
    },
    {
      type: 'page',
      id: 'events-catering',
      name: 'קייטרינג לאירועים',
      description: 'שירותי קייטרינג לאירועים פרטיים ועסקיים',
      route: '/events-catering'
    },
    {
      type: 'page',
      id: 'kosher-certificate',
      name: 'תעודת כשרות',
      description: 'הכשרות שלנו - כשר מפוקח',
      route: '/kosher'
    }
  ].filter(page => 
    page.name.toLowerCase().includes(q.toLowerCase()) ||
    page.description.toLowerCase().includes(q.toLowerCase())
  );

  // Convert menu items to search result format
  const dishResults = menuResults.map(item => ({
    type: 'dish',
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    imageUrl: item.imageUrl,
    price: item.price
  }));

  // Combine results
  const allResults = [...dishResults.slice(0, 6), ...pageResults.slice(0, 4)];

  res.status(200).json({
    success: true,
    data: {
      results: allResults,
      totalResults: allResults.length,
      query: q
    },
    timestamp: new Date().toISOString()
  });
}));

export default router;
