export interface CompetitorAnalysis {
    top_competitors: string[];
    competitor_pricing_strategy: Record<string, string>;
    competitor_strengths: string[];
    market_share_estimation: Record<string, number>;
}