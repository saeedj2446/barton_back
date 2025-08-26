import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common"
import  { PrismaService } from "../prisma/prisma.service"
import  { AdService } from "../ad/ad.service"
import type { CreateCommentDto } from "./dto/create-comment.dto"
import type { UpdateCommentDto } from "./dto/update-comment.dto"
import { Role } from "@prisma/client"

@Injectable()
export class CommentService {
  constructor(
    private prisma: PrismaService,
    private adService: AdService,
  ) {}

  async create(adId: string, userId: string, createCommentDto: CreateCommentDto) {
    // Verify ad exists
    await this.adService.findById(adId)

    // If replying to a comment, verify parent exists
    if (createCommentDto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: createCommentDto.parentId },
      })

      if (!parentComment) {
        throw new NotFoundException("Parent comment not found")
      }

      if (parentComment.adId !== adId) {
        throw new ForbiddenException("Parent comment does not belong to this ad")
      }
    }

    return this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        isAnswer: createCommentDto.isAnswer || false,
        userId,
        adId,
        parentId: createCommentDto.parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })
  }

  async findByAd(adId: string) {
    return this.prisma.comment.findMany({
      where: {
        adId,
        parentId: null, // Only root comments
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async findById(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        ad: {
          select: {
            id: true,
            title: true,
            profile: {
              select: {
                userId: true,
              },
            },
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })

    if (!comment) {
      throw new NotFoundException("Comment not found")
    }

    return comment
  }

  async update(id: string, userId: string, updateCommentDto: UpdateCommentDto, userRole: Role) {
    const comment = await this.findById(id)
    const isAdmin = userRole === Role.ADMIN

    if (!isAdmin && comment.userId !== userId) {
      throw new ForbiddenException("Access denied")
    }

    return this.prisma.comment.update({
      where: { id },
      data: updateCommentDto,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })
  }

  async remove(id: string, userId: string, userRole: Role) {
    const comment = await this.findById(id)
    const isAdmin = userRole === Role.ADMIN
    const isAdOwner = comment.ad.profile.userId === userId

    if (!isAdmin && comment.userId !== userId && !isAdOwner) {
      throw new ForbiddenException("Access denied")
    }

    return this.prisma.comment.delete({
      where: { id },
    })
  }
}
