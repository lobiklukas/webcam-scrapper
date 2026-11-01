export interface FrameStoredEvent {
	frameId: string;
	camId: number;
	storageKey: string;
	sha256: string;
	bytes: number;
	contentType: string;
	capturedAt: string;
}

export interface Broker {
	publish(routingKey: string, payload: FrameStoredEvent): Promise<void>;
	close(): Promise<void>;
}

export const FRAME_EXCHANGE = 'frames';
export const FRAME_STORED = 'frame.stored';
