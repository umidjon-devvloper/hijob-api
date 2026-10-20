import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymeErrorCode } from './payme.errors';
import { PaymeService } from './payme.service';

interface PaymeRpc {
  jsonrpc?: '2.0';
  id: number | string;
  method: string;
  params: any;
}

@ApiTags('payment')
@Controller('payment/payme')
export class PaymeController {
  constructor(private readonly payme: PaymeService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('authorization') auth: string | undefined,
    @Body() body: PaymeRpc,
  ) {
    if (!this.payme.verifyAuth(auth)) {
      return {
        jsonrpc: '2.0',
        id: body?.id ?? 0,
        error: {
          code: PaymeErrorCode.Unauthorized,
          message: {
            ru: 'Неверная авторизация',
            uz: "Noto'g'ri avtorizatsiya",
            en: 'Unauthorized',
          },
        },
      };
    }

    const id = body?.id ?? 0;
    const result = await this.dispatch(body?.method, body?.params);

    if ('error' in result) {
      return { jsonrpc: '2.0', id, error: result.error };
    }
    return { jsonrpc: '2.0', id, result: result.result };
  }

  private async dispatch(method: string, params: any) {
    switch (method) {
      case 'CheckPerformTransaction': {
        const check = await this.payme.checkPerformTransaction(params);
        if ('error' in check) return { error: check.error };
        return { result: { allow: true } };
      }
      case 'CreateTransaction':
        return this.payme.createTransaction(params);
      case 'PerformTransaction':
        return this.payme.performTransaction(params);
      case 'CancelTransaction':
        return this.payme.cancelTransaction(params);
      case 'CheckTransaction':
        return this.payme.checkTransaction(params);
      default:
        return {
          error: {
            code: PaymeErrorCode.MethodNotFound,
            message: {
              ru: `Метод не найден: ${method}`,
              uz: `Metod topilmadi: ${method}`,
              en: `Method not found: ${method}`,
            },
          },
        };
    }
  }
}
