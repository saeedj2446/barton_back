import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger"
import  { AdService } from "./ad.service"
import  { CreateAdDto } from "./dto/create-ad.dto"
import  { UpdateAdDto } from "./dto/update-ad.dto"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { Public } from "../common/decorators/public.decorator"

@ApiTags("Ads")
@Controller("ads")
export class AdController {
  constructor(private readonly adService: AdService) {}

  @Post(":profileId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create ad for profile" })
  @ApiResponse({ status: 201, description: "Ad created successfully" })
  create(@Param('profileId') profileId: string, @Body() createAdDto: CreateAdDto, @CurrentUser() user: any) {
    const isAdmin = user.role === "ADMIN"
    return this.adService.create(profileId, user.id, createAdDto, isAdmin)
  }

  @Get()
  @Public()
  @ApiOperation({ summary: "Get all ads with pagination and filters" })
  @ApiResponse({ status: 200, description: "Ads retrieved successfully" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "category", required: false, type: String })
  @ApiQuery({ name: "location", required: false, type: String })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('location') location?: string,
  ) {
    const pageNum = page ? Number.parseInt(page, 10) : 1
    const limitNum = limit ? Number.parseInt(limit, 10) : 10
    return this.adService.findAll(pageNum, limitNum, category, location)
  }

  @Get('profile/:profileId')
  @Public()
  @ApiOperation({ summary: 'Get ads by profile' })
  @ApiResponse({ status: 200, description: 'Profile ads retrieved successfully' })
  findByProfile(@Param('profileId') profileId: string) {
    return this.adService.findByProfile(profileId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get ad by ID' })
  @ApiResponse({ status: 200, description: 'Ad retrieved successfully' })
  findOne(@Param('id') id: string) {
    return this.adService.findById(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update ad" })
  @ApiResponse({ status: 200, description: "Ad updated successfully" })
  update(@Param('id') id: string, @Body() updateAdDto: UpdateAdDto, @CurrentUser() user: any) {
    return this.adService.update(id, user.id, updateAdDto, user.role)
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete ad" })
  @ApiResponse({ status: 200, description: "Ad deleted successfully" })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.adService.remove(id, user.id, user.role)
  }
}
