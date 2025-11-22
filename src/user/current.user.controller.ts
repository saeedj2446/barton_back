import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { UserService } from "./user.service";

@ApiTags("Current User")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("current-user")
export class CurrentUserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'دریافت پروفایل کاربر جاری' })
  @ApiResponse({ status: 200, description: 'پروفایل دریافت شد' })
  getProfile(@CurrentUser() user: any) {
    return this.userService.findById(user.user_id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'آپدیت پروفایل کاربر جاری' })
  @ApiResponse({ status: 200, description: 'پروفایل آپدیت شد' })
  updateProfile(@Body() updateProfileDto: UpdateProfileDto, @CurrentUser() user: any) {
    return this.userService.updateProfile(user.user_id, updateProfileDto);
  }

  // فقط متدهای مربوط به کاربر جاری باقی می‌مانند
  @Get('accounts')
  @ApiOperation({ summary: 'دریافت حساب‌های کاربر جاری' })
  async getUserAccounts(@CurrentUser() user: any) {
    return this.userService.getUserAccounts(user.user_id);
  }

  @Get('activities-summary')
  @ApiOperation({ summary: 'خلاصه فعالیت‌های کاربر جاری' })
  async getUserActivitiesSummary(@CurrentUser() user: any) {
    return this.userService.getUserActivitiesSummary(user.user_id);
  }
}