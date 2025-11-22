// src/auth/auth.service.ts
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException,
  Inject,
  BadRequestException,
  Logger
} from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { UserService } from "../user/user.service"
import type { LoginDto } from "./dto/login.dto"
import * as bcrypt from "bcryptjs"
import { RegisterDto } from "./dto/register.dto";
import { MobileRequestDto } from "./dto/mobile-request.dto";
import { VerifyCodeDto } from "./dto/verify-code.dto";
import { CompleteRegistrationDto } from "./dto/complete-registration.dto";
import { VerificationService } from "./verification.service";
import { AccountService } from "../account/account.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { PlanService } from "../plan/plan.service";
import { CreditTransactionService } from "../credit-transaction/credit-transaction.service";
import {FileUsage, TransactionType, Language} from '@prisma/client';
import { PrismaService } from "../prisma/prisma.service";
import {FileService} from "../file/file.service";
import * as crypto from 'crypto';
import { I18nService } from '../i18n/i18n.service';
import {
  I18nNotFoundException,
  I18nBadRequestException,
  I18nUnauthorizedException,
  I18nConflictException,
  I18nInternalServerErrorException
} from '../common/exceptions/i18n-exceptions';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly DEFAULT_LANGUAGE = Language.fa;

  constructor(
      private userService: UserService,
      private jwtService: JwtService,
      private verificationService: VerificationService,
      private accountService: AccountService,
      private planService: PlanService,
      private creditTransactionService: CreditTransactionService,
      private fileService: FileService,
      private prisma: PrismaService,
      private i18nService: I18nService,
  ) {}

  /**
   * بررسی صحت پسورد
   */

  private async verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
    try {
      console.log("=== 🔍 دیباگ verifyPassword ===");
      console.log("📤 plainPassword:", plainPassword);
      console.log("💾 storedHash:", storedHash.substring(0, 20) + "...");

      // استفاده دقیقاً مثل پروژه کارکنان
      const isValid = await bcrypt.compare(plainPassword, storedHash);

      console.log("🎯 نتیجه bcrypt.compare:", isValid);
      console.log("=== پایان دیباگ ===");

      return isValid;
    } catch (error) {
      console.error('💥 خطا در verifyPassword:', error);
      return false;
    }
  }

  /**
   * ایجاد هش نهایی برای ذخیره در دیتابیس - دقیقاً مثل پروژه کارکنان
   */
  private async hashPassword(plainPassword: string): Promise<string> {
    return await bcrypt.hash(plainPassword, 10);
  }

  async validateUser(mobile: string, password: string, language: Language = this.DEFAULT_LANGUAGE): Promise<any> {
    try {
      console.log("=== 🔍 دیباگ validateUser ===");
      console.log("📱 موبایل:", mobile);
      console.log("🔑 پسورد دریافتی:", password);

      const user = await this.prisma.user.findUnique({
        where: { mobile },
      });

      if (!user) {
        console.log("❌ کاربر یافت نشد");
        return null;
      }

      console.log("✅ کاربر یافت شد:", user.id);

      // استفاده دقیقاً مثل پروژه کارکنان
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (isPasswordValid) {
        console.log("🎉 کاربر تایید شد");
        const { password, ...result } = user;
        return result;
      } else {
        console.log("❌ پسورد نامعتبر");
        return null;
      }
    } catch (error) {
      console.error('💥 خطا در validateUser:', error);
      return null;
    }
  }



  async completeRegistration(token: string, completeData: CompleteRegistrationDto, language: Language = this.DEFAULT_LANGUAGE) {
    try {
      // تأیید اعتبار توکن موقت
      const payload = this.jwtService.verify(token);
      if (payload.step !== 'registration') {
        throw new I18nUnauthorizedException('REGISTRATION_TOKEN_INVALID', language);
      }

      const { mobile } = payload;
      const { first_name, last_name, password, business_name, activity_type } = completeData;
      // ایجاد کاربر جدید - حالا با پارامتر language
      const user = await this.userService.create({
        mobile,
        password,
        first_name,
        last_name
      }, language);

      // حذف کد تأیید
      await this.verificationService.deleteVerificationCode(mobile);

      // ایجاد اکانت شخصی پیشفرض برای همه کاربران
      const homeAccount =await this.accountService.createPersonalAccount(
          user.id,
          "خرید عمده منزل",
          "خرید های عمده منزل در این قسمت مدیریت می شود",
          language
      );
      //تایید اکانت شخصی
      await this.accountService.updateConfirmation(homeAccount.id, true);
      const personalAccount = await this.accountService.createPersonalAccount(
          user.id,
          "خرید و فروش شخصی",
          "خرید و فروشهای عمده شخصی موردی",
          language
      );
      //تایید اکانت شخصی
      await this.accountService.updateConfirmation(personalAccount.id, true);
      // اگر کاربر کسب‌وکار دارد، اکانت کسب‌وکاری هم ایجاد کن
      if (business_name) {
        await this.accountService.createBusinessAccount(
            user.id,
            business_name,
            activity_type,
            language
        );
      }

      // اضافه کردن شارژ رایگان به کاربر جدید
      await this.addWelcomeCredit(user.id, language);

      // ایجاد توکن دسترسی دائمی
      const jwtPayload = {
        mobile: user.mobile,
        sub: user.id,
        role: user.system_role
      };
      const accessToken = this.jwtService.sign(jwtPayload);

      // دریافت پروفایل کامل کاربر به همراه اکانت‌ها
      const profile = await this.getUserProfile(user.id, language);

      this.logger.log(`User registered successfully: ${user.id}`);

      return {
        access_token: accessToken,
        user: profile,
      };
    } catch (error) {
      this.logger.error("Error in completeRegistration:", error);

      if (error.name === 'TokenExpiredError') {
        throw new I18nUnauthorizedException('REGISTRATION_TOKEN_EXPIRED', language);
      }

      if (error.name === 'JsonWebTokenError') {
        throw new I18nUnauthorizedException('REGISTRATION_TOKEN_INVALID', language);
      }

      if (error.code === 'P2002') {
        throw new I18nConflictException('MOBILE_ALREADY_REGISTERED', language);
      }

      if (error instanceof I18nUnauthorizedException ||
          error instanceof I18nConflictException ||
          error instanceof I18nNotFoundException) {
        throw error;
      }

      throw new I18nInternalServerErrorException('INTERNAL_SERVER_ERROR', language);
    }
  }




  async login(loginDto: LoginDto, language: Language = this.DEFAULT_LANGUAGE) {
    const user = await this.validateUser(loginDto.mobile, loginDto.password, language);

    if (!user) {
      throw new I18nUnauthorizedException('INVALID_CREDENTIALS', language);
    }

    const payload = { mobile: user.mobile, sub: user.id, role: user.system_role };
    const accessToken = this.jwtService.sign(payload);

    // دریافت پروفایل کامل کاربر
    const profile = await this.getUserProfile(user.id, language);

    this.logger.log(`User logged in: ${user.id}`);

    return {
      access_token: accessToken,
      user: profile,
    };
  }

  // تغییر رمز عبور
  async changePassword(user_id: string, changePasswordDto: ChangePasswordDto, language: Language = this.DEFAULT_LANGUAGE) {
    const user = await this.userService.findById(user_id);
    if (!user) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    // استفاده مستقیم از Prisma برای دریافت کاربر با password
    const userWithPassword = await this.prisma.user.findUnique({
      where: { mobile: user.mobile }
    });

    if (!userWithPassword) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    // بررسی صحت رمز عبور فعلی
    const isCurrentPasswordValid = await this.verifyPassword(
        changePasswordDto.currentPassword,
        userWithPassword.password
    );

    if (!isCurrentPasswordValid) {
      throw new I18nUnauthorizedException('CURRENT_PASSWORD_INCORRECT', language);
    }

    // ایجاد هش نهایی برای رمز عبور جدید
    const hashedNewPassword = await this.hashPassword(changePasswordDto.newPassword);

    // به‌روزرسانی رمز عبور
    await this.userService.update(user_id, {
      password: hashedNewPassword
    });

    this.logger.log(`Password changed for user: ${user_id}`);

    return {
      message: this.i18nService.t('PASSWORD_CHANGED_SUCCESS', language)
    };
  }

  // بازنشانی رمز عبور با کد تأیید
  async resetPassword(resetPasswordDto: ResetPasswordDto, language: Language = this.DEFAULT_LANGUAGE) {
    const { mobile, code, newPassword } = resetPasswordDto;

    // تأیید صحت کد
    const isValid = await this.verificationService.verifyCode(mobile, code);
    if (!isValid) {
      throw new I18nUnauthorizedException('VERIFICATION_CODE_INVALID', language);
    }

    // استفاده مستقیم از Prisma برای دریافت کاربر با password
    const user = await this.prisma.user.findUnique({
      where: { mobile }
    });

    if (!user) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    // ایجاد هش نهایی برای رمز عبور جدید
    const hashedPassword = await this.hashPassword(newPassword);

    // به‌روزرسانی رمز عبور
    await this.userService.update(user.id, {
      password: hashedPassword
    });

    // حذف کد تأیید پس از استفاده
    await this.verificationService.deleteVerificationCode(mobile);

    this.logger.log(`Password reset for user: ${user.id}`);

    return {
      message: this.i18nService.t('PASSWORD_RESET_SUCCESS', language)
    };
  }

  async requestMobileVerification(mobileRequestDto: MobileRequestDto, language: Language = this.DEFAULT_LANGUAGE) {
    const { mobile } = mobileRequestDto;

    // بررسی وجود کاربر با این شماره موبایل
    const existingUser = await this.userService.findByMobile(mobile);
    if (existingUser) {
      throw new I18nConflictException('MOBILE_ALREADY_REGISTERED', language);
    }

    // ایجاد و ذخیره کد تأیید
    const code = await this.verificationService.createVerificationCode(mobile);

    this.logger.log(this.i18nService.t('VERIFICATION_CODE_LOG', language, { mobile, code }));

    return {
      message: this.i18nService.t('VERIFICATION_CODE_SENT', language),
      mobile,
    };
  }

  async verifyMobileCode(verifyCodeDto: VerifyCodeDto, language: Language = this.DEFAULT_LANGUAGE) {
    const { mobile, code } = verifyCodeDto;

    // تأیید صحت کد
    const isValid = await this.verificationService.verifyCode(mobile, code);
    if (!isValid) {
      throw new I18nUnauthorizedException('VERIFICATION_CODE_INVALID', language);
    }

    // ایجاد توکن موقت برای مرحله نهایی ثبت‌نام
    const payload = { mobile, step: 'registration' };
    const temporaryToken = this.jwtService.sign(payload, {
      expiresIn: '10m',
    });

    this.logger.log(`Mobile verified: ${mobile}`);

    return {
      message: this.i18nService.t('VERIFICATION_CODE_VERIFIED', language),
      temporaryToken,
    };
  }

  // 🔥 متد جدید برای اضافه کردن شارژ رایگان به کاربر جدید
  private async addWelcomeCredit(user_id: string, language: Language = this.DEFAULT_LANGUAGE): Promise<void> {
    try {
      this.logger.log(`📦 Starting welcome credit for user: ${user_id}`);

      // دریافت پلن رایگان (سطح 1)
      const freePlan = await this.prisma.plan.findUnique({
        where: { level: 1 },
        include: {
          contents: {
            where: { language },
            take: 1
          }
        }
      });

      if (!freePlan) {
        this.logger.error('❌ Free plan not found');
        return;
      }

      this.logger.log(`✅ Free plan found: ${freePlan.contents[0]?.name || 'Plan 1'} - ${freePlan.total_credit} credit`);

      // محاسبه تاریخ انقضا
      const end_date = new Date();
      end_date.setDate(end_date.getDate() + freePlan.expiry_days);

      // ایجاد UserPlan برای کاربر
      const userPlan = await this.prisma.userPlan.create({
        data: {
          user_id: user_id,
          plan_id: freePlan.id,
          start_date: new Date(),
          end_date: end_date,
          initial_credit: freePlan.total_credit,
          remaining_credit: freePlan.total_credit,
          used_credit: 0,
          is_active: true
        }
      });

      this.logger.log(`✅ UserPlan created with ID: ${userPlan.id}`);

      // افزایش اعتبار کاربر
      await this.prisma.user.update({
        where: { id: user_id },
        data: {
          current_credit: { increment: freePlan.total_credit },
          credit_level: freePlan.level
        }
      });

      this.logger.log(`✅ User credit increased: ${freePlan.total_credit} credit`);

      // ایجاد تراکنش اعتباری برای کاربر جدید
      await this.creditTransactionService.create({
        user_id: user_id,
        amount: freePlan.total_credit,
        activity_type: 'WELCOME_BONUS',
        description: `اعتبار هدیه به مناسبت ثبت نام - ${freePlan.contents[0]?.name || 'پلن رایگان'}`,
        credit_transaction_type: TransactionType.CREDIT,
      }, language);

      this.logger.log(`✅ Credit transaction created`);

      this.logger.log(`🎉 Welcome credit added to user ${user_id}: ${freePlan.total_credit} credit (until ${end_date.toLocaleDateString('fa-IR')})`);
    } catch (error) {
      this.logger.error('❌ Error adding welcome credit:', error);
      // این خطا نباید ثبت نام کاربر را مختل کند
    }
  }

  // درخواست بازنشانی رمز عبور
  async requestPasswordReset(forgotPasswordDto: ForgotPasswordDto, language: Language = this.DEFAULT_LANGUAGE) {
    const { mobile } = forgotPasswordDto;
    const user = await this.userService.findByMobile(mobile);
    if (!user) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    // ایجاد و ارسال کد تأیید
    const code = await this.verificationService.createVerificationCode(mobile);

    this.logger.log(this.i18nService.t('PASSWORD_RESET_CODE_LOG', language, { mobile, code }));

    return {
      message: this.i18nService.t('PASSWORD_RESET_CODE_SENT', language),
      mobile,
    };
  }

  async setUserFile(
      userId: string,
      file: Express.Multer.File,
      fileUsage: FileUsage,
      description?: string,
      language: Language = this.DEFAULT_LANGUAGE
  ) {
    // بررسی وجود کاربر
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    // بررسی ایمن برای contents
    const userContents = (user as any).contents || [];
    const userContent = userContents[0] || {};

    // بررسی اینکه fileUsage مربوط به کاربر است
    if (!this.isUserFileUsage(fileUsage)) {
      throw new I18nBadRequestException('INVALID_DATA', language);
    }

    // پیدا کردن فایل قبلی با همین usage
    const existingFile = await this.prisma.file.findFirst({
      where: {
        user_id: userId,
        file_usage: fileUsage,
      },
    });

    // آماده‌سازی داده‌های آپلود
    const uploadDto = {
      file_usage: fileUsage,
      description: description || this.getUserFileUsageDescription(
          fileUsage,
          userContent.first_name || '',
          userContent.last_name || '',
          language
      ),
    };

    let newFileRecord;

    try {
      // آپلود فایل جدید
      newFileRecord = await this.fileService.uploadFile(file, uploadDto, userId);

      // اگر فایل قبلی وجود داشت، حذفش کن
      if (existingFile) {
        await this.fileService.deleteFile(existingFile.id, userId);
      }

      this.logger.log(`File uploaded for user ${userId}: ${fileUsage}`);

      return {
        message: this.i18nService.t('FILE_UPLOAD_SUCCESS', language),
        file: newFileRecord,
      };

    } catch (error) {
      // اگر خطا در آپلود فایل جدید رخ داد و فایل قبلی داشتیم، آن را حفظ کنیم
      if (existingFile && newFileRecord) {
        await this.fileService.deleteFile(newFileRecord.id, userId);
      }
      throw new I18nInternalServerErrorException('INTERNAL_SERVER_ERROR', language);
    }
  }

  /**
   * حذف فایل کاربر
   */
  async removeUserFile(userId: string, fileUsage: FileUsage, language: Language = this.DEFAULT_LANGUAGE) {
    // بررسی وجود کاربر
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    // پیدا کردن فایل
    const userFile = await this.prisma.file.findFirst({
      where: {
        user_id: userId,
        file_usage: fileUsage,
      },
    });

    if (!userFile) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    // حذف فایل
    await this.fileService.deleteFile(userFile.id, userId);

    this.logger.log(`File removed for user ${userId}: ${fileUsage}`);

    return {
      message: this.i18nService.t('FILE_DELETE_SUCCESS', language),
    };
  }

  /**
   * دریافت فایل‌های کاربر
   */
  async getUserFiles(userId: string, fileUsage?: FileUsage, language: Language = this.DEFAULT_LANGUAGE) {
    // بررسی وجود کاربر
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    const where: any = { user_id: userId };
    if (fileUsage) where.file_usage = fileUsage;

    const files = await this.prisma.file.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return {
      user_id: userId,
      files: files.map(file => ({
        id: file.id,
        file_usage: file.file_usage,
        description: file.description,
        created_at: file.created_at,
        file_path: file.file_path,
        thumbnail_path: file.thumbnail_path,
        url: `/files/stream/${file.id}`,
        thumbnail_url: file.thumbnail_path ? `/files/thumbnail/${file.id}` : null,
      })),
    };
  }

  /**
   * دریافت اطلاعات یک فایل خاص از کاربر
   */
  async getUserFile(userId: string, fileId: string, language: Language = this.DEFAULT_LANGUAGE) {
    // بررسی وجود کاربر
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        user_id: userId,
      },
    });

    if (!file) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    return {
      id: file.id,
      file_usage: file.file_usage,
      description: file.description,
      created_at: file.created_at,
      file_path: file.file_path,
      thumbnail_path: file.thumbnail_path,
      url: `/files/stream/${file.id}`,
      thumbnail_url: file.thumbnail_path ? `/files/thumbnail/${file.id}` : null,
    };
  }

  // ==================== متدهای کمکی ====================

  /**
   * بررسی می‌کند که fileUsage مربوط به کاربر است یا نه
   */
  private isUserFileUsage(fileUsage: FileUsage): boolean {
    const userFileUsages: FileUsage[] = [
      FileUsage.PROFILE_PHOTO,
      FileUsage.ID_CARD_FRONT,
      FileUsage.ID_CARD_BACK,
      FileUsage.SELFIE_WITH_ID,
      FileUsage.SIGNATURE,
      FileUsage.BANK_CARD,
      FileUsage.ADDRESS_PROOF,
    ];

    return userFileUsages.includes(fileUsage);
  }

  /**
   * تولید توضیح خودکار برای فایل‌های کاربر
   */
  private getUserFileUsageDescription(fileUsage: FileUsage, firstName: string, lastName: string, language: Language): string {
    const descriptions = {
      [FileUsage.PROFILE_PHOTO]: this.i18nService.t('PROFILE_PHOTO_DESCRIPTION', language, { firstName, lastName }),
      [FileUsage.ID_CARD_FRONT]: this.i18nService.t('ID_CARD_FRONT_DESCRIPTION', language, { firstName, lastName }),
      [FileUsage.ID_CARD_BACK]: this.i18nService.t('ID_CARD_BACK_DESCRIPTION', language, { firstName, lastName }),
      [FileUsage.SELFIE_WITH_ID]: this.i18nService.t('SELFIE_WITH_ID_DESCRIPTION', language, { firstName, lastName }),
      [FileUsage.SIGNATURE]: this.i18nService.t('SIGNATURE_DESCRIPTION', language, { firstName, lastName }),
      [FileUsage.BANK_CARD]: this.i18nService.t('BANK_CARD_DESCRIPTION', language, { firstName, lastName }),
      [FileUsage.ADDRESS_PROOF]: this.i18nService.t('ADDRESS_PROOF_DESCRIPTION', language, { firstName, lastName }),
    };

    return descriptions[fileUsage] || this.i18nService.t('GENERIC_FILE_DESCRIPTION', language, { fileUsage, firstName, lastName });
  }

  /**
   * به‌روزرسانی متد getUserProfile برای شامل کردن تمام فایل‌ها
   */
  async getUserProfile(user_id: string, language: Language = this.DEFAULT_LANGUAGE): Promise<any> {
    const user = await this.userService.findById(user_id, language);
    if (!user) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    // دریافت حساب‌های کاربر با اطلاعات کامل
    const accounts = await this.accountService.findAllByUser(user_id, language);

    // دریافت وضعیت پلن کاربر
    const planStatus = await this.planService.getPlanStatus(user_id, language);


    // 🔥 آمار تعاملات - فقط تعداد
    const [
      userActionsStats,
      receivedActionsStats,
      userContentStats
    ] = await Promise.all([
      this.prisma.interaction.groupBy({
        by: ['type'],
        where: { user_id },
        _count: true
      }),
      Promise.all([
        this.prisma.review.aggregate({
          where: { user_id },
          _sum: { likes: true }
        }),
        this.prisma.comment.aggregate({
          where: { user_id },
          _sum: { likes: true }
        })
      ]),
      Promise.all([
        this.prisma.review.count({ where: { user_id } }),
        this.prisma.comment.count({ where: { user_id } })
      ])
    ]);

    // محاسبه آمار
    const userLikesGiven = userActionsStats.find(stat => stat.type === 'LIKE')?._count || 0;
    const userSavesMade = userActionsStats.find(stat => stat.type === 'SAVE')?._count || 0;
    const userViewsMade = userActionsStats.find(stat => stat.type === 'VIEW')?._count || 0;

    const receivedLikesOnReviews = receivedActionsStats[0]._sum.likes || 0;
    const receivedLikesOnComments = receivedActionsStats[1]._sum.likes || 0;
    const totalReceivedLikes = receivedLikesOnReviews + receivedLikesOnComments;

    const userReviewsCount = userContentStats[0];
    const userCommentsCount = userContentStats[1];


    return {
      // اطلاعات پایه کاربر
       ...user,
      // اطلاعات حساب‌ها و پلن
      accounts,
      plan_status: planStatus,

      // فایل‌ها
      files: user.files,

      // 🔥 آمار فعالیت‌های کاربر
      activity_stats: {
        content_created: {
          reviews: userReviewsCount,
          comments: userCommentsCount,
          total: userReviewsCount + userCommentsCount
        },
        actions_taken: {
          likes_given: userLikesGiven,
          items_saved: userSavesMade,
          views_made: userViewsMade,
          total: userLikesGiven + userSavesMade + userViewsMade
        },
        engagement_received: {
          likes_on_content: totalReceivedLikes,
        },
        summary: {
          total_activities: (userReviewsCount + userCommentsCount + userLikesGiven + userSavesMade + userViewsMade),
          engagement_score: totalReceivedLikes * 2 + (userReviewsCount + userCommentsCount) * 3
        }
      }
    };
  }


  // src/auth/auth.service.ts

  /**
   * ارسال مجدد کد تایید پیامکی برای ثبت‌نام
   */
  async resendVerificationCode(mobileRequestDto: MobileRequestDto, language: Language = this.DEFAULT_LANGUAGE) {
    const { mobile } = mobileRequestDto;

    try {
      // بررسی وجود کاربر با این شماره موبایل (برای ثبت‌نام نباید وجود داشته باشد)
      const existingUser = await this.userService.findByMobile(mobile);
      if (existingUser) {
        throw new I18nConflictException('MOBILE_ALREADY_REGISTERED', language);
      }

      // بررسی وجود کد فعال قبلی
      const existingCode = await this.verificationService.getActiveVerificationCode(mobile);

      if (existingCode) {
        // اگر کد قبلی هنوز معتبر است، زمان انقضای آن را تمدید می‌کنیم
        await this.verificationService.updateVerificationCodeExpiry(mobile, existingCode.code);

        this.logger.log(this.i18nService.t('VERIFICATION_CODE_RESENT', language, {
          mobile,
          code: existingCode.code
        }));

        return {
          message: this.i18nService.t('VERIFICATION_CODE_RESENT', language),
          mobile,
          is_new_code: false // نشان می‌دهد که کد جدیدی ایجاد نشده
        };
      }

      // اگر کد فعالی وجود ندارد، کد جدید ایجاد می‌کنیم
      const code = await this.verificationService.createVerificationCode(mobile);

      this.logger.log(this.i18nService.t('VERIFICATION_CODE_RESENT_NEW', language, {
        mobile,
        code
      }));

      return {
        message: this.i18nService.t('VERIFICATION_CODE_RESENT', language),
        mobile,
        is_new_code: true // نشان می‌دهد که کد جدید ایجاد شده
      };

    } catch (error) {
      this.logger.error(`Error resending verification code for ${mobile}:`, error);

      // اگر خطا از نوع Conflict باشد، آن را پرتاب می‌کنیم
      if (error instanceof I18nConflictException) {
        throw error;
      }

      // برای سایر خطاها، سعی می‌کنیم یک کد جدید ایجاد کنیم
      try {
        const code = await this.verificationService.createVerificationCode(mobile);

        this.logger.log(this.i18nService.t('VERIFICATION_CODE_RESENT_NEW_FALLBACK', language, {
          mobile,
          code
        }));

        return {
          message: this.i18nService.t('VERIFICATION_CODE_RESENT', language),
          mobile,
          is_new_code: true
        };
      } catch (fallbackError) {
        this.logger.error(`Fallback also failed for ${mobile}:`, fallbackError);
        throw new I18nInternalServerErrorException('INTERNAL_SERVER_ERROR', language);
      }
    }
  }

  /**
   * ارسال مجدد کد بازنشانی رمز عبور
   */
  async resendPasswordResetCode(forgotPasswordDto: ForgotPasswordDto, language: Language = this.DEFAULT_LANGUAGE) {
    const { mobile } = forgotPasswordDto;

    // بررسی وجود کاربر
    const user = await this.userService.findByMobile(mobile);
    if (!user) {
      throw new I18nNotFoundException('RECORD_NOT_FOUND', language);
    }

    try {
      // بررسی وجود کد فعال قبلی
      const existingCode = await this.verificationService.getActiveVerificationCode(mobile);

      if (existingCode) {
        // تمدید زمان انقضای کد موجود
        await this.verificationService.updateVerificationCodeExpiry(mobile, existingCode.code);

        this.logger.log(this.i18nService.t('PASSWORD_RESET_CODE_RESENT', language, {
          mobile,
          code: existingCode.code
        }));

        return {
          message: this.i18nService.t('PASSWORD_RESET_CODE_RESENT', language),
          mobile,
          is_new_code: false
        };
      }

      // ایجاد کد جدید
      const code = await this.verificationService.createVerificationCode(mobile);

      this.logger.log(this.i18nService.t('PASSWORD_RESET_CODE_RESENT_NEW', language, {
        mobile,
        code
      }));

      return {
        message: this.i18nService.t('PASSWORD_RESET_CODE_RESENT', language),
        mobile,
        is_new_code: true
      };

    } catch (error) {
      this.logger.error(`Error resending password reset code for ${mobile}:`, error);

      // در صورت خطا، سعی در ایجاد کد جدید
      try {
        const code = await this.verificationService.createVerificationCode(mobile);

        this.logger.log(this.i18nService.t('PASSWORD_RESET_CODE_RESENT_NEW_FALLBACK', language, {
          mobile,
          code
        }));

        return {
          message: this.i18nService.t('PASSWORD_RESET_CODE_RESENT', language),
          mobile,
          is_new_code: true
        };
      } catch (fallbackError) {
        this.logger.error(`Fallback also failed for ${mobile}:`, fallbackError);
        throw new I18nInternalServerErrorException('INTERNAL_SERVER_ERROR', language);
      }
    }
  }
}