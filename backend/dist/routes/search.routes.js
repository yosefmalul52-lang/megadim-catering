"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const errorHandler_1 = require("../middleware/errorHandler");
const menu_service_1 = require("../services/menu.service");
const router = (0, express_1.Router)();
const menuService = new menu_service_1.MenuService();
// Search endpoint
router.get('/', (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
        throw (0, errorHandler_1.createValidationError)('Search query parameter "q" is required');
    }
    if (q.length < 2) {
        throw (0, errorHandler_1.createValidationError)('Search query must be at least 2 characters long');
    }
    // Search menu items
    const menuResults = yield menuService.searchMenuItems(q);
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
    ].filter(page => page.name.toLowerCase().includes(q.toLowerCase()) ||
        page.description.toLowerCase().includes(q.toLowerCase()));
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
})));
exports.default = router;
