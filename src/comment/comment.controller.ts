import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger"
import  { CommentService } from "./comment.service"
import type { CreateCommentDto } from "./dto/create-comment.dto"
import type { UpdateCommentDto } from "./dto/update-comment.dto"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { Public } from "../common/decorators/public.decorator"

@ApiTags("Comments")
@Controller("comments")
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post("ad/:adId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create comment for ad" })
  @ApiResponse({ status: 201, description: "Comment created successfully" })
  create(adId: string, @Body() createCommentDto: CreateCommentDto, @CurrentUser() user: any) {
    return this.commentService.create(adId, user.id, createCommentDto)
  }

  @Get("ad/:adId")
  @Public()
  @ApiOperation({ summary: "Get comments by ad" })
  @ApiResponse({ status: 200, description: "Comments retrieved successfully" })
  findByAd(adId: string) {
    return this.commentService.findByAd(adId)
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get comment by ID' })
  @ApiResponse({ status: 200, description: 'Comment retrieved successfully' })
  findOne(@Param('id') id: string) {
    return this.commentService.findById(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update comment" })
  @ApiResponse({ status: 200, description: "Comment updated successfully" })
  update(@Param('id') id: string, @Body() updateCommentDto: UpdateCommentDto, @CurrentUser() user: any) {
    return this.commentService.update(id, user.id, updateCommentDto, user.role)
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete comment" })
  @ApiResponse({ status: 200, description: "Comment deleted successfully" })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.commentService.remove(id, user.id, user.role)
  }
}
