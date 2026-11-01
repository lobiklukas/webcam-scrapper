import { relations } from 'drizzle-orm';
import { frame, pollAttempt } from './frames.js';
import { cam, location } from './webcams.js';

export const locationRelations = relations(location, ({ many }) => ({
	cam: many(cam)
}));

export const camRelations = relations(cam, ({ one, many }) => ({
	location: one(location, { fields: [cam.locationId], references: [location.id] }),
	frame: many(frame),
	pollAttempt: many(pollAttempt)
}));

export const frameRelations = relations(frame, ({ one }) => ({
	cam: one(cam, { fields: [frame.camId], references: [cam.id] })
}));

export const pollAttemptRelations = relations(pollAttempt, ({ one }) => ({
	cam: one(cam, { fields: [pollAttempt.camId], references: [cam.id] })
}));
