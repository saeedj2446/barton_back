export const errorAr={
  // ==================== 4xx Client Errors ====================
  "BAD_REQUEST": "طلب غير صالح",
  "UNAUTHORIZED": "وصول غير مصرح",
  "FORBIDDEN": "ليس لديك إذن للوصول إلى هذا المورد",
  "NOT_FOUND": "الموارد المطلوبة غير موجودة",
  "METHOD_NOT_ALLOWED": "الطريقة غير مسموح بها",
  "NOT_ACCEPTABLE": "طلب غير مقبول",
  "REQUEST_TIMEOUT": "انتهت مهلة الطلب",
  "CONFLICT": "تعارض في البيانات",
  "GONE": "الموارد لم تعد متاحة",
  "PRECONDITION_FAILED": "فشل الشرط المسبق",
  "PAYLOAD_TOO_LARGE": "الحمولة كبيرة جدًا",
  "UNSUPPORTED_MEDIA_TYPE": "نوع الوسائط غير مدعوم",
  "UNPROCESSABLE_ENTITY": "كيان غير قابل للمعالجة",
  "TOO_MANY_REQUESTS": "طلبات كثيرة جدًا",

  // ==================== 5xx Server Errors ====================
  "INTERNAL_SERVER_ERROR": "خطأ داخلي في الخادم",
  "NOT_IMPLEMENTED": "الميزة غير مطبقة",
  "BAD_GATEWAY": "بوابة سيئة",
  "SERVICE_UNAVAILABLE": "الخدمة غير متاحة مؤقتًا",
  "GATEWAY_TIMEOUT": "انتهت مهلة البوابة",

  // ==================== Business Errors ====================
  "VALIDATION_ERROR": "خطأ في التحقق من الصحة",
  "INVALID_DATA": "بيانات غير صالحة",
  "REQUIRED_FIELD": "الحقل {field} مطلوب",
  "INVALID_EMAIL": "عنوان بريد إلكتروني غير صالح",
  "INVALID_PHONE": "رقم هاتف غير صالح",
  "INVALID_DATE": "تاريخ غير صالح",
  "INVALID_FILE_TYPE": "نوع الملف غير مسموح به",
  "FILE_TOO_LARGE": "حجم الملف كبير جدًا",

  // ==================== Authentication Errors ====================
  "INVALID_CREDENTIALS": "بيانات الاعتماد غير صالحة",
  "EXPIRED_TOKEN": "انتهت صلاحية الرمز",
  "INVALID_TOKEN": "رمز غير صالح",
  "ACCESS_DENIED": "تم رفض الوصول",

  // ==================== Database Errors ====================
  "DATABASE_ERROR": "خطأ في قاعدة البيانات",
  "RECORD_NOT_FOUND": "السجل غير موجود",
  "DUPLICATE_ENTRY": "إدخال مكرر",
  "CONSTRAINT_VIOLATION": "انتهاك قيد قاعدة البيانات",

  // ==================== System Errors ====================
  "NETWORK_ERROR": "خطأ في الشبكة",
  "EXTERNAL_SERVICE_ERROR": "خطأ في الخدمة الخارجية",
  "CONFIGURATION_ERROR": "خطأ في تكوين النظام",
  "MAINTENANCE_MODE": "النظام قيد الصيانة",

  // أخطاء النشاط
  "ACTIVITY_TRACK_ERROR": "خطأ في تتبع النشاط",
  "BATCH_ACTIVITY_TRACK_ERROR": "خطأ في تتبع الأنشطة المجمعة",
  "ACTIVITIES_FETCH_ERROR": "خطأ في جلب الأنشطة",
  "RECENT_ACTIVITIES_FETCH_ERROR": "خطأ في جلب الأنشطة الأخيرة",
  "USER_STATS_FETCH_ERROR": "خطأ في جلب إحصائيات المستخدم",
  "ACCOUNT_STATS_FETCH_ERROR": "خطأ في جلب إحصائيات الحساب",
  "USER_PATTERNS_FETCH_ERROR": "خطأ في جلب أنماط المستخدم",
  "PRODUCT_ENGAGEMENT_FETCH_ERROR": "خطأ في جلب تفاعل المنتج",
  "ACTIVITIES_OVERVIEW_FETCH_ERROR": "خطأ في جلب نظرة عامة على الأنشطة",
  "ACTIVITY_TRENDS_FETCH_ERROR": "خطأ في جلب اتجاهات النشاط",
  "TOP_PRODUCTS_FETCH_ERROR": "خطأ في جلب أفضل المنتجات",
  "USER_ENGAGEMENT_ANALYTICS_ERROR": "خطأ في تحليل تفاعل المستخدمين",
  "CATEGORY_INSIGHTS_FETCH_ERROR": "خطأ في جلب رؤى الفئة",
  "ACTIVITY_DELETE_ERROR": "خطأ في حذف النشاط",
  "USER_ACTIVITIES_DELETE_ERROR": "خطأ في حذف أنشطة المستخدم",
  "OLD_ACTIVITIES_CLEANUP_ERROR": "خطأ في تنظيف الأنشطة القديمة",
  "ACTIVITIES_EXPORT_ERROR": "خطأ في تصدير الأنشطة",

  // أخطاء التحقق
  "ACCOUNT_USER_NOT_FOUND": "لم يتم العثور على مستخدم الحساب بالمعرف {accountUserId}",
  "INVALID_ACCOUNT_USERS": "معرفات مستخدم الحساب غير صالحة: {missingIds}",
  "ACTIVITY_NOT_FOUND": "لم يتم العثور على النشاط بالمعرف {activityId}",

  // رسائل النجاح
  "ACTIVITY_DELETED_SUCCESS": "تم حذف النشاط بنجاح",
  "USER_ACTIVITIES_DELETED_SUCCESS": "تم حذف {count} من أنشطة المستخدم بنجاح",
  "OLD_ACTIVITIES_CLEANED_SUCCESS": "تم تنظيف {count} من الأنشطة القديمة (أقدم من {days} يوم) بنجاح",

  // نصوص عامة
  "UNKNOWN_PRODUCT": "منتج غير معروف",
  "UNKNOWN_CATEGORY": "فئة غير معروفة",
  "UNKNOWN_USER": "مستخدم غير معروف",
  "UNKNOWN_ACCOUNT": "حساب غير معروف",
  "UNKNOWN_INDUSTRY": "صناعة غير معروفة",
  "DATE": "التاريخ",
  "TIME": "الوقت",
  "ACTIVITY_TYPE": "نوع النشاط",
  "USER": "المستخدم",
  "ACCOUNT": "الحساب",
  "INDUSTRY": "الصناعة",
  "PRODUCT": "المنتج",
  "CATEGORY": "الفئة",
  "WEIGHT": "الوزن",
  "METADATA": "البيانات الوصفية",

}