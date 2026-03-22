/**
 * Notification Subscription Component
 * Renders a button to subscribe/unsubscribe from push notifications
 */

export function renderNotificationButton(onSubscribe, onUnsubscribe) {
  const button = document.createElement('button');
  button.id = 'btn-notifications';
  button.className = 'btn-secondary notification-btn';
  button.title = 'Подписаться на уведомления о новостях';
  
  // Check initial subscription status
  updateNotificationButton(button, onSubscribe, onUnsubscribe);
  
  // Listen for permission changes
  if ('Notification' in window) {
    // Update button when permission changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        updateNotificationButton(button, onSubscribe, onUnsubscribe);
      }
    });
  }
  
  return button;
}

function updateNotificationButton(button, onSubscribe, onUnsubscribe) {
  const isSubscribed = 'Notification' in window && Notification.permission === 'granted';
  
  if (isSubscribed) {
    button.innerHTML = '🔔 Включены';
    button.classList.add('subscribed');
    button.onclick = async (e) => {
      e.preventDefault();
      const confirmed = confirm('Вы уверены, что хотите отписаться от уведомлений?');
      if (confirmed && onUnsubscribe) {
        await onUnsubscribe();
      }
    };
  } else if ('Notification' in window && Notification.permission === 'denied') {
    button.innerHTML = '🔕 Заблокировано';
    button.classList.add('blocked');
    button.title = 'Уведомления заблокированы в браузере';
    button.disabled = true;
  } else {
    button.innerHTML = '🔔 Включить';
    button.classList.remove('subscribed', 'blocked');
    button.disabled = false;
    button.onclick = async (e) => {
      e.preventDefault();
      if (onSubscribe) {
        await onSubscribe();
      }
      // Update button after subscription attempt
      setTimeout(() => {
        updateNotificationButton(button, onSubscribe, onUnsubscribe);
      }, 500);
    };
  }
}

/**
 * Update notification button state
 * @param {Element} button - Button element
 * @param {Function} onSubscribe - Callback on subscribe
 * @param {Function} onUnsubscribe - Callback on unsubscribe
 */
export function updateNotificationButtonState(button, onSubscribe, onUnsubscribe) {
  if (!button) return;
  updateNotificationButton(button, onSubscribe, onUnsubscribe);
}

