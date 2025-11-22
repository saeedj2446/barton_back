export const errorEn={
  // ==================== 4xx Client Errors ====================
  "BAD_REQUEST": "Bad request",
  "UNAUTHORIZED": "Unauthorized access",
  "FORBIDDEN": "You don't have permission to access this resource",
  "NOT_FOUND": "Requested resource not found",
  "METHOD_NOT_ALLOWED": "Method not allowed",
  "NOT_ACCEPTABLE": "Request not acceptable",
  "REQUEST_TIMEOUT": "Request timeout",
  "CONFLICT": "Data conflict",
  "GONE": "Resource no longer available",
  "PRECONDITION_FAILED": "Precondition failed",
  "PAYLOAD_TOO_LARGE": "Payload too large",
  "UNSUPPORTED_MEDIA_TYPE": "Unsupported media type",
  "UNPROCESSABLE_ENTITY": "Unprocessable entity",
  "TOO_MANY_REQUESTS": "Too many requests",

  // ==================== 5xx Server Errors ====================
  "INTERNAL_SERVER_ERROR": "Internal server error",
  "NOT_IMPLEMENTED": "Feature not implemented",
  "BAD_GATEWAY": "Bad gateway",
  "SERVICE_UNAVAILABLE": "Service temporarily unavailable",
  "GATEWAY_TIMEOUT": "Gateway timeout",

  // ==================== Business Errors ====================
  "VALIDATION_ERROR": "Validation error",
  "INVALID_DATA": "Invalid data provided",
  "REQUIRED_FIELD": "Field {field} is required",
  "INVALID_EMAIL": "Invalid email address",
  "INVALID_PHONE": "Invalid phone number",
  "INVALID_DATE": "Invalid date",
  "INVALID_FILE_TYPE": "File type not allowed",
  "FILE_TOO_LARGE": "File size too large",

  // ==================== Authentication Errors ====================
  "INVALID_CREDENTIALS": "Invalid credentials",
  "EXPIRED_TOKEN": "Token expired",
  "INVALID_TOKEN": "Invalid token",
  "ACCESS_DENIED": "Access denied",

  // ==================== Database Errors ====================
  "DATABASE_ERROR": "Database error",
  "RECORD_NOT_FOUND": "Record not found",
  "DUPLICATE_ENTRY": "Duplicate entry",
  "CONSTRAINT_VIOLATION": "Database constraint violation",

  // ==================== System Errors ====================
  "NETWORK_ERROR": "Network error",
  "EXTERNAL_SERVICE_ERROR": "External service error",
  "CONFIGURATION_ERROR": "System configuration error",
  "MAINTENANCE_MODE": "System under maintenance",
  // Activity errors
  "ACTIVITY_TRACK_ERROR": "Error tracking activity",
  "BATCH_ACTIVITY_TRACK_ERROR": "Error tracking batch activities",
  "ACTIVITIES_FETCH_ERROR": "Error fetching activities",
  "RECENT_ACTIVITIES_FETCH_ERROR": "Error fetching recent activities",
  "USER_STATS_FETCH_ERROR": "Error fetching user stats",
  "ACCOUNT_STATS_FETCH_ERROR": "Error fetching account stats",
  "USER_PATTERNS_FETCH_ERROR": "Error fetching user patterns",
  "PRODUCT_ENGAGEMENT_FETCH_ERROR": "Error fetching product engagement",
  "ACTIVITIES_OVERVIEW_FETCH_ERROR": "Error fetching activities overview",
  "ACTIVITY_TRENDS_FETCH_ERROR": "Error fetching activity trends",
  "TOP_PRODUCTS_FETCH_ERROR": "Error fetching top products",
  "USER_ENGAGEMENT_ANALYTICS_ERROR": "Error fetching user engagement analytics",
  "CATEGORY_INSIGHTS_FETCH_ERROR": "Error fetching category insights",
  "ACTIVITY_DELETE_ERROR": "Error deleting activity",
  "USER_ACTIVITIES_DELETE_ERROR": "Error deleting user activities",
  "OLD_ACTIVITIES_CLEANUP_ERROR": "Error cleaning up old activities",
  "ACTIVITIES_EXPORT_ERROR": "Error exporting activities",

  // Validation errors
  "ACCOUNT_USER_NOT_FOUND": "Account user with ID {accountUserId} not found",
  "INVALID_ACCOUNT_USERS": "Invalid account user IDs: {missingIds}",
  "ACTIVITY_NOT_FOUND": "Activity with ID {activityId} not found",

  // Success messages
  "ACTIVITY_DELETED_SUCCESS": "Activity deleted successfully",
  "USER_ACTIVITIES_DELETED_SUCCESS": "{count} user activities deleted successfully",
  "OLD_ACTIVITIES_CLEANED_SUCCESS": "{count} old activities (older than {days} days) cleaned up successfully",

  // General texts
  "UNKNOWN_PRODUCT": "Unknown product",
  "UNKNOWN_CATEGORY": "Unknown category",
  "UNKNOWN_USER": "Unknown user",
  "UNKNOWN_ACCOUNT": "Unknown account",
  "UNKNOWN_INDUSTRY": "Unknown industry",
  "DATE": "Date",
  "TIME": "Time",
  "ACTIVITY_TYPE": "Activity Type",
  "USER": "User",
  "ACCOUNT": "Account",
  "INDUSTRY": "Industry",
  "PRODUCT": "Product",
  "CATEGORY": "Category",
  "WEIGHT": "Weight",
  "METADATA": "Metadata",


}