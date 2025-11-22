// src/auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from "passport-jwt"
import { PassportStrategy } from "@nestjs/passport"
import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
      private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
    })
  }

  async validate(payload: any) {
    return {
      user_id: payload.sub,
      id: payload.sub,
      system_role: payload.role || 'USER'
    }
  }
}