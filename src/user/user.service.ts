import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RegistrationDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import * as bcrypt from "bcryptjs";
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { UserQueryDto } from './dto/user-query.dto';
import { UpdateProfileDto } from "./dto/update-profile.dto";
import {SystemRole, Language, Prisma, FileUsage} from '@prisma/client';
import { AccountUserActivityService } from "../account-user-activity/account-user-activity.service";
import {UserBehaviorService} from "../ account-user-behavior/user-behavior.service";
import {
  I18nBadRequestException,
  I18nConflictException,
  I18nInternalServerErrorException,
  I18nNotFoundException
} from "../common/exceptions/i18n-exceptions";
import {I18nService} from "../i18n/i18n.service";

interface UserContentType {
  first_name?: string;
  last_name?: string;
  bio?: string;
  job_title?: string;
  company?: string;
  activity_type?: string;
  coming_from?: string;
}

// در بالای فایل یا در یک فایل constants
const USER_PROFILE_FILE_USAGES: FileUsage[] = [
  FileUsage.PROFILE_PHOTO,
  FileUsage.PROFILE_SMALL_PHOTO,
  FileUsage.ID_CARD_FRONT,
  FileUsage.ID_CARD_BACK,
  FileUsage.SELFIE_WITH_ID,
  FileUsage.SIGNATURE,
  FileUsage.BANK_CARD,
  FileUsage.ADDRESS_PROOF
];
@Injectable()
export class UserService {
  constructor(
      private prisma: PrismaService,
      @Inject(CACHE_MANAGER) private cacheManager: Cache,
      private userBehaviorService: UserBehaviorService,
      private accountUserActivityService: AccountUserActivityService,
      private i18nService: I18nService,
  ) {}

  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 دقیقه
  private readonly DEFAULT_LANGUAGE = Language.fa;

  async create(registrationDto: RegistrationDto, language: Language = this.DEFAULT_LANGUAGE)  {
    try {
      // بررسی وجود کاربر با ایمیل یا موبایل
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: registrationDto.email },
            { mobile: registrationDto.mobile }
          ].filter(Boolean)
        }
      });

      if (existingUser) {
        if (existingUser.email === registrationDto.email) {
          throw new I18nConflictException('DUPLICATE_ENTRY', language, { field: 'email' });
        }
        if (existingUser.mobile === registrationDto.mobile) {
          throw new I18nConflictException('DUPLICATE_ENTRY', language, { field: 'mobile' });
        }
      }

      // هش کردن رمز عبور
      const hashedPassword = await bcrypt.hash(registrationDto.password, 10);

      const userData: any = {
        password: hashedPassword,
        mobile: registrationDto.mobile,
        email: registrationDto.email,
      };

      const user = await this.prisma.user.create({
        data: {
          ...userData,
          // ایجاد محتوای کاربر به زبان پیش‌فرض
          contents: {
            create: {
              language: language,
              first_name: registrationDto.first_name,
              last_name: registrationDto.last_name,
              auto_translated: false
            }
          }
        },
        include: {
          contents: {
            where: {
              language: language
            }
          }
        }
      });

      // پاک کردن کش لیست کاربران
      await this.clearUsersCache();

      return this.formatUserResponse(user);
    } catch (error) {
      if (error instanceof I18nConflictException) {
        throw error;
      }
      throw new I18nInternalServerErrorException('INTERNAL_SERVER_ERROR', language);
    }
  }

  async getUserProfileFiles(user_id: string) {
    const cacheKey = `user_profile_files:${user_id}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const files = await this.prisma.file.findMany({
      where: {
        user_id: user_id,
        file_usage: {
          in: USER_PROFILE_FILE_USAGES // فقط فایل‌های مشخص شده
        }
      },
      select: {
        id: true,
        file_path: true,
        thumbnail_path: true,
        file_usage: true,
        description: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' as Prisma.SortOrder },
    });

    const formattedFiles = files.map(file => ({
      id: file.id,
      file_path: file.file_path,
      thumbnail_path: file.thumbnail_path,
      file_usage: file.file_usage,
      description: file.description,
      created_at: file.created_at,
      download_url: `/files/download/${file.id}`,
      thumbnail_url: file.thumbnail_path ? `/files/thumbnail/${file.id}` : null,
      stream_url: `/files/stream/${file.id}`,
    }));

    const result = {
      user_id,
      files: formattedFiles,
      // ✅ اضافه کردن فایل‌های مهم به صورت جداگانه برای دسترسی آسان
      profile_photo: formattedFiles.find(f => f.file_usage === FileUsage.PROFILE_PHOTO) || null,
      profile_small_photo: formattedFiles.find(f => f.file_usage === FileUsage.PROFILE_SMALL_PHOTO) || null,
      id_card_front: formattedFiles.find(f => f.file_usage === FileUsage.ID_CARD_FRONT) || null,
      id_card_back: formattedFiles.find(f => f.file_usage === FileUsage.ID_CARD_BACK) || null,
      selfie_with_id: formattedFiles.find(f => f.file_usage === FileUsage.SELFIE_WITH_ID) || null,
      signature: formattedFiles.find(f => f.file_usage === FileUsage.SIGNATURE) || null,
      bank_card: formattedFiles.find(f => f.file_usage === FileUsage.BANK_CARD) || null,
      address_proof: formattedFiles.find(f => f.file_usage === FileUsage.ADDRESS_PROOF) || null,
    };

    await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000); // 5 minutes cache
    return result;
  }
  async findAll(query: UserQueryDto = {}) {
    const cacheKey = this.getUsersCacheKey(query);

    // بررسی کش
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { page = 1, limit = 10, role, search, is_active, sortBy = 'created_at', sortOrder = 'desc', language = this.DEFAULT_LANGUAGE } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    // فیلتر بر اساس نقش
    if (role) {
      where.system_role = role;
    }

    // فیلتر بر اساس وضعیت مسدود بودن
    if (is_active !== undefined) {
      where.is_blocked = !is_active;
    }

    // جستجو
    if (search) {
      where.OR = [
        {
          contents: {
            some: {
              language,
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
              ]
            }
          }
        },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          contents: {
            where: { language }
          },
          account_users: {
            select: {
              id: true,
              account_id: true
            }
          },
          orders: {
            select: {
              id: true
            }
          }
        },
        orderBy,
      }),
      this.prisma.user.count({ where })
    ]);

    // تبدیل به فرمت پاسخ
    const usersWithCounts = users.map(user => this.formatUserResponse(user));

    const result = {
      data: usersWithCounts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };

    // ذخیره در کش
    await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);

    return result;
  }

  async findById(id: string, language: Language = this.DEFAULT_LANGUAGE): Promise<any> {
    const cacheKey = `user:${id}:${language}`;

    // بررسی کش
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        contents: {
          where: { language }
        },
        // ✅ اضافه کردن فایل‌های کاربر
        files: {
          where: {
            file_usage: {
              in: USER_PROFILE_FILE_USAGES // فقط فایل‌های پروفایل
            }
          },
          select: {
            id: true,
            file_path: true,
            thumbnail_path: true,
            file_usage: true,
            description: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' as Prisma.SortOrder },
        },
        account_users: {
          include: {
            account: {
              include: {
                industry: {
                  include: {
                    contents: {
                      where: { language }
                    }
                  }
                },
                contents: {
                  where: { language }
                }
              }
            }
          }
        },
        location_level_1: {
          include: {
            contents: {
              where: { language }
            }
          }
        },
        location_level_2: {
          include: {
            contents: {
              where: { language }
            }
          }
        },
        location_level_3: {
          include: {
            contents: {
              where: { language }
            }
          }
        },
        location_level_4: {
          include: {
            contents: {
              where: { language }
            }
          }
        }
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // فرمت پاسخ کاربر با تمام فیلدهای لازم
    const userContent = user.contents.find((c: any) => c.language === language) || user.contents[0];

    // ✅ حالا فایل‌ها مستقیماً از user قابل دسترسی هستند
    const formattedFiles = user.files.map(file => ({
      id: file.id,
      file_path: file.file_path,
      thumbnail_path: file.thumbnail_path,
      file_usage: file.file_usage,
      description: file.description,
      created_at: file.created_at,
      download_url: `/files/download/${file.id}`,
      thumbnail_url: file.thumbnail_path ? `/files/thumbnail/${file.id}` : null,
      stream_url: `/files/stream/${file.id}`,
    }));

    const formattedUser = {
      // فیلدهای اصلی
      id: user.id,
      user_name: user.user_name,
      is_verified: user.is_verified,
      is_buyer: user.is_buyer,
      sex: user.sex,
      is_seller: user.is_seller,
      is_blocked: user.is_blocked,
      wallet_balance: user.wallet_balance,
      category_id: user.category_id,
      active_package_type: user.active_package_type,
      package_end: user.package_end,
      customer_status: user.customer_status,
      support_status: user.support_status,
      phone_allowed: user.phone_allowed,
      product_count: user.product_count,
      response_rate: user.response_rate,
      has_phone: user.has_phone,
      total_profile_views: user.total_profile_views,
      last_profile_view: user.last_profile_view,
      rating: user.rating,
      credit_level: user.credit_level,
      current_credit: user.current_credit,
      total_spent: user.total_spent,
      bonus_credit: user.bonus_credit,
      email: user.email,
      mobile: user.mobile,
      system_role: user.system_role,
      created_at: user.created_at,

      // محتوای چندزبانه
      first_name: userContent?.first_name,
      last_name: userContent?.last_name,
      bio: userContent?.bio,
      job_title: userContent?.job_title,
      company: userContent?.company,
      activity_type: userContent?.activity_type,
      coming_from: userContent?.coming_from,

      // لوکیشن‌ها
      location_level_1: user.location_level_1,
      location_level_2: user.location_level_2,
      location_level_3: user.location_level_3,
      location_level_4: user.location_level_4,

      // ✅ فایل‌ها مستقیماً از user
      //files: formattedFiles,

      // ✅ اضافه کردن فایل‌های مهم به صورت جداگانه
      profile_photo: formattedFiles.find(f => f.file_usage === FileUsage.PROFILE_PHOTO)?.id || null,
      profile_small_photo: formattedFiles.find(f => f.file_usage === FileUsage.PROFILE_SMALL_PHOTO)?.id || null,
      id_card_front: formattedFiles.find(f => f.file_usage === FileUsage.ID_CARD_FRONT)?.id || null,
      id_card_back: formattedFiles.find(f => f.file_usage === FileUsage.ID_CARD_BACK)?.id || null,
      selfie_with_id: formattedFiles.find(f => f.file_usage === FileUsage.SELFIE_WITH_ID)?.id || null,
      signature: formattedFiles.find(f => f.file_usage === FileUsage.SIGNATURE)?.id || null,
      bank_card: formattedFiles.find(f => f.file_usage === FileUsage.BANK_CARD)?.id || null,
      address_proof: formattedFiles.find(f => f.file_usage === FileUsage.ADDRESS_PROOF)?.id || null,

      // حساب‌های کاربر
      accounts: user.account_users?.map((au: any) => au.account),
    };

    // ذخیره در کش
    await this.cacheManager.set(cacheKey, formattedUser, this.CACHE_TTL);

    return formattedUser;
  }

  async findByMobile(mobile: string, language: Language = this.DEFAULT_LANGUAGE) {
    const cacheKey = `user:mobile:${mobile}:${language}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { mobile },
      include: {
        contents: {
          where: { language }
        }
      }
    });

    if (!user) {
      return null;
    }

    const formattedUser = this.formatUserResponse(user);
    await this.cacheManager.set(cacheKey, formattedUser, this.CACHE_TTL);

    return formattedUser;
  }

  async findByEmail(email: string, language: Language = this.DEFAULT_LANGUAGE) {
    const cacheKey = `user:email:${email}:${language}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        contents: {
          where: { language }
        }
      }
    });

    if (!user) {
      return null;
    }

    const formattedUser = this.formatUserResponse(user);
    await this.cacheManager.set(cacheKey, formattedUser, this.CACHE_TTL);

    return formattedUser;
  }

  async update(id: string, updateUserDto: UpdateUserDto, language: Language = this.DEFAULT_LANGUAGE) {
    try {
      // فیلتر کردن فیلدهای خالی قبل از هر کاری
      const filteredUpdateData = this.filterEmptyFields(updateUserDto);

      const existingUser = await this.prisma.user.findUnique({
        where: { id },
        include: {
          contents: {
            where: { language }
          }
        }
      });

      if (!existingUser) {
        throw new I18nNotFoundException('RECORD_NOT_FOUND', language, { entity: 'user' });
      }

      // استفاده از داده‌های فیلتر شده برای چک کردن duplicate
      if (filteredUpdateData.email || filteredUpdateData.mobile) {
        const duplicateUser = await this.prisma.user.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              {
                OR: [
                  { email: filteredUpdateData.email },
                  { mobile: filteredUpdateData.mobile }
                ].filter(Boolean)
              }
            ]
          }
        });

        if (duplicateUser) {
          if (duplicateUser.email === filteredUpdateData.email) {
            throw new I18nConflictException('DUPLICATE_ENTRY', language, { field: 'email' });
          }
          if (duplicateUser.mobile === filteredUpdateData.mobile) {
            throw new I18nConflictException('DUPLICATE_ENTRY', language, { field: 'mobile' });
          }
        }
      }

      const updateData: any = {};
      const contentUpdateData: any = {};

      // 🔥 تعریف فیلدهای مربوط به User اصلی (شامل locationها)
      const userFields = [
        'email', 'mobile',
        'sex', 'location_level_1_id', 'location_level_2_id', 'location_level_3_id', 'location_level_4_id'
      ];

      const specialFields = ['password'];

      // 🔥 تعریف فیلدهای مربوط به محتوای چندزبانه (بدون locationها)
      const contentFields = [
        'first_name', 'last_name', 'bio', 'job_title', 'company'
      ];



      // پردازش فیلدهای User اصلی
      userFields.forEach(field => {
        if (filteredUpdateData[field] !== undefined) {
          updateData[field] = filteredUpdateData[field];
        }
      });

      // پردازش فیلدهای خاص
      if (filteredUpdateData.password) {
        updateData.password = await bcrypt.hash(filteredUpdateData.password, 10);
      }

      // پردازش فیلدهای محتوای چندزبانه
      contentFields.forEach(field => {
        if (filteredUpdateData[field] !== undefined && filteredUpdateData[field] !== '') {
          contentUpdateData[field] = filteredUpdateData[field];
        }
      });



      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          ...updateData,
          contents: {
            upsert: {
              where: {
                user_id_language: {
                  user_id: id,
                  language: language
                }
              },
              create: {
                language: language,
                ...contentUpdateData,
                auto_translated: false
              },
              update: contentUpdateData
            }
          }
        },
        include: {
          contents: {
            where: { language }
          }
        }
      });


      await this.clearUserCache(id, existingUser.email, existingUser.mobile, language);

      return this.formatUserResponse(updatedUser);
    } catch (error) {
      console.log('❌ Error in user update:', error);
      if (error instanceof I18nNotFoundException || error instanceof I18nConflictException) {
        throw error;
      }
      throw new I18nInternalServerErrorException('INTERNAL_SERVER_ERROR', language);
    }
  }

  // تابع کمکی برای فیلتر کردن فیلدهای خالی
  private filterEmptyFields(dto: any): any {
    const filtered = { ...dto };

    // حذف تمام فیلدهایی که مقدار خالی یا undefined دارند
    Object.keys(filtered).forEach(key => {
      if (filtered[key] === '' || filtered[key] === undefined || filtered[key] === null) {
        delete filtered[key];
      }
    });

    return filtered;
  }

  async remove(id: string, language: Language = this.DEFAULT_LANGUAGE) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { email: true, mobile: true }
      });

      if (!user) {
        throw new I18nNotFoundException('RECORD_NOT_FOUND', language, { entity: 'user' });
      }

      const activeAccounts = await this.prisma.accountUser.count({
        where: {
          user_id: id,
          account: {
            is_active: true
          }
        }
      });

      if (activeAccounts > 0) {
        throw new I18nBadRequestException('VALIDATION_ERROR', language, {
          message: 'Cannot delete user with active accounts'
        });
      }

      await this.prisma.user.delete({
        where: { id },
      });

      await this.clearUserCache(id, user.email, user.mobile, language);

      return {
        message: this.i18nService?.t('ACTIVITY_DELETED_SUCCESS', language) || 'User deleted successfully'
      };
    } catch (error) {
      if (error instanceof I18nNotFoundException || error instanceof I18nBadRequestException) {
        throw error;
      }
      throw new I18nInternalServerErrorException('INTERNAL_SERVER_ERROR', language);
    }
  }

  async updateProfile(id: string, updateProfileDto: UpdateProfileDto, language: Language = this.DEFAULT_LANGUAGE) {
    return this.update(id, updateProfileDto as UpdateUserDto, language);
  }

  // ==================== متدهای جدید با سیستم فعالیت‌ها و رفتارها ====================

  async getUserAccountActivities(userId: string, accountUserId: string, query: any = {}) {
    const accountUser = await this.prisma.accountUser.findFirst({
      where: {
        id: accountUserId,
        user_id: userId
      },
      include: {
        account: {
          include: {
            contents: {
              where: { language: this.DEFAULT_LANGUAGE }
            },
            industry: {
              include: {
                contents: {
                  where: { language: this.DEFAULT_LANGUAGE }
                }
              }
            }
          }
        }
      }
    });

    if (!accountUser) {
      throw new NotFoundException("رابطه کاربر-اکانت یافت نشد");
    }

    return await this.accountUserActivityService.getActivitiesByUser(accountUserId, query);
  }

  async trackProfileView(viewedUserId: string, viewerAccountUserId?: string) {
    await this.prisma.user.update({
      where: { id: viewedUserId },
      data: {
        total_profile_views: { increment: 1 },
        last_profile_view: new Date()
      }
    });

    if (viewerAccountUserId) {
      try {
        await this.accountUserActivityService.trackActivity({
          account_user_id: viewerAccountUserId,
          activity_type: 'PROFILE_VIEW',
          target_type: 'USER',
          target_id: viewedUserId,
          metadata: {
            referrer: 'user_profile',
            device_info: {
              action: 'profile_view',
              viewed_user_id: viewedUserId,
              timestamp: new Date().toISOString()
            }
          },
          weight: 1
        });
      } catch (error) {
        console.error('Failed to track profile view activity:', error);
      }
    }
  }

  async updateProfileWithTracking(
      userId: string,
      accountUserId: string,
      updateProfileDto: UpdateProfileDto,
      language: Language = this.DEFAULT_LANGUAGE
  ) {
    const updatedUser = await this.update(userId, updateProfileDto as UpdateUserDto, language);

    try {
      await this.trackUserActivity(userId, accountUserId, {
        activity_type: 'PROFILE_UPDATE',
        metadata: {
          updated_fields: Object.keys(updateProfileDto),
          timestamp: new Date().toISOString()
        },
        weight: 2
      });
    } catch (error) {
      console.error('Failed to track profile update activity:', error);
    }

    return updatedUser;
  }

  async getUserAccountBehavior(userId: string, accountUserId: string) {
    const accountUser = await this.prisma.accountUser.findFirst({
      where: {
        id: accountUserId,
        user_id: userId
      }
    });

    if (!accountUser) {
      throw new NotFoundException("رابطه کاربر-اکانت یافت نشد");
    }

    return await this.userBehaviorService.getBehavior(accountUserId);
  }

  async analyzeUserAccountPatterns(userId: string, accountUserId: string) {
    const accountUser = await this.prisma.accountUser.findFirst({
      where: {
        id: accountUserId,
        user_id: userId
      }
    });

    if (!accountUser) {
      throw new NotFoundException("رابطه کاربر-اکانت یافت نشد");
    }

    return await this.accountUserActivityService.getUserActivityPatterns(accountUserId);
  }

  async trackUserActivity(
      userId: string,
      accountUserId: string,
      activityData: {
        activity_type: any;
        target_type?: string;
        target_id?: string;
        product_id?: string;
        metadata?: any;
        weight?: number;
      }
  ) {
    const accountUser = await this.prisma.accountUser.findFirst({
      where: {
        id: accountUserId,
        user_id: userId
      }
    });

    if (!accountUser) {
      throw new NotFoundException("رابطه کاربر-اکانت یافت نشد");
    }

    return await this.accountUserActivityService.trackActivity({
      account_user_id: accountUserId,
      ...activityData
    });
  }

  async getUserActivitiesSummary(userId: string, language: Language = this.DEFAULT_LANGUAGE) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        contents: {
          where: { language }
        },
        account_users: {
          include: {
            account_user_behavior: true,
            account_user_activities: {
              orderBy: { created_at: 'desc' },
              take: 10,
              include: {
                product: {
                  include: {
                    contents: {
                      where: { language }
                    }
                  }
                }
              }
            },
            account: {
              include: {
                contents: {
                  where: { language }
                },
                industry: {
                  include: {
                    contents: {
                      where: { language }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const totalActivities = user.account_users.reduce(
        (sum, accountUser) => sum + accountUser.account_user_activities.length, 0
    );

    const recentActivities = user.account_users.flatMap(
        accountUser => accountUser.account_user_activities
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);

    const activityBreakdown = user.account_users.reduce((acc, accountUser) => {
      accountUser.account_user_activities.forEach(activity => {
        acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1;
      });
      return acc;
    }, {});

    const userContent = user.contents[0];
    return {
      user: {
        id: user.id,
        name: `${userContent?.first_name || ''} ${userContent?.last_name || ''}`.trim()
      },
      summary: {
        total_accounts: user.account_users.length,
        total_activities: totalActivities,
        activity_breakdown: activityBreakdown,
        last_active: this.getLastActiveTime(user.account_users)
      },
      accounts: user.account_users.map(accountUser => {
        const accountContent = accountUser.account.contents[0];
        const industryContent = accountUser.account.industry?.contents?.[0];

        return {
          account_user_id: accountUser.id,
          account_name: accountContent?.name || accountContent?.company_name,
          industry: industryContent?.name,
          role: accountUser.account_role,
          behavior: accountUser.account_user_behavior,
          recent_activities_count: accountUser.account_user_activities.length
        };
      }),
      recent_activities: recentActivities
    };
  }

  // ==================== متدهای کمکی ====================

  private formatUserResponse(user: any) {
    const content = user.contents?.[0] || {};

    return {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      first_name: content.first_name,
      last_name: content.last_name,
      bio: content.bio,
      job_title: content.job_title,
      company: content.company,
      system_role: user.system_role,
      is_verified: user.is_verified,
      is_blocked: user.is_blocked,
      created_at: user.created_at,
      accountsCount: user.account_users?.length || 0,
      ordersCount: user.orders?.length || 0,
      location: this.formatLocation(user),
      // سایر فیلدهای مورد نیاز
    };
  }

  private formatLocation(user: any) {
    return {
      level_1: user.location_level_1?.contents?.[0]?.name,
      level_2: user.location_level_2?.contents?.[0]?.name,
      level_3: user.location_level_3?.contents?.[0]?.name,
      level_4: user.location_level_4?.contents?.[0]?.name,
    };
  }

  private getLastActiveTime(accountUsers: any[]): Date | null {
    const lastActiveTimes = accountUsers
        .map(accountUser => accountUser.account_user_behavior?.last_active)
        .filter(Boolean)
        .map(date => new Date(date));

    return lastActiveTimes.length > 0
        ? new Date(Math.max(...lastActiveTimes.map(d => d.getTime())))
        : null;
  }

  private getUsersCacheKey(query: UserQueryDto): string {
    return `users:${JSON.stringify(query)}`;
  }

  private async clearUserCache(user_id: string, email: string, mobile: string, language?: Language) {
    const cacheKeys = [
      `user:${user_id}`,
      `user:${user_id}:${language || this.DEFAULT_LANGUAGE}`,
      `user:email:${email}`,
      `user:email:${email}:${language || this.DEFAULT_LANGUAGE}`,
      `user:mobile:${mobile}`,
      `user:mobile:${mobile}:${language || this.DEFAULT_LANGUAGE}`,
      'users:stats'
    ];

    await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
    await this.clearUsersCache();
  }

  private async clearUsersCache() {
    try {
      const knownUserKeys = ['users:stats'];
      await Promise.all(knownUserKeys.map(key => this.cacheManager.del(key)));
    } catch (error) {
      console.error('Error clearing users cache:', error);
    }
  }

  // سایر متدها به‌روزرسانی شده
  async getUsersStats(language: Language = this.DEFAULT_LANGUAGE) {
    const cacheKey = `users:stats:${language}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const [
      totalUsers,
      blockedUsers,
      adminUsers,
      verifiedUsers,
      recentUsers,
      usersWithAccounts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { is_blocked: true } }),
      this.prisma.user.count({ where: { system_role: SystemRole.ADMIN } }),
      this.prisma.user.count({ where: { is_verified: true } }),
      this.prisma.user.count({
        where: {
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      this.prisma.user.count({
        where: {
          account_users: {
            some: {}
          }
        }
      }),
    ]);

    const stats = {
      totalUsers,
      blockedUsers,
      adminUsers,
      verifiedUsers,
      recentUsers,
      usersWithAccounts,
      activeUsers: totalUsers - blockedUsers,
      verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers) * 100 : 0,
      recentGrowth: totalUsers > 0 ? (recentUsers / totalUsers) * 100 : 0,
    };

    await this.cacheManager.set(cacheKey, stats, this.CACHE_TTL);

    return stats;
  }

  async toggleUserStatus(id: string, language: Language = this.DEFAULT_LANGUAGE) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        contents: {
          where: { language }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { is_blocked: !user.is_blocked },
      include: {
        contents: {
          where: { language }
        }
      }
    });

    await this.clearUserCache(id, user.email, user.mobile, language);

    return this.formatUserResponse(updatedUser);
  }

  async updateUserCredit(
      id: string,
      creditData: { amount: number; type: 'add' | 'subtract' | 'set' },
      language: Language = this.DEFAULT_LANGUAGE
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        contents: {
          where: { language }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    let newCredit = user.current_credit;

    switch (creditData.type) {
      case 'add':
        newCredit += creditData.amount;
        break;
      case 'subtract':
        newCredit = Math.max(0, newCredit - creditData.amount);
        break;
      case 'set':
        newCredit = creditData.amount;
        break;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { current_credit: newCredit },
      include: {
        contents: {
          where: { language }
        }
      }
    });

    await this.clearUserCache(id, user.email, user.mobile, language);

    return {
      ...this.formatUserResponse(updatedUser),
      current_credit: updatedUser.current_credit,
      bonus_credit: updatedUser.bonus_credit,
      wallet_balance: updatedUser.wallet_balance,
    };
  }

  async getUserAccounts(id: string, language: Language = this.DEFAULT_LANGUAGE) {
    const accounts = await this.prisma.accountUser.findMany({
      where: { user_id: id },
      include: {
        account: {
          include: {
            contents: {
              where: { language }
            },
            industry: {
              include: {
                contents: {
                  where: { language }
                }
              }
            }
          }
        }
      }
    });

    return accounts.map(acc => {
      const accountContent = acc.account.contents[0];
      const industryContent = acc.account.industry?.contents?.[0];

      return {
        account_id: acc.account.id,
        account_user_id: acc.id,
        account_role: acc.account_role,
        name: accountContent?.name || accountContent?.company_name,
        activity_type: acc.account.activity_type,
        is_active: acc.account.is_active,
        confirmed: acc.account.confirmed,
        created_at: acc.account.created_at,
        industry: industryContent?.name,
        location: this.formatAccountLocation(acc.account),
      };
    });
  }

  async getUserOrders(id: string, query: any = {}, language: Language = this.DEFAULT_LANGUAGE) {
    const { page = 1, limit = 10, status, order_type } = query;
    const skip = (page - 1) * limit;

    const where: any = { user_id: id };

    if (status) {
      where.status = status;
    }

    if (order_type) {
      where.order_type = order_type;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: {
                include: {
                  contents: {
                    where: { language }
                  }
                }
              }
            }
          },
          transactions: true,
          seller: {
            include: {
              contents: {
                where: { language }
              }
            }
          },
          account: {
            include: {
              contents: {
                where: { language }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.order.count({ where })
    ]);

    const formattedOrders = orders.map(order => {
      const accountContent = order.account?.contents?.[0];
      const sellerContent = order.seller?.contents?.[0];

      return {
        id: order.id,
        order_number: order.order_number,
        order_type: order.order_type,
        status: order.status,
        total_amount: order.total_amount,
        net_amount: order.net_amount,
        created_at: order.created_at,
        paid_at: order.paid_at,
        seller: order.seller ? this.formatUserResponse(order.seller) : null,
        account: order.account ? {
          id: order.account.id,
          name: accountContent?.name || accountContent?.company_name
        } : null,
        items: order.items.map(item => ({
          id: item.id,
          item_title: item.item_title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          product: item.product ? {
            id: item.product.id,
            name: item.product.contents[0]?.name || 'محصول'
          } : null
        })),
        transactions: order.transactions
      };
    });

    return {
      data: formattedOrders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  async getUserProducts(id: string, query: any = {}, language: Language = this.DEFAULT_LANGUAGE) {
    const { page = 1, limit = 10, status, category_id } = query;
    const skip = (page - 1) * limit;

    const where: any = { user_id: id };

    if (status) {
      where.status = status;
    }

    if (category_id) {
      where.category_id = category_id;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          contents: {
            where: { language }
          },
          category: {
            include: {
              contents: {
                where: { language }
              }
            }
          },
          sub_category: {
            include: {
              contents: {
                where: { language }
              }
            }
          },
          account: {
            include: {
              contents: {
                where: { language }
              }
            }
          },
          files: {
            where: {
              file_usage: 'PRODUCT_IMAGE'
            },
            take: 1
          },
          // اضافه کردن قیمت‌ها
          pricing_strategies: {
            where: {
              is_active: true,
              OR: [
                { is_primary: true },
                { condition_category: null } // قیمت اصلی
              ]
            },
            take: 1,
            orderBy: { is_primary: 'desc' }
          }
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.product.count({ where })
    ]);

    const formattedProducts = products.map(product => {
      // پیدا کردن قیمت اصلی
      const primaryPrice = product.pricing_strategies?.[0];
      const accountContent = product.account?.contents?.[0];

      return {
        id: product.id,
        name: product.contents[0]?.name,
        description: product.contents[0]?.description || '',
        // اصلاح قیمت‌ها - استفاده از سیستم جدید
        base_min_price: primaryPrice?.base_price_amount || product.base_min_price || 0,
        base_max_price: primaryPrice?.final_price_amount || product.base_min_price || 0,
        calculated_min_price: primaryPrice?.final_price_amount || product.base_min_price || 0,
        calculated_max_price: primaryPrice?.final_price_amount || product.base_min_price || 0,
        stock: product.stock,
        unit: product.unit,
        status: product.status,
        total_views: product.total_views,
        total_likes: product.total_likes,
        total_saves: product.total_saves,
        created_at: product.created_at,
        category: product.category?.contents[0]?.name,
        sub_category: product.sub_category?.contents[0]?.name,
        account: product.account ? {
          id: product.account.id,
          name: accountContent?.name || accountContent?.company_name
        } : null,
        image: product.files[0]?.file_path,
        location: this.formatProductLocation(product),
        // اطلاعات قیمت جدید
        pricing: primaryPrice ? {
          price_unit: primaryPrice.price_unit,
          base_price: primaryPrice.base_price_amount,
          final_price: primaryPrice.final_price_amount,
          has_discount: primaryPrice.has_discount,
          is_primary: primaryPrice.is_primary
        } : null
      };
    });

    return {
      data: formattedProducts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  async getUserBuyAds(id: string, query: any = {}, language: Language = this.DEFAULT_LANGUAGE) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { user_id: id };

    if (status) {
      where.status = status;
    }

    const [buyAds, total] = await Promise.all([
      this.prisma.buyAd.findMany({
        where,
        skip,
        take: limit,
        include: {
          contents: {
            where: { language }
          },
          account: {
            include: {
              contents: {
                where: { language }
              }
            }
          },
          offers: {
            include: {
              seller: {
                include: {
                  contents: {
                    where: { language }
                  }
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.buyAd.count({ where })
    ]);

    const formattedBuyAds = buyAds.map(buyAd => {
      const accountContent = buyAd.account?.contents?.[0];

      return {
        id: buyAd.id,
        name: buyAd.contents[0]?.name,
        requirement_amount: buyAd.requirement_amount,
        unit: buyAd.unit,
        status: buyAd.status,
        is_verified: buyAd.is_verified,
        total_offers: buyAd.total_offers,
        created_at: buyAd.created_at,
        last_offer_at: buyAd.last_offer_at,
        account: buyAd.account ? {
          id: buyAd.account.id,
          name: accountContent?.name || accountContent?.company_name
        } : null,
        offers_count: buyAd.offers.length,
        active_offers: buyAd.offers.filter(offer => offer.status === 'PENDING').length,
        location: this.formatBuyAdLocation(buyAd)
      };
    });

    return {
      data: formattedBuyAds,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

// ==================== متدهای کمکی اضافی ====================

  private formatAccountLocation(account: any) {
    return {
      level_1: account.location_level_1?.contents?.[0]?.name,
      level_2: account.location_level_2?.contents?.[0]?.name,
      level_3: account.location_level_3?.contents?.[0]?.name,
      level_4: account.location_level_4?.contents?.[0]?.name,
      address: account.address
    };
  }

  private formatProductLocation(product: any) {
    return {
      level_1: product.location_level_1?.contents?.[0]?.name,
      level_2: product.location_level_2?.contents?.[0]?.name,
      level_3: product.location_level_3?.contents?.[0]?.name,
      level_4: product.location_level_4?.contents?.[0]?.name,
      address: product.address
    };
  }

  private formatBuyAdLocation(buyAd: any) {
    return {
      level_1: buyAd.location_level_1?.contents?.[0]?.name,
      level_2: buyAd.location_level_2?.contents?.[0]?.name,
      level_3: buyAd.location_level_3?.contents?.[0]?.name,
      level_4: buyAd.location_level_4?.contents?.[0]?.name
    };
  }

// متد جدید برای به‌روزرسانی موقعیت کاربر
  async updateUserLocation(
      id: string,
      locationData: {
        location_level_1_id?: string;
        location_level_2_id?: string;
        location_level_3_id?: string;
        location_level_4_id?: string;
      },
      language: Language = this.DEFAULT_LANGUAGE
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        contents: {
          where: { language }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: locationData,
      include: {
        contents: {
          where: { language }
        },
        location_level_1: {
          include: {
            contents: {
              where: { language }
            }
          }
        },
        location_level_2: {
          include: {
            contents: {
              where: { language }
            }
          }
        },
        location_level_3: {
          include: {
            contents: {
              where: { language }
            }
          }
        },
        location_level_4: {
          include: {
            contents: {
              where: { language }
            }
          }
        }
      }
    });

    await this.clearUserCache(id, user.email, user.mobile, language);
    return this.formatUserResponse(updatedUser);
  }

// متد جدید برای جستجوی پیشرفته کاربران
  async searchUsersAdvanced(
      query: {
        search?: string;
        location_level_2_id?: string;
        location_level_3_id?: string;
        activity_type?: string;
        industry_id?: string;
        has_products?: boolean;
        is_verified?: boolean;
        page?: number;
        limit?: number;
      },
      language: Language = this.DEFAULT_LANGUAGE
  ) {
    const {
      page = 1,
      limit = 10,
      search,
      location_level_2_id,
      location_level_3_id,
      activity_type,
      industry_id,
      has_products,
      is_verified
    } = query;

    const skip = (page - 1) * limit;

    const where: any = {};

    // فیلتر بر اساس موقعیت
    if (location_level_2_id) {
      where.location_level_2_id = location_level_2_id;
    }

    if (location_level_3_id) {
      where.location_level_3_id = location_level_3_id;
    }

    // فیلتر بر اساس تأیید شده بودن
    if (is_verified !== undefined) {
      where.is_verified = is_verified;
    }

    // فیلتر بر اساس داشتن محصول
    if (has_products !== undefined) {
      if (has_products) {
        where.product_count = { gt: 0 };
      } else {
        where.product_count = 0;
      }
    }

    // جستجو در محتوای چندزبانه
    if (search) {
      where.OR = [
        {
          contents: {
            some: {
              language,
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } },
                { job_title: { contains: search, mode: 'insensitive' } },
              ]
            }
          }
        },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }

    // فیلتر بر اساس صنف از طریق اکانت‌ها
    if (industry_id) {
      where.account_users = {
        some: {
          account: {
            industryId: industry_id
          }
        }
      };
    }

    // فیلتر بر اساس نوع فعالیت از طریق اکانت‌ها
    if (activity_type) {
      where.account_users = {
        some: {
          account: {
            activity_type: activity_type
          }
        }
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          contents: {
            where: { language }
          },
          account_users: {
            include: {
              account: {
                include: {
                  industry: {
                    include: {
                      contents: {
                        where: { language }
                      }
                    }
                  },
                  contents: {
                    where: { language }
                  }
                }
              }
            }
          },
          location_level_2: {
            include: {
              contents: {
                where: { language }
              }
            }
          },
          location_level_3: {
            include: {
              contents: {
                where: { language }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.user.count({ where })
    ]);

    const formattedUsers = users.map(user => this.formatUserResponse(user));

    return {
      data: formattedUsers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }
}