import { Injectable, CanActivate, ExecutionContext, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { SystemRole } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector?.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    this.logger.debug(`🔐 Required Roles: ${JSON.stringify(requiredRoles)}`);

    // اگر هیچ رولی نیاز نیست، اجازه دسترسی داده می‌شود
    if (!requiredRoles) {
      this.logger.debug('No roles required - Access granted');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.debug(`👤 User: ${JSON.stringify({
      id: user?.id,
      mobile: user?.mobile,
      system_role: user?.system_role // تغییر به system_role
    })}`);

    if (!user) {
      this.logger.error('❌ No user found in request');
      return false;
    }

    // ✅ استفاده از system_role به جای role
    const hasRole = requiredRoles.some((role) => user.system_role === role);

    this.logger.debug(`✅ User system_role: ${user.system_role}`);
    this.logger.debug(`✅ Has required role: ${hasRole}`);

    if (!hasRole) {
      this.logger.warn(`🚫 Access denied. User system_role: ${user.system_role}, Required: ${requiredRoles.join(', ')}`);
    }

    return hasRole;
  }
}