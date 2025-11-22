import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '@prisma/client';

@ApiTags('User - Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cart')
export class CartUserController {
    constructor(private readonly cartService: CartService) {}

    @Get()
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'دریافت سبد خرید' })
    async getCart(@Request() req) {
        return this.cartService.getCart(req.user.id);
    }

    @Post('items')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'افزودن به سبد خرید' })
    async addToCart(@Request() req, @Body() addToCartDto: AddToCartDto) {
        return this.cartService.addToCart(addToCartDto, req.user.id);
    }

    @Patch('items/:id')
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'بروزرسانی آیتم سبد خرید' })
    async updateCartItem(
        @Request() req,
        @Param('id') id: string,
        @Body() updateDto: UpdateCartItemDto,
    ) {
        return this.cartService.updateCartItem(id, updateDto, req.user.id);
    }

    @Delete('items/:id')
    @HttpCode(HttpStatus.OK)
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'حذف از سبد خرید' })
    async removeFromCart(@Request() req, @Param('id') id: string) {
        return this.cartService.removeFromCart(id, req.user.id);
    }

    @Delete()
    @HttpCode(HttpStatus.OK)
    @Roles(SystemRole.USER, SystemRole.ADMIN, SystemRole.MODERATOR, SystemRole.OPERATOR)
    @ApiOperation({ summary: 'خالی کردن سبد خرید' })
    async clearCart(@Request() req) {
        return this.cartService.clearCart(req.user.id);
    }
}