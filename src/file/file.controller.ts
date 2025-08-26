import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
  Res,
  BadRequestException,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from "@nestjs/swagger"
import type { FastifyReply } from "fastify"
import  { FileService } from "./file.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { RolesGuard } from "../common/guards/roles.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { Role } from "@prisma/client"
import type { Express } from "express"

@ApiTags("Files")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("files")
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload file" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, description: "File uploaded successfully" })
  async uploadFile(
    file: Express.Multer.File,
    @Query('entityType') entityType: 'user' | 'profile' | 'ad',
    @Query('entityId') entityId: string,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException("No file provided")
    }

    if (!entityType || !["user", "profile", "ad"].includes(entityType)) {
      throw new BadRequestException("Invalid entity type")
    }

    return this.fileService.uploadFile(file, user.id, entityType, entityId)
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get all files (Admin only)" })
  @ApiResponse({ status: 200, description: "Files retrieved successfully" })
  findAll() {
    return this.fileService.findAll()
  }

  @Get("entity/:entityType/:entityId")
  @ApiOperation({ summary: "Get files by entity" })
  @ApiResponse({ status: 200, description: "Entity files retrieved successfully" })
  findByEntity(@Param('entityType') entityType: 'user' | 'profile' | 'ad', @Param('entityId') entityId: string) {
    return this.fileService.findByEntity(entityType, entityId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file by ID' })
  @ApiResponse({ status: 200, description: 'File retrieved successfully' })
  findOne(@Param('id') id: string) {
    return this.fileService.findById(id);
  }

  @Get(":id/download")
  @ApiOperation({ summary: "Download file" })
  @ApiResponse({ status: 200, description: "File downloaded successfully" })
  async downloadFile(@Param('id') id: string, @Res() res: FastifyReply) {
    const { file, buffer } = await this.fileService.downloadFile(id)

    res.header("Content-Type", file.mimetype)
    res.header("Content-Disposition", `attachment; filename="${file.originalName}"`)
    res.send(buffer)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete file" })
  @ApiResponse({ status: 200, description: "File deleted successfully" })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.fileService.remove(id, user.id, user.role)
  }
}
