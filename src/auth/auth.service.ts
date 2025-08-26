import { Injectable, UnauthorizedException } from "@nestjs/common"
import  { JwtService } from "@nestjs/jwt"
import  { UserService } from "../user/user.service"
import type { LoginDto } from "./dto/login.dto"
import * as bcrypt from "bcryptjs"
import {RegisterDto} from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email)
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user
      return result
    }
    return null
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password)
    if (!user) {
      throw new UnauthorizedException("Invalid credentials")
    }

    const payload = { email: user.email, sub: user.id, role: user.role }
    return {
      access_token: this.jwtService.sign(payload),
      user,
    }
  }

  async register(registerDto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10)
    const user = await this.userService.create({
      ...registerDto,
      password: hashedPassword,
    })

    const { password, ...result } = user
    const payload = { email: result.email, sub: result.id, role: result.role }

    return {
      access_token: this.jwtService.sign(payload),
      user: result,
    }
  }
}
