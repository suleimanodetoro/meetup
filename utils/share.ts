// utils/share.ts
// Shareable links for sidequests + profiles.
//
// Links are https universal links to usewaypoint.app using the REAL in-app route
// paths (/event/<id>, /profile/<userId>), so they resolve directly to the right
// screen once universal links are wired up (see TODO.md "Sharing / universal links").
// A recipient without the app hits the web fallback; the app's auth gate then
// captures the target and lands them on it after they sign up (deferred deep link
// in app/_layout.tsx).
import { Platform, Share } from 'react-native';

const WEB_BASE = 'https://usewaypoint.app';

export type ShareKind = 'event' | 'profile';

export function buildShareUrl(kind: ShareKind, id: string | number): string {
  const path = kind === 'event' ? `/event/${id}` : `/profile/${id}`;
  return `${WEB_BASE}${path}`;
}

/**
 * Open the native share sheet for a sidequest or profile. Silently no-ops if the
 * user cancels or sharing is unavailable.
 */
export async function shareContent(
  kind: ShareKind,
  id: string | number,
  title?: string | null
): Promise<void> {
  const url = buildShareUrl(kind, id);
  const message =
    kind === 'event'
      ? `Join me on this sidequest${title ? `: ${title}` : ''}\n${url}`
      : `${title ? `${title} on Waypoint` : 'Check out this profile on Waypoint'}\n${url}`;
  try {
    // iOS surfaces `url` as a first-class attachment; Android folds it into the message.
    await Share.share(Platform.OS === 'ios' ? { url, message } : { message });
  } catch {
    // cancelled / unavailable — no-op
  }
}
