import {
  IsString,
  IsUUID,
  Matches,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsISO8601,
  IsIn,
  IsEmail,
  MaxLength,
  IsArray,
  ArrayMaxSize,
} from "class-validator";
export class OtpRequest {
  @Matches(/^\+91[6-9]\d{9}$/) phone!: string;
  @IsBoolean() register!: boolean;
}
export class OtpVerify {
  @IsUUID() challengeId!: string;
  @Matches(/^\d{6}$/) code!: string;
}
export class HoldDto {
  @IsUUID() studioId!: string;
  @IsUUID() serviceId!: string;
  @IsISO8601({ strict: true }) startsAt!: string;
  @IsInt() @Min(30) @Max(480) minutes!: number;
  @IsString() @Matches(/^[a-zA-Z0-9_-]{16,100}$/) idempotencyKey!: string;
  @IsOptional() @IsUUID() membershipId?: string;
}
export class IdDto {
  @IsUUID() id!: string;
}
export class CancelDto {
  @IsString() @MaxLength(500) reason!: string;
}
export class SessionCodeDto {
  @IsUUID() bookingId!: string;
  @IsIn(["START", "END"]) purpose!: "START" | "END";
}
export class SessionVerifyDto extends SessionCodeDto {
  @Matches(/^\d{6}$/) code!: string;
}
export class AssignDto {
  @IsUUID() bookingId!: string;
  @IsUUID() staffId!: string;
}
export class SubscribeDto {
  @IsUUID() planId!: string;
  @Matches(/^[a-zA-Z0-9_-]{16,100}$/) idempotencyKey!: string;
}
export class PaymentVerifyDto {
  @IsString() @MaxLength(100) razorpay_order_id!: string;
  @IsString() @MaxLength(100) razorpay_payment_id!: string;
  @Matches(/^[a-f0-9]{64}$/) razorpay_signature!: string;
}
export class ProfileDto {
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsEmail() email?: string;
}
export class ReviewDto {
  @IsUUID() bookingId!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @MaxLength(2000) text!: string;
}
export class ExceptionDto extends CancelDto {
  @IsIn(["IN_PROGRESS", "COMPLETED"]) status!: "IN_PROGRESS" | "COMPLETED";
}
export class BlockDto {
  @IsUUID() studioId!: string;
  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;
  @IsString() @MaxLength(500) reason!: string;
}
export class PriceDto {
  @IsInt() @Min(100) @Max(100000000) hourlyPaise!: number;
  @IsInt() @Min(0) @Max(10000) taxBps!: number;
}
export class PlanDto {
  @IsString() @MaxLength(100) name!: string;
  @IsString() @MaxLength(500) description!: string;
  @IsInt() @Min(100) @Max(100000000) pricePaise!: number;
  @IsInt() @Min(1) @Max(730) days!: number;
  @IsInt() @Min(0) @Max(10000) discountBps!: number;
  @IsInt() @Min(0) @Max(10000) creditMinutes!: number;
  @IsInt() @Min(1) @Max(1000) maxBookings!: number;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) benefits!: string[];
  @IsBoolean() active!: boolean;
}
export class UploadDto {
  @IsIn(["image/jpeg", "image/png", "image/webp", "image/avif"])
  contentType!: string;
  @IsInt() @Min(1) @Max(10485760) size!: number;
}
export class StudioDto {
  @IsString() @Matches(/^[a-z0-9-]{3,80}$/) slug!: string;
  @IsUUID() categoryId!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(5000) description!: string;
  @IsString() @MaxLength(200) location!: string;
  @IsInt() @Min(1) @Max(500) capacity!: number;
  @IsInt() @Min(0) @Max(120) bufferMinutes!: number;
  @IsArray() @IsString({ each: true }) equipment!: string[];
  @IsBoolean() active!: boolean;
}

export class RescheduleDto {
  @IsISO8601({ strict: true }) startsAt!: string;
}

export class StaffRoleDto {
  @IsUUID() userId!: string;
  @IsIn(["STAFF", "CUSTOMER"]) role!: "STAFF" | "CUSTOMER";
  @IsBoolean() enabled!: boolean;
  @IsString() @MaxLength(100) title!: string;
}
export class HoursDto {
  @IsInt() @Min(0) @Max(6) weekday!: number;
  @IsInt() @Min(0) @Max(1439) openMinute!: number;
  @IsInt() @Min(1) @Max(1440) closeMinute!: number;
}
export class MediaPublishDto {
  @IsUUID() studioId!: string;
  @Matches(/^quarantine\/[a-f0-9-]{36}$/) key!: string;
  @IsString() @MaxLength(300) alt!: string;
}
export class SettingDto {
  @IsString() @MaxLength(20000) json!: string;
}
export class ServiceDto {
  @IsUUID() studioId!: string;
  @IsString() @MaxLength(100) name!: string;
  @IsInt() @Min(100) @Max(100000000) hourlyPaise!: number;
  @IsInt() @Min(0) @Max(10000) taxBps!: number;
  @IsInt() @Min(30) @Max(480) minMinutes!: number;
  @IsInt() @Min(30) @Max(480) maxMinutes!: number;
  @IsInt() @IsIn([15, 30, 60]) stepMinutes!: number;
  @IsBoolean() active!: boolean;
}

export class CategoryDto {
  @Matches(/^[a-z0-9-]{3,80}$/) slug!: string;
  @IsString() @MaxLength(80) name!: string;
  @IsString() @MaxLength(500) description!: string;
  @Matches(/^(\/images\/[^\s]+|https:\/\/[^\s]+)$/) image!: string;
}
export class FacilitiesDto {
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) names!: string[];
}
