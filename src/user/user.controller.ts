import { Controller, Get, Post, Patch, Param, Delete, UseGuards, ForbiddenException } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"


import type { UpdateUserDto } from "./dto/update-user.dto"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { RolesGuard } from "../common/guards/roles.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { Role } from "@prisma/client"
import {UserService} from "./user.service";
import {CreateUserDto} from "./dto/create-user.dto";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Create user (Admin only)" })
  @ApiResponse({ status: 201, description: "User created successfully" })
  create(createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto)
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get all users (Admin only)" })
  @ApiResponse({ status: 200, description: "Users retrieved successfully" })
  findAll() {
    return this.userService.findAll()
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  getProfile(@CurrentUser() user: any) {
    return this.userService.findById(user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  @ApiResponse({ status: 200, description: "User retrieved successfully" })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.role !== Role.ADMIN && user.id !== id) {
      throw new ForbiddenException("Access denied")
    }
    return this.userService.findById(id)
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update user" })
  @ApiResponse({ status: 200, description: "User updated successfully" })
  update(@Param('id') id: string, updateUserDto: UpdateUserDto, @CurrentUser() user: any) {
    if (user.role !== Role.ADMIN && user.id !== id) {
      throw new ForbiddenException("Access denied")
    }
    return this.userService.update(id, updateUserDto)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete user" })
  @ApiResponse({ status: 200, description: "User deleted successfully" })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.role !== Role.ADMIN && user.id !== id) {
      throw new ForbiddenException("Access denied")
    }
    return this.userService.remove(id)
  }
}
