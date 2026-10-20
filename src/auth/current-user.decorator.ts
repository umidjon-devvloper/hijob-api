import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserInfo {
  id: string;
  username: string;
  role: string;
  phone: string;
  fullName: string | null;
  language: string;
  onboardingFaceDone: boolean;
  onboardingBodyDone: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserInfo => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
