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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const errorHandler_1 = require("../middleware/errorHandler");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// Load testimonials from JSON file
const loadTestimonials = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const testimonialsPath = path_1.default.join(__dirname, '..', 'data', 'testimonials.json');
        const data = yield promises_1.default.readFile(testimonialsPath, 'utf-8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error('Error loading testimonials:', error);
        return [];
    }
});
// Save testimonials to JSON file
const saveTestimonials = (testimonials) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const testimonialsPath = path_1.default.join(__dirname, '..', 'data', 'testimonials.json');
        yield promises_1.default.writeFile(testimonialsPath, JSON.stringify(testimonials, null, 2));
    }
    catch (error) {
        console.error('Error saving testimonials:', error);
        throw error;
    }
});
// Get all testimonials (public - only published ones)
router.get('/', (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const testimonials = yield loadTestimonials();
    const publishedTestimonials = testimonials.filter((t) => t.isPublished !== false);
    res.status(200).json({
        success: true,
        data: publishedTestimonials,
        count: publishedTestimonials.length,
        timestamp: new Date().toISOString()
    });
})));
// Get featured testimonials
router.get('/featured', (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const limit = parseInt(req.query.limit) || 3;
    const testimonials = yield loadTestimonials();
    const featuredTestimonials = testimonials
        .filter((t) => t.isPublished !== false)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, limit);
    res.status(200).json({
        success: true,
        data: featuredTestimonials,
        count: featuredTestimonials.length,
        timestamp: new Date().toISOString()
    });
})));
// Admin: Get all testimonials (including unpublished)
router.get('/admin/all', (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const testimonials = yield loadTestimonials();
    res.status(200).json({
        success: true,
        data: testimonials,
        count: testimonials.length,
        timestamp: new Date().toISOString()
    });
})));
// Admin: Create new testimonial
router.post('/', (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, event, quote, rating, location, imageUrl } = req.body;
    if (!name || !event || !quote) {
        throw (0, errorHandler_1.createValidationError)('Name, event, and quote are required');
    }
    if (rating !== undefined && (rating < 1 || rating > 5)) {
        throw (0, errorHandler_1.createValidationError)('Rating must be between 1 and 5');
    }
    const testimonials = yield loadTestimonials();
    const newTestimonial = {
        id: (0, uuid_1.v4)(),
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
    yield saveTestimonials(testimonials);
    res.status(201).json({
        success: true,
        data: newTestimonial,
        message: 'Testimonial created successfully',
        timestamp: new Date().toISOString()
    });
})));
// Admin: Update testimonial
router.put('/:id', (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const updateData = req.body;
    if (!id) {
        throw (0, errorHandler_1.createValidationError)('Testimonial ID is required');
    }
    const testimonials = yield loadTestimonials();
    const testimonialIndex = testimonials.findIndex((t) => t.id === id);
    if (testimonialIndex === -1) {
        throw (0, errorHandler_1.createNotFoundError)('Testimonial');
    }
    testimonials[testimonialIndex] = Object.assign(Object.assign(Object.assign({}, testimonials[testimonialIndex]), updateData), { updatedAt: new Date().toISOString() });
    yield saveTestimonials(testimonials);
    res.status(200).json({
        success: true,
        data: testimonials[testimonialIndex],
        message: 'Testimonial updated successfully',
        timestamp: new Date().toISOString()
    });
})));
// Admin: Delete testimonial
router.delete('/:id', (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (!id) {
        throw (0, errorHandler_1.createValidationError)('Testimonial ID is required');
    }
    const testimonials = yield loadTestimonials();
    const filteredTestimonials = testimonials.filter((t) => t.id !== id);
    if (filteredTestimonials.length === testimonials.length) {
        throw (0, errorHandler_1.createNotFoundError)('Testimonial');
    }
    yield saveTestimonials(filteredTestimonials);
    res.status(200).json({
        success: true,
        message: 'Testimonial deleted successfully',
        timestamp: new Date().toISOString()
    });
})));
// Get testimonial statistics
router.get('/stats', (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const testimonials = yield loadTestimonials();
    const total = testimonials.length;
    const published = testimonials.filter((t) => t.isPublished).length;
    const approved = testimonials.filter((t) => t.isApproved).length;
    const ratings = testimonials.map((t) => t.rating || 0);
    const averageRating = ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
    const locationStats = {};
    testimonials.forEach((t) => {
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
})));
exports.default = router;
