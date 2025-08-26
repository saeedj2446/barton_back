import { Injectable, NotFoundException, ConflictException } from "@nestjs/common"
import  { PrismaService } from "../prisma/prisma.service"
import type { CreateUserDto } from "./dto/create-user.dto"
import type { UpdateUserDto } from "./dto/update-user.dto"
import * as bcrypt from "bcryptjs"

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    })

    if (existingUser) {
      throw new ConflictException("User with this email already exists")
    }

    return this.prisma.user.create({
      data: createUserDto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        password: true,
      },
    })
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            profiles: true,
          },
        },
      },
    })
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      throw new NotFoundException("User not found")
    }

    return user
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    })
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findById(id)

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10)
    }

    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async remove(id: string) {
    await this.findById(id)
    return this.prisma.user.delete({
      where: { id },
    })
  }
}
