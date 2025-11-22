// src/interactions/admin-interactions.controller.ts
import {Controller, Get, Delete, Param, Query, UseGuards, Inject} from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { InteractionQueryDto } from './dto/interaction-query.dto';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { SystemRole, Language } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LanguageHeader } from "../common/decorators/language.decorator";
import {PrismaService} from "../prisma/prisma.service";

@ApiTags('Admin - Interactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/interactions')
export class AdminInteractionsController {

    constructor(
        private readonly interactionsService: InteractionsService,
        @Inject(PrismaService) private prisma: PrismaService
    ) {}
    @Get()
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({ summary: 'دریافت تمام تعاملات (ادمین)' })
    findAll(
        @Query() query: InteractionQueryDto,
        @LanguageHeader() language: Language
    ) {
        return this.interactionsService.findAll({ ...query, language });
    }

    @Delete(':id')
    @Roles(SystemRole.ADMIN)
    @ApiOperation({ summary: 'حذف تعامل (ادمین)' })
    remove(@Param('id') id: string) {
        return this.interactionsService.remove(id, null);
    }

    @Get('stats/overview')
    @Roles(SystemRole.ADMIN, SystemRole.MODERATOR)
    @ApiOperation({ summary: 'آمار کلی تعاملات' })
    async getStats(@Query('days') days: number = 30) {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const [totalInteractions, interactionsByType, recentActivity] = await Promise.all([
            this.prisma.interaction.count({
                where: { created_at: { gte: sinceDate } }
            }),
            this.prisma.interaction.groupBy({
                by: ['type'],
                where: { created_at: { gte: sinceDate } },
                _count: true
            }),
            this.prisma.interaction.groupBy({
                by: ['created_at'],
                where: { created_at: { gte: sinceDate } },
                _count: true,
                orderBy: { created_at: 'desc' },
                take: 30
            })
        ]);

        return {
            period: `${days} روز گذشته`,
            totalInteractions,
            interactionsByType,
            recentActivity,
            averagePerDay: totalInteractions / days
        };
    }
}