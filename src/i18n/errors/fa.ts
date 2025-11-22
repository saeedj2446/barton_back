export const errorFa={
    // ==================== پیام‌های موفقیت احراز هویت ====================
    "VERIFICATION_CODE_SENT": "کد تأیید با موفقیت ارسال شد",
    "VERIFICATION_CODE_VERIFIED": "کد تأیید با موفقیت تأیید شد",
    "REGISTRATION_COMPLETED": "ثبت‌نام با موفقیت انجام شد",
    "LOGIN_SUCCESSFUL": "ورود با موفقیت انجام شد",
    "PASSWORD_CHANGED_SUCCESS": "رمز عبور با موفقیت تغییر یافت",
    "PASSWORD_RESET_SUCCESS": "رمز عبور با موفقیت بازنشانی شد",
    "PASSWORD_RESET_CODE_SENT": "کد بازنشانی رمز عبور ارسال شد",
    VERIFICATION_CODE_RESENT: 'کد تایید مجدداً ارسال شد',
    VERIFICATION_CODE_RESENT_NEW: 'کد تایید جدید ارسال شد: {code}',
    VERIFICATION_CODE_RESENT_NEW_FALLBACK: 'کد تایید جدید (fallback) ارسال شد: {code}',
    PASSWORD_RESET_CODE_RESENT: 'کد بازنشانی رمز عبور مجدداً ارسال شد',
    PASSWORD_RESET_CODE_RESENT_NEW: 'کد بازنشانی رمز عبور جدید ارسال شد: {code}',
    PASSWORD_RESET_CODE_RESENT_NEW_FALLBACK: 'کد بازنشانی رمز عبور جدید (fallback) ارسال شد: {code}',
    // ==================== خطاهای احراز هویت ====================
    "REGISTRATION_TOKEN_EXPIRED": "مجوز ثبت نام منقضی شده است",
    "REGISTRATION_TOKEN_INVALID": "توکن ثبت نام نامعتبر است",
    "MOBILE_ALREADY_REGISTERED": "شماره موبایل قبلاً ثبت‌نام شده است",
    "VERIFICATION_CODE_INVALID": "کد تأیید نامعتبر یا منقضی شده",
    "INVALID_PASSWORD_HASH": "فرمت رمز عبور نامعتبر است",
    "CURRENT_PASSWORD_INCORRECT": "رمز عبور فعلی نادرست است",
    "LOGOUT_SUCCESS": "با موفقیت خارج شدید",
    "LOGOUT_ALL_SUCCESS": "از تمام دستگاه‌ها خارج شدید",

    // ==================== پیام‌های لاگ ====================
    "VERIFICATION_CODE_LOG": "کد تأیید برای {mobile}: {code}",
    "PASSWORD_RESET_CODE_LOG": "کد بازنشانی برای {mobile}: {code}",

  // ==================== 4xx Client Errors ====================
  "BAD_REQUEST": "درخواست نامعتبر",
  "UNAUTHORIZED": "دسترسی غیرمجاز",
  "FORBIDDEN": "شما مجوز دسترسی به این منبع را ندارید",
  "NOT_FOUND": "منبع درخواستی یافت نشد",
  "METHOD_NOT_ALLOWED": "متد درخواستی مجاز نیست",
  "NOT_ACCEPTABLE": "درخواست قابل قبول نیست",
  "REQUEST_TIMEOUT": "زمان درخواست به پایان رسید",
  "CONFLICT": "تعارض در داده‌ها",
  "GONE": "منبع دیگر در دسترس نیست",
  "PRECONDITION_FAILED": "پیش‌شرط برقرار نیست",
  "PAYLOAD_TOO_LARGE": "حجم داده‌ها بسیار بزرگ است",
  "UNSUPPORTED_MEDIA_TYPE": "نوع رسانه پشتیبانی نمی‌شود",
  "UNPROCESSABLE_ENTITY": "داده‌ها قابل پردازش نیستند",
  "TOO_MANY_REQUESTS": "تعداد درخواست‌ها بیش از حد مجاز است",

  // ==================== 5xx Server Errors ====================
  "INTERNAL_SERVER_ERROR": "خطای داخلی سرور",
  "NOT_IMPLEMENTED": "قابلیت پیاده‌سازی نشده است",
  "BAD_GATEWAY": "خطای دروازه",
  "SERVICE_UNAVAILABLE": "سرویس موقتاً در دسترس نیست",
  "GATEWAY_TIMEOUT": "زمان دروازه به پایان رسید",

  // ==================== خطاهای تجاری ====================
  "VALIDATION_ERROR": "خطای اعتبارسنجی داده‌ها",
  "INVALID_DATA": "داده‌های ارسالی نامعتبر است",
  "REQUIRED_FIELD": "فیلد {field} الزامی است",
  "INVALID_EMAIL": "آدرس ایمیل نامعتبر است",
  "INVALID_PHONE": "شماره تلفن نامعتبر است",
  "INVALID_DATE": "تاریخ نامعتبر است",
  "INVALID_FILE_TYPE": "نوع فایل مجاز نیست",
  "FILE_TOO_LARGE": "حجم فایل بسیار بزرگ است",

  // ==================== خطاهای احراز هویت ====================
  "INVALID_CREDENTIALS": "مشخصات ورود نامعتبر است",
  "EXPIRED_TOKEN": "توکن منقضی شده است",
  "INVALID_TOKEN": "توکن نامعتبر است",
  "ACCESS_DENIED": "عدم دسترسی",

  // ==================== خطاهای پایگاه داده ====================
  "DATABASE_ERROR": "خطای پایگاه داده",
  "RECORD_NOT_FOUND": "رکورد یافت نشد",
  "DUPLICATE_ENTRY": "رکورد تکراری",
  "CONSTRAINT_VIOLATION": "محدودیت پایگاه داده نقض شده است",

  // ==================== خطاهای سیستمی ====================
  "NETWORK_ERROR": "خطای شبکه",
  "EXTERNAL_SERVICE_ERROR": "خطای سرویس خارجی",
  "CONFIGURATION_ERROR": "خطای پیکربندی سیستم",
  "MAINTENANCE_MODE": "سیستم در حال نگهداری است",

  // خطاهای فعالیت‌های کاربر
  "ACTIVITY_TRACK_ERROR": "خطا در ثبت فعالیت",
  "BATCH_ACTIVITY_TRACK_ERROR": "خطا در ثبت دسته‌ای فعالیت‌ها",
  "ACTIVITIES_FETCH_ERROR": "خطا در دریافت فعالیت‌ها",
  "RECENT_ACTIVITIES_FETCH_ERROR": "خطا در دریافت فعالیت‌های اخیر",
  "USER_STATS_FETCH_ERROR": "خطا در دریافت آمار کاربر",
  "ACCOUNT_STATS_FETCH_ERROR": "خطا در دریافت آمار اکانت",
  "USER_PATTERNS_FETCH_ERROR": "خطا در دریافت الگوهای کاربر",
  "PRODUCT_ENGAGEMENT_FETCH_ERROR": "خطا در دریافت تعامل محصول",
  "ACTIVITIES_OVERVIEW_FETCH_ERROR": "خطا در دریافت نمای کلی فعالیت‌ها",
  "ACTIVITY_TRENDS_FETCH_ERROR": "خطا در دریافت ترندهای فعالیت",
  "TOP_PRODUCTS_FETCH_ERROR": "خطا در دریافت محصولات برتر",
  "USER_ENGAGEMENT_ANALYTICS_ERROR": "خطا در تحلیل تعامل کاربران",
  "CATEGORY_INSIGHTS_FETCH_ERROR": "خطا در دریافت بینش‌های دسته‌بندی",
  "ACTIVITY_DELETE_ERROR": "خطا در حذف فعالیت",
  "USER_ACTIVITIES_DELETE_ERROR": "خطا در حذف فعالیت‌های کاربر",
  "OLD_ACTIVITIES_CLEANUP_ERROR": "خطا در پاکسازی فعالیت‌های قدیمی",
  "ACTIVITIES_EXPORT_ERROR": "خطا در خروجی گرفتن از فعالیت‌ها",

  // خطاهای اعتبارسنجی
  "ACCOUNT_USER_NOT_FOUND": "کاربر-اکانت با شناسه {accountUserId} یافت نشد",
  "INVALID_ACCOUNT_USERS": "شناسه‌های کاربر-اکانت نامعتبر: {missingIds}",
  "ACTIVITY_NOT_FOUND": "فعالیت با شناسه {activityId} یافت نشد",

  // پیام‌های موفقیت
  "ACTIVITY_DELETED_SUCCESS": "فعالیت با موفقیت حذف شد",
  "USER_ACTIVITIES_DELETED_SUCCESS": "{count} فعالیت کاربر با موفقیت حذف شد",
  "OLD_ACTIVITIES_CLEANED_SUCCESS": "{count} فعالیت قدیمی (بیشتر از {days} روز) با موفقیت پاکسازی شد",

  // متن‌های عمومی
  "UNKNOWN_PRODUCT": "محصول نامشخص",
  "UNKNOWN_CATEGORY": "دسته‌بندی نامشخص",
  "UNKNOWN_USER": "کاربر نامشخص",
  "UNKNOWN_ACCOUNT": "اکانت نامشخص",
  "UNKNOWN_INDUSTRY": "صنف نامشخص",
  "DATE": "تاریخ",
  "TIME": "زمان",
  "ACTIVITY_TYPE": "نوع فعالیت",
  "USER": "کاربر",
  "ACCOUNT": "اکانت",
  "INDUSTRY": "صنف",
  "PRODUCT": "محصول",
  "CATEGORY": "دسته‌بندی",
  "WEIGHT": "وزن",
  "METADATA": "متادیتا",
  "INSUFFICIENT_FUNDS": "موجودی کافی نیست", // برای خطای کیف پول

  //auth
  "PROFILE_PHOTO_DESCRIPTION": "تصویر پروفایل {firstName} {lastName}",
  "ID_CARD_FRONT_DESCRIPTION": "تصویر روی کارت ملی {firstName} {lastName}",
  "ID_CARD_BACK_DESCRIPTION": "تصویر پشت کارت ملی {firstName} {lastName}",
  "SELFIE_WITH_ID_DESCRIPTION": "سلفی با کارت ملی {firstName} {lastName}",
  "SIGNATURE_DESCRIPTION": "امضای {firstName} {lastName}",
  "BANK_CARD_DESCRIPTION": "کارت بانکی {firstName} {lastName}",
  "ADDRESS_PROOF_DESCRIPTION": "سند اثبات آدرس {firstName} {lastName}",
  "GENERIC_FILE_DESCRIPTION": "فایل {fileUsage} برای {firstName} {lastName}",


  // ==================== خطاهای مدیریت فایل ====================
  "FILE_NOT_FOUND": "فایل یافت نشد",
  "FILE_ACCESS_DENIED": "شما دسترسی به این فایل را ندارید",
  "FILE_UPLOAD_ERROR": "خطا در آپلود فایل",
  "FILE_DELETE_ERROR": "خطا در حذف فایل",
  "FILE_SIZE_EXCEEDED": "حجم فایل بیش از حد مجاز است",
  "FILE_TYPE_NOT_ALLOWED": "نوع فایل مجاز نیست",
  "FILE_EXTENSION_NOT_ALLOWED": "پسوند فایل مجاز نیست",
  "FILE_PROCESSING_ERROR": "خطا در پردازش فایل",
  "FILE_STORAGE_ERROR": "خطا در ذخیره‌سازی فایل",
  "FILE_CLEANUP_ERROR": "خطا در پاکسازی فایل‌ها",
  "FILE_ORPHANED_CLEANUP_ERROR": "خطا در پاکسازی فایل‌های سرگردان",
  "FILE_BULK_DELETE_ERROR": "خطا در حذف گروهی فایل‌ها",
  "FILE_STATS_ERROR": "خطا در دریافت آمار فایل‌ها",
  "File_DELETED_SUCCESS": "فایل با موفقیت حذف شد",

  // ==================== خطاهای وابستگی فایل ====================
  "PRODUCT_NOT_FOUND": "محصول یافت نشد",
  "ACCOUNT_NOT_FOUND": "اکانت این کسب و کار یافت نشد",
  "USER_NOT_FOUND": "کاربر یافت نشد",
  "TARGET_USER_NOT_FOUND": "کاربر هدف یافت نشد",

  // خطاهای برند
  "BRAND_ALREADY_EXISTS": "برند با نام {name} یا نام فارسی {name_fa} از قبل وجود دارد",
  "BRAND_NOT_FOUND": "برند با شناسه {id} یافت نشد",
  "BRAND_CREATE_ERROR": "خطا در ایجاد برند",
  "BRANDS_FETCH_ERROR": "خطا در دریافت برندها",
  "BRAND_FETCH_ERROR": "خطا در دریافت برند",
  "BRAND_UPDATE_ERROR": "خطا در آپدیت برند",
  "BRAND_DELETE_ERROR": "خطا در حذف برند",
  "BRAND_DELETED_SUCCESS": "برند با موفقیت حذف شد",
  "DELETE_BRAND_WITH_CATALOGS": "امکان حذف برند با {catalogsCount} کاتالوگ وجود ندارد",
  "BRAND_CONTENT_CREATE_ERROR": "خطا در ایجاد محتوای چندزبانه برند",
  "BRAND_TRANSLATIONS_FETCH_ERROR": "خطا در دریافت ترجمه‌های برند",

  // خطاهای وابستگی
  "INDUSTRY_NOT_FOUND": "صنف با شناسه {industryId} یافت نشد",


  "NO_TRANSLATION_AVAILABLE": "ترجمه در دسترس نیست",
  "CATEGORY_ALREADY_EXISTS": "دسته‌بندی با نام {name} یا شناسه {bId} از قبل وجود دارد",
  "CATEGORY_NOT_FOUND": "دسته‌بندی با شناسه {id} یافت نشد",
  "PARENT_CATEGORY_NOT_FOUND": "دسته‌بندی والد با شناسه {parentId} یافت نشد",
  "CATEGORY_CREATE_ERROR": "خطا در ایجاد دسته‌بندی",
  "CATEGORIES_FETCH_ERROR": "خطا در دریافت دسته‌بندی‌ها",
  "CATEGORY_FETCH_ERROR": "خطا در دریافت دسته‌بندی",
  "CATEGORY_UPDATE_ERROR": "خطا در آپدیت دسته‌بندی",
  "CATEGORY_DELETE_ERROR": "خطا در حذف دسته‌بندی",
  "CATEGORY_DELETED_SUCCESS": "دسته‌بندی با موفقیت حذف شد",
  "DELETE_CATEGORY_WITH_CHILDREN": "امکان حذف دسته‌بندی با {childrenCount} زیردسته وجود ندارد",
  "DELETE_CATEGORY_WITH_PRODUCTS": "امکان حذف دسته‌بندی با {productsCount} محصول وجود ندارد",
  "DELETE_CATEGORY_WITH_CATALOGS": "امکان حذف دسته‌بندی با {catalogsCount} کاتالوگ وجود ندارد",
  "CATEGORY_CANNOT_BE_PARENT_OF_ITSELF": "دسته‌بندی نمی‌تواند والد خودش باشد",
  "CATEGORY_CONTENT_CREATE_ERROR": "خطا در ایجاد محتوای چندزبانه دسته‌بندی",
  "CATEGORY_TRANSLATIONS_FETCH_ERROR": "خطا در دریافت ترجمه‌های دسته‌بندی",
  "CATEGORY_TREE_FETCH_ERROR": "خطا در دریافت درخت دسته‌بندی‌ها",
  "CATEGORY_CHILDREN_FETCH_ERROR": "خطا در دریافت زیردسته‌ها",


  // خطاهای ارتباط دسته‌بندی و مشخصه فنی
  "CATEGORY_SPEC_ALREADY_EXISTS": "ارتباط بین دسته‌بندی {categoryName} و مشخصه فنی {specKey} از قبل وجود دارد",
  "CATEGORY_SPEC_NOT_FOUND": "ارتباط دسته‌بندی و مشخصه فنی با شناسه {id} یافت نشد",
  "CATEGORY_SPEC_CREATE_ERROR": "خطا در ایجاد ارتباط دسته‌بندی و مشخصه فنی",
  "CATEGORY_SPECS_FETCH_ERROR": "خطا در دریافت ارتباطات دسته‌بندی و مشخصه فنی",
  "CATEGORY_SPEC_FETCH_ERROR": "خطا در دریافت ارتباط دسته‌بندی و مشخصه فنی",
  "CATEGORY_SPEC_UPDATE_ERROR": "خطا در آپدیت ارتباط دسته‌بندی و مشخصه فنی",
  "CATEGORY_SPEC_DELETE_ERROR": "خطا در حذف ارتباط دسته‌بندی و مشخصه فنی",
  "CATEGORY_SPEC_DELETED_SUCCESS": "ارتباط دسته‌بندی و مشخصه فنی با موفقیت حذف شد",

  // خطاهای کاتالوگ
  "CATALOG_ALREADY_EXISTS": "کاتالوگ با نام {name} یا مدل {modelNumber} از قبل وجود دارد",
  "CATALOG_NOT_FOUND": "کاتالوگ با شناسه {id} یافت نشد",
  "CATALOG_CREATE_ERROR": "خطا در ایجاد کاتالوگ",
  "CATALOGS_FETCH_ERROR": "خطا در دریافت کاتالوگ‌ها",
  "CATALOG_FETCH_ERROR": "خطا در دریافت کاتالوگ",
  "CATALOG_UPDATE_ERROR": "خطا در آپدیت کاتالوگ",
  "CATALOG_DELETE_ERROR": "خطا در حذف کاتالوگ",
  "CATALOG_DELETED_SUCCESS": "کاتالوگ با موفقیت حذف شد",
  "DELETE_CATALOG_WITH_PRODUCTS": "امکان حذف کاتالوگ با {productsCount} محصول وجود ندارد",
  "CATALOG_ALREADY_APPROVED": "کاتالوگ قبلاً تایید شده است",
  "CATALOG_ALREADY_REJECTED": "کاتالوگ قبلاً رد شده است",
  "CATALOG_APPROVE_ERROR": "خطا در تایید کاتالوگ",
  "CATALOG_REJECT_ERROR": "خطا در رد کاتالوگ",
  "CATALOG_CONTENT_CREATE_ERROR": "خطا در ایجاد محتوای چندزبانه کاتالوگ",
  "CATALOG_TRANSLATIONS_FETCH_ERROR": "خطا در دریافت ترجمه‌های کاتالوگ",


  // خطاهای جدید محصول
  "PRODUCT_TRANSLATION_ALREADY_EXISTS": "ترجمه محصول برای زبان {language} از قبل وجود دارد",
  "PRODUCT_TRANSLATIONS_FETCH_ERROR": "خطا در دریافت ترجمه‌های محصول",
  "PRODUCT_TRANSLATION_CREATE_ERROR": "خطا در ایجاد ترجمه محصول",

  // خطاهای مرتبط با مدل‌های جدید

  "LOCATION_NOT_FOUND": "لوکیشن با شناسه {id} یافت نشد",
  "UNIT_NOT_FOUND": "واحد با شناسه {id} یافت نشد",
  "SPEC_NOT_FOUND": "مشخصه فنی با شناسه {id} یافت نشد",

  // خطاهای قیمت‌گذاری
  "PRODUCT_PRICE_CREATE_ERROR": "خطا در ایجاد قیمت محصول",
  "PRODUCT_PRICE_UPDATE_ERROR": "خطا در بروزرسانی قیمت محصول",
  "PRODUCT_PRICE_NOT_FOUND": "قیمت محصول با شناسه {id} یافت نشد",

  // خطاهای اعتبارسنجی
  "INVALID_LOCATION_HIERARCHY": "سلسله مراتب لوکیشن نامعتبر است",
  "CATEGORY_REQUIRED": "دسته‌بندی الزامی است",
  "UNIT_REQUIRED": "واحد محصول الزامی است",
  "MIN_SALE_AMOUNT_REQUIRED": "حداقل مقدار فروش الزامی است",

  // خطاهای چندزبانی
  "LANGUAGE_REQUIRED": "زبان الزامی است",
  "PRODUCT_NAME_REQUIRED": "نام محصول الزامی است",
  "CONTENT_REQUIRED": "محتوای چندزبانه الزامی است",

  // پیام‌های موفقیت
  "PRODUCT_TRANSLATION_CREATED": "ترجمه محصول با موفقیت ایجاد شد",
  "PRODUCT_TRANSLATION_UPDATED": "ترجمه محصول با موفقیت بروزرسانی شد",
  "PRODUCT_CONTENT_MERGED": "محتوای محصول با موفقیت ترکیب شد",

  "PRODUCT_NOT_APPROVED": "فقط محصولات تأیید شده قابل بوست کردن هستند",
  "ALREADY_LIKED": "شما قبلاً این محصول را لایک کرده‌اید",
  "ALREADY_SAVED": "شما قبلاً این محصول را ذخیره کرده‌اید",
  "LIKE_NOT_FOUND": "لایک یافت نشد",
  "SAVE_NOT_FOUND": "ذخیره یافت نشد",
  "LIKE_REMOVED": "لایک حذف شد",
  "SAVE_REMOVED": "ذخیره حذف شد",
  "FILE_UPLOAD_SUCCESS": "فایل با موفقیت بروزرسانی شد",
  "FILE_DELETE_SUCCESS": "فایل با موفقیت حذف شد",
  "INVALID_FILE_USAGE": "این نوع فایل برای محصول مجاز نیست",
  "BOOST_SUCCESS": "محصول با توان {power} به مدت {months} ماه بوست شد",
  "EXPIRED_BOOSTS_PROCESSED": "{count} محصول با بوست منقضی شده به‌روزرسانی شد",
  "PRODUCT_STATS_ERROR": "خطا در دریافت آمار محصولات",
  "PRODUCT_PERMANENTLY_DELETED": "محصول و تمام داده‌های مرتبط با موفقیت حذف شد",
  "CATEGORY_INSIGHTS_ERROR": "خطا در دریافت بینش‌های دسته‌بندی",
  "ENGAGEMENT_ANALYTICS_ERROR": "خطا در تحلیل تعامل محصولات",
  "POPULAR_PRODUCTS_ERROR": "خطا در دریافت محصولات پرطرفدار",
  "RECENT_ACTIVITIES_ERROR": "خطا در دریافت فعالیت‌های اخیر",
  // خطاهای قیمت‌گذاری محصول
  "PRODUCT_PRICE_DELETE_ERROR": "خطا در حذف قیمت محصول",
  "NO_ACTIVE_PRICES_FOUND": "هیچ قیمت فعالی برای محصول {productId} یافت نشد",
  "CANNOT_DELETE_PRIMARY_PRICE": "نمی‌توان قیمت اصلی را حذف کرد",
  "CANNOT_SET_INACTIVE_PRICE_AS_PRIMARY": "قیمت غیرفعال را نمی‌توان به عنوان قیمت اصلی تنظیم کرد",
  "SET_PRIMARY_PRICE_ERROR": "خطا در تنظیم قیمت اصلی",
  "PRICE_FILTERS_FETCH_ERROR": "خطا در دریافت فیلترهای قیمت",
  "PRICE_STATS_FETCH_ERROR": "خطا در دریافت آمار قیمت‌ها",
  "PRODUCT_PRICE_DELETED_SUCCESS": "قیمت محصول با موفقیت حذف شد",
  // پیام‌های موفقیت
  "PRODUCT_ANALYTICS_GENERATED": "تحلیل محصولات با موفقیت تولید شد",
  "CATEGORY_INSIGHTS_GENERATED": "بینش‌های دسته‌بندی با موفقیت تولید شد",
  "ENGAGEMENT_STATS_CALCULATED": "آمار تعاملات با موفقیت محاسبه شد",

  // خطاهای اعتبارسنجی
  "INVALID_DATE_RANGE": "بازه تاریخ نامعتبر است",
  "INVALID_LIMIT_VALUE": "مقدار limit نامعتبر است",
  "INVALID_CATEGORY_ID": "شناسه دسته‌بندی نامعتبر است",

  // خطاهای دسترسی
  "ACCESS_DENIED_PRODUCT_ANALYTICS": "دسترسی به تحلیل محصولات مجاز نیست",
  "ACCESS_DENIED_CATEGORY_INSIGHTS": "دسترسی به بینش‌های دسته‌بندی مجاز نیست",



}