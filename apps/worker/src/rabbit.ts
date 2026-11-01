import amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel } from 'amqplib';
import { FRAME_EXCHANGE, type Broker, type FrameStoredEvent } from './broker.js';

export class RabbitBroker implements Broker {
	private constructor(
		private readonly model: ChannelModel,
		private readonly channel: ConfirmChannel,
		private readonly exchange: string
	) {}

	static async connect(url: string, exchange: string): Promise<RabbitBroker> {
		const model = await amqp.connect(url);
		const channel = await model.createConfirmChannel();
		await channel.assertExchange(exchange, 'topic', { durable: true });

		return new RabbitBroker(model, channel, exchange);
	}

	async publish(routingKey: string, payload: FrameStoredEvent): Promise<void> {
		const body = Buffer.from(JSON.stringify(payload));

		await new Promise<void>((resolve, reject) => {
			this.channel.publish(
				this.exchange,
				routingKey,
				body,
				{
					persistent: true,
					contentType: 'application/json',
					type: routingKey,
					messageId: payload.frameId
				},
				(error) => (error ? reject(error) : resolve())
			);
		});
	}

	async close(): Promise<void> {
		await this.channel.close();
		await this.model.close();
	}
}

export async function connectBroker(url: string): Promise<Broker> {
	try {
		return await RabbitBroker.connect(url, FRAME_EXCHANGE);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(
			`RabbitMQ is not reachable at ${url}: ${reason}. Start it with \`pnpm db:start\`.`,
			{ cause: error }
		);
	}
}
