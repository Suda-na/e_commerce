import { NotificationService } from './notification.service';

let notificationServiceInstance: NotificationService | null = null;

export function setNotificationService(service: NotificationService): void {
  notificationServiceInstance = service;
}

export function getNotificationService(): NotificationService | null {
  return notificationServiceInstance;
}
