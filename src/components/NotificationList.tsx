import { notifications, removeNotification } from "@/stores/notifications";

export default function NotificationList() {
	return (
		<div class="d-flex flex-column gap-1 notification-list position-fixed end-0 bottom-0 me-1 mb-1">
			{notifications().map(notification => (
				<div class={`alert fade show alert-${notification.type}`} role="alert">
					<div class="d-flex">
						<div class="me-auto" innerHTML={notification.message}></div>
						<button class="btn-close ms-2" onClick={() => removeNotification(notification.id)} aria-label="Close"></button>
					</div>
				</div>
			))}
		</div>
	);
}