import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common"
import  { PrismaService } from "../prisma/prisma.service"
import  { ProfileService } from "../profile/profile.service"
import  { CreateAdDto } from "./dto/create-ad.dto"
import  { UpdateAdDto } from "./dto/update-ad.dto"
import { Role } from "@prisma/client"

@Injectable()
export class AdService {
  constructor(
    private prisma: PrismaService,
    private profileService: ProfileService,
  ) {}

  async create(profileId: string, userId: string, createAdDto: CreateAdDto, isAdmin = false) {
    const profile = await this.profileService.findById(profileId)

    if (!isAdmin && profile.userId !== userId) {
      throw new ForbiddenException("Access denied")
    }

    return this.prisma.ad.create({
      data: {
        ...createAdDto,
        profileId,
      },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            comments: true,
            files: true,
          },
        },
      },
    })
  }

  async findAll(page = 1, limit = 10, category?: string, location?: string) {
    const skip = (page - 1) * limit
    const where: any = { isActive: true }

    if (category) {
      where.category = { contains: category, mode: "insensitive" }
    }

    if (location) {
      where.location = { contains: location, mode: "insensitive" }
    }

    const [ads, total] = await Promise.all([
      this.prisma.ad.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          profile: {
            select: {
              id: true,
              name: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              files: true,
            },
          },
        },
      }),
      this.prisma.ad.count({ where }),
    ])

    return {
      ads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  async findByProfile(profileId: string) {
    return this.prisma.ad.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            comments: true,
            files: true,
          },
        },
      },
    })
  }

  async findById(id: string) {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            website: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        comments: {
          where: { parentId: null },
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
          orderBy: { createdAt: "desc" },
        },
        files: true,
        _count: {
          select: {
            comments: true,
            files: true,
          },
        },
      },
    })

    if (!ad) {
      throw new NotFoundException("Ad not found")
    }

    return ad
  }

  async update(id: string, userId: string, updateAdDto: UpdateAdDto, userRole: Role) {
    const ad = await this.findById(id)
    const isAdmin = userRole === Role.ADMIN

    if (!isAdmin && ad.profile.user.id !== userId) {
      throw new ForbiddenException("Access denied")
    }

    return this.prisma.ad.update({
      where: { id },
      data: updateAdDto,
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            comments: true,
            files: true,
          },
        },
      },
    })
  }

  async remove(id: string, userId: string, userRole: Role) {
    const ad = await this.findById(id)
    const isAdmin = userRole === Role.ADMIN

    if (!isAdmin && ad.profile.user.id !== userId) {
      throw new ForbiddenException("Access denied")
    }

    return this.prisma.ad.delete({
      where: { id },
    })
  }
}
