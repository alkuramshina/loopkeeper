import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { ApiCommonErrors } from '../common/swagger/api-errors.decorator';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationResponseDto } from './dto/location-response.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationService } from './location.service';

@ApiTags('Locations')
@ApiBearerAuth('access-token')
@Controller()
export class LocationController {
  constructor(private readonly locations: LocationService) {}

  @ApiOperation({ summary: 'Create a campaign location as its owner' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiCreatedResponse({ type: LocationResponseDto })
  @ApiCommonErrors()
  @Post('campaigns/:campaignId/locations')
  create(
    @Param('campaignId') campaignId: string,
    @Body() createDto: CreateLocationDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.locations.create(request.user.userId, campaignId, createDto);
  }

  @ApiOperation({
    summary: 'List locations available to campaign owners and players',
  })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiOkResponse({ type: LocationResponseDto, isArray: true })
  @ApiCommonErrors({ badRequest: false })
  @Get('campaigns/:campaignId/locations')
  findAll(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.locations.findAll(request.user.userId, campaignId);
  }

  @ApiOperation({
    summary: 'Get a location available to campaign owners and players',
  })
  @ApiParam({ name: 'locationId', format: 'uuid' })
  @ApiOkResponse({ type: LocationResponseDto })
  @ApiCommonErrors({ badRequest: false })
  @Get('locations/:locationId')
  findOne(
    @Param('locationId') locationId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.locations.findOne(request.user.userId, locationId);
  }

  @ApiOperation({ summary: 'Update a campaign location as its owner' })
  @ApiParam({ name: 'locationId', format: 'uuid' })
  @ApiOkResponse({ type: LocationResponseDto })
  @ApiCommonErrors()
  @Patch('locations/:locationId')
  update(
    @Param('locationId') locationId: string,
    @Body() updateDto: UpdateLocationDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.locations.update(request.user.userId, locationId, updateDto);
  }

  @ApiOperation({ summary: 'Delete a campaign location as its owner' })
  @ApiParam({ name: 'locationId', format: 'uuid' })
  @ApiOkResponse({ description: 'Location deleted.' })
  @ApiCommonErrors({ badRequest: false })
  @Delete('locations/:locationId')
  remove(
    @Param('locationId') locationId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.locations.remove(request.user.userId, locationId);
  }
}
