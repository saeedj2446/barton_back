// در auth.controller.ts - اضافه کردن endpointهای ارسال مجدد
import {
  Body, Controller, Post, Req, UnauthorizedException, Get, Put, UseGuards,
  UseInterceptors, UploadedFile, Delete, Param, Query, HttpStatus, HttpCode
} from "@nestjs/common";
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { MobileRequestDto } from "./dto/mobile-request.dto";
import { VerifyCodeDto } from "./dto/verify-code.dto";
import { CompleteRegistrationDto } from "./dto/complete-registration.dto";
import { Public } from "../common/decorators/public.decorator";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {FileUsage, Language} from '@prisma/client';
import {PrismaService} from "../prisma/prisma.service";
import * as bcrypt from "bcryptjs"

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(
      private authService: AuthService,
      private prisma: PrismaService,
  ) {}

  @Public()
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @Post("mobile/request")
  @ApiOperation({ summary: "دریافت کد تأیید برای ثبت‌نام" })
  @ApiResponse({ status: 200, description: "کد تأیید ارسال شد" })
  async requestMobileVerification(@Body() mobileRequestDto: MobileRequestDto) {
    return this.authService.requestMobileVerification(mobileRequestDto);
  }

  // 🔥 NEW: ارسال مجدد کد تأیید برای ثبت‌نام
  @Public()
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @Post("mobile/resend-verification")
  @ApiOperation({ summary: "ارسال مجدد کد تأیید برای ثبت‌نام" })
  @ApiResponse({ status: 200, description: "کد تأیید مجدداً ارسال شد" })
  async resendVerificationCode(@Body() mobileRequestDto: MobileRequestDto) {
    return this.authService.resendVerificationCode(mobileRequestDto);
  }

  @Public()
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post("mobile/verify")
  @ApiOperation({ summary: "تأیید کد دریافت شده" })
  @ApiResponse({ status: 200, description: "کد تأیید شد" })
  async verifyMobileCode(@Body() verifyCodeDto: VerifyCodeDto) {
    return this.authService.verifyMobileCode(verifyCodeDto);
  }

  @Public()
  @Throttle({ medium: { limit: 3, ttl: 300000 } })
  @Post("mobile/complete-registration")
  @ApiOperation({ summary: "تکمیل ثبت‌نام" })
  @ApiResponse({ status: 201, description: "ثبت‌نام انجام شد" })
  @ApiBearerAuth('access-token')
  async completeRegistration(
      @Body() completeData: CompleteRegistrationDto,
      @Req() req: any
  ) {
    const token = (req.headers['authorization'] as string | undefined)?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException("توکن موقت ارائه نشده");
    }
    return this.authService.completeRegistration(token, completeData);
  }

  @Public()
  @Throttle({ short: { limit: 5, ttl: 300000 } })
  @Post("login")
  @ApiOperation({ summary: "ورود به سیستم" })
  @ApiResponse({ status: 200, description: "ورود موفق" })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto)
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile")
  @ApiOperation({ summary: "دریافت پروفایل کاربر" })
  @ApiBearerAuth('access-token')
  async getProfile(@Req() req: any) {
    return this.authService.getUserProfile(req.user.user_id);
  }

  @UseGuards(JwtAuthGuard)
  @Put("change-password")
  @ApiOperation({ summary: "تغییر رمز عبور" })
  @ApiBearerAuth('access-token')
  async changePassword(@Body() changePasswordDto: ChangePasswordDto, @Req() req: any) {
    return this.authService.changePassword(req.user.user_id, changePasswordDto);
  }

  @Public()
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @Post("forgot-password")
  @ApiOperation({ summary: "درخواست بازنشانی رمز عبور" })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(forgotPasswordDto);
  }

  // 🔥 NEW: ارسال مجدد کد بازنشانی رمز عبور
  @Public()
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @Post("forgot-password/resend")
  @ApiOperation({ summary: "ارسال مجدد کد بازنشانی رمز عبور" })
  async resendPasswordResetCode(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.resendPasswordResetCode(forgotPasswordDto);
  }

  @Public()
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post("reset-password")
  @ApiOperation({ summary: "بازنشانی رمز عبور" })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  // ==================== مدیریت فایل‌های کاربر ====================

  @UseGuards(JwtAuthGuard)
  @Post("files/:fileUsage")
  @ApiOperation({ summary: 'آپلود فایل برای کاربر' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth('access-token')
  async setUserFile(
      @Req() req: any,
      @Param('fileUsage') fileUsage: FileUsage,
      @UploadedFile() file: Express.Multer.File,
      @Body('description') description?: string,
  ) {
    return this.authService.setUserFile(req.user.user_id, file, fileUsage, description);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("files/:fileUsage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف فایل کاربر' })
  @ApiBearerAuth('access-token')
  async removeUserFile(
      @Req() req: any,
      @Param('fileUsage') fileUsage: FileUsage,
  ) {
    return this.authService.removeUserFile(req.user.user_id, fileUsage);
  }

  @UseGuards(JwtAuthGuard)
  @Get("files")
  @ApiOperation({ summary: 'دریافت فایل‌های کاربر' })
  @ApiBearerAuth('access-token')
  async getUserFiles(
      @Req() req: any,
      @Query('file_usage') fileUsage?: FileUsage,
  ) {
    return this.authService.getUserFiles(req.user.user_id, fileUsage);
  }

  @UseGuards(JwtAuthGuard)
  @Get("files/:fileId")
  @ApiOperation({ summary: 'دریافت اطلاعات یک فایل خاص' })
  @ApiBearerAuth('access-token')
  async getUserFile(
      @Req() req: any,
      @Param('fileId') fileId: string,
  ) {
    return this.authService.getUserFile(req.user.user_id, fileId);
  }

  @Public()
  @Post('debug/create-exact-user')
  async createExactUser() {
    const mobile = "989196421264";
    const password = "123456";

    // حذف کاربر موجود
    await this.prisma.user.deleteMany({
      where: { mobile }
    });

    // ایجاد کاربر جدید دقیقاً مثل پروژه کارکنان
    const hashedPassword = await bcrypt.hash(password, 12);

    console.log("🔐 هش جدید:", hashedPassword);

    const user = await this.prisma.user.create({
      data: {
        mobile,
        password: hashedPassword,
        system_role: 'USER',
        contents: {
          create: {
            language: Language.fa,
            first_name: 'Test',
            last_name: 'User',
            auto_translated: false
          }
        }
      }
    });

    // تست دقیقاً مثل پروژه کارکنان
    const testResult = await bcrypt.compare(password, hashedPassword);

    console.log("✅ تست با bcrypt.compare:", testResult);

    return {
      user: user.id,
      passwordTest: testResult,
      hash: hashedPassword.substring(0, 50) + "...",
      message: testResult ? '✅ کاربر ایجاد شد' : '❌ مشکل باقی است'
    };
  }
}