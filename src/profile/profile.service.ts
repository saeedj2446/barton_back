import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common"
import  { PrismaService } from "../prisma/prisma.service"
import  { CreateProfileDto } from "./dto/create-profile.dto"
import  { UpdateProfileDto } from "./dto/update-profile.dto"

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createProfileDto: CreateProfileDto) {
    return this.prisma.profile.create({
      data: {
        ...createProfileDto,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            ads: true,
          },
        },
      },
    })
  }

  async findAll() {
    return this.prisma.profile.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            ads: true,
          },
        },
      },
    })
  }

  async findByUser(userId: string) {
    return this.prisma.profile.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            ads: true,
          },
        },
      },
    })
  }

  async findById(id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            ads: true,
          },
        },
      },
    })

    if (!profile) {
      throw new NotFoundException("Profile not found")
    }

    return profile
  }

  async update(id: string, userId: string, updateProfileDto: UpdateProfileDto, isAdmin = false) {
    const profile = await this.findById(id)

    if (!isAdmin && profile.userId !== userId) {
      throw new ForbiddenException("Access denied")
    }

    return this.prisma.profile.update({
      where: { id },
      data: updateProfileDto,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            ads: true,
          },
        },
      },
    })
  }

  async remove(id: string, userId: string, isAdmin = false) {
    const profile = await this.findById(id)

    if (!isAdmin && profile.userId !== userId) {
      throw new ForbiddenException("Access denied")
    }

    return this.prisma.profile.delete({
      where: { id },
    })
  }
}
