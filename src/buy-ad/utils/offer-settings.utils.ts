// src/buy-ad/utils/offer-settings.utils.ts
import { OfferSettings, BudgetRange } from '../interfaces/offer-settings.interface';

export class OfferSettingsUtils {
    static getDefaultSettings(): OfferSettings {
        return {
            allow_public_offers: true,
            auto_expire_days: 7,
        };
    }

    static parseOfferSettings(settingsJson: any): OfferSettings {
        if (!settingsJson) {
            return this.getDefaultSettings();
        }

        if (typeof settingsJson === 'object' && !Array.isArray(settingsJson)) {
            return {
                ...this.getDefaultSettings(),
                ...settingsJson
            };
        }

        if (typeof settingsJson === 'string') {
            try {
                return {
                    ...this.getDefaultSettings(),
                    ...JSON.parse(settingsJson)
                };
            } catch {
                return this.getDefaultSettings();
            }
        }

        return this.getDefaultSettings();
    }

    static serializeOfferSettings(settings: OfferSettings): any {
        return settings;
    }
}