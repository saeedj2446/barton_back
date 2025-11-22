// src/common/services/excel-service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { Language } from '@prisma/client';
import * as stream from 'stream';

export interface ExcelColumn {
    key: string;
    title: string;
    width?: number;
    type?: 'string' | 'number' | 'date' | 'boolean' | 'currency';
    format?: string;
    required?: boolean;
    validation?: {
        type: 'list' | 'number' | 'date' | 'custom';
        values?: string[];
        min?: number;
        max?: number;
        formula?: string;
    };
}

export interface ExportConfig {
    filename: string;
    sheetName: string;
    columns: ExcelColumn[];
    data: any[];
    language: Language;
    withValidation?: boolean;
    withFilters?: boolean;
    withStyles?: boolean;
}

export interface ImportConfig {
    columns: ExcelColumn[];
    requiredFields?: string[];
    maxRows?: number;
    validateData?: boolean;
}

export interface ImportResult {
    success: boolean;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    data: any[];
    errors: {
        row: number;
        field: string;
        error: string;
    }[];
    summary: {
        imported: number;
        updated: number;
        skipped: number;
    };
}

@Injectable()
export class ExcelService {

    // ==================== EXPORT METHODS ====================

    async generateExcelFile(config: ExportConfig): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(config.sheetName);

        // تنظیمات اولیه worksheet
        this.setupWorksheet(worksheet, config);

        // اضافه کردن هدر
        this.addHeaderRow(worksheet, config);

        // اضافه کردن داده‌ها
        this.addDataRows(worksheet, config);

        // اضافه کردن اعتبارسنجی اگر نیاز باشد
        if (config.withValidation) {
            this.addDataValidation(worksheet, config);
        }

        // اضافه کردن فیلترها
        if (config.withFilters) {
            worksheet.autoFilter = {
                from: 'A1',
                to: `${this.getExcelColumn(config.columns.length)}1`
            };
        }

        // اضافه کردن استایل‌ها
        if (config.withStyles) {
            this.applyStyles(worksheet, config);
        }

        // بازگرداندن بافر - راه حل کامل
        try {
            const excelBuffer = await workbook.xlsx.writeBuffer();

            // تبدیل به Node.js Buffer استاندارد
            if (excelBuffer instanceof Buffer) {
                return excelBuffer;
            } else if (excelBuffer instanceof Uint8Array) {
                return Buffer.from(excelBuffer);
            } else if (ArrayBuffer.isView(excelBuffer)) {
                return Buffer.from(excelBuffer.buffer);
            } else {
                // برای انواع دیگر
                return Buffer.from(excelBuffer as any);
            }
        } catch (error) {
            throw new Error(`خطا در تولید فایل Excel: ${error.message}`);
        }
    }

    async exportToResponse(config: ExportConfig, response: Response): Promise<void> {
        const buffer = await this.generateExcelFile(config);

        response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        response.setHeader('Content-Disposition', `attachment; filename=${config.filename}.xlsx`);
        response.setHeader('Content-Length', buffer.length);

        response.send(buffer);
    }

    async createProductTemplate(language: Language = Language.fa): Promise<Buffer> {
        const columns: ExcelColumn[] = [
            {
                key: 'name',
                title: this.getTranslation('name', language),
                width: 30,
                type: 'string',
                required: true
            },
            {
                key: 'brand_name',
                title: this.getTranslation('brand_name', language),
                width: 20,
                type: 'string'
            },
            {
                key: 'description',
                title: this.getTranslation('description', language),
                width: 40,
                type: 'string'
            },
            {
                key: 'category_name',
                title: this.getTranslation('category', language),
                width: 20,
                type: 'string',
                required: true
            },
            {
                key: 'base_price',
                title: this.getTranslation('base_price', language),
                width: 15,
                type: 'currency',
                format: '#,##0',
                required: true,
                validation: {
                    type: 'number',
                    min: 0
                }
            },
            {
                key: 'stock',
                title: this.getTranslation('stock', language),
                width: 12,
                type: 'number',
                validation: {
                    type: 'number',
                    min: 0
                }
            },
            {
                key: 'min_sale_amount',
                title: this.getTranslation('min_sale_amount', language),
                width: 15,
                type: 'number',
                validation: {
                    type: 'number',
                    min: 1
                }
            },
            {
                key: 'unit',
                title: this.getTranslation('unit', language),
                width: 15,
                type: 'string',
                validation: {
                    type: 'list',
                    values: ['PIECE', 'KILOGRAM', 'METER', 'LITER', 'PACKAGE', 'BOX']
                }
            },
            {
                key: 'tags',
                title: this.getTranslation('tags', language),
                width: 25,
                type: 'string'
            },
            {
                key: 'address',
                title: this.getTranslation('address', language),
                width: 30,
                type: 'string'
            }
        ];

        const config: ExportConfig = {
            filename: 'product-import-template',
            sheetName: this.getTranslation('products', language),
            columns,
            data: [],
            language,
            withValidation: true,
            withStyles: true
        };

        return this.generateExcelFile(config);
    }

    async createPriceUpdateTemplate(productData: any[], language: Language = Language.fa): Promise<Buffer> {
        const columns: ExcelColumn[] = [
            {
                key: 'product_id',
                title: this.getTranslation('product_id', language),
                width: 15,
                type: 'string',
                required: true
            },
            {
                key: 'name',
                title: this.getTranslation('name', language),
                width: 30,
                type: 'string'
            },
            {
                key: 'current_price',
                title: this.getTranslation('current_price', language),
                width: 15,
                type: 'currency',
                format: '#,##0'
            },
            {
                key: 'new_price',
                title: this.getTranslation('new_price', language),
                width: 15,
                type: 'currency',
                format: '#,##0',
                required: true,
                validation: {
                    type: 'number',
                    min: 0
                }
            },
            {
                key: 'price_unit',
                title: this.getTranslation('price_unit', language),
                width: 12,
                type: 'string'
            },
            {
                key: 'change_reason',
                title: this.getTranslation('change_reason', language),
                width: 25,
                type: 'string',
                validation: {
                    type: 'list',
                    values: [
                        this.getTranslation('market_change', language),
                        this.getTranslation('cost_change', language),
                        this.getTranslation('promotion', language),
                        this.getTranslation('seasonal', language)
                    ]
                }
            },
            {
                key: 'effective_date',
                title: this.getTranslation('effective_date', language),
                width: 15,
                type: 'date',
                format: 'yyyy-mm-dd'
            }
        ];

        const data = productData.map(product => ({
            product_id: product.id,
            name: product.name,
            current_price: product.current_price,
            new_price: '',
            price_unit: product.price_unit,
            change_reason: '',
            effective_date: new Date().toISOString().split('T')[0]
        }));

        const config: ExportConfig = {
            filename: 'price-update-template',
            sheetName: this.getTranslation('price_update', language),
            columns,
            data,
            language,
            withValidation: true,
            withStyles: true
        };

        return this.generateExcelFile(config);
    }

    // ==================== IMPORT METHODS ====================

    async importFromExcel(
        fileBuffer: Buffer,
        config: ImportConfig
    ): Promise<ImportResult> {
        const workbook = new ExcelJS.Workbook();

        // راه حل قطعی - استفاده از any
        await workbook.xlsx.load(fileBuffer as any);

        const worksheet = workbook.worksheets[0];
        const result: ImportResult = {
            success: false,
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            data: [],
            errors: [],
            summary: {
                imported: 0,
                updated: 0,
                skipped: 0
            }
        };

        try {
            // خواندن هدر
            const headerRow = worksheet.getRow(1);
            const headers = this.parseHeaders(headerRow, config);

            // خواندن داده‌ها
            result.totalRows = worksheet.rowCount - 1;

            for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
                if (config.maxRows && rowNum > config.maxRows + 1) break;

                const row = worksheet.getRow(rowNum);
                const rowData = this.parseRowData(row, headers, config.columns);

                // اعتبارسنجی
                const validationErrors = this.validateRowData(rowData, config, rowNum);

                if (validationErrors.length > 0) {
                    result.invalidRows++;
                    result.errors.push(...validationErrors);
                } else {
                    result.validRows++;
                    result.data.push(rowData);
                }
            }

            result.success = result.validRows > 0;

        } catch (error) {
            result.errors.push({
                row: 0,
                field: 'file',
                error: `خطا در خواندن فایل: ${error.message}`
            });
        }

        return result;
    }

// متد کمکی برای بررسی ردیف خالی
    private isRowEmpty(row: ExcelJS.Row): boolean {
        let isEmpty = true;
        row.eachCell((cell) => {
            if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
                isEmpty = false;
            }
        });
        return isEmpty;
    }

    async importProducts(fileBuffer: Buffer, language: Language = Language.fa): Promise<ImportResult> {
        const config: ImportConfig = {
            columns: [
                { key: 'name', title: 'name', type: 'string', required: true },
                { key: 'brand_name', title: 'brand_name', type: 'string' },
                { key: 'description', title: 'description', type: 'string' },
                { key: 'category_name', title: 'category_name', type: 'string', required: true },
                { key: 'base_price', title: 'base_price', type: 'number', required: true },
                { key: 'stock', title: 'stock', type: 'number' },
                { key: 'min_sale_amount', title: 'min_sale_amount', type: 'number' },
                { key: 'unit', title: 'unit', type: 'string' },
                { key: 'tags', title: 'tags', type: 'string' },
                { key: 'address', title: 'address', type: 'string' }
            ],
            requiredFields: ['name', 'category_name', 'base_price'],
            maxRows: 1000,
            validateData: true
        };

        const result = await this.importFromExcel(fileBuffer, config);

        // اعتبارسنجی اضافی برای محصولات
        result.data.forEach((row, index) => {
            if (row.base_price && row.base_price < 0) {
                result.errors.push({
                    row: index + 2,
                    field: 'base_price',
                    error: 'قیمت نمی‌تواند منفی باشد'
                });
            }

            if (row.stock && row.stock < 0) {
                result.errors.push({
                    row: index + 2,
                    field: 'stock',
                    error: 'موجودی نمی‌تواند منفی باشد'
                });
            }
        });

        return result;
    }

    async importPriceUpdates(fileBuffer: Buffer, language: Language = Language.fa): Promise<ImportResult> {
        const config: ImportConfig = {
            columns: [
                { key: 'product_id', title: 'product_id', type: 'string', required: true },
                { key: 'new_price', title: 'new_price', type: 'number', required: true },
                { key: 'change_reason', title: 'change_reason', type: 'string' },
                { key: 'effective_date', title: 'effective_date', type: 'date' }
            ],
            requiredFields: ['product_id', 'new_price'],
            maxRows: 500,
            validateData: true
        };

        const result = await this.importFromExcel(fileBuffer, config);

        // اعتبارسنجی اضافی برای قیمت‌ها
        result.data.forEach((row, index) => {
            if (row.new_price && row.new_price < 0) {
                result.errors.push({
                    row: index + 2,
                    field: 'new_price',
                    error: 'قیمت جدید نمی‌تواند منفی باشد'
                });
            }

            if (row.effective_date && new Date(row.effective_date) < new Date()) {
                result.errors.push({
                    row: index + 2,
                    field: 'effective_date',
                    error: 'تاریخ اثر نمی‌تواند در گذشته باشد'
                });
            }
        });

        return result;
    }

    // ==================== UTILITY METHODS ====================

    private setupWorksheet(worksheet: ExcelJS.Worksheet, config: ExportConfig): void {
        // تنظیم جهت راست به چپ برای زبان فارسی
        worksheet.views = [
            {
                state: 'normal',
                rightToLeft: config.language === Language.fa
            }
        ];

        // تنظیم عرض ستون‌ها
        config.columns.forEach((column, index) => {
            worksheet.getColumn(index + 1).width = column.width || 15;
        });
    }

    private addHeaderRow(worksheet: ExcelJS.Worksheet, config: ExportConfig): void {
        const headerRow = worksheet.getRow(1);

        config.columns.forEach((column, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = column.title;
            cell.style = {
                font: { bold: true, size: 12 },
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE6E6FA' }
                },
                border: {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                },
                alignment: {
                    vertical: 'middle',
                    horizontal: 'center'
                }
            };
        });

        headerRow.commit();
    }

    private addDataRows(worksheet: ExcelJS.Worksheet, config: ExportConfig): void {
        config.data.forEach((rowData, rowIndex) => {
            const row = worksheet.getRow(rowIndex + 2);

            config.columns.forEach((column, colIndex) => {
                const cell = row.getCell(colIndex + 1);
                const value = rowData[column.key];

                cell.value = this.formatCellValue(value, column.type);

                // اعمال فرمت عددی برای ارز
                if (column.type === 'currency' && typeof value === 'number') {
                    cell.numFmt = column.format || '#,##0';
                }

                // اعمال فرمت تاریخ
                if (column.type === 'date' && value) {
                    cell.numFmt = 'yyyy-mm-dd';
                }
            });

            row.commit();
        });
    }

    private addDataValidation(worksheet: ExcelJS.Worksheet, config: ExportConfig): void {
        config.columns.forEach((column, colIndex) => {
            if (column.validation) {
                const colLetter = this.getExcelColumn(colIndex + 1);
                const startRow = 2;
                const endRow = config.data.length + 1;

                for (let row = startRow; row <= endRow; row++) {
                    const cell = worksheet.getCell(`${colLetter}${row}`);

                    switch (column.validation.type) {
                        case 'list':
                            if (column.validation.values) {
                                cell.dataValidation = {
                                    type: 'list',
                                    formulae: [`"${column.validation.values.join(',')}"`],
                                    allowBlank: true,
                                    showErrorMessage: true,
                                    errorTitle: 'مقدار نامعتبر',
                                    error: 'لطفاً یکی از مقادیر مجاز را انتخاب کنید'
                                };
                            }
                            break;

                        case 'number':
                            cell.dataValidation = {
                                type: 'decimal',
                                operator: 'between',
                                formulae: [
                                    column.validation.min?.toString() || '0',
                                    column.validation.max?.toString() || '1000000000'
                                ],
                                allowBlank: true,
                                showErrorMessage: true
                            };
                            break;
                    }
                }
            }
        });
    }

    private applyStyles(worksheet: ExcelJS.Worksheet, config: ExportConfig): void {
        // استایل‌دهی به تمام سلول‌های داده
        for (let rowNum = 2; rowNum <= config.data.length + 1; rowNum++) {
            const row = worksheet.getRow(rowNum);

            row.eachCell((cell) => {
                cell.style = {
                    border: {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    },
                    alignment: {
                        vertical: 'middle',
                        horizontal: config.language === Language.fa ? 'right' : 'left'
                    }
                };
            });
        }
    }

    private parseHeaders(headerRow: ExcelJS.Row, config: ImportConfig): Map<string, number> {
        const headerMap = new Map<string, number>();

        headerRow.eachCell((cell, colNumber) => {
            if (cell.value) {
                const column = config.columns.find(col =>
                    col.title === cell.value.toString().trim()
                );
                if (column) {
                    headerMap.set(column.key, colNumber);
                }
            }
        });

        // بررسی فیلدهای اجباری
        const missingHeaders = config.requiredFields?.filter(field =>
            !Array.from(headerMap.keys()).includes(field)
        );

        if (missingHeaders && missingHeaders.length > 0) {
            throw new BadRequestException(
                `ستون‌های اجباری یافت نشد: ${missingHeaders.join(', ')}`
            );
        }

        return headerMap;
    }

    private parseRowData(
        row: ExcelJS.Row,
        headers: Map<string, number>,
        columns: ExcelColumn[]
    ): any {
        const rowData: any = {};

        columns.forEach(column => {
            const colNumber = headers.get(column.key);
            if (colNumber) {
                const cell = row.getCell(colNumber);
                rowData[column.key] = this.parseCellValue(cell, column.type);
            }
        });

        return rowData;
    }

    private validateRowData(
        rowData: any,
        config: ImportConfig,
        rowNum: number
    ): { row: number; field: string; error: string }[] {
        const errors: { row: number; field: string; error: string }[] = [];

        config.columns.forEach(column => {
            const value = rowData[column.key];

            // بررسی فیلدهای اجباری
            if (column.required && (value === undefined || value === null || value === '')) {
                errors.push({
                    row: rowNum,
                    field: column.key,
                    error: `${column.title} اجباری است`
                });
            }

            // اعتبارسنجی نوع داده
            if (value !== undefined && value !== null && value !== '') {
                switch (column.type) {
                    case 'number':
                        if (isNaN(Number(value))) {
                            errors.push({
                                row: rowNum,
                                field: column.key,
                                error: `${column.title} باید عددی باشد`
                            });
                        }
                        break;

                    case 'date':
                        if (isNaN(Date.parse(value))) {
                            errors.push({
                                row: rowNum,
                                field: column.key,
                                error: `${column.title} فرمت تاریخ نامعتبر است`
                            });
                        }
                        break;
                }
            }
        });

        return errors;
    }

    private formatCellValue(value: any, type?: string): any {
        if (value === undefined || value === null) return '';

        switch (type) {
            case 'date':
                return value instanceof Date ? value : new Date(value);
            case 'number':
                return Number(value);
            case 'boolean':
                return Boolean(value);
            default:
                return String(value);
        }
    }

    private parseCellValue(cell: ExcelJS.Cell, type?: string): any {
        if (!cell.value) return null;

        const value = cell.value;

        switch (type) {
            case 'number':
                return Number(value);
            case 'date':
                // راه حل ایمن برای تاریخ
                if (value instanceof Date) {
                    return value;
                } else if (typeof value === 'string' || typeof value === 'number') {
                    return new Date(value);
                } else {
                    return null;
                }
            case 'boolean':
                return Boolean(value);
            default:
                return String(value).trim();
        }
    }

    private getExcelColumn(number: number): string {
        let column = '';
        while (number > 0) {
            const remainder = (number - 1) % 26;
            column = String.fromCharCode(65 + remainder) + column;
            number = Math.floor((number - 1) / 26);
        }
        return column;
    }

    private getTranslation(key: string, language: Language): string {
        const translations = {
            name: { fa: 'نام محصول', en: 'Product Name' },
            brand_name: { fa: 'نام برند', en: 'Brand Name' },
            description: { fa: 'توضیحات', en: 'Description' },
            category: { fa: 'دسته‌بندی', en: 'Category' },
            base_price: { fa: 'قیمت پایه', en: 'Base Price' },
            stock: { fa: 'موجودی', en: 'Stock' },
            min_sale_amount: { fa: 'حداقل فروش', en: 'Min Sale Amount' },
            unit: { fa: 'واحد', en: 'Unit' },
            tags: { fa: 'تگ‌ها', en: 'Tags' },
            address: { fa: 'آدرس', en: 'Address' },
            products: { fa: 'محصولات', en: 'Products' },
            product_id: { fa: 'شناسه محصول', en: 'Product ID' },
            current_price: { fa: 'قیمت فعلی', en: 'Current Price' },
            new_price: { fa: 'قیمت جدید', en: 'New Price' },
            price_unit: { fa: 'واحد قیمت', en: 'Price Unit' },
            change_reason: { fa: 'دلیل تغییر', en: 'Change Reason' },
            effective_date: { fa: 'تاریخ اثر', en: 'Effective Date' },
            price_update: { fa: 'بروزرسانی قیمت', en: 'Price Update' },
            market_change: { fa: 'تغییر بازار', en: 'Market Change' },
            cost_change: { fa: 'تغییر هزینه', en: 'Cost Change' },
            promotion: { fa: 'پروموشن', en: 'Promotion' },
            seasonal: { fa: 'فصلی', en: 'Seasonal' }
        };

        return translations[key]?.[language] || key;
    }
}