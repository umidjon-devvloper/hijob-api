import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser, CurrentUserInfo } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserInfo) {
    return this.notifications.list(user.id);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: CurrentUserInfo) {
    return this.notifications.unreadCount(user.id);
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: CurrentUserInfo) {
    return this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  read(
    @CurrentUser() user: CurrentUserInfo,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }
}
