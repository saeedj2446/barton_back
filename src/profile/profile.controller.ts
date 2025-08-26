import { Controller, Get, Post, Patch, Param, Delete, UseGuards } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import  { ProfileService } from "./profile.service"
import  { CreateProfileDto } from "./dto/create-profile.dto"
import  { UpdateProfileDto } from "./dto/update-profile.dto"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { RolesGuard } from "../common/guards/roles.guard"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { Role } from "@prisma/client"

@ApiTags("Profiles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("profiles")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post()
  @ApiOperation({ summary: "Create profile" })
  @ApiResponse({ status: 201, description: "Profile created successfully" })
  create(createProfileDto: CreateProfileDto, @CurrentUser() user: any) {
    return this.profileService.create(user.id, createProfileDto)
  }

  @Get()
  @ApiOperation({ summary: "Get all profiles" })
  @ApiResponse({ status: 200, description: "Profiles retrieved successfully" })
  findAll() {
    return this.profileService.findAll()
  }

  @Get('my-profiles')
  @ApiOperation({ summary: 'Get current user profiles' })
  @ApiResponse({ status: 200, description: 'User profiles retrieved successfully' })
  findMyProfiles(@CurrentUser() user: any) {
    return this.profileService.findByUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get profile by ID' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  findOne(@Param('id') id: string) {
    return this.profileService.findById(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update profile" })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  update(@Param('id') id: string, updateProfileDto: UpdateProfileDto, @CurrentUser() user: any) {
    const isAdmin = user.role === Role.ADMIN
    return this.profileService.update(id, user.id, updateProfileDto, isAdmin)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete profile" })
  @ApiResponse({ status: 200, description: "Profile deleted successfully" })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user.role === Role.ADMIN
    return this.profileService.remove(id, user.id, isAdmin)
  }
}
