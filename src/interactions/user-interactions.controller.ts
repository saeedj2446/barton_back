// src/interactions/user-interactions.controller.ts
import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { InteractionQueryDto } from './dto/interaction-query.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { LanguageHeader } from "../common/decorators/language.decorator";
import { Language, InteractionType } from '@prisma/client';

@ApiTags('User - Interactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user/interactions')
export class UserInteractionsController {
    constructor(private readonly interactionsService: InteractionsService) {}

    @Post()
    @ApiOperation({ summary: 'ثبت تعامل جدید (لایک، ذخیره، مشاهده)' })
    create(
        @Body() createInteractionDto: CreateInteractionDto,
        @Req() req: any,
        @LanguageHeader() language: Language
    ) {
        return this.interactionsService.create(createInteractionDto, req.user.id, language);
    }

    @Get()
    @ApiOperation({ summary: 'دریافت تعاملات کاربر' })
    findAll(
        @Query() query: InteractionQueryDto,
        @Req() req: any,
        @LanguageHeader() language: Language
    ) {
        return this.interactionsService.findAll({ ...query, user_id: req.user.id, language });
    }

    @Get('my')
    @ApiOperation({ summary: 'دریافت تعاملات کاربر با جزئیات کامل' })
    getMyInteractions(
        @Query('type') type: InteractionType,
        @Req() req: any,
        @LanguageHeader() language: Language
    ) {
        return this.interactionsService.getUserInteractions(req.user.id, type, language);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'حذف تعامل' })
    remove(@Param('id') id: string, @Req() req: any) {
        return this.interactionsService.remove(id, req.user.id);
    }
}