// src/reviews/reviews.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReviewsService } from './reviews.service';
import { UserReviewsController } from './user-reviews.controller';
import { PublicReviewsController } from './public-reviews.controller';
import { AdminReviewsController } from './admin-reviews.controller';

@Module({
    imports: [PrismaModule],
    controllers: [
        UserReviewsController,
        PublicReviewsController,
        AdminReviewsController
    ],
    providers: [ReviewsService],
    exports: [ReviewsService]
})
export class ReviewsModule {}