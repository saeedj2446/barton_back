import { Controller, Get, Param, Query, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Public - Users')
@Public()
@Controller('public/users')
export class UserPublicController {
    constructor(private readonly userService: UserService) {}

    @Get('profile/:id')
    @ApiOperation({ summary: 'مشاهده پروفایل عمومی کاربر' })
    @ApiResponse({ status: 200, description: 'پروفایل دریافت شد' })
    async getPublicProfile(@Param('id') id: string) {
        const user = await this.userService.findById(id);

        // فقط اطلاعات عمومی برگردان
        return {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            bio: user.bio,
            job_title: user.job_title,
            company: user.company,
            location: user.location,
            is_verified: user.is_verified,
            created_at: user.created_at,
            // آمار عمومی
            stats: {
                accountsCount: user.accountsCount,
                ordersCount: user.ordersCount
            }
        };
    }



    @Get('sellers/top')
    @ApiOperation({ summary: 'دریافت بهترین فروشندگان' })
    @ApiResponse({ status: 200, description: 'لیست فروشندگان دریافت شد' })
    async getTopSellers(@Query() query: { limit?: number; category?: string }) {
        // استفاده از متد موجود searchUsersAdvanced
        const result = await this.userService.searchUsersAdvanced({
            has_products: true,
            is_verified: true,
            limit: query.limit || 10,
            page: 1
        });

        // فیلتر کردن فقط اطلاعات عمومی
        return {
            data: result.data.map(seller => ({
                id: seller.id,
                first_name: seller.first_name,
                last_name: seller.last_name,
                company: seller.company,
                is_verified: seller.is_verified,
                location: seller.location
            })),
            meta: result.meta
        };
    }

    @Get('search')
    @ApiOperation({ summary: 'جستجوی کاربران و فروشندگان' })
    @ApiResponse({ status: 200, description: 'نتایج جستجو دریافت شد' })
    async searchUsers(@Query() query: { q: string; type?: 'seller' | 'buyer'; page?: number; limit?: number }) {
        // استفاده از متد موجود searchUsersAdvanced
        const result = await this.userService.searchUsersAdvanced({
            search: query.q,
            has_products: query.type === 'seller' ? true : undefined,
            page: query.page || 1,
            limit: query.limit || 10
        });

        // فیلتر کردن فقط اطلاعات عمومی
        return {
            data: result.data.map(user => ({
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                company: user.company,
                job_title: user.job_title,
                is_verified: user.is_verified,
                location: user.location,
                user_type: user.accountsCount > 0 ? 'seller' : 'user'
            })),
            meta: result.meta
        };
    }
}