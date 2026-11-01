import { ApiProperty } from '@nestjs/swagger';

export class HealthDto {
	@ApiProperty({ example: 'ok', enum: ['ok'] })
	status!: 'ok';

	@ApiProperty({ example: 42, description: 'Process uptime in seconds.' })
	uptime!: number;

	@ApiProperty({ example: '2026-11-01T12:00:00.000Z', format: 'date-time' })
	timestamp!: string;
}
