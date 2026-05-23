export class SimpleFinUserIdDto {
  userId!: string;
}

export class SimpleFinClaimDto extends SimpleFinUserIdDto {
  token!: string;
}

export class SimpleFinSyncDto extends SimpleFinUserIdDto {
  startDate?: number;
  startDateSec?: number;
}
