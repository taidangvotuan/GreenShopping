import { IsIn } from 'class-validator';
import type { MockPaymentOutcome } from '../payments.service';

export class MockPaymentResultDto {
  @IsIn(['SUCCEEDED', 'FAILED', 'CANCELLED'])
  outcome!: MockPaymentOutcome;
}
