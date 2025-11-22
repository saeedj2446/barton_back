// seed/technical-units.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedTechnicalUnits() {
    console.log('🌱 Starting technical units seeding...');

    // پاک کردن داده‌های موجود
    await prisma.unitContent.deleteMany({});
    await prisma.unit.deleteMany({});

    console.log('✅ Existing units cleared');

    // واحدهای فنی کامل برای صنایع مختلف
    const technicalUnits = [
        // ==================== واحدهای طول و ابعاد ====================
        {
            key: 'MILLIMETER',
            symbol: 'mm',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'میلی‌متر' },
                { language: 'en', label: 'Millimeter' },
                { language: 'ar', label: 'مليمتر' },
                { language: 'tr', label: 'Milimetre' }
            ]
        },
        {
            key: 'CENTIMETER',
            symbol: 'cm',
            rate: 10,
            isBase: false,
            contents: [
                { language: 'fa', label: 'سانتی‌متر' },
                { language: 'en', label: 'Centimeter' },
                { language: 'ar', label: 'سنتيمتر' },
                { language: 'tr', label: 'Santimetre' }
            ]
        },
        {
            key: 'METER',
            symbol: 'm',
            rate: 1000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'متر' },
                { language: 'en', label: 'Meter' },
                { language: 'ar', label: 'متر' },
                { language: 'tr', label: 'Metre' }
            ]
        },
        {
            key: 'INCH',
            symbol: 'in',
            rate: 25.4,
            isBase: false,
            contents: [
                { language: 'fa', label: 'اینچ' },
                { language: 'en', label: 'Inch' },
                { language: 'ar', label: 'بوصة' },
                { language: 'tr', label: 'İnç' }
            ]
        },
        {
            key: 'FOOT',
            symbol: 'ft',
            rate: 304.8,
            isBase: false,
            contents: [
                { language: 'fa', label: 'فوت' },
                { language: 'en', label: 'Foot' },
                { language: 'ar', label: 'قدم' },
                { language: 'tr', label: 'Fit' }
            ]
        },

        // ==================== واحدهای سطح و مساحت ====================
        {
            key: 'SQUARE_MILLIMETER',
            symbol: 'mm²',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'میلی‌متر مربع' },
                { language: 'en', label: 'Square Millimeter' },
                { language: 'ar', label: 'مليمتر مربع' },
                { language: 'tr', label: 'Milimetre Kare' }
            ]
        },
        {
            key: 'SQUARE_CENTIMETER',
            symbol: 'cm²',
            rate: 100,
            isBase: false,
            contents: [
                { language: 'fa', label: 'سانتی‌متر مربع' },
                { language: 'en', label: 'Square Centimeter' },
                { language: 'ar', label: 'سنتيمتر مربع' },
                { language: 'tr', label: 'Santimetre Kare' }
            ]
        },
        {
            key: 'SQUARE_METER',
            symbol: 'm²',
            rate: 1000000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'متر مربع' },
                { language: 'en', label: 'Square Meter' },
                { language: 'ar', label: 'متر مربع' },
                { language: 'tr', label: 'Metre Kare' }
            ]
        },

        // ==================== واحدهای حجم ====================
        {
            key: 'CUBIC_MILLIMETER',
            symbol: 'mm³',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'میلی‌متر مکعب' },
                { language: 'en', label: 'Cubic Millimeter' },
                { language: 'ar', label: 'مليمتر مكعب' },
                { language: 'tr', label: 'Milimetre Küp' }
            ]
        },
        {
            key: 'CUBIC_CENTIMETER',
            symbol: 'cm³',
            rate: 1000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'سانتی‌متر مکعب' },
                { language: 'en', label: 'Cubic Centimeter' },
                { language: 'ar', label: 'سنتيمتر مكعب' },
                { language: 'tr', label: 'Santimetre Küp' }
            ]
        },
        {
            key: 'CUBIC_METER',
            symbol: 'm³',
            rate: 1000000000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'متر مکعب' },
                { language: 'en', label: 'Cubic Meter' },
                { language: 'ar', label: 'متر مكعب' },
                { language: 'tr', label: 'Metre Küp' }
            ]
        },

        // ==================== واحدهای وزن ====================
        {
            key: 'MILLIGRAM',
            symbol: 'mg',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'میلی‌گرم' },
                { language: 'en', label: 'Milligram' },
                { language: 'ar', label: 'ملليغرام' },
                { language: 'tr', label: 'Miligram' }
            ]
        },
        {
            key: 'GRAM',
            symbol: 'g',
            rate: 1000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'گرم' },
                { language: 'en', label: 'Gram' },
                { language: 'ar', label: 'غرام' },
                { language: 'tr', label: 'Gram' }
            ]
        },
        {
            key: 'KILOGRAM',
            symbol: 'kg',
            rate: 1000000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'کیلوگرم' },
                { language: 'en', label: 'Kilogram' },
                { language: 'ar', label: 'كيلوغرام' },
                { language: 'tr', label: 'Kilogram' }
            ]
        },
        {
            key: 'TON',
            symbol: 't',
            rate: 1000000000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'تن' },
                { language: 'en', label: 'Ton' },
                { language: 'ar', label: 'طن' },
                { language: 'tr', label: 'Ton' }
            ]
        },

        // ==================== واحدهای فشار ====================
        {
            key: 'PASCAL',
            symbol: 'Pa',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'پاسکال' },
                { language: 'en', label: 'Pascal' },
                { language: 'ar', label: 'باسكال' },
                { language: 'tr', label: 'Pascal' }
            ]
        },
        {
            key: 'KILOPASCAL',
            symbol: 'kPa',
            rate: 1000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'کیلوپاسکال' },
                { language: 'en', label: 'Kilopascal' },
                { language: 'ar', label: 'كيلوباسكال' },
                { language: 'tr', label: 'Kilopascal' }
            ]
        },
        {
            key: 'BAR',
            symbol: 'bar',
            rate: 100000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'بار' },
                { language: 'en', label: 'Bar' },
                { language: 'ar', label: 'بار' },
                { language: 'tr', label: 'Bar' }
            ]
        },
        {
            key: 'PSI',
            symbol: 'psi',
            rate: 6894.76,
            isBase: false,
            contents: [
                { language: 'fa', label: 'پی‌اس‌آی' },
                { language: 'en', label: 'PSI' },
                { language: 'ar', label: 'رطل لكل بوصة مربعة' },
                { language: 'tr', label: 'PSI' }
            ]
        },

        // ==================== واحدهای دما ====================
        {
            key: 'CELSIUS',
            symbol: '°C',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'سلسیوس' },
                { language: 'en', label: 'Celsius' },
                { language: 'ar', label: 'مئوية' },
                { language: 'tr', label: 'Santigrat' }
            ]
        },
        {
            key: 'FAHRENHEIT',
            symbol: '°F',
            rate: 1, // تبدیل خاص نیاز دارد
            isBase: false,
            contents: [
                { language: 'fa', label: 'فارنهایت' },
                { language: 'en', label: 'Fahrenheit' },
                { language: 'ar', label: 'فهرنهايت' },
                { language: 'tr', label: 'Fahrenheit' }
            ]
        },
        {
            key: 'KELVIN',
            symbol: 'K',
            rate: 1, // تبدیل خاص نیاز دارد
            isBase: false,
            contents: [
                { language: 'fa', label: 'کلوین' },
                { language: 'en', label: 'Kelvin' },
                { language: 'ar', label: 'كلفن' },
                { language: 'tr', label: 'Kelvin' }
            ]
        },

        // ==================== واحدهای سرعت ====================
        {
            key: 'METER_PER_SECOND',
            symbol: 'm/s',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'متر بر ثانیه' },
                { language: 'en', label: 'Meter per Second' },
                { language: 'ar', label: 'متر لكل ثانية' },
                { language: 'tr', label: 'Saniyede Metre' }
            ]
        },
        {
            key: 'KILOMETER_PER_HOUR',
            symbol: 'km/h',
            rate: 0.277778,
            isBase: false,
            contents: [
                { language: 'fa', label: 'کیلومتر بر ساعت' },
                { language: 'en', label: 'Kilometer per Hour' },
                { language: 'ar', label: 'كيلومتر لكل ساعة' },
                { language: 'tr', label: 'Saatte Kilometre' }
            ]
        },
        {
            key: 'RPM',
            symbol: 'rpm',
            rate: 1,
            isBase: false,
            contents: [
                { language: 'fa', label: 'دور بر دقیقه' },
                { language: 'en', label: 'RPM' },
                { language: 'ar', label: 'دورة لكل دقيقة' },
                { language: 'tr', label: 'Dakikada Devir' }
            ]
        },

        // ==================== واحدهای نیرو ====================
        {
            key: 'NEWTON',
            symbol: 'N',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'نیوتن' },
                { language: 'en', label: 'Newton' },
                { language: 'ar', label: 'نيوتن' },
                { language: 'tr', label: 'Newton' }
            ]
        },
        {
            key: 'KILONEWTON',
            symbol: 'kN',
            rate: 1000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'کیلونیوتن' },
                { language: 'en', label: 'Kilonewton' },
                { language: 'ar', label: 'كيلونيوتن' },
                { language: 'tr', label: 'Kilonewton' }
            ]
        },

        // ==================== واحدهای توان ====================
        {
            key: 'WATT',
            symbol: 'W',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'وات' },
                { language: 'en', label: 'Watt' },
                { language: 'ar', label: 'واط' },
                { language: 'tr', label: 'Watt' }
            ]
        },
        {
            key: 'KILOWATT',
            symbol: 'kW',
            rate: 1000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'کیلووات' },
                { language: 'en', label: 'Kilowatt' },
                { language: 'ar', label: 'كيلوواط' },
                { language: 'tr', label: 'Kilowatt' }
            ]
        },
        {
            key: 'HORSEPOWER',
            symbol: 'hp',
            rate: 745.7,
            isBase: false,
            contents: [
                { language: 'fa', label: 'اسب بخار' },
                { language: 'en', label: 'Horsepower' },
                { language: 'ar', label: 'حصان' },
                { language: 'tr', label: 'Beygir Gücü' }
            ]
        },

        // ==================== واحدهای انرژی ====================
        {
            key: 'JOULE',
            symbol: 'J',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'ژول' },
                { language: 'en', label: 'Joule' },
                { language: 'ar', label: 'جول' },
                { language: 'tr', label: 'Joule' }
            ]
        },
        {
            key: 'KILOJOULE',
            symbol: 'kJ',
            rate: 1000,
            isBase: false,
            contents: [
                { language: 'fa', label: 'کیلوژول' },
                { language: 'en', label: 'Kilojoule' },
                { language: 'ar', label: 'كيلوجول' },
                { language: 'tr', label: 'Kilojoule' }
            ]
        },
        {
            key: 'CALORIE',
            symbol: 'cal',
            rate: 4.184,
            isBase: false,
            contents: [
                { language: 'fa', label: 'کالری' },
                { language: 'en', label: 'Calorie' },
                { language: 'ar', label: 'سعرة' },
                { language: 'tr', label: 'Kalori' }
            ]
        },

        // ==================== واحدهای الکتریکی ====================
        {
            key: 'VOLT',
            symbol: 'V',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'ولت' },
                { language: 'en', label: 'Volt' },
                { language: 'ar', label: 'فولت' },
                { language: 'tr', label: 'Volt' }
            ]
        },
        {
            key: 'AMPERE',
            symbol: 'A',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'آمپر' },
                { language: 'en', label: 'Ampere' },
                { language: 'ar', label: 'أمبير' },
                { language: 'tr', label: 'Amper' }
            ]
        },
        {
            key: 'OHM',
            symbol: 'Ω',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'اهم' },
                { language: 'en', label: 'Ohm' },
                { language: 'ar', label: 'أوم' },
                { language: 'tr', label: 'Ohm' }
            ]
        },
        {
            key: 'HERTZ',
            symbol: 'Hz',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'هرتز' },
                { language: 'en', label: 'Hertz' },
                { language: 'ar', label: 'هيرتز' },
                { language: 'tr', label: 'Hertz' }
            ]
        },

        // ==================== واحدهای زمان ====================
        {
            key: 'SECOND',
            symbol: 's',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'ثانیه' },
                { language: 'en', label: 'Second' },
                { language: 'ar', label: 'ثانية' },
                { language: 'tr', label: 'Saniye' }
            ]
        },
        {
            key: 'MINUTE',
            symbol: 'min',
            rate: 60,
            isBase: false,
            contents: [
                { language: 'fa', label: 'دقیقه' },
                { language: 'en', label: 'Minute' },
                { language: 'ar', label: 'دقيقة' },
                { language: 'tr', label: 'Dakika' }
            ]
        },
        {
            key: 'HOUR',
            symbol: 'h',
            rate: 3600,
            isBase: false,
            contents: [
                { language: 'fa', label: 'ساعت' },
                { language: 'en', label: 'Hour' },
                { language: 'ar', label: 'ساعة' },
                { language: 'tr', label: 'Saat' }
            ]
        },

        // ==================== واحدهای شیمیایی ====================
        {
            key: 'MOLE',
            symbol: 'mol',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'مول' },
                { language: 'en', label: 'Mole' },
                { language: 'ar', label: 'مول' },
                { language: 'tr', label: 'Mol' }
            ]
        },
        {
            key: 'PERCENT',
            symbol: '%',
            rate: 1,
            isBase: false,
            contents: [
                { language: 'fa', label: 'درصد' },
                { language: 'en', label: 'Percent' },
                { language: 'ar', label: 'بالمئة' },
                { language: 'tr', label: 'Yüzde' }
            ]
        },
        {
            key: 'PPM',
            symbol: 'ppm',
            rate: 1,
            isBase: false,
            contents: [
                { language: 'fa', label: 'پی‌پی‌ام' },
                { language: 'en', label: 'PPM' },
                { language: 'ar', label: 'جزء بالمليون' },
                { language: 'tr', label: 'Milyonda Bir' }
            ]
        },

        // ==================== واحدهای نوری ====================
        {
            key: 'LUMEN',
            symbol: 'lm',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'لومن' },
                { language: 'en', label: 'Lumen' },
                { language: 'ar', label: 'لومن' },
                { language: 'tr', label: 'Lümen' }
            ]
        },
        {
            key: 'LUX',
            symbol: 'lx',
            rate: 1,
            isBase: false,
            contents: [
                { language: 'fa', label: 'لوکس' },
                { language: 'en', label: 'Lux' },
                { language: 'ar', label: 'لوكس' },
                { language: 'tr', label: 'Lüks' }
            ]
        },

        // ==================== واحدهای صوتی ====================
        {
            key: 'DECIBEL',
            symbol: 'dB',
            rate: 1,
            isBase: true,
            contents: [
                { language: 'fa', label: 'دسی‌بل' },
                { language: 'en', label: 'Decibel' },
                { language: 'ar', label: 'ديسيبل' },
                { language: 'tr', label: 'Desibel' }
            ]
        }
    ];

    // ایجاد واحدها
    for (const unitData of technicalUnits) {
        const unit = await prisma.unit.create({
            data: {
                key: unitData.key,
                symbol: unitData.symbol,
                rate: unitData.rate,
                isBase: unitData.isBase,
                contents: {
                    create: unitData.contents
                }
            }
        });

        console.log(`✅ Created unit: ${unit.key} (${unit.symbol})`);
    }

    console.log('🎉 Technical units seeding completed!');
    console.log(`📊 Total units created: ${technicalUnits.length}`);
    console.log('🏭 Covered categories: Length, Area, Volume, Weight, Pressure, Temperature, Speed, Force, Power, Energy, Electrical, Time, Chemical, Optical, Acoustic');
}

// اجرای سید
seedTechnicalUnits()
    .catch((e) => {
        console.error('❌ Error seeding technical units:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });