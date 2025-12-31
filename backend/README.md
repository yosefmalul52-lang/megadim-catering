# Megadim Catering - Backend API

Premium kosher catering services backend API built with Node.js, Express, and TypeScript.

## Features

- 🚀 **Express.js** with TypeScript
- 🔒 **Security** with Helmet, CORS, and Rate Limiting
- 📊 **Comprehensive API** for menu, orders, contacts, and testimonials
- 🔍 **Search functionality** across menu items and pages
- 👤 **Authentication system** (mock implementation)
- 📱 **Mobile-first** responsive design support
- 🌐 **RTL/LTR** language support
- 📈 **Admin dashboard** endpoints
- 🛡️ **Error handling** with detailed logging
- 🚦 **Health checks** and monitoring endpoints

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

   The server will start at `http://localhost:4000`

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Public Endpoints

#### Menu
- `GET /api/menu` - Get all menu items
- `GET /api/menu/popular` - Get popular menu items
- `GET /api/menu/categories` - Get menu categories
- `GET /api/menu/category/:category` - Get items by category
- `GET /api/menu/:id` - Get specific menu item

#### Contact
- `POST /api/contact` - Submit contact form

#### Orders
- `POST /api/order/checkout` - Submit new order

#### Search
- `GET /api/search?q=query` - Search menu items and pages

#### Testimonials
- `GET /api/testimonials` - Get published testimonials
- `GET /api/testimonials/featured` - Get featured testimonials

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/validate` - Validate token

### Admin Endpoints

> **Note**: In production, these endpoints should be protected with authentication middleware.

#### Menu Management
- `POST /api/menu` - Create menu item
- `PUT /api/menu/:id` - Update menu item
- `DELETE /api/menu/:id` - Delete menu item
- `GET /api/menu/stats` - Get menu statistics

#### Contact Management
- `GET /api/contact` - Get all contact requests
- `GET /api/contact/stats` - Get contact statistics
- `GET /api/contact/:id` - Get specific contact request
- `PATCH /api/contact/:id/status` - Update contact status
- `DELETE /api/contact/:id` - Delete contact request

#### Order Management
- `GET /api/order` - Get all orders
- `GET /api/order/stats` - Get order statistics
- `GET /api/order/recent` - Get recent orders
- `GET /api/order/search` - Search orders
- `GET /api/order/:id` - Get specific order
- `PATCH /api/order/:id/status` - Update order status
- `DELETE /api/order/:id` - Delete order

#### Testimonials Management
- `GET /api/testimonials/admin/all` - Get all testimonials (including unpublished)
- `POST /api/testimonials` - Create testimonial
- `PUT /api/testimonials/:id` - Update testimonial
- `DELETE /api/testimonials/:id` - Delete testimonial
- `GET /api/testimonials/stats` - Get testimonials statistics

### System Endpoints

- `GET /api/health` - Health check
- `GET /api` - API information

## Project Structure

```
backend/
├── src/
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── routes/          # Route definitions
│   ├── models/          # TypeScript interfaces
│   ├── data/            # Mock data (JSON files)
│   ├── middleware/      # Custom middleware
│   ├── app.ts           # Express app configuration
│   └── server.ts        # Server entry point
├── dist/                # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run watch` - Build and watch for changes
- `npm run clean` - Clean dist directory
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:4200
BUSINESS_PHONE=0528240230
ADMIN_PHONE=0528240230
ADMIN_PASSWORD=admin123
```

### CORS Configuration

The API is configured to accept requests from:
- Development: `http://localhost:4200`, `http://localhost:3000`
- Production: Configure with your domain

### Rate Limiting

- General API: 100 requests per 15 minutes per IP
- Contact/Order forms: 10 requests per 15 minutes per IP

## Data Storage

Currently using JSON files for data storage:
- `src/data/menuItems.json` - Menu items
- `src/data/testimonials.json` - Customer testimonials

In production, replace with a proper database (MongoDB, PostgreSQL, etc.).

## Authentication

Current implementation uses mock authentication:
- Admin credentials: `0528240230` / `admin123`
- Customer registration creates new accounts
- Tokens are mock implementations

For production, implement:
- Proper password hashing (bcrypt)
- JWT token generation and validation
- Session management
- Role-based access control

## Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate limiting** - Prevent abuse
- **Input validation** - Joi validation schemas
- **Error handling** - Consistent error responses
- **Logging** - Request/error logging with Morgan

## Monitoring & Health Checks

### Health Check Endpoint

```bash
curl http://localhost:4000/api/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 1234.567,
  "environment": "development",
  "version": "1.0.0",
  "service": "Megadim Catering API"
}
```

## Error Handling

The API uses consistent error response format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "stack": "Error stack trace (development only)"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/endpoint",
  "method": "POST"
}
```

## Logging

- Development: Detailed console logging with colors
- Production: Combined Apache-style logging
- All errors are logged with full context

## Future Enhancements

### Database Integration
- Replace JSON files with MongoDB/PostgreSQL
- Add database migrations
- Implement connection pooling

### Authentication & Authorization
- JWT implementation with refresh tokens
- OAuth integration (Google, Facebook)
- Role-based permissions system

### File Uploads
- Image upload for menu items
- File storage (AWS S3, Cloudinary)
- Image resizing and optimization

### Email System
- Welcome emails for new users
- Order confirmation emails
- Contact form notifications
- Newsletter system

### Payment Integration
- Stripe/PayPal integration
- Order payment processing
- Invoice generation

### Advanced Features
- Real-time notifications (WebSockets)
- Analytics and reporting
- Inventory management
- Delivery tracking
- Multi-language support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, email info@megadim-catering.com or call 052-824-0230.

---

**Megadim Catering** - Premium kosher catering services
