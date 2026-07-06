import { createStore, produce } from "solid-js/store";
import type { UUID } from "crypto";

export type Notification = {
	id: UUID;
	type: "success" | "info" | "warning" | "danger";
	timeStamp: number;
	message: string;
	removeTimer?: ReturnType<typeof setTimeout>;
};
export type NotificationList = Array<Notification>;

const maxNotifications = 5;
const [store, setStore] = createStore<NotificationList>([]);
export const notifications = () => store;

function createNotification(type: Notification["type"], message: string) {
	const notification: Notification = {
		id: crypto.randomUUID() as UUID,
		type,
		timeStamp: Date.now(),
		message
	};
	if (type !== "danger") {
		notification.removeTimer = setTimeout(() => {
			deleteNotification(notification.id);
		}, 5000);
	}
	if (store.length >= maxNotifications) {
		deleteNotification(store[0]!.id);
	}
	setStore(store.concat([notification]));
}

function deleteNotification(id: UUID) {
	const index = store.findIndex(n => n.id === id);
	if (index !== -1) {
		clearTimeout(store[index]!.removeTimer);
		setStore(
			produce(store => {
				store.splice(index, 1);
			})
		);
	}
}

export function addNotification(type: Notification["type"], message: string) {
	const existingNotification = store.find(n => n.message === message && n.type === type);
	if (!existingNotification) {
		createNotification(type, message);
		return;
	}
	deleteNotification(existingNotification.id);
	setTimeout(() => createNotification(type, message), 250);
}

export function removeNotification(id: UUID) {
	deleteNotification(id);
}