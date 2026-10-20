import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CatalogFiltersDto } from './dto';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('home')
  getHome() {
    return this.catalog.getHome();
  }

  @Get('stores')
  listStores() {
    return this.catalog.listStores();
  }

  @Get('products')
  listProducts(@Query() filters: CatalogFiltersDto) {
    return this.catalog.listProducts(filters);
  }

  @Get('products/:id')
  getProduct(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalog.getProduct(id);
  }
}
