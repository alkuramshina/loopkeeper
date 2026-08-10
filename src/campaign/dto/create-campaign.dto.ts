import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class CreateCampaignDto {
  @IsString()
  @MaxLength(100)
  title!: string;

  @IsString()
  @MaxLength(1000)
  description!: string;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;
}
