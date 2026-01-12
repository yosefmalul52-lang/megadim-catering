"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const errorHandler_1 = require("../middleware/errorHandler");
const menu_service_1 = require("../services/menu.service");
const router = (0, express_1.Router)();
const menuService = new menu_service_1.MenuService();
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
        throw (0, errorHandler_1.createValidationError)('Search query parameter "q" is required');
    }
    if (q.length < 2) {
        throw (0, errorHandler_1.createValidationError)('Search query must be at least 2 characters long');
    }
    const menuResults = await menuService.searchMenuItems(q);
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
    ].filter(page => page.name.toLowerCase().includes(q.toLowerCase()) ||
        page.description.toLowerCase().includes(q.toLowerCase()));
    const dishResults = menuResults.map(item => ({
        type: 'dish',
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        imageUrl: item.imageUrl,
        price: item.price
    }));
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
exports.default = router;
//# sourceMappingURL=search.routes.js.map