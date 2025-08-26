# Wholesale Marketplace Backenddd44

A professional NestJS backend application for a wholesale marketplace with comprehensive user management, profile creation, ad posting, and commenting system.

## Features

- **User Management**: Registration, authentication, profile management
- **Profile System**: Multiple profiles per user with business information
- **Ad Management**: Create, update, delete ads with file attachments
- **Comment System**: Nested comments and replies on ads
- **File Management**: Upload, download, and manage files
- **Admin Panel**: Complete admin control over all entities
- **Security**: JWT authentication, role-based access control
- **API Documentation**: Swagger/OpenAPI documentation

## Tech Stack

- **Framework**: NestJS with Fastify
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Passport
- **Documentation**: Swagger/OpenAPI
- **File Upload**: Multer
- **Validation**: class-validator

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   Update the `.env` file with your database credentials and JWT secret.

4. Set up the database:
   \`\`\`bash
   npm run prisma:generate
   npm run prisma:push
   \`\`\`

5. Start the development server:
   \`\`\`bash
   npm run start:dev
   \`\`\`

The API will be available at `http://localhost:3010`
API documentation at `http://localhost:3010/api`

### Docker Setup

\`\`\`bash
docker-compose up -d
\`\`\`

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login

### Users
- `GET /users` - Get all users (Admin)
- `GET /users/profile` - Get current user profile
- `PATCH /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Profiles
- `POST /profiles` - Create profile
- `GET /profiles` - Get all profiles
- `GET /profiles/my-profiles` - Get current user profiles
- `GET /profiles/:id` - Get profile by ID
- `PATCH /profiles/:id` - Update profile
- `DELETE /profiles/:id` - Delete profile

### Ads
- `POST /ads/profile/:profileId` - Create ad for profile
- `GET /ads` - Get all ads (with pagination and filters)
- `GET /ads/profile/:profileId` - Get ads by profile
- `GET /ads/:id` - Get ad by ID
- `PATCH /ads/:id` - Update ad
- `DELETE /ads/:id` - Delete ad

### Comments
- `POST /comments/ad/:adId` - Create comment for ad
- `GET /comments/ad/:adId` - Get comments by ad
- `GET /comments/:id` - Get comment by ID
- `PATCH /comments/:id` - Update comment
- `DELETE /comments/:id` - Delete comment

### Files
- `POST /files/upload` - Upload file
- `GET /files` - Get all files (Admin)
- `GET /files/entity/:entityType/:entityId` - Get files by entity
- `GET /files/:id` - Get file by ID
- `GET /files/:id/download` - Download file
- `DELETE /files/:id` - Delete file

## Database Schema

The application uses the following main entities:

- **User**: User accounts with authentication
- **Profile**: Business profiles (multiple per user)
- **Ad**: Product/service advertisements
- **Comment**: Comments and replies on ads
- **File**: File attachments for users, profiles, and ads

## Security Features

- JWT-based authentication
- Role-based access control (USER, ADMIN)
- Input validation and sanitization
- File upload security
- CORS protection
- Rate limiting

## Development

### Scripts

- `npm run start:dev` - Start development server
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run test` - Run tests
- `npm run prisma:studio` - Open Prisma Studio
- `npm run prisma:migrate` - Run database migrations

### Project Structure

\`\`\`
src/
├── auth/           # Authentication module
├── user/           # User management
├── profile/        # Profile management
├── ad/             # Advertisement management
├── comment/        # Comment system
├── file/           # File management
├── common/         # Shared utilities
│   ├── decorators/ # Custom decorators
│   ├── filters/    # Exception filters
│   ├── guards/     # Auth guards
│   └── interceptors/ # Interceptors
└── prisma/         # Database service
\`\`\`

## License

MIT License
