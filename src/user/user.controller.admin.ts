import {
    Controller,
    Get,
    Patch,
    Param,
    Delete,
    Query,
    Body,
    UseGuards,
    Post,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UserQueryDto } from './dto/user-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import { CreditUpdateDto } from './dto/credit-update.dto';
import { RegistrationDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SystemRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
@Controller('admin/users')
export class UserAdminController {
    constructor(private readonly userService: UserService) {}

    // 🔄 منتقل شده از Current User Controller
    @Post()
    @ApiOperation({ summary: 'ایجاد کاربر جدید (فقط ادمین)' })
    @ApiResponse({ status: 201, description: 'کاربر ایجاد شد' })
    async create(@Body() registrationDto: RegistrationDto) {
        return this.userService.create(registrationDto);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تمام کاربران با فیلتر و صفحه‌بندی' })
    async findAll(@Query() query: UserQueryDto) {
        return this.userService.findAll(query);
    }

    @Get('stats')
    @ApiOperation({ summary: 'آمار کامل کاربران' })
    async getStats() {
        return this.userService.getUsersStats();
    }

    @Get(':id')
    @ApiOperation({ summary: 'دریافت اطلاعات کامل کاربر' })
    async findOne(@Param('id') id: string) {
        return this.userService.findById(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'آپدیت کاربر' })
    async update(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto
    ) {
        return this.userService.update(id, updateUserDto);
    }

    // 🔄 منتقل شده از Current User Controller
    @Patch(':id/toggle-status')
    @ApiOperation({ summary: 'تغییر وضعیت فعال/غیرفعال کاربر' })
    async toggleStatus(@Param('id') id: string) {
        return this.userService.toggleUserStatus(id);
    }

    @Patch(':id/role')
    @ApiOperation({ summary: 'تغییر نقش کاربر' })
    async updateRole(
        @Param('id') id: string,
        @Body() updateRoleDto: UpdateRoleDto,
    ) {
        return this.userService.update(id, { system_role: updateRoleDto.system_role });
    }

    @Patch(':id/verification')
    @ApiOperation({ summary: 'تغییر وضعیت تأیید کاربر' })
    async updateVerification(
        @Param('id') id: string,
        @Body() updateVerificationDto: UpdateVerificationDto,
    ) {
        return this.userService.update(id, { is_verified: updateVerificationDto.is_verified });
    }

    @Patch(':id/block')
    @ApiOperation({ summary: 'مسدود کردن کاربر' })
    async blockUser(@Param('id') id: string) {
        return this.userService.update(id, { is_blocked: true });
    }

    @Patch(':id/unblock')
    @ApiOperation({ summary: 'آزاد کردن کاربر' })
    async unblockUser(@Param('id') id: string) {
        return this.userService.update(id, { is_blocked: false });
    }

    @Patch(':id/credit')
    @ApiOperation({ summary: 'مدیریت اعتبار کاربر' })
    async updateCredit(
        @Param('id') id: string,
        @Body() creditData: CreditUpdateDto,
    ) {
        return this.userService.updateUserCredit(id, creditData);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف کاربر' })
    async remove(@Param('id') id: string) {
        return this.userService.remove(id);
    }

    // 🔥 فعالیت‌های کاربر در همه اکانت‌ها
    @Get(':id/activities-summary')
    @ApiOperation({ summary: 'خلاصه فعالیت‌های کاربر در همه اکانت‌ها' })
    async getUserActivitiesSummary(@Param('id') id: string) {
        return this.userService.getUserActivitiesSummary(id);
    }

    @Get(':id/accounts')
    @ApiOperation({ summary: 'دریافت حساب‌های کاربر' })
    async getUserAccounts(@Param('id') id: string) {
        return this.userService.getUserAccounts(id);
    }

    // 🔥 فعالیت‌های کاربر در یک اکانت خاص (برای ادمین)
    @Get(':id/accounts/:accountUserId/activities')
    @ApiOperation({ summary: 'فعالیت‌های کاربر در یک اکانت خاص' })
    async getUserAccountActivities(
        @Param('id') id: string,
        @Param('accountUserId') accountUserId: string,
        @Query() query: any
    ) {
        return this.userService.getUserAccountActivities(id, accountUserId, query);
    }

    // 🔥 رفتار کاربر در یک اکانت خاص (برای ادمین)
    @Get(':id/accounts/:accountUserId/behavior')
    @ApiOperation({ summary: 'رفتار کاربر در یک اکانت خاص' })
    async getUserAccountBehavior(
        @Param('id') id: string,
        @Param('accountUserId') accountUserId: string
    ) {
        return this.userService.getUserAccountBehavior(id, accountUserId);
    }

    // 🔥 تحلیل الگوهای کاربر (منتقل شده از Current User)
    @Get(':id/accounts/:accountUserId/patterns')
    @ApiOperation({ summary: 'تحلیل الگوهای کاربر در یک اکانت' })
    async analyzeUserAccountPatterns(
        @Param('id') id: string,
        @Param('accountUserId') accountUserId: string
    ) {
        return this.userService.analyzeUserAccountPatterns(id, accountUserId);
    }

    // 🔥 آپدیت پروفایل با ردیابی فعالیت (منتقل شده از Current User)
    @Patch(':id/accounts/:accountUserId/profile')
    @ApiOperation({ summary: 'آپدیت پروفایل با ردیابی فعالیت' })
    async updateProfileWithTracking(
        @Param('id') id: string,
        @Param('accountUserId') accountUserId: string,
        @Body() updateProfileDto: UpdateProfileDto
    ) {
        return this.userService.updateProfileWithTracking(id, accountUserId, updateProfileDto);
    }

    // 🔥 ردیابی مشاهده پروفایل (منتقل شده از Current User)
    @Post(':id/track-profile-view')
    @ApiOperation({ summary: 'ردیابی مشاهده پروفایل کاربر' })
    async trackProfileView(
        @Param('id') id: string,
        @Body() body: { viewer_account_user_id?: string }
    ) {
        return this.userService.trackProfileView(id, body.viewer_account_user_id);
    }

    // 🔥 جدید: جستجوی پیشرفته کاربران
    @Get('search/advanced')
    @ApiOperation({ summary: 'جستجوی پیشرفته کاربران' })
    async searchUsersAdvanced(
        @Query() query: {
            search?: string;
            location_level_2_id?: string;
            location_level_3_id?: string;
            activity_type?: string;
            industry_id?: string;
            has_products?: boolean;
            is_verified?: boolean;
            page?: number;
            limit?: number;
        }
    ) {
        return this.userService.searchUsersAdvanced(query);
    }
}