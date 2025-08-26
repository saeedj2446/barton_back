import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common"
import  { PrismaService } from "../prisma/prisma.service"
import { FileType, Role } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { v4 as uuidv4 } from "uuid"
import type { Express } from "express"

@Injectable()
export class FileService {
  constructor(private prisma: PrismaService) {}

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    entityType: "user" | "profile" | "ad",
    entityId?: string,
  ) {
    const uploadDir = process.env.UPLOAD_PATH || "./uploads"

    // Create upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname)
    const filename = `${uuidv4()}${fileExtension}`
    const filePath = path.join(uploadDir, filename)

    // Write file to disk
    fs.writeFileSync(filePath, file.buffer)

    // Determine file type
    let fileType: FileType
    if (file.mimetype.startsWith("image/")) {
      fileType = FileType.IMAGE
    } else if (file.mimetype.startsWith("video/")) {
      fileType = FileType.VIDEO
    } else {
      fileType = FileType.DOCUMENT
    }

    // Save file record to database
    const fileData: any = {
      originalName: file.originalname,
      filename,
      path: filePath,
      mimetype: file.mimetype,
      size: file.size,
      type: fileType,
    }

    // Associate with entity
    switch (entityType) {
      case "user":
        fileData.userId = userId
        break
      case "profile":
        fileData.profileId = entityId
        break
      case "ad":
        fileData.adId = entityId
        break
    }

    return this.prisma.file.create({
      data: fileData,
    })
  }

  async findAll() {
    return this.prisma.file.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })
  }

  async findByEntity(entityType: "user" | "profile" | "ad", entityId: string) {
    const where: any = {}

    switch (entityType) {
      case "user":
        where.userId = entityId
        break
      case "profile":
        where.profileId = entityId
        break
      case "ad":
        where.adId = entityId
        break
    }

    return this.prisma.file.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })
  }

  async findById(id: string) {
    const file = await this.prisma.file.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!file) {
      throw new NotFoundException("File not found")
    }

    return file
  }

  async downloadFile(id: string) {
    const file = await this.findById(id)

    if (!fs.existsSync(file.path)) {
      throw new NotFoundException("File not found on disk")
    }

    return {
      file,
      buffer: fs.readFileSync(file.path),
    }
  }

  async remove(id: string, userId: string, userRole: Role) {
    const file = await this.findById(id)
    const isAdmin = userRole === Role.ADMIN

    // Check permissions
    if (!isAdmin && file.userId !== userId) {
      throw new ForbiddenException("Access denied")
    }

    // Delete file from disk
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }

    // Delete file record from database
    return this.prisma.file.delete({
      where: { id },
    })
  }
}
