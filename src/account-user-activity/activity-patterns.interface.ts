// src/account-user-activity/interfaces/activity-patterns.interface.ts
export interface UserActivityPattern {
    account_user_id: string;
    peak_hours: number[];
    favorite_categories: string[];
    search_habits: {
        avg_query_length: number;
        common_filters: string[];
        time_between_searches: number;
    };
    browsing_behavior: {
        avg_session_duration: number;
        pages_per_session: number;
        bounce_rate: number;
    };
    purchase_patterns: {
        avg_order_value: number;
        conversion_rate: number;
        favorite_brands: string[];
    };
    engagement_score: number;
    last_updated: Date;
}

export interface ActivityTrend {
    period: string;
    total_activities: number;
    unique_users: number;
    activity_breakdown: Record<string, number>;
    growth_rate: number;
}

export interface ProductEngagement {
    product_id: string;
    name: string;
    category_name: string;
    total_views: number;
    total_saves: number;
    total_likes: number;
    unique_users: number;
    engagement_rate: number;
    conversion_rate: number;
    avg_time_spent: number;
}

export interface CategoryInsights {
    category_name: string;
    total_activities: number;
    unique_products: number;
    unique_users: number;
    engagement_score: number;
}