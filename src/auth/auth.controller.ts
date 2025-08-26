import { Controller, Post } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger"
import  { AuthService } from "./auth.service"
import  { LoginDto } from "./dto/login.dto"
import  { RegisterDto } from "./dto/register.dto"
import { Public } from "../common/decorators/public.decorator"

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @ApiOperation({ summary: "User login" })
  @ApiResponse({ status: 200, description: "Login successful" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(loginDto: LoginDto) {
    return this.authService.login(loginDto)
  }

  @Public()
  @Post("register")
  @ApiOperation({ summary: "User registration" })
  @ApiResponse({ status: 201, description: "Registration successful" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async register(registerDto: RegisterDto) {
    return this.authService.register(registerDto)
  }
}
