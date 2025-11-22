export interface PriceConditionAnalysis {
    avg_price: number;
    min_price: number;
    max_price: number;
    acceptance_rate: number;
    popularity?: number;
    discount_rate?: number;
    usage_rate?: number;
}

export interface PriceAnalysis {
    quantity_based: Record<string, PriceConditionAnalysis>;
    payment_based: Record<string, PriceConditionAnalysis>;
    delivery_based: Record<string, PriceConditionAnalysis>;
    customer_type_based?: Record<string, PriceConditionAnalysis>;
}